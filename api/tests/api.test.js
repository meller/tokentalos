import request from 'supertest';
import express from 'express';
import { createApp } from '../index.js';
import { initDb } from '../../lib/engine/db.js';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';

describe('API Integration', () => {
  let app;
  const testDbPath = path.join(os.tmpdir(), `tokentalos-test-${Date.now()}.db`);

  beforeAll(async () => {
    const config = { sqlitePath: testDbPath, databaseType: 'sqlite', llmProvider: 'none' };
    await initDb(config);
    app = createApp(express(), config);
  });

  afterAll(async () => {
    await fs.remove(testDbPath);
  });

  test('GET /api/health should return ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api metadata should return info', async () => {
    const res = await request(app).get('/api');
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('TokenTalos Collector API');
  });

  test('POST /api/v1/usage/ingest should store usage data', async () => {
    const res = await request(app)
      .post('/api/v1/usage/ingest')
      .send({
        provider: 'gemini',
        model: 'gemini-3-flash-preview',
        input_tokens: 100,
        output_tokens: 50
      });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
  });
});
