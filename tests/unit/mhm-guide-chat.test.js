/**
 * Development work by David Lane
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const GUIDE_CHAT = path.join(process.cwd(), 'public/mountain-high/js/mhm-guide-chat.js');
const TYPES = path.join(process.cwd(), 'public/mountain-high/js/mhm-types.js');

describe('mhm-guide-chat', () => {
  test('Ask Bud Master opens the widget instead of toggling it closed', async () => {
    const src = await readFile(GUIDE_CHAT, 'utf8');
    expect(src).not.toMatch(/widget\.open\?\.\(\)\s*\|\|\s*widget\.toggle/);
    expect(src).toMatch(/typeof widget\.open === ['"]function['"]/);
    expect(src).toContain("apiEndpoint: '/api/mountain-high/assistant/chat'");
    expect(src).toContain("title: 'Bud Master'");
  });

  test('type-card Ask does not also flip the card', async () => {
    const src = await readFile(TYPES, 'utf8');
    expect(src).toMatch(/if \(ask\) \{[\s\S]*return;/);
    expect(src).toContain('MhmAskJill');
  });
});
