import { processWebhookEvent } from '../services/encompass-webhook.service.js';

/**
 * Handles incoming Encompass webhook events.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 */
export async function handleWebhookEvent(req, res) {
  try {
    const event = req.body;
    await processWebhookEvent(event);
    res.status(200).send('Webhook received successfully.');
  } catch (error) {
    console.error('Error handling Encompass webhook event:', error.message);
    res.status(500).send('Error processing webhook event.');
  }
}
