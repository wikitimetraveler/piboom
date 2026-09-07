/**
 * Create Zed (cyberpunk alien) HeyGen prompt avatar + Studio face catalog.
 * Requires HEYGEN_API_KEY in .env
 *
 * Usage:
 *   npm run create:zed-heygen-avatar
 *   node scripts/tools/create-zed-heygen-avatar.mjs --voice-id <id>
 *
 * Add a look to the existing Zed character instead of a new one:
 *   node scripts/tools/create-zed-heygen-avatar.mjs --reuse-group --orientation vertical --pose close_up --backdrop sky
 *
 * List voice candidates without spending credits:
 *   node scripts/tools/create-zed-heygen-avatar.mjs --voices 8
 */
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  heygenConfigured,
  createPromptAvatar,
  getAvatarLook,
  listVoices
} from '../../services/heygen.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const AVATAR_MD = path.join(ROOT, 'AVATAR-ZED.md');
const FACE_JSON = path.join(ROOT, 'data/studio-heygen-face.json');

const APPEARANCE_PROMPT =
  'Young-adult humanoid alien presenter, half-body. Iridescent teal-grey skin with faint circuit-like facial markings. Large dark almond eyes with a cyan catchlight. Short silver-white undercut, one neon-magenta streak. Subtle cranial ridges and slightly pointed ears. Black high-collar jacket with chrome zipper and a thin LED rim at the collar. Neon rain night-city bokeh in magenta and teal. Cool, still expression, cinematic cyberpunk lighting.';

/** Sky backdrop keeps Zed on-theme for the planetarium surfaces. */
const APPEARANCE_PROMPT_SKY =
  'Young-adult humanoid alien presenter, close-up head and shoulders, centered in a vertical frame. Iridescent teal-grey skin with faint circuit-like facial markings. Large dark almond eyes with a cyan catchlight. Short silver-white undercut, one neon-magenta streak. Subtle cranial ridges and slightly pointed ears. Black high-collar jacket with chrome zipper and a thin LED rim at the collar. Behind him a deep night sky with a soft starfield and faint magenta-teal nebula glow — no city, no rain. Cool, still expression, cinematic low-key lighting with a cyan rim light.';

const GREETING =
  "Signal acquired. Console is live — arm a track when you're ready.";

/** HeyGen orientation enum -> AVATAR-ZED.md Looks key. */
const LOOK_KEYS = { horizontal: 'landscape', vertical: 'portrait', square: 'square' };

function argVal(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || !process.argv[idx + 1]) return null;
  const next = String(process.argv[idx + 1]).trim();
  return next.startsWith('--') ? null : next;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function voiceIdArg() {
  return argVal('--voice-id');
}

/** Group ID recorded in AVATAR-ZED.md, so new looks join the same character. */
async function readGroupIdFromAvatarMd() {
  const md = await readFile(AVATAR_MD, 'utf8');
  const match = md.match(/- Group ID:\s*(\S+)/);
  return match ? match[1] : null;
}

async function rankCyberpunkEnglishVoices() {
  const pages = Number(argVal('--voice-pages')) || 3;
  const grep = argVal('--voice-grep');
  const filter = grep ? new RegExp(grep, 'i') : null;
  const designedOnly = hasFlag('--voice-designed');
  const voices = await listVoices({ maxPages: pages });
  return voices
    .filter((v) => !filter || filter.test(String(v.name || v.voice_name || '')))
    .filter((v) => {
      if (!designedOnly) return true;
      const preview = String(v.preview_audio || v.preview_audio_url || v.sample_url || '');
      return preview.includes('voice-design');
    })
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
      // Zed reads telemetry, not headlines — favour a processed, unhurried delivery.
      if (/robot|synthetic|processed|android|cyber|machine|monotone|dry|deep|low/.test(name)) score += 4;
      if (/warm|cheerful|bubbly|playful|child|grandma|news anchor/.test(name)) score -= 3;
      return {
        voiceId: v.voice_id || v.id,
        voiceName: v.name || v.voice_name || v.voice_id || v.id,
        gender: v.gender || v.sex || '',
        language: v.language || v.locale || '',
        previewUrl: v.preview_audio || v.preview_audio_url || v.sample_url || '',
        score
      };
    })
    .filter((v) => v.voiceId && v.score > 0)
    .sort((a, b) => b.score - a.score);
}

