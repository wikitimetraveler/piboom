/**
 * Build Lane Family quick-start card using the same default-cover layout as trading cards.
 * Portrait: /family/assets/DavidELane.png (DEFAULT_CARD_COVER_IMAGE in lane-trading-cards.js)
 *
 * Usage: node scripts/tools/generate-lane-family-guide-card.mjs
 */
import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const GUIDE_PATH = path.join(ROOT, 'data/lane-family-guide.json');
const PUBLIC_ASSETS = path.join(ROOT, 'public/family/assets');
/** Same asset as DEFAULT_CARD_COVER_IMAGE in public/family/js/lane-trading-cards.js */
const DEFAULT_CARD_COVER = '/family/assets/DavidELane.png';

/** 2.5 × 3.5 in at ~280 DPI */
const CARD_W = 700;
const CARD_H = 980;
const PAD = 28;
const FOOTER_H = 112;
const INNER_W = CARD_W - PAD * 2;
const ART_H = CARD_H - PAD * 2 - FOOTER_H - 12;

function publicOrigin() {
  return 'https://www.thelanefamily.us';
}

function xmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchQrPng(url, size) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=1&data=${encodeURIComponent(url)}`;
  const res = await fetch(qrUrl);
  if (!res.ok) throw new Error(`QR fetch failed ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function wrapLines(text, maxLen) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLen && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function overlaySvg(card) {
  const titleLines = wrapLines(card.coverTitle, 22);
  const titleY = ART_H - 88;
  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="24" y="${titleY + i * 24}" fill="#f1f2f6" font-family="Georgia, serif" font-size="22" font-weight="700">${xmlEscape(line)}</text>`
    )
    .join('');

  return Buffer.from(`<svg width="${INNER_W}" height="${ART_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b0f18" stop-opacity="0"/>
      <stop offset="36%" stop-color="#0b0f18" stop-opacity="0"/>
      <stop offset="66%" stop-color="#0b0f18" stop-opacity="0.58"/>
      <stop offset="100%" stop-color="#0b0f18" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#shade)"/>
  <text x="24" y="34" fill="#dfc076" font-family="Inter, sans-serif" font-size="11" letter-spacing="2.2" font-weight="700">${xmlEscape(card.coverKicker)}</text>
  ${titleSvg}
  <text x="24" y="${titleY + (titleLines.length - 1) * 24 + 28}" fill="#d7dbea" font-family="Inter, sans-serif" font-size="14">${xmlEscape(card.coverDates)}</text>
  <text x="24" y="${titleY + (titleLines.length - 1) * 24 + 48}" fill="#bdc5d9" font-family="Inter, sans-serif" font-size="12">${xmlEscape(card.coverMeta)}</text>
</svg>`);
}

function footerSvg(card, qrSize) {
  const qrBox = qrSize + 16;
  const footerInnerH = FOOTER_H - 8;
  return Buffer.from(`<svg width="${INNER_W}" height="${footerInnerH}" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="28" fill="#f2f3f8" font-family="Inter, sans-serif" font-size="14" font-weight="700">${xmlEscape(card.footerTitle)}</text>
  <text x="0" y="48" fill="#ced4e3" font-family="Inter, sans-serif" font-size="12">${xmlEscape(card.footerDates)}</text>
  <rect x="${INNER_W - qrBox}" y="4" width="${qrBox}" height="${qrBox}" rx="6" fill="#f7f8fb" stroke="#f2e9d1" stroke-width="1" stroke-opacity="0.4"/>
</svg>`);
}

function frameSvg() {
  return Buffer.from(`<svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="face" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f1320"/>
      <stop offset="100%" stop-color="#1d2536"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" rx="22" fill="url(#face)" stroke="#b8860b" stroke-opacity="0.45" stroke-width="2"/>
  <rect x="${PAD}" y="${PAD}" width="${INNER_W}" height="${ART_H}" rx="10" fill="#141926" stroke="#f3dfa6" stroke-opacity="0.2" stroke-width="1"/>
</svg>`);
}

async function fitPortraitContain(portraitPath, boxW, boxH) {
  const portrait = sharp(portraitPath);
  const meta = await portrait.metadata();
  const scale = Math.min(boxW / meta.width, boxH / meta.height);
  const w = Math.round(meta.width * scale);
  const h = Math.round(meta.height * scale);
  const resized = await portrait.resize(w, h, { fit: 'inside' }).png().toBuffer();
  const canvas = await sharp({
    create: {
      width: boxW,
      height: boxH,
      channels: 4,
      background: { r: 20, g: 25, b: 38, alpha: 1 }
    }
  })
    .composite([{ input: resized, top: 0, left: Math.round((boxW - w) / 2) }])
    .png()
    .toBuffer();
  return canvas;
}

async function main() {
  const guide = JSON.parse(await readFile(GUIDE_PATH, 'utf8'));
  await mkdir(PUBLIC_ASSETS, { recursive: true });

  const card = {
    coverImage: guide.tradingCard?.coverImage || DEFAULT_CARD_COVER,
    coverKicker: guide.tradingCard?.coverKicker || 'Lane Legacy Museum',
    coverTitle: guide.tradingCard?.coverTitle || guide.title || 'How to use this site',
    coverDates: guide.tradingCard?.coverDates || 'Memorial · Museum · QR · Plates',
    coverMeta: guide.tradingCard?.coverMeta || 'Site guide · scan to watch',
    footerTitle: guide.tradingCard?.footerTitle || guide.title || 'How to use this site',
    footerDates: guide.tradingCard?.footerDates || '90-second tour'
  };

  const portraitAbs = path.join(ROOT, 'public', card.coverImage.replace(/^\//, ''));

  const landing = new URL(
    guide.shortLandingPath || `${guide.landingPath}?autoplay=1`,
    `${publicOrigin()}/`
  ).href;
  const cardOut = path.join(PUBLIC_ASSETS, 'lane-family-guide-card.png');

  const artInnerW = INNER_W - 2;
  const artInnerH = ART_H - 2;
  const portraitLayer = await fitPortraitContain(portraitAbs, artInnerW, artInnerH);
  const overlayLayer = await sharp(overlaySvg(card)).png().toBuffer();

  const qrSize = 84;
  const qrBuf = await fetchQrPng(landing, qrSize);
  const footerLayer = await sharp(footerSvg(card, qrSize)).png().toBuffer();

  const qrLeft = PAD + INNER_W - (qrSize + 16) + 8;
  const qrTop = PAD + ART_H + 12 + 8;

  await sharp(frameSvg())
    .composite([
      { input: portraitLayer, top: PAD + 1, left: PAD + 1 },
      { input: overlayLayer, top: PAD + 1, left: PAD + 1 },
      { input: footerLayer, top: PAD + ART_H + 12, left: PAD },
      { input: qrBuf, top: qrTop, left: qrLeft }
    ])
    .png({ quality: 95 })
    .toFile(cardOut);

  guide.qrLandingUrl = landing;
  guide.cardImageUrl = '/family/assets/lane-family-guide-card.png';
  guide.portraitUrl = card.coverImage;
  guide.tradingCard = card;
  await writeFile(GUIDE_PATH, `${JSON.stringify(guide, null, 2)}\n`, 'utf8');

  console.log(`Card: ${cardOut}`);
  console.log(`Cover: ${card.coverImage}`);
  console.log(`QR → ${landing}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
