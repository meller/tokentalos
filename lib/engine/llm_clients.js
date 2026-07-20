import { GoogleGenAI } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getLogger } from '../logger.js';

export class LLMGateway {
  constructor(config) {
    this.config = config;
    this.logger = config?.logger || getLogger();
    this.clients = {
      vertex: new Map() // Cache VertexAI clients by project:location
    };
    this.auth = new GoogleAuth();
  }

  getGemini() {
    const apiKey = this.config.geminiApiKey
      || process.env.GEMINI_API_KEY
      || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return null;
    }
    if (!this.clients.gemini) {
      // Track 010 Phase 4: same @google/genai SDK as the Vertex path, in
      // direct-API mode (no `vertexai: true`, plain API key auth).
      // Track 013: bounded per-attempt timeout + retry count — see getVertex()
      // for the full rationale (a real ~10min hang on a transient 503).
      this.clients.gemini = new GoogleGenAI({
        apiKey,
        httpOptions: {
          timeout: this.config.llmRequestTimeoutMs || 30000,
          retryOptions: { attempts: this.config.llmMaxRetryAttempts ?? 2 },
        },
      });
    }
    return this.clients.gemini;
  }

  async getVertex(projectOverride) {
    const location = this.config.location || process.env.GCP_REGION || 'us-central1';
    let project = projectOverride || this.config.gcpProjectId || this.config.project || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

    if (!project) {
      try {
        // Try to auto-detect project ID from ADC
        project = await this.auth.getProjectId();
        if (project) {
          this.logger.info({ project }, '[TokenTalos] Auto-detected Project ID from ADC');
        }
      } catch (e) {
        this.logger.warn({ err: e }, '[TokenTalos] Failed to auto-detect Project ID');
      }
    }

    if (!project) {
      this.logger.warn('[TokenTalos] Vertex AI requires a Project ID. Set GOOGLE_CLOUD_PROJECT, GCLOUD_PROJECT, or configure it in setup.');
      return null;
    }

    const cacheKey = `${project}:${location}`;
    if (!this.clients.vertex.has(cacheKey)) {
      // Track 010: migrated off @google-cloud/vertexai's deprecated VertexAI
      // class (removal date 2026-06-24, already past) to the unified
      // @google/genai SDK per Google's own migration guide.
      const genaiConfig = {
        vertexai: true,
        project,
        location,
        // Track 013: @google/genai defaults to up to 5 attempts with a
        // maxElapsedTime backoff ceiling of 1 HOUR, and no per-attempt
        // timeout — confirmed root cause of a real ~10min hang on a
        // transient Vertex 503 (coachai Track 135). Bound both explicitly.
        httpOptions: {
          timeout: this.config.llmRequestTimeoutMs || 30000,
          retryOptions: { attempts: this.config.llmMaxRetryAttempts ?? 2 },
        },
      };

      if (location === 'global') {
        genaiConfig.apiEndpoint = 'aiplatform.googleapis.com';
      }

      this.logger.info({ project, location }, '[TokenTalos] Initializing GoogleGenAI (Vertex mode) client');
      this.clients.vertex.set(cacheKey, new GoogleGenAI(genaiConfig));
    }

    return this.clients.vertex.get(cacheKey);
  }

  getAnthropic() {
    if (!this.clients.anthropic) {
      this.clients.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
    }
    return this.clients.anthropic;
  }

  getOpenAI() {
    if (!this.clients.openai) {
      this.clients.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
    }
    return this.clients.openai;
  }

  getDeepSeek() {
    if (!this.clients.deepseek) {
      // DeepSeek is OpenAI-compatible
      this.clients.deepseek = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        baseURL: 'https://api.deepseek.com'
      });
    }
    return this.clients.deepseek;
  }

  async execute(provider, model, messages, options = {}) {
    switch (provider.toLowerCase()) {
      case 'gemini':
        return this.executeGemini(model, messages, options);
      case 'anthropic':
        return this.executeAnthropic(model, messages, options);
      case 'openai':
        return this.executeOpenAI(model, messages, options);
      case 'deepseek':
        return this.executeDeepSeek(model, messages, options);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async *streamExecute(provider, model, messages, options = {}) {
    switch (provider.toLowerCase()) {
      case 'gemini':
        yield* this.streamExecuteGemini(model, messages, options);
        break;
      case 'openai':
        yield* this.streamExecuteOpenAI(model, messages, options);
        break;
      default:
        throw new Error(`Streaming not supported for provider: ${provider}`);
    }
  }

  async *streamExecuteGemini(modelName, messages, options) {
    const aiClient = this.getGemini();
    const vertexClient = await this.getVertex(options.gcpProjectId);

    if (vertexClient && (!aiClient || this.config.useVertex)) {
      yield* this.streamExecuteVertex(modelName, messages, options);
      return;
    }

    if (!aiClient) throw new Error('No Gemini client');
    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    // Track 010 Phase 4: same call shape as streamExecuteVertex() — the
    // returned value is itself the async-iterable stream (no .stream wrapper).
    const stream = await aiClient.models.generateContentStream({
      model: modelName,
      contents,
      config: {
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        maxOutputTokens: options.max_tokens,
        temperature: options.temperature,
        // Track 013: lets a caller (e.g. coachai, on client disconnect) stop
        // consuming this stream promptly instead of waiting for natural
        // completion or a slow provider-side failure.
        abortSignal: options.abortSignal,
      }
    });

    for await (const chunk of stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? chunk.text;
      if (text || chunk.usageMetadata) yield { text, usageMetadata: chunk.usageMetadata };
    }
  }

  async *streamExecuteVertex(modelName, messages, options) {
    const ai = await this.getVertex(options.gcpProjectId);
    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    // Track 010: ai.models.generateContentStream() replaces
    // client.getGenerativeModel({model}).generateContentStream({...}) — the
    // returned value is itself the async-iterable stream (no .stream wrapper).
    const stream = await ai.models.generateContentStream({
      model: modelName,
      contents,
      config: {
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        maxOutputTokens: options.max_tokens,
        temperature: options.temperature,
        // Track 013: see streamExecuteGemini()'s identical field for rationale.
        abortSignal: options.abortSignal,
      }
    });

    for await (const chunk of stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? chunk.text;
      // Track 011: only the last chunk of a Vertex/Gemini stream carries a
      // populated usageMetadata (promptTokenCount/candidatesTokenCount), and
      // that last chunk may carry NO text (e.g. finishReason=MAX_TOKENS with
      // nothing left to say) — so this must yield even when text is empty,
      // or the engine layer never sees the real token counts.
      if (text || chunk.usageMetadata) yield { text, usageMetadata: chunk.usageMetadata };
    }
  }

  async *streamExecuteOpenAI(model, messages, options) {
    const client = this.getOpenAI();
    const stream = await client.chat.completions.create({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: options.max_tokens,
      temperature: options.temperature,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content || chunk.usage) yield { text: content, usageMetadata: chunk.usage };
    }
  }

  async executeGemini(modelName, messages, options) {
    try {
      const aiClient = this.getGemini();
      const vertexClient = await this.getVertex(options.gcpProjectId);

      // Prefer Vertex AI if GOOGLE_API_KEY is missing, or if explicitly configured
      if (vertexClient && (!aiClient || this.config.useVertex)) {
        return await this.executeVertex(modelName, messages, options);
      }

      if (!aiClient) {
        throw new Error('No LLM client available for Gemini. Set GOOGLE_API_KEY or GOOGLE_CLOUD_PROJECT (for Vertex AI).');
      }

      // Convert OpenAI-style messages to Gemini contents
      const systemInstruction = messages.find(m => m.role === 'system')?.content;
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      // Track 010 Phase 4: same call shape as executeVertex() — generation
      // params nest under `config`, not `generationConfig`.
      const response = await aiClient.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          maxOutputTokens: options.max_tokens,
          temperature: options.temperature,
          responseMimeType: options.responseMimeType,
          abortSignal: options.abortSignal,
        }
      });

      const usage = response.usageMetadata || {};

      // Same defensive extraction as executeVertex().
      let content = '';
      const candidate = response.candidates?.[0];
      if (candidate) {
        const parts = candidate.content?.parts || [];
        content = parts.map(p => p.text || '').join('');
      }
      if (!content) {
        try {
          content = response.text || '';
        } catch (_) { /* accessing .text may throw on safety blocks */ }
      }

      return {
        content,
        input_tokens: usage.promptTokenCount || 0,
        output_tokens: usage.candidatesTokenCount || 0,
        raw: response
      };
    } catch (err) {
      this.logger.error({ err }, '[TokenTalos] Gemini execution failed');
      throw err;
    }
  }

  async executeVertex(modelName, messages, options) {
    try {
      const ai = await this.getVertex(options.gcpProjectId);

      const systemInstruction = messages.find(m => m.role === 'system')?.content;
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      // Track 010: @google/genai's ai.models.generateContent() replaces the
      // old client.getGenerativeModel({model}).generateContent({...}) call —
      // note generation params now nest under `config`, not `generationConfig`.
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          maxOutputTokens: options.max_tokens,
          temperature: options.temperature,
          responseMimeType: options.responseMimeType,
          abortSignal: options.abortSignal,
        }
      });

      const usage = response.usageMetadata || {};

      // Robustly extract text from all candidate parts — same defensive
      // shape as before migration; @google/genai's response still exposes
      // .candidates[].content.parts[] and a top-level .text convenience getter.
      let content = '';
      const candidate = response.candidates?.[0];
      if (candidate) {
        const finishReason = candidate.finishReason;
        if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
          this.logger.warn({ finishReason }, '[TokenTalos] Vertex candidate finishReason — may indicate a safety block or error');
        }
        // Concatenate all text parts
        const parts = candidate.content?.parts || [];
        content = parts.map(p => p.text || '').join('');
      }

      // Fallback to response.text (property, not a method, in @google/genai)
      if (!content) {
        try {
          content = response.text || '';
        } catch (_) { /* accessing .text may throw on safety blocks */ }
      }

      // Do NOT return empty — throw so the caller knows and avoids caching it
      if (!content) {
        const reason = candidate?.finishReason || 'UNKNOWN';
        throw new Error(`Vertex AI returned empty content (finishReason=${reason}). The response may have been blocked or truncated.`);
      }

      return {
        content,
        input_tokens: usage.promptTokenCount || 0,
        output_tokens: usage.candidatesTokenCount || 0,
        raw: response
      };
    } catch (err) {
      this.logger.error({ err }, '[TokenTalos] Vertex execution failed');
      throw err;
    }
  }

  async executeAnthropic(model, messages, options) {
    const client = this.getAnthropic();
    const system = messages.find(m => m.role === 'system')?.content;
    const filteredMessages = messages.filter(m => m.role !== 'system');

    const response = await client.messages.create({
      model,
      messages: filteredMessages,
      system,
      max_tokens: options.max_tokens || 1024,
      temperature: options.temperature,
    });

    return {
      content: response.content[0].text,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      raw: response
    };
  }

  async executeOpenAI(model, messages, options) {
    const client = this.getOpenAI();
    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: options.max_tokens,
      temperature: options.temperature,
    });

    return {
      content: response.choices[0].message.content,
      input_tokens: response.usage.prompt_tokens,
      output_tokens: response.usage.completion_tokens,
      raw: response
    };
  }

  async executeDeepSeek(model, messages, options) {
    const client = this.getDeepSeek();
    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: options.max_tokens,
      temperature: options.temperature,
    });

    return {
      content: response.choices[0].message.content,
      input_tokens: response.usage.prompt_tokens,
      output_tokens: response.usage.completion_tokens,
      raw: response
    };
  }
}

let gateway;
export function getLLMGateway(config) {
  if (!gateway) {
    gateway = new LLMGateway(config);
  }
  return gateway;
}
