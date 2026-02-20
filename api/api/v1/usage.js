import express from 'express';
import { getDb } from '../../../lib/engine/db.js';
import { v4 as uuidv4 } from 'uuid';
import { TokenTalosPrompt } from '../../../lib/engine/parameterizer.js';
import { getCostCalculator } from '../../../lib/engine/pricing.js';
import { processPromptParts } from '../../../lib/engine/processor.js';
import { detectPII } from '../../../lib/engine/pii_detector.js';
import { getLLMGateway } from '../../../lib/engine/llm_clients.js';
import { TokenTalosEngine } from '../../../lib/engine/index.js';
import { authMiddleware } from '../../middleware/auth.js';

const router = express.Router();
let config = {};

export function setConfig(c) {
  config = c;
}

// POST /api/v1/usage/ingest - Ingest usage data from external sources
router.post('/ingest', authMiddleware, async (req, res) => {
  const db = getDb();
  const data = req.body;
  const usageId = uuidv4();
  const projectId = data.projectId || 'default';
  const orgId = req.orgId;

  const provider = data.provider || config.llmProvider || 'gemini';
  const model = data.model || config.defaultModel || 'gemini-3-flash-preview';

  const totalTokens = (data.input_tokens || 0) + (data.output_tokens || 0);
  const calculator = getCostCalculator();
  const [inputCost, outputCost] = calculator.calculateCost(
    provider,
    model,
    data.input_tokens || 0,
    data.output_tokens || 0
  );

  const totalCost = inputCost + outputCost;
  const limitExceeded = totalTokens > (config.maxTokens || 32000);

  try {
    await db.run(`
      INSERT INTO usage_data (
        id, org_id, project_id, type, provider, model, full_prompt, response_content, input_tokens, output_tokens, total_tokens, 
        input_cost, output_cost, total_cost, endpoint, latency_ms, token_limit_exceeded, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      usageId, orgId, projectId, 'ingested', provider, model, data.full_prompt || null, data.response_content || null,
      data.input_tokens || 0, data.output_tokens || 0,
      totalTokens, inputCost, outputCost, totalCost, data.endpoint, data.latency_ms,
      limitExceeded ? 1 : 0, data.timestamp || new Date().toISOString()
    ]);

    if (data.variables && Array.isArray(data.variables)) {
      for (const v of data.variables) {
        await db.run(`
          INSERT INTO prompt_variables (usage_id, name, content, original_content, token_count, char_count, position)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          usageId,
          v.name,
          v.content || '',
          v.original_content || v.content || '',
          v.token_count || 0,
          v.char_count || 0,
          v.position || 0
        ]);

        if (config.formattingFeatures && config.formattingFeatures.includes('pii')) {
          const findings = detectPII(v.content);
          if (findings.length > 0) {
            for (const finding of findings) {
              await db.run(`
                INSERT INTO pii_hits (usage_id, variable_name, pii_type, action_taken)
                VALUES (?, ?, ?, ?)
              `, [usageId, v.name, finding.type, 'ingested_warning']);
            }
          }
        }
      }
    }

    if (data.actions_taken && Array.isArray(data.actions_taken)) {
      for (const action of data.actions_taken) {
        await db.run(`
          INSERT INTO variable_actions (usage_id, variable_name, action_type, action_method, details)
          VALUES (?, ?, ?, ?, ?)
        `, [
          usageId,
          action.target,
          action.type,
          action.method || null,
          JSON.stringify(action)
        ]);
      }
    }

    res.status(201).json({ id: usageId, message: 'Usage data ingested successfully' });
  } catch (err) {
    console.error('Ingestion error:', err);
    res.status(500).json({ error: 'Failed to ingest usage data' });
  }
});

// GET /api/v1/usage/recent - Get recent usage records
router.get('/recent', authMiddleware, async (req, res) => {
  const db = getDb();
  const limit = req.query.limit || 50;
  const projectId = req.query.projectId;
  const orgId = req.orgId;

  try {
    let sql = 'SELECT * FROM usage_data WHERE org_id = ?';
    let params = [orgId];

    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(parseInt(limit));

    const usageRecords = await db.all(sql, params);

    for (const record of usageRecords) {
      record.variables = await db.all(`
        SELECT name, content, original_content, token_count, char_count, position 
        FROM prompt_variables 
        WHERE usage_id = ?
      `, [record.id]);

      record.explain_plan = await db.get(`
        SELECT * FROM explain_plans WHERE usage_id = ?
      `, [record.id]);

      if (record.explain_plan) {
        if (record.explain_plan.variable_analysis) record.explain_plan.variable_analysis = JSON.parse(record.explain_plan.variable_analysis);
        if (record.explain_plan.detected_issues) record.explain_plan.detected_issues = JSON.parse(record.explain_plan.detected_issues);
        if (record.explain_plan.optimization_suggestions) record.explain_plan.optimization_suggestions = JSON.parse(record.explain_plan.optimization_suggestions);
        if (record.explain_plan.mce_alternatives && typeof record.explain_plan.mce_alternatives === 'string') {
          record.explain_plan.mce_alternatives = JSON.parse(record.explain_plan.mce_alternatives);
        }

        // On-the-fly MCE calculation if missing from DB (for existing records)
        if (!record.explain_plan.mce_best_alternative_model || !record.explain_plan.mce_alternatives) {
          const calculator = getCostCalculator();
          const bestAlt = calculator.getBestAlternative(record.provider, record.model, record.input_tokens, record.output_tokens);
          const allAlts = calculator.getAllAlternatives(record.provider, record.model, record.input_tokens, record.output_tokens);

          record.explain_plan.mce_alternatives = allAlts;

          if (bestAlt) {
            // Use calculated cost from tokens (record.total_cost may be 0 for passively ingested records)
            const [calcInput, calcOutput] = calculator.calculateCost(record.provider, record.model, record.input_tokens, record.output_tokens);
            const currentCost = (calcInput + calcOutput) > 0 ? (calcInput + calcOutput) : (record.total_cost || 0);
            const savingsPct = currentCost > 0 ? ((currentCost - bestAlt.cost) / currentCost) * 100 : 0;
            if (savingsPct > 10) {
              record.explain_plan.mce_best_alternative_model = bestAlt.model;
              record.explain_plan.mce_best_alternative_provider = bestAlt.provider;
              record.explain_plan.mce_best_alternative_cost = bestAlt.cost;
              record.explain_plan.mce_savings_pct = savingsPct;
            }
          }
        }
      }
    }

    res.json(usageRecords);
  } catch (err) {
    console.error('Recent usage error:', err);
    res.status(500).json({ error: 'Failed to fetch recent usage' });
  }
});

