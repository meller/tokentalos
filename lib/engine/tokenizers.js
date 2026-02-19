import { getEncoding } from 'js-tiktoken';

// We'll use a simplified mapping for now.
// For more accuracy, we could load specific encodings for different models.
const DEFAULT_ENCODING = 'cl100k_base'; // Used by GPT-4, GPT-3.5-Turbo, etc.

export class TokenCounter {
  constructor() {
    this.encodings = {};
  }

  getEncoding(encodingName = DEFAULT_ENCODING) {
    if (!this.encodings[encodingName]) {
      this.encodings[encodingName] = getEncoding(encodingName);
    }
    return this.encodings[encodingName];
  }

  countTokens(text, provider, model) {
    if (!text) return 0;
    
    // For now, use cl100k_base as a general-purpose tokenizer for OpenAI and others.
    // In the future, we can add provider-specific tokenization logic (e.g., Anthropic, Gemini).
    try {
      const encoding = this.getEncoding();
      return encoding.encode(text).length;
    } catch (err) {
      console.warn('Token counting failed, using fallback estimate:', err);
      return Math.ceil(text.length / 4); // Very rough estimate
    }
  }
}

let counter;
export function getTokenCounter() {
  if (!counter) {
    counter = new TokenCounter();
  }
  return counter;
}
