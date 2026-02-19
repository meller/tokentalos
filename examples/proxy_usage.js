import TokenTalos from '../index.js';

async function main() {
  // Initialize TokenTalos in proxy mode (connecting to a TokenTalos Gateway)
  const tt = new TokenTalos({
    mode: 'proxy',
    apiUrl: 'http://localhost:8060/api/v1',
    apiKey: 'your-api-key',
    projectId: 'web-app-production'
  });

  console.log('--- Executing via Proxy ---');
  try {
    const result = await tt.execute({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-latest',
      parts: {
        system: 'Summarize the following text.',
        context: 'Token Talos is a modular LLM gateway that helps teams track token usage and costs.',
        user_query: 'What does Token Talos do?'
      }
    });

    console.log('Proxy Result:', result.content);
    console.log('Tracking ID:', result.id);
  } catch (err) {
    console.error('Proxy Execution Failed:', err.response?.data || err.message);
  }
}

main().catch(console.error);
