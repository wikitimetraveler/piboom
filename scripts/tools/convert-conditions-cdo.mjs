#!/usr/bin/env node
/**
 * Development work by David Lane
 *
 * Dry-run converter: legacy ConditionsTemplate.xml CDO -> Encompass Enhanced Conditions
 * payloads plus a data-quality report. Writes files only; never calls the Encompass API.
 *
 * Usage:
 *   node scripts/tools/convert-conditions-cdo.mjs --input <cdo.json|cdo.xml> [--personas <personas.json>]
 *     [--persona-source <UAT|Production|label>] [--out <dir>]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  buildMigrationBundle,
  readConditionsCdo,
  renderMigrationReport,
} from '../../services/encompass-conditions-migration.service.js';

const DEFAULT_OUT = path.join('data', 'encompass-conditions');

// npm strips `--flag value` pairs it mistakes for its own config, so positional
// arguments are accepted as a fallback for `npm run convert:conditions-cdo -- ...`.
function parseArgs(argv) {
  const args = { input: null, personas: null, personaSource: null, out: DEFAULT_OUT };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--input' || flag === '-i') args.input = argv[++i];
    else if (flag === '--personas' || flag === '-p') args.personas = argv[++i];
    else if (flag === '--persona-source' || flag === '-s') args.personaSource = argv[++i];
    else if (flag === '--out' || flag === '-o') args.out = argv[++i];
    else if (flag === '--help' || flag === '-h') args.help = true;
    else if (!flag.startsWith('-')) positional.push(flag);
  }

  args.input ??= positional[0] ?? null;
  args.personas ??= positional[1] ?? null;
  if (args.out === DEFAULT_OUT && positional[2]) args.out = positional[2];
  return args;
}

// Handed over as bytes so the reader can sniff the encoding itself: a saved response can
// be UTF-16 or gzipped, and decoding it as UTF-8 here would corrupt it before it arrives.
const readCdo = (inputPath) => fs.readFile(inputPath);

async function readPersonas(personasPath) {
  if (!personasPath) return [];
  const parsed = JSON.parse(await fs.readFile(personasPath, 'utf8'));
  if (Array.isArray(parsed)) return parsed;
  return parsed.personas || parsed.items || parsed.value || [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.input) {
    console.log('Usage: node scripts/tools/convert-conditions-cdo.mjs --input <cdo.json|cdo.xml> [--personas <file>] [--persona-source <UAT|Production|label>] [--out <dir>]');
    process.exit(args.help ? 0 : 1);
  }

  const { xml, notes } = readConditionsCdo(await readCdo(args.input));
  const personas = await readPersonas(args.personas);
  const bundle = buildMigrationBundle(xml, { personas, personaSource: args.personaSource });

  await fs.mkdir(args.out, { recursive: true });
  const write = (name, value) =>
    fs.writeFile(path.join(args.out, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');

  await Promise.all([
    write('condition-types.json', bundle.conditionTypes),
    write('condition-templates.json', bundle.conditionTemplates),
    write('acl-profiles.json', { profiles: bundle.aclProfiles, assignments: bundle.aclAssignments }),
    write('normalized-conditions.json', bundle.conditions),
    write('data-quality-report.json', { summary: bundle.summary, issues: bundle.issues, personaReconciliation: bundle.personaReconciliation }),
    write('data-quality-report.md', renderMigrationReport(bundle)),
  ]);

  console.log(`Read ${args.input} as ${notes.length ? notes.join(' -> ') : 'plain Conditions XML'}`);
  console.log(`Wrote dry-run artifacts to ${args.out}`);
  for (const [key, value] of Object.entries(bundle.summary)) console.log(`  ${key}: ${value}`);

  if (!personas.length) {
    console.log('\nPersona reconciliation skipped (no --personas supplied).');
  } else if (bundle.personaSource.provisional) {
    console.log(
      `\nPersona list treated as provisional (${bundle.personaSource.label || 'unlabelled'}).`
      + ' Re-run with --persona-source Production before configuring anything.',
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
