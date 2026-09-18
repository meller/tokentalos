import { getEncoding } from 'js-tiktoken';
import { getLogger } from '../logger.js';

const logger = getLogger();

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

    // js-tiktoken's pure-JS BPE merge loop degrades badly (measured
    // O(n^2): 1K chars ~300ms, 20K chars ~26s) on long runs of a single
    // repeated character -- a shape normal prose never has, but that a
    // padded/structured prompt segment (separators, repeated data) can.
    // Skip the exact encode for that pathological shape and fall back to
    // the same length-based estimate already used on encode failure
    // (TD-015).
    if (hasLongRepeatedRun(text)) {
      return Math.ceil(text.length / 4);
    }

    // For now, use cl100k_base as a general-purpose tokenizer for OpenAI and others.
    // In the future, we can add provider-specific tokenization logic (e.g., Anthropic, Gemini).
    try {
      const encoding = this.getEncoding();
      return encoding.encode(text).length;
    } catch (err) {
      logger.warn({ err }, 'Token counting failed, using fallback estimate');
      return Math.ceil(text.length / 4); // Very rough estimate
    }
  }
}

// Cheap O(n) scan that bails out as soon as it finds a run of 300+
// identical characters -- well past anything real prose produces, but
// well before js-tiktoken's encode() cost becomes noticeable.
function hasLongRepeatedRun(text, threshold = 300) {
  let run = 1;
  for (let i = 1; i < text.length; i++) {
    run = text[i] === text[i - 1] ? run + 1 : 1;
    if (run >= threshold) return true;
  }
  return false;
}

let counter;
export function getTokenCounter() {
  if (!counter) {
    counter = new TokenCounter();
  }
  return counter;
}
