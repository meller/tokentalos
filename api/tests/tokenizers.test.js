import { getTokenCounter } from '../../lib/engine/tokenizers.js';

describe('TokenCounter (TD-015: catastrophic backtracking guard)', () => {
  test('does not exhibit catastrophic backtracking on a long repeated-character run', () => {
    const counter = getTokenCounter();
    const text = 'x'.repeat(100000);
    const start = Date.now();
    const count = counter.countTokens(text, 'openai', 'gpt-4');
    expect(Date.now() - start).toBeLessThan(200);
    expect(count).toBeGreaterThan(0);
  });

  test('still returns an accurate real-BPE count for normal prose', () => {
    const counter = getTokenCounter();
    const text = 'The quick brown fox jumps over the lazy dog. '.repeat(200);
    const count = counter.countTokens(text, 'openai', 'gpt-4');
    // Real BPE on this sentence repeated 200x is ~2000 tokens; the
    // length/4 estimate the guard would otherwise fall back to gives
    // ~2250 -- close enough to collide, so assert against a tighter
    // real-BPE-only range to prove the guard didn't misfire.
    expect(count).toBeGreaterThan(1900);
    expect(count).toBeLessThan(2100);
  });
});
