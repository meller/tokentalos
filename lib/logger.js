import pino from 'pino';

// Lazily-created shared default logger. TokenTalosEngine/LLMGateway/TokenTalos
// each accept an optional config.logger override (so a consumer can inject
// its own pino instance and see tokentalos's logs unified in the same
// stream) and fall back to this singleton otherwise. Deliberately plain JSON
// (no pretty-print transport) — the point is that a host app piping stdout
// into a pino-aware viewer (e.g. `node server.js | npx pinorama --open`)
// actually parses and surfaces these lines, instead of silently dropping the
// plain-text console.* output tokentalos used to emit.
let defaultLogger = null;

export function getLogger() {
  if (!defaultLogger) {
    defaultLogger = pino({ name: 'tokentalos', level: process.env.TOKENTALOS_LOG_LEVEL || 'info' });
  }
  return defaultLogger;
}
