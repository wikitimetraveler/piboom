/**
 * Thin HTTP layer for the loan-file flight simulator.
 * Development work by David Lane
 */
import { Router } from 'express';
import { cleanClientId, coach, completeFlight, getDeck } from '../services/loan-flight.service.js';

const router = Router();

router.get('/deck', async (req, res) => {
  try {
    const deck = await getDeck(req.query.clientId, {
      difficulty: req.query.difficulty,
      count: req.query.count
    });
    res.json({ success: true, ...deck });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

router.post('/complete', async (req, res) => {
  try {
    const result = await completeFlight(req.body || {});
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

router.post('/assistant/chat', async (req, res) => {
  try {
    const clientId = req.body?.clientId ? cleanClientId(req.body.clientId) : 'loan-flight-anon';
    const result = await coach({ ...req.body, clientId });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

export default router;
