import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pg from 'pg';
import chalk from 'chalk';

let db;
let dbType;
let dbConfig;

export async function initDb(config) {
  dbConfig = config;
  dbType = config.databaseType || 'sqlite';

  if (dbType === 'sqlite') {
    db = await open({
      filename: config.sqlitePath,
      driver: sqlite3.Database,
    });

    await db.exec(getSchema('sqlite'));
    await runMigrations('sqlite', db);
    console.log(chalk.green(`\nSQLite initialized at ${config.sqlitePath}\n`));
  } else {
    const { Pool } = pg;
    db = new Pool({
      host: config.pgHost,
      port: config.pgPort,
      user: config.pgUser,
      password: config.pgPassword,
      database: config.pgDatabase,
    });

    const schemaName = config.databaseSchema || 'tokentalos';
    await db.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
    await db.query(`SET search_path TO ${schemaName}`);

    await db.query(getSchema('postgres', schemaName));
    await runMigrations('postgres', db, schemaName);

    db.on('connect', (client) => {
      client.query(`SET search_path TO ${schemaName}`).catch(err => {
        console.error('[TokenTalos] Error setting search_path on connect:', err);
      });
    });

    console.log(chalk.green(`\nPostgreSQL initialized at ${config.pgHost}:${config.pgPort} (schema: ${schemaName})\n`));
  }

  return db;
}

/**
 * Basic migration helper to ensure schema evolution
 */
