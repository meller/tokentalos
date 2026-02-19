import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { initDb } from '../lib/engine/db.js';
import usageRouter, { setConfig as setUsageConfig } from './api/v1/usage.js';
import analyticsRouter from './api/v1/analytics.js';
import opvRouter, { setConfig as setOpvConfig } from './api/v1/opv.js';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') resolve(true);
        else resolve(false);
      })
      .once('listening', () => {
        server.close();
        resolve(false);
      })
      .listen(port, '0.0.0.0');
  });
}

export async function startServer(config) {
  await initDb(config);
  setUsageConfig(config);
  setOpvConfig(config);
  const app = express();
  return createApp(app, config);
}

export function createApp(app, config) {
  const isCollectorOnly = config._service === 'collector';
  const isDashboardOnly = config._service === 'dashboard';
  
  const PORT = isDashboardOnly ? (config.dashboardPort || 8060) : (config.gatewayPort || 8060);
  const publicPath = path.join(__dirname, 'public');

  // Store config for middleware access
  app.set('tokentalosConfig', config);

  app.use(cors());
  app.use(express.json());

  // --- API Router ---
  // The Dashboard ALWAYS needs the Analytics and Recent Usage APIs to function.
  if (config.enableCollector !== false || config.enableDashboard !== false) {
    const apiRouter = express.Router();

    // Shared / Analytics Routes (Needed by Dashboard)
    apiRouter.use('/v1/analytics', analyticsRouter);
    
    // Usage Router has both Read (recent) and Write (ingest/execute).
    // We mount it for both, as the dashboard needs the 'recent' logs.
    apiRouter.use('/v1/usage', usageRouter);
    apiRouter.use('/v1/opv', opvRouter);

    apiRouter.get('/', (req, res) => {
      res.json({
        name: isDashboardOnly ? 'TokenTalos Dashboard API' : 'TokenTalos Collector API',
        version: '0.1.0',
        services: {
          collector: !isDashboardOnly && (config.enableCollector !== false),
          dashboard: !isCollectorOnly && (config.enableDashboard !== false)
        }
      });
    });

    apiRouter.get('/health', (req, res) => {
      res.json({ status: 'ok', service: isDashboardOnly ? 'dashboard' : 'collector' });
    });

    app.use('/api', apiRouter);
  }

  // --- Dashboard Static Assets ---
  if (config.enableDashboard !== false && !isCollectorOnly) {
    app.use(express.static(publicPath));

    // Catch-all for SPA (excluding /api)
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(publicPath, 'index.html'), (err) => {
        if (err) res.status(404).send('TokenTalos Dashboard build not found.');
      });
    });
  }

  if (process.env.NODE_ENV !== 'test') {
    (async () => {
      if (await isPortInUse(PORT)) {
        console.error(chalk.red.bold(`\n❌ Error: Port ${PORT} is already in use.`));
        process.exit(1);
      }

      app.listen(PORT, '0.0.0.0', () => {
        const serviceName = isCollectorOnly ? 'Collector' : (isDashboardOnly ? 'Dashboard' : 'TokenTalos');
        console.log(chalk.cyan.bold(`\n🚀 ${serviceName} running at http://localhost:${PORT}`));
        if (!isDashboardOnly && (config.enableCollector !== false)) console.log(chalk.gray(`   API Endpoint: http://localhost:${PORT}/api/v1`));
      });
    })();
  }

  return app;
}
