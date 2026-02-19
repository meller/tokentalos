import { TokenTalos } from '../../index.js';

describe('TokenTalos Node.js SDK', () => {
  let tw;

  beforeAll(async () => {
    tw = new TokenTalos({
      mode: 'standalone',
      config: {
        databaseType: 'sqlite',
        sqlitePath: ':memory:',
        llmProvider: 'none' // Disable LLM calls for base SDK tests
      }
    });
    await tw.init();
  });

  test('should construct a prompt in standalone mode', async () => {
    const result = await tw.construct({
      parts: { system: 'Helpful AI', user_query: 'Hello' }
    });

    expect(result.messages).toHaveLength(2);
    expect(result.full_prompt_string).toContain('Helpful AI');
  });

  test('should have engine methods available', async () => {
    expect(tw.execute).toBeDefined();
    expect(tw.verifyReasoning).toBeDefined();
  });
});
