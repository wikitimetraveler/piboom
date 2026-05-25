/**
 * Development work by David Lane
 */
/**
 * Helper utilities for managing Google API keys with separate
 * browser (HTTP referrer restricted) and server (IP/server-side)
 * credentials. Falls back to the legacy GOOGLE_API_KEY to avoid
 * breaking existing environments.
 */

export function getGoogleBrowserApiKey() {
  return (
    process.env.GOOGLE_BROWSER_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();
}

export function getGoogleServerApiKey() {
  return (
    process.env.GOOGLE_SERVER_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();
}
