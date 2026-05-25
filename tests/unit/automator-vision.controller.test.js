/**
 * Development work by David Lane
 */
import { sanitizeAutomatorVisionLine } from '../../controllers/automator-vision.controller.js';

describe('automator vision line sanitization', () => {
  test('removes bracketed field IDs from description segment only', () => {
    const line = '[CX.TEST]\tNew\tString(3)\tMy desc [CX.TEST] [4002]\tN';
    const out = sanitizeAutomatorVisionLine(line);
    const parts = out.split('\t');

    expect(parts[0]).toBe('[CX.TEST]');
    expect(parts[1]).toBe('New');
    expect(parts[2]).toBe('String(3)');
    expect(parts[3]).toBe('My desc');
    expect(parts[4]).toBe('N');
  });

  test('keeps malformed lines unchanged', () => {
    const line = '[CX.TEST]\tNew\tString(3)';
    expect(sanitizeAutomatorVisionLine(line)).toBe(line);
  });
});
