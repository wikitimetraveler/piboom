/**
 * Bootstrap 5 data-bs-* and common v4 utility class migrations for public/finance/*.html
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', '..', 'public', 'finance');

function migrate(content) {
  let t = content;
  t = t.replace(/\bdata-toggle="/g, 'data-bs-toggle="');
  t = t.replace(/\bdata-target="/g, 'data-bs-target="');
  t = t.replace(/\bdata-dismiss="/g, 'data-bs-dismiss="');

  t = t.replace(/\bmr-auto\b/g, 'me-auto');
  t = t.replace(/\bmr-1\b/g, 'me-1');
  t = t.replace(/\bmr-2\b/g, 'me-2');
  t = t.replace(/\bmr-3\b/g, 'me-3');
  t = t.replace(/\bml-auto\b/g, 'ms-auto');
  t = t.replace(/\bml-1\b/g, 'ms-1');
  t = t.replace(/\bml-2\b/g, 'ms-2');
  t = t.replace(/\bml-3\b/g, 'ms-3');
  t = t.replace(/\bpl-2\b/g, 'ps-2');
  t = t.replace(/\bpl-3\b/g, 'ps-3');
  t = t.replace(/\bpr-2\b/g, 'pe-2');
  t = t.replace(/\bpr-3\b/g, 'pe-3');
  t = t.replace(/\bfont-weight-bold\b/g, 'fw-bold');
  t = t.replace(/\btext-left\b/g, 'text-start');
  t = t.replace(/\btext-right\b/g, 'text-end');
  t = t.replace(/\bform-group\b/g, 'mb-3');

  t = t.replace(/\bbadge badge-pill\b/g, 'badge rounded-pill');
  t = t.replace(/\bbadge-pill\b/g, 'rounded-pill');
  return t;
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
let touched = 0;
for (const f of files) {
  const p = path.join(dir, f);
  const before = fs.readFileSync(p, 'utf8');
  const after = migrate(before);
  if (after !== before) {
    fs.writeFileSync(p, after);
    touched++;
    console.log('migrated', f);
  }
}
console.log('files touched', touched);
