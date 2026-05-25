#!/usr/bin/env node
/**
 * Development work by David Lane
 *
 * One-off utility: add lightweight source attribution headers to app source files.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const HEADER_TEXT = 'Development work by David Lane';

const INCLUDE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.html', '.css']);
const EXCLUDE_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.cursor',
  'knowledge-sources',
  'data'
]);
const EXCLUDE_FILE_PATTERNS = [
  /\.min\.(js|css)$/i,
  /package-lock\.json$/i,
  /yarn\.lock$/i
];

function shouldSkipDir(dirName) {
  return EXCLUDE_DIR_NAMES.has(dirName);
}

function shouldProcessFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!INCLUDE_EXTENSIONS.has(ext)) return false;
  const base = path.basename(filePath);
  if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(base))) return false;
  return true;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
      continue;
    }
    const full = path.join(dir, entry.name);
    if (shouldProcessFile(full)) out.push(full);
  }
  return out;
}

function hasExistingAttribution(content) {
  if (/Development work by David Lane/i.test(content.slice(0, 400))) return true;

  const topLines = content.split(/\r?\n/).slice(0, 20);
  for (const line of topLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!/^(\/\*|\/\/|\*|<!--)/.test(trimmed)) continue;
    if (/David Lane/i.test(trimmed)) return true;
    if (/DevConnect Labs/i.test(trimmed)) return true;
    if (/@author\s+David/i.test(trimmed)) return true;
  }
  return false;
}

function addHeader(content, ext) {
  if (hasExistingAttribution(content)) return null;

  if (ext === '.html') {
    const doctypeMatch = content.match(/^(\s*<!DOCTYPE html[^>]*>\s*)/i);
    if (doctypeMatch) {
      return `${doctypeMatch[1]}<!-- ${HEADER_TEXT} -->\n${content.slice(doctypeMatch[0].length)}`;
    }
    return `<!-- ${HEADER_TEXT} -->\n${content}`;
  }

  const shebangMatch = content.match(/^(#!.*\n)/);
  const body = shebangMatch ? content.slice(shebangMatch[0].length) : content;
  const prefix = shebangMatch ? shebangMatch[0] : '';

  if (ext === '.css') {
    return `${prefix}/**\n * ${HEADER_TEXT}\n */\n${body}`;
  }

  return `${prefix}/**\n * ${HEADER_TEXT}\n */\n${body}`;
}

function main() {
  const files = walk(repoRoot);
  let updated = 0;
  let skipped = 0;

  for (const filePath of files) {
    const rel = path.relative(repoRoot, filePath);
    const ext = path.extname(filePath).toLowerCase();
    const original = fs.readFileSync(filePath, 'utf8');
    const next = addHeader(original, ext);
    if (next === null) {
      skipped += 1;
      continue;
    }
    if (next !== original) {
      fs.writeFileSync(filePath, next, 'utf8');
      updated += 1;
      process.stdout.write(`updated ${rel}\n`);
    }
  }

  process.stdout.write(`\nDone. Updated ${updated} files, skipped ${skipped} with existing attribution.\n`);
}

main();
