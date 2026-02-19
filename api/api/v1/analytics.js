import express from 'express';
import { getDb } from '../../../lib/engine/db.js';
import { authMiddleware } from '../../middleware/auth.js';
import { getCostCalculator } from '../../../lib/engine/pricing.js';

const router = express.Router();

// GET /api/v1/analytics/stats
router.get('/stats', authMiddleware, async (req, res) => {
  const db = getDb();
  const projectId = req.query.projectId;
  const orgId = req.orgId;
  
  try {
    let whereClause = ' WHERE org_id = ?';
    let params = [orgId];

    if (projectId) {
      whereClause += ' AND project_id = ?';
      params.push(projectId);
    }

    const totals = await db.get(`
      SELECT 
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost,
        SUM(CASE WHEN type = 'cache_hit' THEN saved_tokens ELSE 0 END) as cache_saved_tokens,
        SUM(CASE WHEN type = 'execution' THEN saved_tokens ELSE 0 END) as compression_saved_tokens,
        SUM(saved_cost) as total_saved_cost,
        COUNT(id) as total_requests,
        COUNT(CASE WHEN type = 'cache_hit' THEN 1 END) as total_cache_hits
      FROM usage_data
      ${whereClause}
    `, params);

    // Calculate Potential Savings (Optimization Opportunity)
    const recentExecutions = await db.all(`
      SELECT provider, model, input_tokens, output_tokens, total_cost 
      FROM usage_data 
      ${whereClause} AND type = 'execution'
      ORDER BY timestamp DESC LIMIT 100
    `, params);

    const calculator = getCostCalculator();
    let totalPotentialSavings = 0;
    
    for (const record of recentExecutions) {
      const bestAlt = calculator.getBestAlternative(record.provider, record.model, record.input_tokens, record.output_tokens);
      if (bestAlt && bestAlt.cost < record.total_cost) {
        totalPotentialSavings += (record.total_cost - bestAlt.cost);
      }
    }

    const byProvider = await db.all(`
      SELECT provider, SUM(total_tokens) as total_tokens, SUM(total_cost) as total_cost
      FROM usage_data 
      ${whereClause}
      GROUP BY provider
    `, params);

    const byModel = await db.all(`
      SELECT model, SUM(total_tokens) as total_tokens, SUM(total_cost) as total_cost
      FROM usage_data 
      ${whereClause}
      GROUP BY model
    `, params);

    const piiHits = await db.get(`
      SELECT COUNT(*) as count FROM pii_hits
      JOIN usage_data ON pii_hits.usage_id = usage_data.id
      ${whereClause}
    `, params);

    const securityAlerts = await db.get(`
      SELECT COUNT(*) as count FROM security_alerts
      JOIN usage_data ON security_alerts.usage_id = usage_data.id
      ${whereClause}
    `, params);

    res.json({
      total_tokens: totals.total_tokens || 0,
      total_cost: totals.total_cost || 0,
      total_saved_tokens: (totals.cache_saved_tokens || 0) + (totals.compression_saved_tokens || 0),
      cache_saved_tokens: totals.cache_saved_tokens || 0,
      compression_saved_tokens: totals.compression_saved_tokens || 0,
      total_cache_hits: totals.total_cache_hits || 0,
      total_saved_cost: totals.total_saved_cost || 0,
      total_requests: totals.total_requests || 0,
      pii_hits: piiHits.count || 0,
      security_alerts: securityAlerts.count || 0,
      potential_savings: totalPotentialSavings,
      by_provider: byProvider,
      by_model: byModel
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/v1/analytics/heatmap
router.get('/heatmap', authMiddleware, async (req, res) => {
  const db = getDb();
  const days = req.query.days || 30;
  const projectId = req.query.projectId;
  const orgId = req.orgId;

  try {
    const timestampFilter = db.type === 'sqlite' 
      ? `usage_data.timestamp >= datetime('now', '-${days} days')` 
      : `usage_data.timestamp >= CURRENT_TIMESTAMP - INTERVAL '${days} days'`;

    let filterClause = ` WHERE ${timestampFilter} AND usage_data.org_id = ?`;
    let params = [orgId];

    if (projectId) {
      filterClause += ` AND usage_data.project_id = ?`;
      params.push(projectId);
    }

    const heatmap = await db.all(`
      SELECT 
        name as variable_name,
        SUM(token_count) as total_tokens,
        COUNT(usage_id) as request_count
      FROM prompt_variables
      JOIN usage_data ON prompt_variables.usage_id = usage_data.id
      ${filterClause}
      AND name NOT IN ('system', 'context')
      GROUP BY name
      ORDER BY total_tokens DESC
    `, params);

    res.json({ heatmap });
  } catch (err) {
    console.error('Heatmap error:', err);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

// GET /api/v1/analytics/projects
router.get('/projects', authMiddleware, async (req, res) => {
  const db = getDb();
  const orgId = req.orgId;
  try {
    const projects = await db.all('SELECT DISTINCT project_id FROM usage_data WHERE org_id = ?', [orgId]);
    res.json(projects.map(p => p.project_id));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

export default router;
