import { LLMGateway } from './lib/engine/llm_clients.js';

const gateway = new LLMGateway({ project: 'ocumentor-prod', location: 'global', useVertex: true });

async function run() {
  console.log('--- executeVertex ---');
  const result = await gateway.executeVertex('gemini-3.5-flash', [
    { role: 'system', content: 'You are a helpful assistant. Always answer in exactly one word.' },
    { role: 'user', content: 'What color is the sky on a clear day?' },
  ], { temperature: 0, max_tokens: 200 });
  console.log('content:', result.content);
  console.log('input_tokens:', result.input_tokens, 'output_tokens:', result.output_tokens);
  console.log('raw.text (property):', result.raw.text);
  console.log('raw keys:', Object.keys(result.raw));

  console.log('\n--- streamExecuteVertex ---');
  let chunks = 0;
  let full = '';
  let lastUsage = null;
  const start = performance.now();
  let firstChunkMs = null;
  for await (const chunk of gateway.streamExecuteVertex('gemini-3.5-flash', [
    { role: 'user', content: 'Write a detailed 300-word paragraph explaining how photosynthesis works, in simple terms a child could understand.' },
  ], { temperature: 0, max_tokens: 800 })) {
    if (firstChunkMs === null) firstChunkMs = performance.now() - start;
    chunks++;
    full += chunk.text;
    if (chunk.usageMetadata?.promptTokenCount || chunk.usageMetadata?.candidatesTokenCount) lastUsage = chunk.usageMetadata;
  }
  console.log('total chunks:', chunks, '| time to first chunk:', firstChunkMs.toFixed(0) + 'ms', '| total time:', (performance.now()-start).toFixed(0) + 'ms');
  console.log('full text:', full.replace(/\n/g, ' | '));
  console.log('last usageMetadata:', lastUsage);
}

run().catch(e => { console.error('FAILED:', e); process.exit(1); });