// POST /api/v1/usage/execute - Gateway execution
router.post('/execute', authMiddleware, async (req, res) => {
  try {
    const engine = new TokenTalosEngine(config);
    await engine.init();

    const result = await engine.execute({
      ...req.body,
      orgId: req.orgId,
      projectId: req.body.projectId || req.query.projectId,
      bypassCache: req.query.bypassCache === 'true'
    });

    res.json(result);
  } catch (err) {
    console.error('Execution error:', err);
    res.status(500).json({ error: 'Failed to execute prompt', details: err.message });
  }
});

// POST /api/v1/usage/prompt/construct - Active orchestration
router.post('/prompt/construct', authMiddleware, async (req, res) => {
  const { provider, model, parts, endpoint, projectId } = req.body;
  const orgId = req.orgId;

  const { processedParts, metadata } = await processPromptParts(parts, config);

  const finalProvider = provider || config.llmProvider || 'gemini';
  const finalModel = model || config.defaultModel || 'gemini-3-flash-preview';

  const prompt = new TokenTalosPrompt(finalProvider, finalModel);

  for (const key in processedParts) {
    if (key === 'system') prompt.addSystem(processedParts[key], parts[key]);
    else if (key === 'context') prompt.addContext(processedParts[key], parts[key]);
    else if (key === 'history') prompt.addHistory(processedParts[key], parts[key]);
    else if (key === 'user_query') prompt.addUserQuery(processedParts[key], parts[key]);
    else prompt.add(key, processedParts[key], parts[key]);
  }

  const messages = prompt.toMessages();
  const trackingData = prompt.getTrackingData();

  const maxTokens = config.maxTokens || 32000;
  const thresholdAction = config.thresholdAction || 'warning';

  if (trackingData.total_tokens > maxTokens && thresholdAction === 'reject') {
    return res.status(400).json({
      error: 'Token limit exceeded',
      total_tokens: trackingData.total_tokens,
      max_tokens: maxTokens,
      message: 'Construction rejected by policy. Truncate parts or increase limit in setup.'
    });
  }

  const db = getDb();
  const calculator = getCostCalculator();
  const [inputCost] = calculator.calculateCost(finalProvider, finalModel, trackingData.total_tokens, 0);

  const limitExceeded = trackingData.total_tokens > maxTokens;
  const finalProjectId = projectId || 'default';

  try {
    await db.run(`
      INSERT INTO usage_data (id, org_id, project_id, type, provider, model, input_tokens, total_tokens, input_cost, total_cost, endpoint, token_limit_exceeded, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trackingData.id, orgId, finalProjectId, 'construction', finalProvider, finalModel, trackingData.total_tokens, trackingData.total_tokens,
      inputCost, inputCost, endpoint, limitExceeded ? 1 : 0, trackingData.timestamp
    ]);

    for (const v of trackingData.variables) {
      await db.run(`
        INSERT INTO prompt_variables (usage_id, name, content, original_content, token_count, char_count, position)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [trackingData.id, v.name, v.content, v.original_content, v.token_count, v.char_count, v.position]);
    }

    for (const action of metadata.actions_taken) {
      // ... same generic action log ...
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

      // 2. Legacy PII hit log (for backward compat/dashboards)
      if (action.type === 'pii') {
        for (const finding of action.findings) {
          await db.run(`
            INSERT INTO pii_hits (usage_id, variable_name, pii_type, action_taken)
            VALUES (?, ?, ?, ?)
          `, [trackingData.id, action.target, finding.type, action.method]);
        }
      }
    }

    // 3. Heuristic Analysis
    const analysis = runHeuristicAnalysis({
      total_tokens: trackingData.total_tokens,
      total_cost: inputCost,
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

    res.json({
      id: trackingData.id,
      messages: messages,
      full_prompt_string: prompt.toString(),
      total_tokens: trackingData.total_tokens,
      estimated_input_cost: inputCost,
      token_limit_exceeded: limitExceeded,
      max_tokens: maxTokens,
      threshold_action: thresholdAction,
      checks_run: metadata.checks_run,
      actions_taken: metadata.actions_taken
    });
  } catch (err) {
    console.error('Construction error:', err);
    res.status(500).json({ error: 'Failed to construct prompt' });
  }
});

export default router;
