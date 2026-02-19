import express from 'express';
import { TokenTalosEngine } from '../../../lib/engine/index.js';

const router = express.Router();
let config = {};

export function setConfig(c) {
  config = c;
}

// POST /api/v1/opv/heartbeat - Real-time reasoning analysis
router.post('/heartbeat', async (req, res) => {
  const { thinking_sample, task_description, previous_status } = req.body;

  if (!thinking_sample || !task_description) {
    return res.status(400).json({ error: 'thinking_sample and task_description are required' });
  }

  try {
    const engine = new TokenTalosEngine(config);
    await engine.init();
    
    const result = await engine.verifyReasoning({
      thinking_sample,
      task_description,
      previous_status
    });

    res.json(result);
  } catch (err) {
    console.error('OPV heartbeat error:', err);
    res.status(500).json({ error: 'Failed to verify reasoning', details: err.message });
  }
});

export default router;
