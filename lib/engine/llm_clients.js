import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleAuth } from 'google-auth-library';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export class LLMGateway {
  constructor(config) {
    this.config = config;
    this.clients = {};
    this.auth = new GoogleAuth();
  }

  getGemini() {
    if (!process.env.GOOGLE_API_KEY) {
      return null;
    }
    if (!this.clients.gemini) {
      this.clients.gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    }
    return this.clients.gemini;
  }

  async getVertex() {
    if (!this.clients.vertex) {
      const location = this.config.location || process.env.GCP_REGION || 'us-central1';
      let project = this.config.gcpProjectId || this.config.project || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

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

      const pgConfig = {
        project,
        location
      };

      if (location === 'global') {
        pgConfig.apiEndpoint = 'aiplatform.googleapis.com';
      }

      this.clients.vertex = new VertexAI(pgConfig);
    }
    return this.clients.vertex;
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

  async executeGemini(modelName, messages, options) {
    try {
      const aiClient = this.getGemini();
      const vertexClient = await this.getVertex();

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
      const client = await this.getVertex();
      const model = client.getGenerativeModel({ model: modelName });

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

      const response = (await result.response);

      // Vertex response structure is slightly different for usage
      // It's under usageMetadata or usage_metadata
      const usage = response.usageMetadata || {};

      // Handle candidates properly
      const content = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text?.() || '';

      return {
        content,
        input_tokens: usage.promptTokenCount || 0,
        output_tokens: usage.candidatesTokenCount || 0,
        raw: response
      };
    } catch (err) {
      console.error('[TokenTalos] Vertex execution failed:', err);
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
