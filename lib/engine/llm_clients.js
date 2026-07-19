import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleGenAI } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export class LLMGateway {
  constructor(config) {
    this.config = config;
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
      this.clients.gemini = new GoogleGenerativeAI(apiKey);
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
          console.log(`[TokenTalos] Auto-detected Project ID from ADC: ${project}`);
        }
      } catch (e) {
        console.warn(`[TokenTalos] Failed to auto-detect Project ID: ${e.message}`);
      }
    }

    if (!project) {
      console.warn('Vertex AI requires a Project ID. Set GOOGLE_CLOUD_PROJECT, GCLOUD_PROJECT, or configure it in setup.');
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
      };

      if (location === 'global') {
        genaiConfig.apiEndpoint = 'aiplatform.googleapis.com';
      }

      console.log(`[TokenTalos] Initializing GoogleGenAI (Vertex mode) client for project: ${project}, location: ${location}`);
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
    const model = aiClient.getGenerativeModel({ model: modelName });
    const systemInstruction = messages.find(m => m.role === 'system')?.content;
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const result = await model.generateContentStream({
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig: { maxOutputTokens: options.max_tokens, temperature: options.temperature }
    });

    for await (const chunk of result.stream) {
      yield { text: chunk.text(), usageMetadata: chunk.usageMetadata };
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
      // ... (rest of the function remains the same)


      const model = aiClient.getGenerativeModel({ model: modelName });

      // Convert OpenAI-style messages to Gemini contents
      const systemInstruction = messages.find(m => m.role === 'system')?.content;
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      const result = await model.generateContent({
        contents,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
        generationConfig: {
          maxOutputTokens: options.max_tokens,
          temperature: options.temperature,
          responseMimeType: options.responseMimeType
        }
      });

      const response = await result.response;
      const usage = response.usageMetadata;

      return {
        content: response.text(),
        input_tokens: usage.promptTokenCount,
        output_tokens: usage.candidatesTokenCount,
        raw: response
      };
    } catch (err) {
      console.error('[TokenTalos] Gemini execution failed:', err);
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
          responseMimeType: options.responseMimeType
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
          console.warn(`[TokenTalos] Vertex candidate finishReason=${finishReason} — may indicate a safety block or error`);
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
      console.error('[TokenTalos] Vertex execution failed:', err.message);
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
