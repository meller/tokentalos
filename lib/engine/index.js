import { initDb, getDb } from './db.js';
import { processPromptParts } from './processor.js';
import { TokenTalosPrompt } from './parameterizer.js';
import { getCostCalculator } from './pricing.js';
import { getLLMGateway } from './llm_clients.js';
import { PromptCache } from './cache.js';
import { OPVService } from './opv.js';
import { runHeuristicAnalysis } from './analyzer.js';
import { v4 as uuidv4 } from 'uuid';

export class TokenTalosEngine {
  constructor(config = {}) {
    this.config = {
      formattingFeatures: ['pii', 'neutralize'],
      intelligenceFeatures: ['cache', 'explain'],
      securityFeatures: ['injection', 'secrets'],
      securityAction: 'warn',
      piiAction: 'mask',
      ...config
    };
    this.managedMode = this.config.managedMode || false;
    this.orgId = this.config.orgId || 'default_org';
    this.projectId = this.config.projectId || 'default';
    this.db = null;
    this.cache = null;
    this.opv = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    // Default to SQLite if not specified
    const dbConfig = {
      databaseType: this.config.databaseType || 'sqlite',
      sqlitePath: this.config.sqlitePath || ':memory:',
      ...this.config
    };

    this.db = await initDb(dbConfig);

    // Create default org if it doesn't exist
    await this.ensureDefaultOrg();

    this.cache = new PromptCache(getDb());
    this.opv = new OPVService(this.config, getLLMGateway(this.config));
    this.initialized = true;
  }

  async ensureDefaultOrg() {
    const db = getDb();
    try {
      // 1. Ensure Default Organization
      await db.run('INSERT INTO organizations (id, name) VALUES (?, ?) ON CONFLICT DO NOTHING', ['default_org', 'Default Organization']);

      // 2. Ensure Default User (for local mode)
      await db.run('INSERT INTO users (id, email, name) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', ['local_user', 'dev@tokentalos.local', 'Local Developer']);

      // 3. Ensure Membership
      await db.run('INSERT INTO organization_members (org_id, user_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', ['default_org', 'local_user', 'admin']);
    } catch (e) {
      // Ignore if schema not ready or unique constraint (for non-ID on conflict)
    }
  }

  async validateApiKey(key) {
    if (!key) return null;
    const db = this.getDb();
    // In a real system, we'd hash the key here before lookup
    const keyRecord = await db.get('SELECT org_id FROM api_keys WHERE key_hash = ?', [key]);
    return keyRecord ? keyRecord.org_id : null;
  }
  async verifyReasoning(params) {
    if (!this.initialized) await this.init();
    return await this.opv.verifyReasoning(params);
  }

  getDb() {
    if (!this.initialized) throw new Error('TokenTalos Engine not initialized. Call init() first.');
    return getDb();
  }

  async process(parts) {
    return processPromptParts(parts, this.config);
  }

  createPrompt(provider, model) {
    const finalProvider = provider || this.config.llmProvider || 'gemini';
    const finalModel = model || this.config.defaultModel || 'gemini-3-flash-preview';
    return new TokenTalosPrompt(finalProvider, finalModel);
  }

