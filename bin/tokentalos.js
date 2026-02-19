#!/usr/bin/env node

import { loadConfig, runSetup } from '../api/setup.js';
import { startServer } from '../api/index.js';
import chalk from 'chalk';
import Table from 'cli-table3';
import axios from 'axios';
import { Command } from 'commander';
import { exec, spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const program = new Command();

const getPidFile = (service) => path.join(process.cwd(), `.tokentalos-${service || 'full'}.pid`);

program
  .name('tokentalos')
  .description('Standalone LLM Token Usage Analyzer and Proxy')
  .version('0.1.0');

program
  .command('setup')
  .description('Run the interactive configuration wizard')
  .action(async () => {
    await runSetup();
  });

program
  .command('start [service]')
  .description('Start TokenTalos services (all, collector, or dashboard)')
  .option('-d, --daemon', 'Run in background', false)
  .action(async (service, options) => {
    const validServices = ['collector', 'dashboard'];
    if (service && !validServices.includes(service)) {
      console.log(chalk.red(`Invalid service: ${service}. Use 'collector', 'dashboard', or leave empty for both.`));
      process.exit(1);
    }

    let config = await loadConfig();
    if (!config) {
      console.log(chalk.yellow('No configuration found. Starting setup...'));
      config = await runSetup();
    }

    // Inject service context into config
    if (service) config._service = service;

    const pidFile = getPidFile(service);

    if (options.daemon) {
      if (fs.existsSync(pidFile)) {
        console.log(chalk.red(`TokenTalos ${service || ''} is already running (PID file exists).`));
        process.exit(1);
      }

      const logFile = `./tokentalos-${service || 'all'}.log`;
      const out = fs.openSync(logFile, 'a');
      const err = fs.openSync(logFile, 'a');

      const args = ['start'];
      if (service) args.push(service);

      const child = spawn('node', [path.join(__dirname, 'tokentalos.js'), ...args], {
        detached: true,
        stdio: ['ignore', out, err]
      });

      fs.writeFileSync(pidFile, child.pid.toString());
      child.unref();
      console.log(chalk.green(`TokenTalos ${service || 'services'} started in background (PID: ${child.pid})`));
      console.log(chalk.gray(`Logs: ${logFile}`));
      process.exit(0);
    } else {
      await startServer(config);
    }
  });

program
  .command('stop [service]')
  .description('Stop TokenTalos services (all, collector, or dashboard)')
  .action(async (service) => {
    const config = await loadConfig();
    const pidFile = getPidFile(service);
    
    // Determine port based on service
    let port = config?.gatewayPort || 8060;
    if (service === 'dashboard') port = config?.dashboardPort || 8060;

    let stopped = false;

    if (fs.existsSync(pidFile)) {
      const pid = fs.readFileSync(pidFile, 'utf8');
      try {
        process.kill(parseInt(pid), 'SIGTERM');
        fs.removeSync(pidFile);
        console.log(chalk.green(`TokenTalos ${service || ''} (PID: ${pid}) stopped.`));
        stopped = true;
      } catch (err) {
        console.log(chalk.red(`Failed to stop TokenTalos ${service || ''} via PID: ${err.message}`));
        fs.removeSync(pidFile);
      }
    }

    // Secondary check: kill by port if PID file didn't work
    if (!stopped) {
      console.log(chalk.gray(`Checking for processes on port ${port}...`));
      try {
        const { stdout } = await new Promise((resolve) => {
          exec(`lsof -t -i:${port}`, (err, stdout) => resolve({ stdout }));
        });

        if (stdout && stdout.trim()) {
          const pids = stdout.trim().split('\n');
          for (const pidToKill of pids) {
            process.kill(parseInt(pidToKill), 'SIGKILL');
            console.log(chalk.green(`Process on port ${port} (PID: ${pidToKill}) terminated.`));
          }
          stopped = true;
        }
      } catch (err) {
        // Silently ignore if lsof fails (likely no process)
      }
    }

    if (!stopped) {
      console.log(chalk.yellow(`No running TokenTalos ${service || 'service'} found.`));
    }
  });

program
  .command('dashboard')
  .description('Launch the TokenTalos Dashboard (Reader Mode)')
  .action(async () => {
    let config = await loadConfig();
    if (!config) {
      console.log(chalk.yellow('No configuration found. Starting setup...'));
      config = await runSetup();
    }
    // Start server in foreground for dashboard access
    console.log(chalk.blue('Launching Dashboard...'));
    await startServer(config);
  });

program
  .command('stats')
  .description('Show aggregate token and cost statistics')
  .action(async () => {
    const config = await loadConfig();
    const port = config?.gatewayPort || 8060;
    const API_URL = process.env.TOKENTALOS_API_URL || `http://localhost:${port}/api/v1`;
    try {
      const { data } = await axios.get(`${API_URL}/usage/stats`);
      const table = new Table({ head: [chalk.blue('Metric'), chalk.blue('Value')] });
      table.push(['Total Tokens', data.total_tokens.toLocaleString()]);
      table.push(['Total Cost', `$${data.total_cost.toFixed(4)}`]);
      table.push(['Total Requests', data.total_requests]);
      console.log(table.toString());
    } catch (err) {
      console.error(chalk.red('Error: Could not connect to API. Is TokenTalos running?'));
    }
  });

program
  .command('list')
  .description('List recent prompt logs')
  .action(async () => {
    const config = await loadConfig();
    const port = config?.gatewayPort || 8060;
    const API_URL = process.env.TOKENTALOS_API_URL || `http://localhost:${port}/api/v1`;
    try {
      const { data } = await axios.get(`${API_URL}/usage/recent`);
      const table = new Table({ head: [chalk.blue('ID'), chalk.blue('Model'), chalk.blue('Tokens'), chalk.blue('Cost')] });
      data.forEach(r => table.push([r.id.substring(0, 8), r.model, r.total_tokens, `$${r.total_cost.toFixed(4)}`]));
      console.log(table.toString());
    } catch (err) {
      console.error(chalk.red('Error: Could not connect to API.'));
    }
  });

program
  .command('export')
  .description('Export usage logs to external formats')
  .option('-f, --format <type>', 'Export format (jsonl, langsmith)', 'jsonl')
  .option('-o, --output <path>', 'Output file path', './tokentalos_export.json')
  .action(async (options) => {
    const config = await loadConfig();
    const port = config?.gatewayPort || 8060;
    const API_URL = process.env.TOKENTALOS_API_URL || `http://localhost:${port}/api/v1`;
    try {
      const { data } = await axios.get(`${API_URL}/usage/recent?limit=1000`);
      
      let outputData = '';
      if (options.format === 'jsonl') {
        outputData = data.map(r => JSON.stringify(r)).join('\n');
      } else if (options.format === 'langsmith') {
        // Simple mapping to LangSmith schema
        outputData = JSON.stringify(data.map(r => ({
          name: r.endpoint || 'tokentalos_gateway',
          inputs: r.variables ? Object.fromEntries(r.variables.map(v => [v.name, v.content])) : {},
          outputs: { content: '...' }, // Responses not stored in passive ingest
          usage: { prompt_tokens: r.input_tokens, completion_tokens: r.output_tokens },
          extra: { model: r.model, provider: r.provider }
        })), null, 2);
      }

      fs.writeFileSync(options.output, outputData);
      console.log(chalk.green(`Successfully exported ${data.length} records to ${options.output} (${options.format})`));
    } catch (err) {
      console.error(chalk.red(`Export failed: ${err.message}`));
    }
  });

// Handle default case
if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);
