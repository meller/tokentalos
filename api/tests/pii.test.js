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
});
