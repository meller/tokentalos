import TokenTalos from '../index.js';

async function main() {
  // Initialize TokenTalos in standalone mode (direct database access)
  const tt = new TokenTalos({
    mode: 'standalone',
    projectId: 'demo-project',
    config: {
      // Storage Settings
      databaseType: 'sqlite',
      sqlitePath: './tokentalos.db',

      // Provider Settings
      location: 'us-central1', // GCP Region for Vertex AI
      
      // Feature Flags (ORM behavior)
      formattingFeatures: ['pii', 'neutralize'],
      intelligenceFeatures: ['cache', 'explain'],
      securityFeatures: ['injection', 'secrets'],
      
      // Policy Actions
      securityAction: 'warn', // 'warn' or 'block'
      piiAction: 'mask'       // 'mask' or 'reject'
    }
  });

  await tt.init();

  console.log('--- Constructing Prompt ---');
  const prompt = await tt.construct({
    provider: 'gemini',
    model: 'gemini-3-flash-preview',
    parts: {
      system: 'You are a helpful assistant.',
      user_query: 'What is the capital of France?'
    }
  });

  console.log('Messages:', JSON.stringify(prompt.messages, null, 2));

  console.log('\n--- Executing Prompt ---');
  const result = await tt.execute({
    provider: 'gemini',
    model: 'gemini-3-flash-preview',
    parts: {
      system: 'You are a helpful assistant.',
      user_query: 'Explain quantum computing in one sentence.'
    }
  });

  console.log('Result:', result.content);
  console.log('Tokens:', result.usage);
  console.log('Cost:', result.total_cost);
}

main().catch(console.error);
