/**
 * Development work by David Lane
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('livekit agent worker prompts', () => {
  test('Python prompts register StarBand and WolfmanDave', () => {
    const src = readFileSync(path.join(root, 'python-service/livekit_agent/prompts.py'), 'utf8');
    expect(src).toContain('STARBAND_AGENT_NAME = "StarBand"');
    expect(src).toContain('WOLFMAN_AGENT_NAME = "WolfmanDave"');
    expect(src).toContain('You are Reed');
    expect(src).toContain('You are Wolfman Dave');
  });

  test('worker dispatches by LIVEKIT_AGENT_NAME', () => {
    const src = readFileSync(path.join(root, 'python-service/livekit_agent/worker.py'), 'utf8');
    expect(src).toContain('agent_name=_agent_name()');
    expect(src).toContain('LIVEKIT_AGENT_NAME');
  });
});
