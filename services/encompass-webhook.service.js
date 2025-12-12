/**
 * Processes an incoming webhook event from Encompass.
 * @param {object} event - The webhook event payload.
 */
export async function processWebhookEvent(event) {
  // For now, we'll just log the event to the console.
  // This allows for easy inspection during local testing.
  console.log('Received Encompass webhook event:', JSON.stringify(event, null, 2));

  // In a real-world scenario, you would add your business logic here.
  // For example, you might update a database, send a notification,
  // or trigger another process.
}
