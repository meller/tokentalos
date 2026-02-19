import { TokenTalosEngine } from './lib/engine/index.js';
import { TokenTalosPrompt } from './lib/engine/parameterizer.js';
import axios from 'axios';

/**
 * TokenTalos Client SDK
 * 
 * Supports both Standalone (direct DB) and Proxy (HTTP) modes.
 */
export class TokenTalos {
  /**
   * @param {Object} options
   * @param {string} [options.mode='standalone'] - 'standalone' or 'proxy'
   * @param {string} [options.apiUrl] - Base URL for proxy mode
   * @param {Object} [options.config] - TokenTalos configuration for standalone mode
   */
  constructor(options = {}) {
    this.mode = options.mode || 'standalone';
    this.apiUrl = options.apiUrl || 'http://localhost:8060/api/v1';
    this.reportUrl = options.reportUrl || options.apiUrl || null; // URL to report usage to if in standalone
    this.projectId = options.projectId || 'default';
    this.apiKey = options.apiKey || null;
    
    if (this.mode === 'standalone') {
      this.engine = new TokenTalosEngine({ 
        ...options.config, 
        projectId: this.projectId 
      });
    }
  }

  /**
   * Internal helper for reporting to collector
   */
  async _report(usageId, result, params) {
    if (!this.reportUrl || this.mode === 'proxy') return;

    try {
      // Re-map engine result to ingestion format
      const reportData = {
        id: usageId,
        projectId: this.projectId,
        provider: params.provider,
        model: params.model,
        full_prompt: result.full_prompt_string || result.full_prompt || null,
        response_content: result.content || null,
        input_tokens: result.usage?.input_tokens || result.input_tokens || 0,
        output_tokens: result.usage?.output_tokens || result.output_tokens || 0,
        latency_ms: result.metadata?.latency_ms || 0,
        endpoint: params.endpoint || 'sdk_standalone',
        variables: result.variables || [],
        actions_taken: result.metadata?.actions_taken || [],
        timestamp: new Date().toISOString()
      };

      await axios.post(`${this.reportUrl}/usage/ingest`, reportData, { 
        headers: this._getHeaders() 
      });
    } catch (err) {
      console.warn('[TokenTalos] Failed to report usage to collector:', err.message);
    }
  }

  async init() {
    if (this.mode === 'standalone') {
      await this.engine.init();
    }
  }

  /**
   * Construct and process a prompt without executing
   */
  async construct(params) {
    if (this.mode === 'standalone') {
      const { processedParts, metadata } = await this.engine.process(params.parts);
      const prompt = this.engine.createPrompt(params.provider, params.model);
      
      for (const key in processedParts) {
        if (key === 'system') prompt.addSystem(processedParts[key], params.parts[key]);
        else if (key === 'context') prompt.addContext(processedParts[key], params.parts[key]);
        else if (key === 'history') prompt.addHistory(processedParts[key], params.parts[key]);
        else if (key === 'user_query') prompt.addUserQuery(processedParts[key], params.parts[key]);
        else prompt.add(key, processedParts[key], params.parts[key]);
      }

      const trackingData = prompt.getTrackingData();
      const result = {
        id: trackingData.id,
        messages: prompt.toMessages(),
        full_prompt_string: prompt.toString(),
        metadata,
        variables: trackingData.variables
      };

      // Construction is "passive" ingestion - we report the intent
      await this._report(trackingData.id, { ...result, input_tokens: trackingData.total_tokens }, params);

      return result;
    } else {
      const { data } = await axios.post(`${this.apiUrl}/usage/prompt/construct`, {
        projectId: this.projectId,
        ...params
      }, { headers: this._getHeaders() });
      return data;
    }
  }

  /**
   * Execute a prompt through the Gateway
   */
  async execute(params) {
    if (this.mode === 'standalone') {
      const result = await this.engine.execute({
        projectId: this.projectId,
        ...params
      });

      // Report execution result
      await this._report(result.id, result, params);

      return result;
    } else {
      const { data } = await axios.post(`${this.apiUrl}/usage/prompt/execute`, {
        projectId: this.projectId,
        ...params
      }, { headers: this._getHeaders() });
      return data;
    }
  }

  /**
   * Verify reasoning chunks (OPV)
   */
  async verifyReasoning(params) {
    if (this.mode === 'standalone') {
      return await this.engine.verifyReasoning({
        projectId: this.projectId,
        ...params
      });
    } else {
      const { data } = await axios.post(`${this.apiUrl}/opv/heartbeat`, {
        projectId: this.projectId,
        ...params
      }, { headers: this._getHeaders() });
      return data;
    }
  }
}

export { TokenTalosPrompt };
export default TokenTalos;
