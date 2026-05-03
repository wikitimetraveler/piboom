/**
 * Default Chat Completions model for multimodal (image) requests across discovery agents.
 *
 * - Global override: `OPENAI_VISION_MODEL` (default `gpt-4o`).
 * - Per-feature override: pass env key, e.g. `resolveOpenAiVisionModel('FISH_VISION_MODEL')`
 *   checks `process.env.FISH_VISION_MODEL` first, then falls back to global/default.
 */

export const OPENAI_VISION_MODEL_DEFAULT = 'gpt-4o';

export function resolveOpenAiVisionModel(specificEnvVar) {
  if (specificEnvVar && typeof process.env[specificEnvVar] === 'string') {
    const v = process.env[specificEnvVar].trim();
    if (v) return v;
  }
  const g = String(process.env.OPENAI_VISION_MODEL || OPENAI_VISION_MODEL_DEFAULT).trim();
  return g || OPENAI_VISION_MODEL_DEFAULT;
}
