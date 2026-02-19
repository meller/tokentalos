import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

const CONFIG_PATH = path.join(os.homedir(), '.tokentalosrc');

export async function runSetup() {
  if (!process.stdout.isTTY) {
    console.log(chalk.gray('Non-interactive environment detected. Using default configuration.'));
    const defaults = {
      databaseType: 'sqlite',
      sqlitePath: path.join(os.homedir(), '.tokentalos', 'data.db'),
      enableCollector: true,
      gatewayPort: 8060,
      enableDashboard: true,
      dashboardPort: 8060,
      llmProvider: 'gemini',
      defaultModel: 'gemini-3-flash-preview',
      location: 'global',
      formattingFeatures: ['compress', 'pii', 'neutralize'],
      intelligenceFeatures: ['cache', 'explain'],
      securityFeatures: ['injection', 'secrets'],
      securityAction: 'warn',
      piiAction: 'mask',
      databaseSchema: 'tokentalos',
      maxTokens: 12000,
      thresholdAction: 'warning'
    };
    const dbDir = path.dirname(defaults.sqlitePath);
    await fs.ensureDir(dbDir);
    await fs.writeJson(CONFIG_PATH, defaults, { spaces: 2 });
    return defaults;
  }

  console.log(chalk.blue.bold('\n--- TokenTalos Setup ---\n'));
  console.log(chalk.gray('This wizard will configure your Database, Collector (API), and Dashboard.'));
  console.log(chalk.white('\n  [Collector]: ') + chalk.gray('The ingestion endpoint that receives and analyzes LLM data.'));
  console.log(chalk.white('  [Dashboard]: ') + chalk.gray('The visual interface for monitoring your AI performance.\n'));
  
  const answers = await inquirer.prompt([
    // --- DATABASE SECTION ---
    {
      type: 'list',
      name: 'databaseType',
      message: chalk.cyan('DATABASE: ') + 'Select storage engine:',
      choices: [
        { name: 'SQLite (Local file, zero-install)', value: 'sqlite' },
        { name: 'PostgreSQL (External server)', value: 'postgres' },
      ],
      default: 'sqlite',
    },
    // ... rest of database questions ...
    {
      type: 'input',
      name: 'sqlitePath',
      message: '  Where should the SQLite database be stored?',
      default: path.join(os.homedir(), '.tokentalos', 'data.db'),
      when: (ans) => ans.databaseType === 'sqlite',
    },
    {
      type: 'input',
      name: 'pgHost',
      message: '  Postgres Host:',
      default: 'localhost',
      when: (ans) => ans.databaseType === 'postgres',
    },
    {
      type: 'input',
      name: 'pgPort',
      message: '  Postgres Port:',
      default: 5432,
      when: (ans) => ans.databaseType === 'postgres',
    },
    {
      type: 'input',
      name: 'pgUser',
      message: '  Postgres User:',
      default: 'postgres',
      when: (ans) => ans.databaseType === 'postgres',
    },
    {
      type: 'password',
      name: 'pgPassword',
      message: '  Postgres Password:',
      when: (ans) => ans.databaseType === 'postgres',
    },
    {
      type: 'input',
      name: 'pgDatabase',
      message: '  Postgres Database Name:',
      default: 'tokentalos',
      when: (ans) => ans.databaseType === 'postgres',
    },
    {
      type: 'input',
      name: 'databaseSchema',
      message: '  Database schema name:',
      default: 'tokentalos',
    },

    // --- COLLECTOR (API) SECTION ---
    {
      type: 'confirm',
      name: 'enableCollector',
      message: chalk.green('COLLECTOR: ') + 'Enable API ingestion endpoint?',
      default: true,
    },
    {
      type: 'input',
      name: 'gatewayPort',
      message: '  Collector Port:',
      default: 8060,
      when: (ans) => ans.enableCollector,
      validate: (input) => !isNaN(parseInt(input)) || 'Please enter a valid port number',
    },
    // ... safety and intelligence ...
    {
      type: 'list',
      name: 'llmProvider',
      message: '  LLM provider for OPV/Analysis:',
      choices: [
        { name: 'Gemini (via ADC/Vertex)', value: 'gemini' },
        { name: 'Anthropic', value: 'anthropic' },
        { name: 'OpenAI', value: 'openai' },
        { name: 'Skip / Configure Later', value: 'none' },
      ],
      default: 'none',
      when: (ans) => ans.enableCollector,
    },
    {
      type: 'input',
      name: 'defaultModel',
      message: '  Default model name:',
      default: (ans) => {
        if (ans.llmProvider === 'gemini') return 'gemini-3-flash-preview';
        if (ans.llmProvider === 'anthropic') return 'claude-3-5-sonnet-latest';
        if (ans.llmProvider === 'openai') return 'gpt-4o-mini';
        return 'none';
      },
      when: (ans) => ans.enableCollector && ans.llmProvider !== 'none',
    },
    {
      type: 'input',
      name: 'location',
      message: '  LLM Model Location:',
      default: (ans) => ans.llmProvider === 'gemini' ? 'global' : 'us-central1',
      when: (ans) => ans.enableCollector && ans.llmProvider !== 'none',
    },
    {
      type: 'input',
      name: 'gcpProjectId',
      message: '  Google Cloud Project ID (required for Vertex AI/ADC):',
      when: (ans) => ans.enableCollector && ans.llmProvider === 'gemini',
      validate: (input) => input.length > 0 || 'Project ID is required for Vertex AI',
    },
    {
      type: 'checkbox',
      name: 'formattingFeatures',
      message: '  Select Safety features:',
      choices: [
        { name: 'Compress (Lossless compression)', value: 'compress', checked: true },
        { name: 'Neutralize (XML wrapping)', value: 'neutralize', checked: true },
        { name: 'PII Redaction (Masking)', value: 'pii', checked: true },
      ],
      when: (ans) => ans.enableCollector,
    },
    {
      type: 'checkbox',
      name: 'securityFeatures',
      message: '  Select Security scanning:',
      choices: [
        { name: 'Injection Scanning (Jailbreak detection)', value: 'injection', checked: true },
        { name: 'Secret Detection (API Keys/Secrets)', value: 'secrets', checked: true },
      ],
      when: (ans) => ans.enableCollector,
    },
    {
      type: 'list',
      name: 'securityAction',
      message: '  Default action for security threats:',
      choices: [
        { name: 'Warn (Log to dashboard, proceed)', value: 'warn' },
        { name: 'Reject (Fail request with error)', value: 'reject' },
      ],
      default: 'warn',
      when: (ans) => ans.enableCollector,
    },
    {
      type: 'input',
      name: 'maxTokens',
      message: '  Max token threshold (per prompt):',
      default: 12000,
      when: (ans) => ans.enableCollector,
      validate: (input) => !isNaN(parseInt(input)) || 'Please enter a valid number',
    },
    {
      type: 'list',
      name: 'thresholdAction',
      message: '  Action when threshold exceeded:',
      choices: [
        { name: 'Warning (Flag in dashboard)', value: 'warning' },
        { name: 'Reject (Fail request)', value: 'reject' },
      ],
      default: 'warning',
      when: (ans) => ans.enableCollector,
    },

    // --- DASHBOARD SECTION ---
    {
      type: 'confirm',
      name: 'enableDashboard',
      message: chalk.magenta('DASHBOARD: ') + 'Enable web interface?',
      default: true,
    },
    {
      type: 'input',
      name: 'dashboardPort',
      message: '  Dashboard Port:',
      default: 8060,
      when: (ans) => ans.enableDashboard,
      validate: (input) => !isNaN(parseInt(input)) || 'Please enter a valid port number',
    },
    {
      type: 'checkbox',
      name: 'intelligenceFeatures',
      message: '  Select Analytics features:',
      choices: [
        { name: 'Semantic Caching', value: 'cache', checked: true },
        { name: 'OPV (Reasoning Analysis)', value: 'opv', checked: true },
        { name: 'Explain Plan (Heuristic Detection)', value: 'explain', checked: true },
      ],
      when: (ans) => ans.enableDashboard && ans.llmProvider !== 'none',
    },
    {
      type: 'checkbox',
      name: 'comparisonProviders',
      message: '  Include in cost-comparison:',
      choices: [
        { name: 'OpenAI', value: 'openai', checked: true },
        { name: 'Anthropic', value: 'anthropic', checked: true },
        { name: 'Gemini', value: 'gemini', checked: true },
        { name: 'DeepSeek', value: 'deepseek', checked: true },
      ],
      when: (ans) => ans.enableDashboard,
    },
    {
      type: 'list',
      name: 'exportTarget',
      message: '  Default export format:',
      choices: ['jsonl', 'langsmith', 'none'],
      default: 'jsonl',
      when: (ans) => ans.enableDashboard,
    }
  ]);

  // Create directory for database if using sqlite
  if (answers.databaseType === 'sqlite') {
    const dbDir = path.dirname(answers.sqlitePath);
    await fs.ensureDir(dbDir);
  }

  // Save config
  await fs.writeJson(CONFIG_PATH, answers, { spaces: 2 });
  
  console.log(chalk.green.bold(`\n✅ Setup complete! Configuration saved to ${CONFIG_PATH}`));
  
  if (answers.enableCollector) {
    console.log(chalk.white(`\n  Collector (API) will run on port: `) + chalk.green.bold(answers.gatewayPort));
    console.log(chalk.gray(`  Endpoint: http://localhost:${answers.gatewayPort}/api/v1`));
  }

  if (answers.enableDashboard) {
    console.log(chalk.white(`\n  Dashboard will run on port: `) + chalk.magenta.bold(answers.dashboardPort));
    console.log(chalk.gray(`  URL: http://localhost:${answers.dashboardPort}`));
  }
  
  if (answers.llmProvider === 'none') {
    console.log(chalk.yellow(`\nNotice: OPV and AI Analysis are currently disabled.\n`));
  }

  return answers;
}

export async function loadConfig() {
  if (await fs.pathExists(CONFIG_PATH)) {
    return await fs.readJson(CONFIG_PATH);
  }
  return null;
}
