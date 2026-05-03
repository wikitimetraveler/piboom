/**
 * Default Chat Completions model for **text** agents (chat, JSON routing, LangChain-style helpers).
 *
 * - Global: `OPENAI_AGENT_MODEL` (default `gpt-4o`).
 * - Per-feature: `resolveOpenAiAgentModel('LANE_FAMILY_AI_MODEL')` checks that env first.
 *
 * Vision/multimodal defaults live in `openai-vision-model.js` (`OPENAI_VISION_MODEL`).
 */

export const OPENAI_AGENT_MODEL_DEFAULT = 'gpt-4o';

export function resolveOpenAiAgentModel(specificEnvVar) {
  if (specificEnvVar && typeof process.env[specificEnvVar] === 'string') {
    const v = process.env[specificEnvVar].trim();
    if (v) return v;
  }
  const g = String(process.env.OPENAI_AGENT_MODEL || OPENAI_AGENT_MODEL_DEFAULT).trim();
  return g || OPENAI_AGENT_MODEL_DEFAULT;
}
