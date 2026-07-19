import TokenTalos from './index.js';

async function run() {
  const tt = new TokenTalos({
    mode: 'standalone',
    projectId: 'tokentalos-track011-test',
    config: {
      databaseType: 'postgres',
      pgHost: process.env.DB_HOST || 'localhost',
      pgPort: parseInt(process.env.DB_PORT || '5432', 10),
      pgUser: process.env.DB_USER || 'postgres',
      pgPassword: process.env.DB_PASSWORD || 'postgres',
      pgDatabase: process.env.DB_NAME || 'ocumentor_dev',
      databaseSchema: 'tokentalos',
      llmProvider: 'gemini',
      defaultModel: 'gemini-3.5-flash',
      project: 'ocumentor-prod',
      location: 'global',
      useVertex: true,
      formattingFeatures: [],
      intelligenceFeatures: [],
    },
  });

  await tt.init();

  let chunks = 0;
  let full = '';
  const start = performance.now();
  let firstChunkMs = null;

  for await (const chunk of tt.streamExecute({
    endpoint: 'track011_manual_test',
    parts: {
      system: 'You are a helpful assistant. Always answer in exactly one short sentence.',
      user_query: 'What color is the sky on a clear day, and why?',
    },
    options: { temperature: 0, max_tokens: 300 },
  })) {
    if (firstChunkMs === null) firstChunkMs = performance.now() - start;
    chunks++;
    full += chunk;
  }

  const totalMs = performance.now() - start;
  console.log('total chunks:', chunks, '| time to first chunk:', firstChunkMs.toFixed(0) + 'ms', '| total time:', totalMs.toFixed(0) + 'ms');
  console.log('full text:', full);

  // Give the finally-block persistence a beat, then query the row back.
  await new Promise(r => setTimeout(r, 300));
  const db = tt.engine.getDb();
  const row = await db.get(
    `SELECT id, endpoint, input_tokens, output_tokens, total_tokens, latency_ms, length(full_prompt) as prompt_len, length(response_content) as response_len
     FROM usage_data WHERE endpoint = 'track011_manual_test' ORDER BY timestamp DESC LIMIT 1`
  );
  console.log('persisted row:', row);
  const vars = await db.all(`SELECT name, token_count FROM prompt_variables WHERE usage_id = ?`, [row?.id]);
  console.log('prompt_variables:', vars);
}

run().catch(e => { console.error('FAILED:', e); process.exit(1); });
