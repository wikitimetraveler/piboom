/**
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';

const syncPath = path.join(process.cwd(), 'public/watch-together/js/sync.js');

describe('watch-together LiveKit clock', () => {
  test('joins the shared LiveKit room clock like Studio, not a per-browser reel', () => {
    const src = fs.readFileSync(syncPath, 'utf8');
    expect(src).toContain('RoomMetadataChanged');
    expect(src).toContain('parseClockSnapshot');
    expect(src).toContain('republishClock');
    expect(src).toContain('room.metadata');
    expect(src).toMatch(/ParticipantConnected[\s\S]*republishClock/);
  });
});