async function pickCyberpunkEnglishVoice() {
  const best = (await rankCyberpunkEnglishVoices())[0];
  if (!best) throw new Error('No suitable English HeyGen voices available for Zed');
  return best;
}

/** Merge one orientation into the Looks line; other orientations keep their own look IDs. */
function mergeLooksLine(line, lookKey, lookId) {
  const looks = {};
  String(line || '')
    .replace(/^- Looks:\s*/, '')
    .split(',')
    .forEach((part) => {
      const [key, value] = part.split('=').map((piece) => (piece || '').trim());
      if (key && value) looks[key] = value;
    });
  if (lookId) looks[lookKey] = lookId;
  const pairs = ['landscape', 'portrait', 'square']
    .filter((key) => looks[key])
    .map((key) => `${key}=${looks[key]}`);
  return `- Looks: ${pairs.join(', ')}`;
}

async function updateAvatarMd({ groupId, lookId, lookKey, voiceId, voiceName }) {
  let md = await readFile(AVATAR_MD, 'utf8');
  const now = new Date().toISOString();
  if (groupId) md = md.replace(/- Group ID:.*/, `- Group ID: ${groupId}`);
  md = md
    .replace(/- Voice ID:.*/, `- Voice ID: ${voiceId}`)
    .replace(/- Voice Name:.*/, `- Voice Name: ${voiceName}`)
    .replace(/- Voice Designed:.*/, `- Voice Designed: false`)
    .replace(/- Looks:.*/, (line) => mergeLooksLine(line, lookKey, lookId))
    .replace(/- Last Synced:.*/, `- Last Synced: ${now}`)
    .replace(/- Status:.*/, `- Status: heygen-ready`);
  await writeFile(AVATAR_MD, md, 'utf8');
}

