import { TokenTalosEngine } from '../../lib/engine/index.js';

describe('TokenTalos Engine Intelligence', () => {
  let engine;

  beforeAll(async () => {
    engine = new TokenTalosEngine({
      databaseType: 'sqlite',
      sqlitePath: ':memory:',
      llmProvider: 'none',
      intelligenceFeatures: ['cache'],
      formattingFeatures: ['compress']
    });
    await engine.init();
  });

  test('should cache and retrieve identical results', async () => {
    // 1. Mock execution result (bypass real LLM call)
    // For this test, we'll manually set a cache entry
    const promptHash = engine.cache.generateHash('Test Prompt');
    await engine.cache.set(promptHash, 'Cached Result', 'test-id');

    // 2. Try to execute the same prompt
    const result = await engine.execute({
      parts: { user_query: 'Test Prompt' }
    });

    expect(result.cached).toBe(true);
    expect(result.content).toBe('Cached Result');
  });

  test('should compress whitespace in prompt parts', async () => {
    const parts = { context: 'Too    much    whitespace' };
    const { processedParts, metadata } = await engine.process(parts);

    expect(processedParts.context).toBe('Too much whitespace');
    expect(metadata.actions_taken).toContainEqual(expect.objectContaining({ type: 'compress' }));
  });

  test('should minify JSON in prompt parts', async () => {
    const parts = { context: `{\n  "key": "value",\n  "nested": { "id": 1 }\n}` };
    const { processedParts } = await engine.process(parts);

    expect(processedParts.context).toBe('{"key":"value","nested":{"id":1}}');
  });
});