async function runMigrations(type, database, schemaName = '') {
  const prefix = (type === 'postgres' && schemaName) ? `${schemaName}.` : '';

  if (type === 'sqlite') {
    // 1. Add org_id and project_id to usage_data if they don't exist
    const columns = await database.all(`PRAGMA table_info(usage_data)`);
    const hasOrgId = columns.some(c => c.name === 'org_id');
    const hasProjectId = columns.some(c => c.name === 'project_id');
    const hasSavedCost = columns.some(c => c.name === 'saved_cost');
    const hasSavedTokens = columns.some(c => c.name === 'saved_tokens');
    const hasFullPrompt = columns.some(c => c.name === 'full_prompt');
    const hasResponseContent = columns.some(c => c.name === 'response_content');
    const hasType = columns.some(c => c.name === 'type');

    if (!hasOrgId) await database.exec(`ALTER TABLE usage_data ADD COLUMN org_id TEXT DEFAULT 'default_org'`);
    if (!hasProjectId) await database.exec(`ALTER TABLE usage_data ADD COLUMN project_id TEXT DEFAULT 'default'`);
    if (!hasSavedCost) await database.exec(`ALTER TABLE usage_data ADD COLUMN saved_cost REAL DEFAULT 0`);
    if (!hasSavedTokens) await database.exec(`ALTER TABLE usage_data ADD COLUMN saved_tokens INTEGER DEFAULT 0`);
    if (!hasFullPrompt) await database.exec(`ALTER TABLE usage_data ADD COLUMN full_prompt TEXT`);
    if (!hasResponseContent) await database.exec(`ALTER TABLE usage_data ADD COLUMN response_content TEXT`);
    if (!hasType) await database.exec(`ALTER TABLE usage_data ADD COLUMN type TEXT DEFAULT 'execution'`);

    // Prompt Variables columns
    const varColumns = await database.all(`PRAGMA table_info(prompt_variables)`);
    const hasOriginalContent = varColumns.some(c => c.name === 'original_content');
    if (!hasOriginalContent) await database.exec(`ALTER TABLE prompt_variables ADD COLUMN original_content TEXT`);

    // Check explain_plans
    const planColumns = await database.all(`PRAGMA table_info(explain_plans)`);
    const hasMceAlternatives = planColumns.some(c => c.name === 'mce_alternatives');
    if (!hasMceAlternatives) await database.exec(`ALTER TABLE explain_plans ADD COLUMN mce_alternatives TEXT`);
  } else {
    // Postgres migration check
    try {
      // Check if columns exist in usage_data
      const checkSql = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = '${schemaName || 'tokentalos'}' 
        AND table_name = 'usage_data'
      `;
      const { rows } = await database.query(checkSql);
      const colNames = rows.map(r => r.column_name);

      if (!colNames.includes('org_id')) {
        await database.query(`ALTER TABLE ${prefix}usage_data ADD COLUMN org_id TEXT DEFAULT 'default_org'`);
      }
      if (!colNames.includes('project_id')) {
        await database.query(`ALTER TABLE ${prefix}usage_data ADD COLUMN project_id TEXT DEFAULT 'default'`);
      }
      if (!colNames.includes('saved_cost')) {
        await database.query(`ALTER TABLE ${prefix}usage_data ADD COLUMN saved_cost REAL DEFAULT 0`);
      }
      if (!colNames.includes('saved_tokens')) {
        await database.query(`ALTER TABLE ${prefix}usage_data ADD COLUMN saved_tokens INTEGER DEFAULT 0`);
      }
      if (!colNames.includes('full_prompt')) {
        await database.query(`ALTER TABLE ${prefix}usage_data ADD COLUMN full_prompt TEXT`);
      }
      if (!colNames.includes('response_content')) {
        await database.query(`ALTER TABLE ${prefix}usage_data ADD COLUMN response_content TEXT`);
      }
      if (!colNames.includes('type')) {
        await database.query(`ALTER TABLE ${prefix}usage_data ADD COLUMN type TEXT DEFAULT 'execution'`);
      }

      // Check prompt_variables
      const varRes = await database.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = '${schemaName || 'tokentalos'}' AND table_name = 'prompt_variables'
      `);
      const varCols = varRes.rows.map(r => r.column_name);
      if (!varCols.includes('original_content')) {
        await database.query(`ALTER TABLE ${prefix}prompt_variables ADD COLUMN original_content TEXT`);
      }

      // Check explain_plans
      const planRes = await database.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema = '${schemaName || 'tokentalos'}' AND table_name = 'explain_plans'
      `);
      const planCols = planRes.rows.map(r => r.column_name);
      if (!planCols.includes('variable_analysis')) {
        await database.query(`ALTER TABLE ${prefix}explain_plans ADD COLUMN variable_analysis TEXT`);
      }
      if (!planCols.includes('mce_alternatives')) {
        await database.query(`ALTER TABLE ${prefix}explain_plans ADD COLUMN mce_alternatives TEXT`);
      }
    } catch (e) {
      console.warn('[TokenTalos] Migration check failed (Postgres):', e.message);
    }
  }
}

export function getDb() {
  if (!db) throw new Error('Database not initialized');

  if (dbType === 'sqlite') {
    db.type = 'sqlite';
    return db;
  } else {
    return {
      type: 'postgres',
      run: async (sql, params) => {
        let i = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++i}`);
        return await db.query(pgSql, params);
      },
      get: async (sql, params) => {
        let i = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++i}`);
        const res = await db.query(pgSql, params);
        return res.rows[0];
      },
      all: async (sql, params) => {
        let i = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++i}`);
        const res = await db.query(pgSql, params);
        return res.rows;
      },
      exec: async (sql) => await db.query(sql)
    };
  }
}

