/**
 * Clone one Middle East atlas folder + backend stubs from another.
 *
 * Jordan (`public/jordan/`) is the product base. Prefer:
 *   node scripts/tools/clone-me-atlas.mjs --from jordan --to <atlas> --guide … --guideAr … --prefix … --fromGuide Rami --fromGuideAr رامي --fromPrefix jd
 *
 * Legacy example (Oman-shaped clone):
 *   node scripts/tools/clone-me-atlas.mjs --from oman --to iran --guide Nima --guideAr نیما --prefix ir
 * Development work by David Lane
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const from = arg('from');
const to = arg('to');
const guide = arg('guide');
const guideAr = arg('guideAr');
const prefix = arg('prefix');
if (!from || !to || !guide || !guideAr || !prefix) {
  console.error('Usage: --from oman --to iran --guide Nima --guideAr نیما --prefix ir');
  process.exit(1);
}

const ROOT = process.cwd();
const fromCap = from.charAt(0).toUpperCase() + from.slice(1);
const toCap = to.charAt(0).toUpperCase() + to.slice(1);
const fromGuide = arg('fromGuide', 'Salim');
const fromGuideAr = arg('fromGuideAr', 'سليم');
const fromPrefix = arg('fromPrefix', 'om');

const fromPublic = path.join(ROOT, 'public', from);
const toPublic = path.join(ROOT, 'public', to);
if (!existsSync(fromPublic)) throw new Error(`Missing ${fromPublic}`);
if (existsSync(toPublic)) rmSync(toPublic, { recursive: true, force: true });
cpSync(fromPublic, toPublic, { recursive: true });

function walk(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function renamePath(filePath) {
  const base = path.basename(filePath);
  let next = base
    .replaceAll(from, to)
    .replaceAll(fromGuide.toLowerCase(), guide.toLowerCase())
    .replaceAll(fromGuide, guide);
  if (next === base) return filePath;
  const dest = path.join(path.dirname(filePath), next);
  if (filePath !== dest) {
    cpSync(filePath, dest);
    rmSync(filePath);
  }
  return dest;
}

const textExt = new Set(['.html', '.css', '.js', '.json', '.svg', '.md']);
for (const file of walk(toPublic)) {
  const renamed = renamePath(file);
  const ext = path.extname(renamed).toLowerCase();
  if (!textExt.has(ext)) continue;
  let c = readFileSync(renamed, 'utf8');
  c = c
    .replaceAll(`/${from}/`, `/${to}/`)
    .replaceAll(from, to)
    .replaceAll(fromCap, toCap)
    .replaceAll(`${fromCap}I18N`, `${toCap}I18N`)
    .replaceAll(`${from}Lang`, `${to}Lang`)
    .replaceAll(`${from}StoryNarrate`, `${to}StoryNarrate`)
    .replaceAll(fromGuide, guide)
    .replaceAll(fromGuide.toLowerCase(), guide.toLowerCase())
    .replaceAll(fromGuideAr, guideAr)
    .replaceAll(`${fromPrefix}-`, `${prefix}-`)
    .replace(new RegExp(`\\b${fromPrefix}([A-Z])`, 'g'), `${prefix}$1`)
    .replaceAll(`id="${fromPrefix}`, `id="${prefix}`)
    .replaceAll(`#${fromPrefix}`, `#${prefix}`)
    .replaceAll(`data-${fromPrefix}-`, `data-${prefix}-`)
    .replaceAll(`getElementById('${fromPrefix}`, `getElementById('${prefix}`)
    .replaceAll(`getElementById("${fromPrefix}`, `getElementById("${prefix}`)
    .replaceAll(`'${from}-`, `'${to}-`)
    .replaceAll(`"${from}-`, `"${to}-`)
    .replaceAll(`/api/${from}/`, `/api/${to}/`);
  writeFileSync(renamed, c, 'utf8');
}

function copyStub(relFrom, relTo, transform) {
  const src = path.join(ROOT, relFrom);
  const dest = path.join(ROOT, relTo);
  mkdirSync(path.dirname(dest), { recursive: true });
  let c = readFileSync(src, 'utf8');
  c = transform(c);
  writeFileSync(dest, c, 'utf8');
}

const renameTokens = (c) =>
  c
    .replaceAll(from, to)
    .replaceAll(fromCap, toCap)
    .replaceAll(fromGuide, guide)
    .replaceAll(fromGuide.toLowerCase(), guide.toLowerCase())
    .replaceAll(fromGuideAr, guideAr)
    .replaceAll(`${fromPrefix}-`, `${prefix}-`)
    .replace(new RegExp(`\\b${fromPrefix}([A-Z])`, 'g'), `${prefix}$1`)
    .replaceAll(`chatWith${fromGuide}`, `chatWith${guide}`)
    .replaceAll(`get${fromCap}Summary`, `get${toCap}Summary`)
    .replaceAll(`${from.toUpperCase()}_ASSISTANT_MODEL`, `${to.toUpperCase()}_ASSISTANT_MODEL`);

copyStub(
  `services/${from}-assistant.service.js`,
  `services/${to}-assistant.service.js`,
  renameTokens
);
copyStub(
  `controllers/${from}-assistant.controller.js`,
  `controllers/${to}-assistant.controller.js`,
  renameTokens
);
copyStub(`routes/${from}.routes.js`, `routes/${to}.routes.js`, renameTokens);
copyStub(`data/${from}-heygen-demo.json`, `data/${to}-heygen-demo.json`, renameTokens);
copyStub(
  `tests/unit/${from}-atlas-content.test.js`,
  `tests/unit/${to}-atlas-content.test.js`,
  (c) =>
    renameTokens(c)
      .replaceAll(`startsWith('${fromPrefix}')`, `startsWith('${prefix}')`)
      .replaceAll(`toMatch(/${fromCap}/)`, `toMatch(/${toCap}/)`)
);

console.log(`Cloned ${from} → ${to} (guide ${guide}, prefix ${prefix})`);