async function updateFaceCatalog({ lookId, lookKey, groupId, voiceId, voiceName }) {
  const catalog = JSON.parse(await readFile(FACE_JSON, 'utf8'));
  Object.assign(catalog, {
    name: 'Zed',
    avatarFile: 'AVATAR-ZED.md',
    voiceId,
    voiceName,
    greeting: GREETING,
    status: 'heygen-ready'
  });
  if (groupId) catalog.groupId = groupId;
  // Landscape stays the desk/theater tile; portrait serves phone-shaped surfaces.
  if (lookId && lookKey === 'portrait') catalog.portraitAvatarId = lookId;
  else if (lookId) catalog.avatarId = lookId;
  await writeFile(FACE_JSON, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
}

/** Voice already recorded in AVATAR-ZED.md, for runs that only add a look. */
async function readVoiceFromAvatarMd() {
  const md = await readFile(AVATAR_MD, 'utf8');
  const id = md.match(/- Voice ID:\s*(\S+)/);
  const name = md.match(/- Voice Name:\s*(.+)/);
  if (!id) return null;
  return { voiceId: id[1], voiceName: (name?.[1] || id[1]).trim() };
}

async function resolveVoice() {
  const forced = voiceIdArg();
  if (forced) {
    process.stdout.write(`  voice (--voice-id): ${forced}\n`);
    return { voiceId: forced, voiceName: argVal('--voice-name') || forced };
  }
  if (hasFlag('--keep-voice')) {
    const current = await readVoiceFromAvatarMd();
    if (!current) throw new Error('--keep-voice needs a Voice ID in AVATAR-ZED.md');
    process.stdout.write(`  voice (kept): ${current.voiceName}\n`);
    return current;
  }
  process.stdout.write('Picking cool English voice for Zed…\n');
  const picked = await pickCyberpunkEnglishVoice();
  process.stdout.write(`  voice: ${picked.voiceName} (${picked.voiceId})\n`);
  return picked;
}

async function main() {
  if (!heygenConfigured()) {
    console.error('HEYGEN_API_KEY is not configured');
    process.exit(1);
  }

  const previewLookId = argVal('--preview');
  if (previewLookId) {
    const look = await getAvatarLook(previewLookId);
    const url = look?.preview_image_url || look?.image_url || '';
    process.stdout.write(`  status: ${look?.status || '(unknown)'}\n`);
    process.stdout.write(`  preview: ${url || '(not rendered yet)'}\n`);
    const saveTo = argVal('--save');
    if (url && saveTo) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Preview download failed (${res.status})`);
      await writeFile(saveTo, Buffer.from(await res.arrayBuffer()));
      process.stdout.write(`  saved: ${saveTo}\n`);
    }
    return;
  }

  if (hasFlag('--voices')) {
    const limit = Number(argVal('--voices')) || 8;
    const ranked = await rankCyberpunkEnglishVoices();
    ranked.slice(0, limit).forEach((voice, i) => {
      process.stdout.write(`${i + 1}. ${voice.voiceName} — ${voice.gender || 'unspecified'} · ${voice.language || 'unknown'}\n`);
      process.stdout.write(`   id: ${voice.voiceId}\n`);
      if (voice.previewUrl) process.stdout.write(`   preview: ${voice.previewUrl}\n`);
    });
    return;
  }

  const orientation = argVal('--orientation') || 'horizontal';
  const lookKey = LOOK_KEYS[orientation];
  if (!lookKey) {
    console.error(`--orientation must be one of: ${Object.keys(LOOK_KEYS).join(', ')}`);
    process.exit(1);
  }

  if (hasFlag('--voice-only')) {
    const voice = await resolveVoice();
    await updateAvatarMd({ lookKey, voiceId: voice.voiceId, voiceName: voice.voiceName });
    await updateFaceCatalog({ voiceId: voice.voiceId, voiceName: voice.voiceName });
    process.stdout.write(`Updated voice in ${AVATAR_MD} and ${FACE_JSON}\n`);
    return;
  }

  const pose = argVal('--pose') || 'half_body';
  const backdrop = argVal('--backdrop') || 'city';
  const prompt = argVal('--prompt') || (backdrop === 'sky' ? APPEARANCE_PROMPT_SKY : APPEARANCE_PROMPT);
  const groupId = hasFlag('--reuse-group') ? await readGroupIdFromAvatarMd() : argVal('--group-id');
  if (hasFlag('--reuse-group') && !groupId) {
    console.error('--reuse-group found no Group ID in AVATAR-ZED.md');
    process.exit(1);
  }

  process.stdout.write(
    `Creating Zed prompt avatar (Cyberpunk, ${lookKey}, ${pose}, ${backdrop} backdrop)…\n`
  );
  if (groupId) process.stdout.write('  joining existing Zed character\n');
  const created = await createPromptAvatar({
    name: lookKey === 'landscape' ? 'Zed — cyberpunk alien' : `Zed — cyberpunk alien (${lookKey})`,
    prompt,
    avatarGroupId: groupId || undefined,
    age: 'Young Adult',
    gender: 'Unspecified',
    ethnicity: 'Unspecified',
    style: 'Cyberpunk',
    orientation,
    pose
  });
  process.stdout.write(`  look_id: ${created.lookId}\n`);
  process.stdout.write(`  group_id: ${created.groupId || groupId || '(none)'}\n`);

  const voice = await resolveVoice();

  await updateAvatarMd({
    groupId: created.groupId || groupId,
    lookId: created.lookId,
    lookKey,
    voiceId: voice.voiceId,
    voiceName: voice.voiceName
  });
  process.stdout.write(`Updated ${AVATAR_MD}\n`);

  await updateFaceCatalog({
    lookId: created.lookId,
    lookKey,
    groupId: created.groupId || groupId,
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
