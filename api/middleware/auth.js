import { TokenTalosEngine } from '../../lib/engine/index.js';

/**
 * Authentication Middleware
 * 
 * Secure ingestion and execution endpoints.
 * In Managed Mode: Requires valid X-TokenTalos-Key.
 * In Local Mode: Optional key, defaults to default_org.
 */
export async function authMiddleware(req, res, next) {
  // Config is passed to the app during startServer
  const config = req.app.get('tokentalosConfig');
  const managedMode = config.managedMode || false;
  const apiKey = req.headers['x-tokentalos-key'];

  try {
    const engine = new TokenTalosEngine(config);
    await engine.init();

    if (apiKey) {
      const orgId = await engine.validateApiKey(apiKey);
      if (orgId) {
        req.orgId = orgId;
        return next();
      }
      
      // If key provided but invalid
      if (managedMode) {
        return res.status(401).json({ error: 'Invalid API Key' });
      }
    }

    // No key provided
    if (managedMode) {
      return res.status(401).json({ error: 'API Key required (X-TokenTalos-Key)' });
    }

    // Fallback for Local Mode
    req.orgId = config.orgId || 'default_org';
    next();
  } catch (err) {
    console.error('[TokenTalos] Auth Error:', err);
    res.status(500).json({ error: 'Authentication internal error' });
  }
}