  async execute(params) {
    if (!this.initialized) await this.init();
    const { provider, model, parts, endpoint, options = {}, bypassCache = false, orgId, projectId } = params;
    const startTime = Date.now();

    const finalOrgId = orgId || this.orgId;
    const finalProjectId = projectId || this.projectId;

    // 1. Process Parts
    const { processedParts, metadata } = await this.process(parts);

    const finalProvider = provider || this.config.llmProvider || 'gemini';
    const finalModel = model || this.config.defaultModel || 'gemini-3-flash-preview';

    const prompt = this.createPrompt(finalProvider, finalModel);

    // Add processed parts to the prompt
    for (const key in processedParts) {
      if (key === 'system') prompt.addSystem(processedParts[key], parts[key]);
      else if (key === 'context') prompt.addContext(processedParts[key], parts[key]);
      else if (key === 'history') prompt.addHistory(processedParts[key], parts[key]);
      else if (key === 'user_query') prompt.addUserQuery(processedParts[key], parts[key]);
      else prompt.add(key, processedParts[key], parts[key]);
    }

    const fullPromptString = prompt.toString();
    const promptHash = this.cache.generateHash(fullPromptString);

    // Track compression savings
    const compressionAction = metadata.actions_taken.find(a => a.type === 'compress');
    const savedChars = compressionAction?.saved_chars || 0;
    const savedTokens = Math.ceil(savedChars / 4); // Heuristic
    const calculator = getCostCalculator();
    const [savedCompressionCost] = calculator.calculateCost(finalProvider, finalModel, savedTokens, 0);

    // 2. Cache Check
    if (!bypassCache && this.config.intelligenceFeatures?.includes('cache')) {
      const cached = await this.cache.get(promptHash);
      if (cached) {
        // Log the cache hit as a usage event with 0 cost but record saved tokens
        const hitId = uuidv4();
        const db = this.getDb();

        // Calculate what it WOULD have cost
        const [savedInputCost] = calculator.calculateCost(finalProvider, finalModel, prompt.getTrackingData().total_tokens, 0);
        const trackingData = prompt.getTrackingData();

        await db.run(`
          INSERT INTO usage_data (id, org_id, project_id, type, provider, model, full_prompt, response_content, input_tokens, total_tokens, saved_tokens, saved_cost, input_cost, total_cost, endpoint, latency_ms, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          hitId, finalOrgId, finalProjectId, 'cache_hit', finalProvider, finalModel, fullPromptString, cached.response_content, 0, 0,
          prompt.getTrackingData().total_tokens, savedInputCost, 0, 0, endpoint, Date.now() - startTime, trackingData.timestamp
        ]);

        for (const v of trackingData.variables) {
          await db.run(`
            INSERT INTO prompt_variables (usage_id, name, content, original_content, token_count, char_count, position)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [hitId, v.name, v.content, v.original_content, v.token_count, v.char_count, v.position]);
        }

        for (const action of metadata.actions_taken) {
          await db.run(`
            INSERT INTO variable_actions (usage_id, variable_name, action_type, action_method, details)
            VALUES (?, ?, ?, ?, ?)
          `, [
            hitId,
            action.target,
            action.type,
            action.method || null,
            JSON.stringify(action)
          ]);
        }

        return {
          id: cached.usage_id,
          content: cached.response_content,
          cached: true,
          saved_tokens: prompt.getTrackingData().total_tokens,
          saved_cost: savedInputCost,
          metadata: { ...metadata, latency_ms: Date.now() - startTime }
        };
      }
    }

    const gateway = getLLMGateway(this.config);
    const messages = prompt.toMessages();
    const result = await gateway.execute(finalProvider, finalModel, messages, {
      ...options,
      gcpProjectId: params.gcpProjectId || options.gcpProjectId
    });
    const latencyMs = Date.now() - startTime;

    // 4. Persistence
    const trackingData = prompt.getTrackingData();
    const [inputCost, outputCost] = calculator.calculateCost(
      finalProvider, finalModel, result.input_tokens, result.output_tokens
    );

    const db = this.getDb();
    const limitExceeded = (result.input_tokens + result.output_tokens) > (this.config.maxTokens || 32000);

