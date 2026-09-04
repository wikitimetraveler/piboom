/**
 * Create Zed (cyberpunk alien) HeyGen prompt avatar + Studio face catalog.
 * Requires HEYGEN_API_KEY in .env
 *
 * Usage:
 *   npm run create:zed-heygen-avatar
 *   node scripts/tools/create-zed-heygen-avatar.mjs --voice-id <id>
 */
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  heygenConfigured,
  createPromptAvatar,
  listVoices
} from '../../services/heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const AVATAR_MD = path.join(ROOT, 'AVATAR-ZED.md');
const FACE_JSON = path.join(ROOT, 'data/studio-heygen-face.json');

const APPEARANCE_PROMPT =
  'Young-adult humanoid alien presenter, half-body. Iridescent teal-grey skin with faint circuit-like facial markings. Large dark almond eyes with a cyan catchlight. Short silver-white undercut, one neon-magenta streak. Subtle cranial ridges and slightly pointed ears. Black high-collar jacket with chrome zipper and a thin LED rim at the collar. Neon rain night-city bokeh in magenta and teal. Cool, still expression, cinematic cyberpunk lighting.';

const GREETING =
  "Signal acquired. Console is live — arm a track when you're ready.";

function voiceIdArg() {
  const idx = process.argv.indexOf('--voice-id');
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return String(process.argv[idx + 1]).trim();
}

async function pickCyberpunkEnglishVoice() {
  const voices = await listVoices({ maxPages: 3 });
  const scored = voices
    .map((v) => {
      const name = String(v.name || v.voice_name || '').toLowerCase();
      const gender = String(v.gender || v.sex || '').toLowerCase();
      const lang = String(v.language || v.locale || '').toLowerCase();
      let score = 0;
      if (lang.includes('english') || lang.startsWith('en') || /en[-_]?us|american/.test(`${name} ${lang}`)) {
        score += 8;
      } else {
        score -= 20;
      }
      if (/italian|spanish|french|german|japanese|chinese|korean|portuguese|hindi|arabic/.test(`${name} ${lang}`)) {
        score -= 25;
      }
      if (/female|woman|girl/.test(`${gender} ${name}`) && !/male/.test(gender)) score += 1;
      if (/male|man|guy/.test(`${gender} ${name}`)) score += 2;
      if (/cool|calm|deep|smooth|neutral|dry|tech|robot|synthetic|processed|narrator|dj|console/.test(name)) {
        score += 5;
      }
      if (/warm|cheerful|bubbly|playful|child|grandma|news anchor/.test(name)) score -= 3;
      return {
        voiceId: v.voice_id || v.id,
        voiceName: v.name || v.voice_name || v.voice_id || v.id,
        score
      };
    })
    .filter((v) => v.voiceId && v.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) throw new Error('No suitable English HeyGen voices available for Zed');
  return best;
}

async function updateAvatarMd({ groupId, lookId, voiceId, voiceName }) {
  let md = await readFile(AVATAR_MD, 'utf8');
  const now = new Date().toISOString();
  md = md
    .replace(/- Group ID:.*/, `- Group ID: ${groupId || ''}`)
    .replace(/- Voice ID:.*/, `- Voice ID: ${voiceId}`)
    .replace(/- Voice Name:.*/, `- Voice Name: ${voiceName}`)
    .replace(/- Voice Designed:.*/, `- Voice Designed: false`)
    .replace(/- Looks:.*/, `- Looks: landscape=${lookId}, portrait=${lookId}, square=${lookId}`)
    .replace(/- Last Synced:.*/, `- Last Synced: ${now}`)
    .replace(/- Status:.*/, `- Status: heygen-ready`);
  await writeFile(AVATAR_MD, md, 'utf8');
}

async function updateFaceCatalog({ lookId, groupId, voiceId, voiceName }) {
  const catalog = JSON.parse(await readFile(FACE_JSON, 'utf8'));
  Object.assign(catalog, {
    name: 'Zed',
    avatarFile: 'AVATAR-ZED.md',
    avatarId: lookId,
    groupId: groupId || null,
    voiceId,
    voiceName,
    greeting: GREETING,
    status: 'heygen-ready'
  });
  await writeFile(FACE_JSON, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
}

async function main() {
  if (!heygenConfigured()) {
    console.error('HEYGEN_API_KEY is not configured');
    process.exit(1);
  }

  process.stdout.write('Creating Zed prompt avatar (Cyberpunk)…\n');
  const created = await createPromptAvatar({
    name: 'Zed — cyberpunk alien',
    prompt: APPEARANCE_PROMPT,
    age: 'Young Adult',
    gender: 'Unspecified',
    ethnicity: 'Unspecified',
    style: 'Cyberpunk',
    orientation: 'horizontal',
    pose: 'half_body'
  });
  process.stdout.write(`  look_id: ${created.lookId}\n`);
  process.stdout.write(`  group_id: ${created.groupId || '(none)'}\n`);

  const forcedVoiceId = voiceIdArg();
  let voice;
  if (forcedVoiceId) {
    voice = { voiceId: forcedVoiceId, voiceName: forcedVoiceId };
    process.stdout.write(`  voice (--voice-id): ${forcedVoiceId}\n`);
  } else {
    process.stdout.write('Picking cool English voice for Zed…\n');
    voice = await pickCyberpunkEnglishVoice();
    process.stdout.write(`  voice: ${voice.voiceName} (${voice.voiceId})\n`);
  }

  await updateAvatarMd({
    groupId: created.groupId,
    lookId: created.lookId,
    voiceId: voice.voiceId,
    voiceName: voice.voiceName
  });
  process.stdout.write(`Updated ${AVATAR_MD}\n`);

  await updateFaceCatalog({
    lookId: created.lookId,
    groupId: created.groupId,
    voiceId: voice.voiceId,
    voiceName: voice.voiceName
  });
  process.stdout.write(`Updated ${FACE_JSON}\n`);

  process.stdout.write('\nZed avatar ready. Open /studio/desk.html and click Zed face, or /planetarium/ Show Zed.\n');
  process.stdout.write('Live tile uses HeyGen Avatar Realtime (HLS), not the sunset Interactive Avatar API.\n');
}

main().catch((err) => {
  console.error(err.message || err);
  if (err.details) console.error(JSON.stringify(err.details, null, 2));
  process.exit(1);
});