function getSchema(type, schemaName = '') {
  const autoInc = type === 'sqlite' ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'SERIAL PRIMARY KEY';
  const timestamp = type === 'sqlite' ? "TEXT DEFAULT (datetime('now', 'utc'))" : "TIMESTAMP DEFAULT CURRENT_TIMESTAMP";
  const prefix = (type === 'postgres' && schemaName) ? `${schemaName}.` : '';

  const booleanType = type === 'sqlite' ? 'BOOLEAN' : 'BOOLEAN';
  const booleanDefault0 = type === 'sqlite' ? '0' : 'FALSE';

  return `
    CREATE TABLE IF NOT EXISTS ${prefix}usage_data (
      id TEXT PRIMARY KEY,
      org_id TEXT DEFAULT 'default_org',
      project_id TEXT DEFAULT 'default',
      type TEXT DEFAULT 'execution', -- 'execution', 'cache_hit'
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      full_prompt TEXT,
      response_content TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      saved_tokens INTEGER DEFAULT 0,
      saved_cost REAL DEFAULT 0,
      input_cost REAL DEFAULT 0,
      output_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      endpoint TEXT,
      latency_ms REAL,
      token_limit_exceeded ${booleanType} DEFAULT ${booleanDefault0},
      timestamp ${timestamp}
    );

    CREATE TABLE IF NOT EXISTS ${prefix}organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at ${timestamp}
    );

    CREATE TABLE IF NOT EXISTS ${prefix}api_keys (
      key_hash TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      name TEXT NOT NULL,
      last_used_at ${timestamp},
      FOREIGN KEY (org_id) REFERENCES ${prefix}organizations (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ${prefix}users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at ${timestamp}
    );

    CREATE TABLE IF NOT EXISTS ${prefix}organization_members (
      id ${autoInc},
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'viewer',
      created_at ${timestamp},
      FOREIGN KEY (org_id) REFERENCES ${prefix}organizations (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES ${prefix}users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ${prefix}prompt_variables (
      id ${autoInc},
      usage_id TEXT NOT NULL,
      name TEXT NOT NULL,
      content TEXT,
      original_content TEXT,
      token_count INTEGER DEFAULT 0,
      char_count INTEGER DEFAULT 0,
      position INTEGER DEFAULT 0${type === 'sqlite' ? '' : `, FOREIGN KEY (usage_id) REFERENCES ${prefix}usage_data (id) ON DELETE CASCADE`}
    );
    ${type === 'sqlite' ? 'CREATE INDEX IF NOT EXISTS idx_variables_usage ON prompt_variables(usage_id);' : ''}

    CREATE TABLE IF NOT EXISTS ${prefix}security_alerts (
      id ${autoInc},
      usage_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'injection', 'secret', 'malicious_code'
      description TEXT NOT NULL,
      severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
      action_taken TEXT NOT NULL, -- 'warn', 'reject', 'mask'
      timestamp ${timestamp}
    );

    CREATE TABLE IF NOT EXISTS ${prefix}explain_plans (
      id TEXT PRIMARY KEY,
      usage_id TEXT NOT NULL,
      variable_analysis TEXT, -- JSON array of per-variable insights
      detected_issues TEXT,
      optimization_suggestions TEXT,
      estimated_savings_pct REAL DEFAULT 0,
      estimated_savings_usd REAL DEFAULT 0,
      mce_best_alternative_model TEXT,
      mce_best_alternative_provider TEXT,
      mce_best_alternative_cost REAL,
      mce_savings_pct REAL,
      mce_alternatives TEXT -- JSON representation of possible model alternatives
    );

    CREATE TABLE IF NOT EXISTS ${prefix}opv_results (
      id TEXT PRIMARY KEY,
      usage_id TEXT NOT NULL,
      status TEXT,
      confidence REAL,
      reasoning TEXT,
      should_continue ${booleanType},
      verified_at ${timestamp}
    );

    CREATE TABLE IF NOT EXISTS ${prefix}pii_hits (
      id ${autoInc},
      usage_id TEXT NOT NULL,
      variable_name TEXT NOT NULL,
      pii_type TEXT NOT NULL,
      action_taken TEXT NOT NULL,
      timestamp ${timestamp}
    );

    CREATE TABLE IF NOT EXISTS ${prefix}variable_actions (
      id ${autoInc},
      usage_id TEXT NOT NULL,
      variable_name TEXT NOT NULL,
      action_type TEXT NOT NULL, -- 'compress', 'pii', 'neutralize', 'owasp'
      action_method TEXT,        -- 'mask', 'warn', 'xml_wrap', etc.
      details TEXT,              -- JSON string for specific metadata (e.g. saved_chars)
      timestamp ${timestamp}
    );

    CREATE TABLE IF NOT EXISTS ${prefix}cache_entries (
      prompt_hash TEXT PRIMARY KEY,
      response_content TEXT NOT NULL,
      usage_id TEXT NOT NULL,
      timestamp ${timestamp}
    );
  `;
}
