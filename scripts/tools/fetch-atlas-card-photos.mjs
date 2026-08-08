#!/usr/bin/env node
/**
 * Fetch Wikimedia Commons photos for atlas card/era image paths.
 *
 *   node scripts/tools/fetch-atlas-card-photos.mjs --atlas iran
 *   node scripts/tools/fetch-atlas-card-photos.mjs --atlas iraq
 *   node scripts/tools/fetch-atlas-card-photos.mjs --atlas oman
 *   node scripts/tools/fetch-atlas-card-photos.mjs --atlas lebanon
 *   node scripts/tools/fetch-atlas-card-photos.mjs --atlas egypt
 *
 * For each foods/music/hookah/living/raqs/eras item with an `image` path, if the file
 * is missing, search Commons (filetype:bitmap), accept CC/PD licenses, download
 * a ~1000px thumb, and write credits to public/<atlas>/data/<atlas>-photo-credits.json.
 *
 * Development work by David Lane
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'DevConnectLabs-Atlas/1.0 (https://devconnectlabs.example; atlas@devconnectlabs.example)';
const ROOT = process.cwd();
const THUMB_WIDTH = 1000;
const SLEEP_MS = 400;

const ALLOWED_LICENSE = /^(cc0|cc[- ]?by([- ]?sa)?([- ]?\d(\.\d)?)?|public domain|pd\b|no restrictions)/i;

const COUNTRY = {
  iran: 'Iran',
  iraq: 'Iraq',
  oman: 'Oman',
  lebanon: 'Lebanon',
  egypt: 'Egypt'
};

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(params) {
  const url = new URL(API);
  url.search = new URLSearchParams({ format: 'json', formatversion: '2', ...params }).toString();
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return res.json();
}

function readMeta(page) {
  const info = page?.imageinfo?.[0];
  if (!info) return null;
  const meta = info.extmetadata || {};
  return {
    title: page.title,
    thumbUrl: info.thumburl || info.url,
    width: info.width,
    height: info.height,
    mime: info.mime,
    artist: stripHtml(meta.Artist?.value) || 'Unknown',
    credit: stripHtml(meta.Credit?.value),
    license: stripHtml(meta.LicenseShortName?.value) || 'Unknown',
    licenseUrl: stripHtml(meta.LicenseUrl?.value),
    descriptionUrl: info.descriptionurl,
    caption: stripHtml(meta.ImageDescription?.value).slice(0, 240)
  };
}

async function search(query, limit = 8) {
  const data = await api({
    action: 'query',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(THUMB_WIDTH)
  });
  return (data.query?.pages || []).map(readMeta).filter(Boolean);
}

async function download(url, destination) {
  let wait = 1500;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, buffer);
      return buffer.length;
    }
    if (res.status !== 429 && res.status !== 503) throw new Error(`Download ${res.status} for ${url}`);
    await sleep(wait);
    wait *= 2;
  }
  throw new Error(`Download rate-limited after 5 attempts: ${url}`);
}

function publicPathToFs(imagePath) {
  return path.join(ROOT, 'public', imagePath.replace(/^\//, '').replace(/\//g, path.sep));
}

function buildQueries(item, section, country) {
  const name = item.name?.en || item.title?.en || item.id;
  const idWords = String(item.id || '').replace(/-/g, ' ');
  const extras = {
    'qalyun-chai': ['qalyan Iran', 'Persian hookah', 'ghalyan Iran'],
    chalghi: ['Iraqi maqam ensemble', 'santur Iraq', 'Baghdad musicians'],
    'nargileh-evening': ['nargileh', 'hookah cafe', 'argileh Middle East'],
    'iraqi-tea': ['chai istikan Iraq', 'tea Iraq'],
    shuwa: ['Omani shuwa', 'slow cooked meat Oman'],
    kahwa: ['Arabic coffee pot dallah', 'qahwa dates Gulf', 'Omani coffee'],
    mashuai: ['samak mashwi', 'Fish Market Mutrah Oman', 'Fish Souk Quriyat Muscat'],
    lokhemat: ['luqaimat', 'lokma honey', 'Gulf sweet dumplings'],
    razha: ['Omani sword dance', 'razhah', 'traditional dance Oman'],
    barah: ['baraah dance', 'Dhofar dance', 'Yemen dance dagger'],
    'contemporary-music': ['oud concert Arab', 'Arabic music stage', 'musician Middle East'],
    'majlis-qahwa': ['majlis Gulf', 'Arabic coffee majlis', 'dallah coffee'],
    'shisha-gulf': ['shisha cafe', 'hookah lounge', 'argileh'],
    'bedouin-sharqiya': ['Wahiba Sands', 'Oman desert camp', 'Bedouin camel Oman'],
    tabbouleh: ['tabbouleh salad', 'Lebanese parsley salad', 'tabbouleh'],
    kibbeh: ['kibbeh Lebanon', 'kibbe fried', 'Lebanese kibbeh'],
    manakish: ['manakish zaatar', 'manaeesh Lebanon', 'zaatar flatbread'],
    fattoush: ['fattoush salad', 'Lebanese fattoush', 'sumac salad'],
    shawarma: ['shawarma sandwich Lebanon', 'shawarma spit', 'shaurma'],
    knafeh: ['knafeh cheese', 'kanafeh Tripoli', 'kunafa'],
    mezze: ['Lebanese mezze table', 'mezze platter', 'hummus mezze'],
    'arak-table': ['arak drink Lebanon', 'arak anise', 'Lebanese arak'],
    fairuz: ['Fairuz singer', 'Fairouz Lebanon', 'Fairuz concert'],
    dabke: ['dabke dance', 'Lebanese dabke', 'dabkeh wedding'],
    'oud-beirut': ['oud instrument', 'Arabic oud player', 'oud Beirut'],
    rahbani: ['Rahbani brothers', 'Lebanese musical theater', 'Assi Rahbani'],
    'folk-village': ['Lebanese village festival', 'folk dance Lebanon', 'mountain village Lebanon'],
    'beirut-corniche': ['Beirut corniche', 'Beirut seaside', 'Raouche Beirut'],
    'tripoli-nargileh': ['Tripoli Lebanon souk', 'nargileh cafe', 'argileh Lebanon'],
    'hamra-cafe': ['Hamra Beirut cafe', 'Beirut coffee shop', 'cafe Beirut'],
    'mountain-argileh': ['Lebanon mountain cafe', 'Chouf Lebanon', 'Beiteddine'],
    cedars: ['Cedars of God Lebanon', 'Cedrus libani', 'Arz el Rab'],
    diaspora: ['Lebanese diaspora', 'Lebanese immigrants', 'Lebanon passport'],
    village: ['Lebanese mountain village', 'stone village Lebanon', 'Chouf village'],
    'mediterranean-coast': ['Lebanon coast Byblos', 'Mediterranean Lebanon beach', 'Jbeil harbor'],
    'arabic-print': ['Arabic newspaper Beirut', 'Arabic printing press', 'bookstore Beirut'],
    phoenician: ['Byblos ruins Phoenician', 'Phoenician ruins Lebanon', 'Jbeil castle'],
    roman: ['Baalbek temple', 'Baalbek ruins', 'Temple of Bacchus'],
    'byzantine-islamic': ['Aanjar ruins', 'Anjar Umayyad', 'Aanjar Lebanon'],
    crusader: ['Tripoli citadel Lebanon', 'Crusader castle Lebanon', 'Sidon Sea Castle'],
    ottoman: ['Beiteddine Palace', 'Beit ed-Dine', 'Ottoman palace Lebanon'],
    mandate: ['Beirut 1920s', 'Grand Serail Beirut', 'Mandate Beirut'],
    independence: ['Lebanese independence', 'Beirut parliament', 'Lebanon flag cedar'],
    contemporary: ['Beirut skyline', 'modern Beirut', 'Lebanon contemporary'],
    predynastic: ['Narmer Palette', 'predynastic Egypt pottery', 'Early Dynastic Egypt'],
    'old-kingdom': ['Great Pyramid of Giza', 'Giza pyramids', 'Khufu pyramid'],
    'new-kingdom': ['Karnak Temple', 'Luxor Temple pylons', 'Valley of the Kings'],
    'late-ptolemaic': ['Alexandria Egypt harbor', 'Ptolemaic Egypt', 'Cleopatra Alexandria'],
    'roman-byzantine': ['Roman theater Alexandria', 'Pompeys Pillar Alexandria', 'Coptic Egypt'],
    'islamic-fatimid': ['Al-Azhar Mosque Cairo', 'Fatimid Cairo', 'Bab Zuweila'],
    mamluk: ['Mamluk Cairo mosque', 'Sultan Hassan Mosque', 'Historic Cairo'],
    'muhammad-ali': ['Muhammad Ali Mosque Cairo', 'Citadel of Cairo', 'Khedival Cairo'],
    koshari: ['koshari Egypt', 'Egyptian kushari', 'koshary street food'],
    'ful-medames': ['ful medames', 'Egyptian fava beans', 'foul medames'],
    taameya: ['taameya Egypt', 'Egyptian falafel', 'tamiya'],
    molokhia: ['molokhia Egypt', 'mulukhiyah', 'Egyptian green soup'],
    fatteh: ['Egyptian fatteh', 'fatteh Egypt', 'fattah bread'],
    mahshi: ['mahshi Egypt', 'Egyptian stuffed vegetables', 'mahshy'],
    hawawshi: ['hawawshi', 'Egyptian hawawshi', 'hawaweshy'],
    basbousa: ['basbousa', 'basbousa cake Egypt', 'semolina cake'],
    konafa: ['kunafa Egypt', 'konafa Cairo', 'knafeh Egyptian'],
    feteer: ['feteer meshaltet', 'Egyptian feteer', 'fiteer'],
    'umm-ali': ['umm ali dessert', 'om ali Egypt', 'Egyptian bread pudding'],
    'tea-shai': ['Egyptian tea mint', 'shai Egypt', 'tea glass Egypt'],
    'um-kulthum': ['Umm Kulthum', 'Om Kalthoum', 'Umm Kulthum concert'],
    'oud-egypt': ['oud player Egypt', 'Arabic oud Cairo', 'oud instrument'],
    tabla: ['darbuka Egypt', 'tabla drum Egypt', 'goblet drum'],
    'folk-saidi': ['Saidi dance Egypt', 'tahtib', 'Upper Egypt folk'],
    mawwal: ['mawwal singer', 'Arabic mawwal', 'Egyptian singer'],
    'classical-tarab': ['takht ensemble', 'Arabic classical music', 'qanun Egypt'],
    'contemporary-cairo': ['Cairo concert', 'Egyptian pop singer', 'Cairo nightlife music'],
    'sufi-dhikr': ['Sufi dhikr Egypt', 'mawlid Egypt', 'Sufi drums'],
    'nile-folk': ['Nile felucca Aswan', 'Nubian music', 'Egyptian folk boat'],
    'egyptian-pop': ['Egyptian shaabi', 'Cairo pop music', 'shaabi singer'],
    'cairo-ahwa': ['Cairo cafe ahwa', 'Egyptian coffeehouse', 'ahwa Cairo'],
    'nile-terrace': ['Nile corniche Cairo', 'Cairo river cafe', 'Nile terrace'],
    'alexandria-cafe': ['Alexandria corniche cafe', 'Alexandria Egypt cafe', 'Mediterranean cafe Egypt'],
    'khan-shisha': ['Khan el Khalili', 'shisha Cairo', 'hookah Cairo'],
    'aswan-evening': ['Aswan Nile evening', 'Aswan felucca sunset', 'Aswan Egypt'],
    'nile-flood-memory': ['Nile flood Egypt', 'Nile irrigation', 'Egyptian farmland Nile'],
    calligraphy: ['Arabic calligraphy Cairo', 'Islamic calligraphy Egypt', 'Cairo calligraphy'],
    souq: ['Egyptian souq', 'Cairo market', 'Khan el Khalili market'],
    felucca: ['felucca Nile', 'felucca Aswan', 'Nile sailboat'],
    'coptic-community': ['Coptic church Cairo', 'Hanging Church Cairo', 'Coptic Egypt'],
    'bedouin-sinai': ['Sinai Bedouin', 'St Catherine Sinai', 'Bedouin camp Egypt'],
    'cafe-culture': ['Cairo ahwa', 'Egyptian cafe culture', 'coffeehouse Cairo'],
    'craft-khan': ['Khan el Khalili crafts', 'copper Cairo souq', 'Egyptian handicrafts'],
    baladi: ['Egyptian baladi dance', 'belly dance Egypt folk', 'raqs baladi Cairo'],
    'raqs-sharqi': ['raqs sharqi', 'oriental dance Egypt', 'belly dance stage Egypt'],
    'tahtib-dance': ['tahtib Egypt', 'stick dance Upper Egypt', 'Saidi stick dance'],
    zaffa: ['Egyptian wedding zaffa', 'zaffa drums Cairo', 'wedding procession Egypt'],
    'tabla-solo': ['darbuka solo dancer', 'tabla dancer Egypt', 'belly dance drum solo'],
    'cinema-dance': ['Samia Gamal', 'Egyptian cinema dance', 'Tahiya Karioka']
  };
  const countryExtras = {
    Egypt: {
      contemporary: ['Cairo skyline Egypt', 'modern Cairo', 'Cairo Nile night'],
      ottoman: ['Ottoman Cairo mosque', 'Cairo citadel', 'Historic Cairo street'],
      calligraphy: ['Arabic calligraphy Cairo', 'Islamic calligraphy Egypt']
    }
  };
  const base = [
    `${name} ${country}`,
    `${idWords} ${country}`,
    `${name}`,
    section === 'eras' ? `${name} archaeology ${country}` : `${name} ${section} ${country}`,
    ...((countryExtras[country] && countryExtras[country][item.id]) || []),
    ...(extras[item.id] || [])
  ];
  return [...new Set(base.map((q) => q.trim()).filter(Boolean))];
}

function collectItems(content) {
  const out = [];
  for (const era of content.eras || []) {
    if (era.image) out.push({ section: 'eras', item: era });
  }
  for (const section of ['foods', 'music', 'hookah', 'living', 'raqs']) {
    for (const item of content[section] || []) {
      if (item.image) out.push({ section, item });
    }
  }
  return out;
}

async function pickLicensedResult(queries) {
  for (const query of queries) {
    const results = await search(query);
    await sleep(SLEEP_MS);
    const ok = results.find((r) => ALLOWED_LICENSE.test(r.license) && r.thumbUrl);
    if (ok) return { meta: ok, query };
  }
  return null;
}

async function main() {
  const atlas = String(arg('atlas') || '').toLowerCase();
  if (!COUNTRY[atlas]) {
    console.error('Usage: --atlas iran|iraq|oman|lebanon|egypt');
    process.exit(1);
  }

  const contentPath = path.join(ROOT, 'public', atlas, 'data', `${atlas}-content.json`);
  const creditsPath = path.join(ROOT, 'public', atlas, 'data', `${atlas}-photo-credits.json`);
  const content = JSON.parse(await readFile(contentPath, 'utf8'));
  const country = COUNTRY[atlas];

  let credits = {};
  try {
    credits = JSON.parse(await readFile(creditsPath, 'utf8')).credits || {};
  } catch (_) {
    /* first run */
  }

  const items = collectItems(content);
  let downloaded = 0;
  let skipped = 0;
  let blocked = 0;
  const problems = [];

  for (const { section, item } of items) {
    const dest = publicPathToFs(item.image);
    const creditKey = `${section}/${item.id}`;
    if (existsSync(dest)) {
      console.log(`· ${creditKey.padEnd(36)} cached`);
      skipped += 1;
      continue;
    }

    try {
      const picked = await pickLicensedResult(buildQueries(item, section, country));
      if (!picked) {
        problems.push(`${creditKey}: no CC/PD Commons match`);
        blocked += 1;
        console.log(`✗ ${creditKey.padEnd(36)} no licensed match`);
        continue;
      }
      const bytes = await download(picked.meta.thumbUrl, dest);
      credits[creditKey] = {
        id: item.id,
        section,
        image: item.image,
        file: picked.meta.title,
        license: picked.meta.license,
        licenseUrl: picked.meta.licenseUrl,
        artist: picked.meta.artist,
        credit: picked.meta.credit,
        descriptionUrl: picked.meta.descriptionUrl,
        query: picked.query,
        bytes
      };
      downloaded += 1;
      console.log(`✓ ${creditKey.padEnd(36)} ${picked.meta.license} ← ${picked.query}`);
      await sleep(SLEEP_MS);
    } catch (err) {
      problems.push(`${creditKey}: ${err.message}`);
      blocked += 1;
      console.log(`✗ ${creditKey.padEnd(36)} ${err.message}`);
    }
  }

  content.photoCredits = `/${atlas}/data/${atlas}-photo-credits.json`;
  await writeFile(contentPath, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  await mkdir(path.dirname(creditsPath), { recursive: true });
  await writeFile(
    creditsPath,
    `${JSON.stringify({ atlas, updatedAt: new Date().toISOString(), credits }, null, 2)}\n`,
    'utf8'
  );

  console.log(`\n${atlas}: downloaded=${downloaded} cached=${skipped} blocked=${blocked}`);
  if (problems.length) {
    console.log('Blocked / problems:');
    for (const p of problems) console.log(`  - ${p}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
