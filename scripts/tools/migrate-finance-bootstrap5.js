/**
 * One-off: swap Bootstrap 4.5.2 StackPath URLs for 5.3.3 jsDelivr in public/finance/*.html
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
const dir = path.join(root, 'public', 'finance');

const cssOld = 'https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css';
const cssNew = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
const jsMinOld = 'https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js';
const jsBundleOld = 'https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.bundle.min.js';
const jsNew = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';
const popperNeedle = '<script src="https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.1/dist/umd/popper.min.js"></script>';

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
let touched = 0;
for (const f of files) {
  const p = path.join(dir, f);
  let s = fs.readFileSync(p, 'utf8');
  if (!s.includes(cssOld) && !s.includes(jsMinOld) && !s.includes(jsBundleOld)) continue;
  let t = s.replaceAll(cssOld, cssNew);
  t = t.replaceAll(jsMinOld, jsNew);
  t = t.replaceAll(jsBundleOld, jsNew);
  if (t.includes(popperNeedle)) {
    t = t.split(popperNeedle).join('');
  }
  if (t !== s) {
    fs.writeFileSync(p, t);
    touched++;
    console.log('updated', f);
  }
}
console.log('files touched', touched);
