/**
 * Development work by David Lane
 */
/**
 * Remove BS4 input-group-prepend / input-group-append wrappers (flat structure for BS5).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', '..', 'public', 'finance');

/** Unwrap: <div class="input-group-prepend|append">INNER</div> -> INNER */
function unwrap(content) {
  let t = content;
  const re = /<div class="input-group-(?:prepend|append)">\s*([\s\S]*?)\s*<\/div>/g;
  let m;
  let prev = t;
  let guard = 0;
  while (guard++ < 5000) {
    t = t.replace(re, '$1');
    if (t === prev) break;
    prev = t;
  }
  return t;
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
let touched = 0;
for (const f of files) {
  const p = path.join(dir, f);
  const before = fs.readFileSync(p, 'utf8');
  if (!before.includes('input-group-prepend') && !before.includes('input-group-append')) continue;
  const after = unwrap(before);
  if (after !== before) {
    fs.writeFileSync(p, after);
    touched++;
    console.log('unwrapped', f);
  }
}
console.log('files touched', touched);
