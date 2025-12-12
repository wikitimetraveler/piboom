import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.ENCOMPASS_WEBHOOK_SECRET;

/**
 * Middleware to verify the signature of an incoming Encompass webhook.
 * This assumes Encompass includes a signature in the 'X-Encompass-Signature' header,
 * which is a common practice for webhook security.
 */
export function verifyEncompassWebhook(req, res, next) {
  if (!WEBHOOK_SECRET) {
    console.error('ENCOMPASS_WEBHOOK_SECRET is not configured. Cannot verify webhook.');
    // In a production environment, you might want to fail closed and return a 500
    // return res.status(500).send('Webhook secret is not configured.');
    // For local testing and development, we can bypass the check.
    return next();
  }

  const signature = req.get('X-Encompass-Signature');
  if (!signature) {
    return res.status(400).send('No signature provided.');
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    return res.status(400).send('Missing raw request body.');
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const computedSignature = `sha256=${hmac.update(rawBody).digest('hex')}`;

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature))) {
    return res.status(401).send('Invalid signature.');
  }

  next();
}

/**
 * Middleware to capture the raw request body. This is necessary because the body-parser
 * middleware consumes the stream, and we need the raw body to verify the webhook signature.
 * This should be placed *before* the body-parser middleware in the Express app setup.
 */
export function captureRawBody(req, res, next) {
  let data = '';
  req.on('data', (chunk) => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
}
