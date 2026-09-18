import { detectPII } from '../../lib/engine/pii_detector.js';

describe('PII Detection Logic', () => {
  test('should detect emails', () => {
    const text = 'Contact me at test@example.com for more info.';
    const results = detectPII(text);
    expect(results).toContainEqual(expect.objectContaining({ type: 'email', value: 'test@example.com' }));
  });

  test('should detect potential API keys', () => {
    const text = 'My key is sk-1234567890abcdef1234567890abcdef';
    const results = detectPII(text);
    expect(results).toContainEqual(expect.objectContaining({ type: 'api_key' }));
  });

  test('should detect potential SSNs', () => {
    const text = 'His SSN is 123-45-6789.';
    const results = detectPII(text);
    expect(results).toContainEqual(expect.objectContaining({ type: 'ssn', value: '123-45-6789' }));
  });

  test('should return empty array when no PII is found', () => {
    const text = 'This is a clean string with no sensitive data.';
    const results = detectPII(text);
    expect(results).toEqual([]);
  });

  test('should not exhibit catastrophic backtracking on a long non-matching run (TD-015)', () => {
    const text = 'x'.repeat(100000); // no '@' anywhere
    const start = Date.now();
    const results = detectPII(text);
    expect(Date.now() - start).toBeLessThan(200);
    expect(results).toEqual([]);
  });

  test('should still detect an email embedded in a long run (TD-015)', () => {
    const text = 'x'.repeat(50000) + ' a@b.com ' + 'x'.repeat(50000);
    const start = Date.now();
    const results = detectPII(text);
    expect(Date.now() - start).toBeLessThan(200);
    expect(results).toContainEqual(expect.objectContaining({ type: 'email', value: 'a@b.com' }));
  });
});
