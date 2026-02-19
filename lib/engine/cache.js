import crypto from 'crypto';

export class PromptCache {
  constructor(db) {
    this.db = db;
  }

  generateHash(promptString) {
    return crypto.createHash('sha256').update(promptString).digest('hex');
  }

  async get(hash) {
    return await this.db.get(`
      SELECT response_content, usage_id, timestamp 
      FROM cache_entries 
      WHERE prompt_hash = ?
    `, [hash]);
  }

  async set(hash, responseContent, usageId) {
    return await this.db.run(`
      INSERT INTO cache_entries (prompt_hash, response_content, usage_id)
      VALUES (?, ?, ?)
      ON CONFLICT(prompt_hash) DO UPDATE SET 
        response_content = excluded.response_content,
        usage_id = excluded.usage_id,
        timestamp = CURRENT_TIMESTAMP
    `, [hash, responseContent, usageId]);
  }
}
