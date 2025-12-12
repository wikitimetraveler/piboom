# Encompass Webhook Setup Guide

This guide provides instructions for configuring webhooks in your Encompass account to send real-time event notifications to your piBoom application.

## 1. Security Configuration

Webhooks are secured using a signing secret. This ensures that the requests are genuinely from Encompass and have not been tampered with.

### A. Generate a Secure Secret

You need to generate a strong, random secret to be shared between Encompass and your application. You can use a password generator or a command-line tool to create one. For example:

```bash
openssl rand -hex 32
```

### B. Configure Your Environment

Take the generated secret and add it to your `.env` file. If you are using the `.env.example` file as a template, it will look like this:

```
ENCOMPASS_WEBHOOK_SECRET=your_generated_secret_here
```

## 2. Encompass Configuration

In your Encompass Developer Connect portal, you will need to configure a new webhook subscription.

1.  **Navigate to the Webhooks Section:** Log in to your Encompass Developer Connect account and go to the webhooks or API section.
2.  **Create a New Subscription:** Cick the "Add" or "Create" button to create a new webhook.
3.  **Configure the Endpoint:**
    *   **URL:** This is the URL of your deployed application's webhook endpoint. For local testing, you can use a tool like [ngrok](https://ngrok.com/) to expose your local server to the internet. The URL will be `https://your-domain.com/api/encompass-webhooks/webhook`.
    *   **Secret:** Paste the secure secret you generated in the previous step into the "Secret" or "Signing Secret" field.
4.  **Select Events:** Choose the events you want to subscribe to (e.g., "Loan Status Changed," "Document Uploaded").
5.  **Activate the Webhook:** Save and activate the webhook.

## 3. Local Testing

To test the webhook locally, you can use a tool like `ngrok` to create a secure tunnel to your local server.

1.  **Start Your Local Server:**
    ```bash
    npm run dev
    ```
2.  **Start ngrok:**
    ```bash
    ngrok http 3000
    ```
3.  **Use the ngrok URL:** `ngrok` will provide you with a public URL (e.g., `https://1234-56-78-90.ngrok.io`). Use this as the URL for your webhook in the Encompass Developer Connect portal.

Now, when an event occurs in Encompass, it will send a webhook to your local server, and you should see the event logged in your console.
