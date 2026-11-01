/**
 * Create Apex (ski racer / super cruiser) HeyGen prompt avatar + face catalog.
 * Requires HEYGEN_API_KEY in .env. Spends HeyGen credits.
 *
 *   node scripts/tools/create-apex-heygen-avatar.mjs
 */
import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { heygenConfigured, createPromptAvatar, listVoices } from '../../services/heygen.service.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const PROMPT =
  'Young adult man, athletic ski racer, half body. Short sun-lightened brown hair, windburned fair skin, sharp focused eyes, a small confident grin. Navy race suit unzipped at the collar over a base layer, helmet under one arm, goggles pushed up on his forehead. Sunny groomed ski slope and pines behind him, golden-hour light. Realistic.';

const GREETING =
  "Apex here. Point me at a run and I'll tell you if it's a cruiser or a race line.";

async function pickVoice() {
  const voices = await listVoices({ maxPages: 3 });
  const ranked = voices
    .map((v) => {
      const name = String(v.name || v.voice_name || '').toLowerCase();
      const gender = String(v.gender || v.sex || '').toLowerCase();
      const lang = String(v.language || v.locale || '').toLowerCase();
      let score = 0;
      if (lang.includes('english') || lang.startsWith('en') || /american|en[-_]?us/.test(`${name} ${lang}`)) score += 8;
      else score -= 20;
      if (/female|woman|girl/.test(`${gender} ${name}`) && !/\bmale\b/.test(gender)) score -= 30;
      if (/\bmale\b|\bman\b/.test(`${gender} ${name}`)) score += 6;
      if (/athletic|confident|deep|smooth|narrator|warm|clear|young/.test(name)) score += 4;
      if (/child|grandma|whisper|cartoon|robot/.test(name)) score -= 8;
      return {
        voiceId: v.voice_id || v.id,
        voiceName: v.name || v.voice_name || '',
        gender: v.gender || '',
        language: v.language || v.locale || '',
        score,
      };
    })
    .filter((v) => v.voiceId && v.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked[0]) throw new Error('No English male HeyGen voice matched');
  return ranked[0];
}

async function main() {
  if (!heygenConfigured()) throw new Error('HEYGEN_API_KEY is not configured');
  const voice = await pickVoice();
  const created = await createPromptAvatar({
    name: 'Apex',
    prompt: PROMPT,
    age: 'Young Adult',
    gender: 'Man',
    ethnicity: 'White',
    style: 'Realistic',
    orientation: 'horizontal',
    pose: 'half_body',
  });
  const today = new Date().toISOString().slice(0, 10);
  const md = `# Avatar: Apex

Ski racer and super cruiser for the Ski Areas page. Named character — not the agent, not the user. Snow stays the snowboarder greeter. Ridge stays the drive desk.

## Appearance
- Age: Young adult (early thirties)
- Gender: Man
- Ethnicity: White
- Hair: Short, sun-lightened brown
- Build: Athletic ski-racer build
- Features: Windburned fair skin, sharp focused eyes, a small confident grin
- Style: Navy race suit unzipped at the collar, helmet under one arm, goggles up, sunny groomed slope
- Reference:

## Voice
- Tone: Confident and direct
- Accent: General American
- Energy: Calm at speed — a racer who now super-cruises groomers
- Think: The skier who talks you through a carved line, not a hype reel

## HeyGen
- Group ID: ${created.groupId || ''}
- Voice ID: ${voice.voiceId}
- Voice Name: ${voice.voiceName}
- Voice Designed: false
- Voice Seed:
- Looks: landscape=${created.lookId}
- Last Synced: ${today}

⚠️ look_ids are ephemeral — always resolve fresh from group_id at runtime.
`;
  const catalog = {
    name: 'Apex',
    avatarFile: 'AVATAR-APEX.md',
    avatarId: created.lookId,
    groupId: created.groupId || '',
    voiceId: voice.voiceId,
    voiceName: voice.voiceName,
    greeting: GREETING,
    status: 'heygen-ready',
  };
  await writeFile(path.join(ROOT, 'AVATAR-APEX.md'), md);
  await writeFile(path.join(ROOT, 'data', 'ski', 'apex-heygen-face.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(JSON.stringify({ lookId: created.lookId, groupId: created.groupId, voiceName: voice.voiceName }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
