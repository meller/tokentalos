import { getTokenCounter } from './tokenizers.js';
import { getCostCalculator } from './pricing.js';
import { v4 as uuidv4 } from 'uuid';

export class TokenTalosPrompt {
  constructor(provider, model) {
    this.provider = provider || 'gemini';
    this.model = model || 'gemini-3-flash-preview';
    this.variables = [];
    this.tokenCounter = getTokenCounter();
    this.metadata = {};
  }

  add(name, content, originalContent = null, metadata = {}) {
    const tokenCount = this.tokenCounter.countTokens(content, this.provider, this.model);
    
    const variable = {
      name,
      content,
      original_content: originalContent || content,
      token_count: tokenCount,
      char_count: content.length,
      position: this.variables.length
    };

    this.variables.push(variable);
    if (metadata) this.metadata[name] = metadata;

    return this;
  }

  addSystem(content, original = null) { return this.add('system', content, original); }
  addContext(content, original = null, source = null) { return this.add('context', content, original, { source }); }
  addHistory(messages, originalMessages = null) {
    messages.forEach((msg, idx) => {
      const originalContent = originalMessages ? originalMessages[idx]?.content : null;
      this.add(`history_${msg.role}_${idx}`, msg.content, originalContent);
    });
    return this;
  }
  addUserQuery(content, original = null) { return this.add('user_query', content, original); }

  toMessages() {
    return this.variables.map(v => {
      if (v.name === 'system') return { role: 'system', content: v.content };
      if (v.name.startsWith('history_')) {
        const role = v.name.split('_')[1];
        return { role, content: v.content };
      }
      return { role: 'user', content: v.content };
    });
  }

  toString() {
    return this.variables.map(v => v.content).join('\n\n');
  }

  getTrackingData() {
    return {
      id: uuidv4(),
      provider: this.provider,
      model: this.model,
      variables: this.variables,
      total_tokens: this.variables.reduce((acc, v) => acc + v.token_count, 0),
      timestamp: new Date().toISOString()
    };
  }
}
