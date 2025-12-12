import { Router } from 'express';
import { handleWebhookEvent } from '../controllers/encompass-webhook.controller.js';
import { verifyEncompassWebhook } from '../middleware/verify-encompass-webhook.js';

const router = Router();

router.post('/webhook', verifyEncompassWebhook, handleWebhookEvent);

export default router;
