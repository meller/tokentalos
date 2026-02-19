import { processPromptParts } from '../../lib/engine/processor.js';

describe('PII Middleware Integration', () => {
  const parts = {
    user_query: 'My email is asaf@example.com',
    context: 'Secret key is sk-1234567890abcdef1234567890abcdef'
  };

  test('should mask PII when configured', async () => {
    const config = {
      formattingFeatures: ['pii'],
      piiAction: 'mask'
    };
    
    const { processedParts, metadata } = await processPromptParts(parts, config);
    
    expect(processedParts.user_query).toContain('[EMAIL_REDACTED]');
    expect(processedParts.context).toContain('[API_KEY_REDACTED]');
    expect(metadata.actions_taken).toContainEqual(expect.objectContaining({ type: 'pii', method: 'mask' }));
  });

  test('should warn but not mask when configured', async () => {
    const config = {
      formattingFeatures: ['pii'],
      piiAction: 'warn'
    };
    
    const { processedParts, metadata } = await processPromptParts(parts, config);
    
    expect(processedParts.user_query).toBe('My email is asaf@example.com');
    expect(metadata.actions_taken).toContainEqual(expect.objectContaining({ type: 'pii', method: 'warn' }));
  });

  test('should throw error when reject is configured and PII found', async () => {
    const config = {
      formattingFeatures: ['pii'],
      piiAction: 'reject'
    };
    
    await expect(processPromptParts(parts, config)).rejects.toThrow('PII detected in prompt parts');
  });
});