    await db.run(`
      INSERT INTO usage_data (id, org_id, project_id, type, provider, model, full_prompt, response_content, input_tokens, output_tokens, total_tokens, saved_tokens, saved_cost, input_cost, output_cost, total_cost, endpoint, latency_ms, token_limit_exceeded, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trackingData.id, finalOrgId, finalProjectId, 'execution', finalProvider, finalModel, fullPromptString, result.content, result.input_tokens, result.output_tokens,
      result.input_tokens + result.output_tokens, savedTokens, savedCompressionCost, inputCost, outputCost, inputCost + outputCost,
      endpoint, latencyMs, limitExceeded ? 1 : 0, trackingData.timestamp
    ]);

    for (const v of trackingData.variables) {
      await db.run(`
        INSERT INTO prompt_variables (usage_id, name, content, original_content, token_count, char_count, position)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [trackingData.id, v.name, v.content, v.original_content, v.token_count, v.char_count, v.position]);
    }

    for (const action of metadata.actions_taken) {
      await db.run(`
        INSERT INTO variable_actions (usage_id, variable_name, action_type, action_method, details)
        VALUES (?, ?, ?, ?, ?)
      `, [
        trackingData.id,
        action.target,
        action.type,
        action.method || null,
        JSON.stringify(action)
      ]);
    }

    // Persist Security Alerts
    for (const finding of (metadata.security_findings || [])) {
      await db.run(`
        INSERT INTO security_alerts (usage_id, type, description, severity, action_taken)
        VALUES (?, ?, ?, ?, ?)
      `, [
        trackingData.id,
        finding.type,
        finding.description,
        finding.severity,
        this.config.securityAction || 'warn'
      ]);
    }

    // 5. Heuristic Analysis
    const analysis = runHeuristicAnalysis({
      total_tokens: result.input_tokens + result.output_tokens,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      total_cost: inputCost + outputCost,
      provider: finalProvider,
      model: finalModel
    }, trackingData.variables);
    if (analysis) {
      const planId = uuidv4();
      await db.run(`
        INSERT INTO explain_plans (
          id, usage_id, variable_analysis, detected_issues, optimization_suggestions, 
          estimated_savings_pct, estimated_savings_usd,
          mce_best_alternative_model, mce_best_alternative_provider, mce_best_alternative_cost, mce_savings_pct, mce_alternatives
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        planId,
        trackingData.id,
        JSON.stringify(analysis.variable_analysis),
        JSON.stringify(analysis.detected_issues),
        JSON.stringify(analysis.optimization_suggestions),
        analysis.estimated_savings_pct,
        analysis.estimated_savings_usd,
        analysis.mce_best_alternative_model || null,
        analysis.mce_best_alternative_provider || null,
        analysis.mce_best_alternative_cost || 0,
        analysis.mce_savings_pct || 0,
        analysis.mce_alternatives ? JSON.stringify(analysis.mce_alternatives) : null
      ]);
    }

    // Save to Cache
    await this.cache.set(promptHash, result.content, trackingData.id);

    return {
      id: trackingData.id,
      content: result.content,
      cached: false,
      usage: {
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        cost_usd: inputCost + outputCost
      },
      metadata: { ...metadata, latency_ms: latencyMs }
    };
  }

  async ingest(data) {
    const db = this.getDb();
    const usageId = uuidv4();
    const provider = data.provider || this.config.llmProvider || 'gemini';
    const model = data.model || this.config.defaultModel || 'gemini-3-flash-preview';

    const totalTokens = (data.input_tokens || 0) + (data.output_tokens || 0);
    const calculator = getCostCalculator();
    const [inputCost, outputCost] = calculator.calculateCost(
      provider,
      model,
      data.input_tokens || 0,
      data.output_tokens || 0
    );

    const totalCost = inputCost + outputCost;
    const limitExceeded = totalTokens > (this.config.maxTokens || 32000);
    const finalProjectId = data.projectId || this.projectId;
    const finalOrgId = data.orgId || this.orgId;

    await db.run(`
      INSERT INTO usage_data (
        id, org_id, project_id, provider, model, input_tokens, output_tokens, total_tokens, 
        input_cost, output_cost, total_cost, endpoint, latency_ms, token_limit_exceeded, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      usageId, finalOrgId, finalProjectId, provider, model, data.input_tokens || 0, data.output_tokens || 0,
      totalTokens, inputCost, outputCost, totalCost, data.endpoint, data.latency_ms,
      limitExceeded, data.timestamp || new Date().toISOString()
    ]);

    // Handle variables if present...
    // (We will migrate the full ingestion logic here)

    return { id: usageId, totalCost };
  }
}
