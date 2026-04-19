/**
 * Optional second pass: send batched raw page text to OpenAI and write staging JSON for human merge.
 * Requires OPENAI_API_KEY. Does not modify lane-book-sayings.json.
 *
 * Usage: node scripts/extract_lane_sayings_llm.mjs [--from-page 1] [--to-page 30] [--batch 4]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'lane-book-sayings-llm-staging.json');
const PY = path.join(ROOT, 'scripts', 'dump_lane_pdf_pages_json.py');

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (name, def) => {
    const i = a.indexOf(name);
    return i >= 0 && a[i + 1] != null ? a[i + 1] : def;
  };
  return {
    fromPage: parseInt(get('--from-page', '1'), 10),
    toPage: parseInt(get('--to-page', '30'), 10),
    batch: parseInt(get('--batch', '4'), 10)
  };
}

async function main() {
  const { fromPage, toPage, batch } = parseArgs();
  const key = (process.env.OPENAI_API_KEY || '').trim();
  if (!key) {
    console.error('OPENAI_API_KEY not set; skipping LLM extraction.');
    const stub = {
      version: 1,
      skipped: true,
      reason: 'OPENAI_API_KEY not set',
      generatedAt: new Date().toISOString(),
      entries: []
    };
    fs.writeFileSync(OUT, JSON.stringify(stub, null, 2) + '\n', 'utf8');
    process.exit(0);
  }

  const raw = execFileSync(process.platform === 'win32' ? 'python' : 'python3', [
    PY,
    '--from-page',
    String(fromPage),
    '--to-page',
    String(toPage)
  ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

  const pages = JSON.parse(raw);
  const openai = new OpenAI({ apiKey: key });

  const system = `You extract short memorable lines from a 19th-century Lane family genealogy PDF OCR text.
Return ONLY valid JSON: {"items":[{"quote":"...","pdfPage":number,"description":"why it matters (one sentence)","tags":["tag"]}]}
Rules:
- Prefer quoted dialogue, chapter headings, preface remarks, witty asides — NOT routine birth/marriage lists.
- Keep each quote under 400 characters.
- pdfPage must match the page number given in the batch context.
- If nothing qualifies, return {"items":[]}.`;

  const allItems = [];

  for (let i = 0; i < pages.length; i += batch) {
    const chunk = pages.slice(i, i + batch);
    const user = `Pages in this batch:\n${chunk
      .map((p) => `--- PDF page ${p.pdfPage} ---\n${p.text}`)
      .join('\n\n')}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      max_tokens: 1200,
      temperature: 0.3
    });

    const text = completion.choices[0]?.message?.content || '';
    let parsed;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : text);
    } catch {
      console.warn('Batch parse failed, skipping chunk', i);
      continue;
    }
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    for (const it of items) {
      if (!it.quote || it.pdfPage == null) continue;
      allItems.push({
        id: `llm-p${it.pdfPage}-${allItems.length}`,
        quote: String(it.quote).slice(0, 500),
        description: String(it.description || '').slice(0, 300),
        pdfPage: Number(it.pdfPage),
        tags: Array.isArray(it.tags) ? it.tags.map(String).slice(0, 8) : ['llm'],
        kind: 'llm',
        status: 'pending_review'
      });
    }
  }

  const doc = {
    version: 1,
    skipped: false,
    generatedAt: new Date().toISOString(),
    source: 'lanegenealogies01chap.pdf',
    fromPage,
    toPage,
    entryCount: allItems.length,
    entries: allItems
  };
  fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${allItems.length} LLM candidates to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
