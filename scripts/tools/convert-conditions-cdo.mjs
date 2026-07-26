#!/usr/bin/env node
/**
 * Development work by David Lane
 *
 * Dry-run converter: legacy ConditionsTemplate.xml CDO -> Encompass Enhanced Conditions
 * payloads plus a data-quality report. Writes files only; never calls the Encompass API.
 *
 * Usage:
 *   node scripts/tools/convert-conditions-cdo.mjs --input <cdo.json|cdo.xml> [--personas <personas.json>] [--out <dir>]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildMigrationBundle } from '../../services/encompass-conditions-migration.service.js';

const DEFAULT_OUT = path.join('data', 'encompass-conditions');

// npm strips `--flag value` pairs it mistakes for its own config, so positional
// arguments are accepted as a fallback for `npm run convert:conditions-cdo -- ...`.
function parseArgs(argv) {
  const args = { input: null, personas: null, out: DEFAULT_OUT };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--input' || flag === '-i') args.input = argv[++i];
    else if (flag === '--personas' || flag === '-p') args.personas = argv[++i];
    else if (flag === '--out' || flag === '-o') args.out = argv[++i];
    else if (flag === '--help' || flag === '-h') args.help = true;
    else if (!flag.startsWith('-')) positional.push(flag);
  }

  args.input ??= positional[0] ?? null;
  args.personas ??= positional[1] ?? null;
  if (args.out === DEFAULT_OUT && positional[2]) args.out = positional[2];
  return args;
}

async function readCdo(inputPath) {
  const raw = await fs.readFile(inputPath, 'utf8');
  const trimmed = raw.trim();
  if (trimmed.startsWith('<')) return trimmed;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed[0] : parsed;
  }
  return trimmed;
}

async function readPersonas(personasPath) {
  if (!personasPath) return [];
  const parsed = JSON.parse(await fs.readFile(personasPath, 'utf8'));
  if (Array.isArray(parsed)) return parsed;
  return parsed.personas || parsed.items || parsed.value || [];
}

function groupIssues(issues) {
  const grouped = new Map();
  for (const issue of issues) {
    const key = `${issue.severity}:${issue.type}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(issue);
  }
  return grouped;
}

function renderReport(bundle) {
  const { summary } = bundle;
  const lines = [];
  const push = (line = '') => lines.push(line);

  push('# Enhanced Conditions migration — dry run');
  push();
  push(`Generated ${bundle.generatedAt}`);
  push();
  push('| Metric | Value |');
  push('| --- | --- |');
  push(`| Conditions parsed from CDO | ${summary.conditionsParsed} |`);
  push(`| Condition templates generated | ${summary.conditionsConverted} |`);
  push(`| Condition types generated | ${summary.conditionTypes} |`);
  push(`| Distinct ACL profiles | ${summary.aclProfiles} |`);
  push(`| ACL profiles used by one condition | ${summary.singleUseAclProfiles} |`);
  push(`| Distinct persona names referenced | ${summary.distinctRoles} |`);
  push(`| Persona names not matched | ${summary.unresolvedRoles} |`);
  push(`| Conditions referencing a missing persona | ${summary.conditionsWithUnresolvedRoles} |`);
  push(`| Permission lists granting access to nobody | ${summary.permissionListsGrantingNobody} of ${bundle.personaReconciliation.impact.permissionLists} |`);
  push(`| Automatic fixes applied | ${summary.autoFixed} |`);
  push(`| Items needing a decision | ${summary.needsReview} |`);
  push();

  const grouped = groupIssues(bundle.issues);
  const review = [...grouped.entries()].filter(([key]) => key.startsWith('needs_review'));
  const fixed = [...grouped.entries()].filter(([key]) => key.startsWith('auto_fixed'));

  push('## Needs a decision');
  push();
  if (!review.length) push('_None._');
  for (const [key, items] of review.sort((a, b) => b[1].length - a[1].length)) {
    push(`### ${key.split(':')[1].replace(/_/g, ' ')} (${items.length})`);
    push();
    for (const item of items.slice(0, 40)) {
      const { severity, type, ...rest } = item;
      push(`- ${JSON.stringify(rest)}`);
    }
    if (items.length > 40) push(`- _...${items.length - 40} more, see data-quality-report.json_`);
    push();
  }

  push('## Applied automatically');
  push();
  if (!fixed.length) push('_None._');
  for (const [key, items] of fixed.sort((a, b) => b[1].length - a[1].length)) {
    push(`### ${key.split(':')[1].replace(/_/g, ' ')} (${items.length})`);
    push();
    for (const item of items.slice(0, 25)) {
      const { severity, type, ...rest } = item;
      push(`- ${JSON.stringify(rest)}`);
    }
    if (items.length > 25) push(`- _...${items.length - 25} more, see data-quality-report.json_`);
    push();
  }

  push('## ACL profiles');
  push();
  push('Enhanced Conditions has no per-condition ACL. Each profile below is a persona access');
  push('pattern to configure once in Encompass admin, replacing the per-condition role lists.');
  push();
  push('| Profile | Conditions | Add | Waive |');
  push('| --- | --- | --- | --- |');
  for (const profile of bundle.aclProfiles.slice(0, 25)) {
    push(
      `| ${profile.profileId} | ${profile.conditionCount} | ${profile.permissions.Add.length} personas | ${profile.permissions.SetStatusWaived.length} personas |`,
    );
  }
  if (bundle.aclProfiles.length > 25) push(`| _...${bundle.aclProfiles.length - 25} more_ | | | |`);
  push();

  if (bundle.personaReconciliation.personaCount === 0) {
    push('## Persona reconciliation');
    push();
    push('Skipped — no persona list supplied. Re-run with `--personas` once you have');
    push('`GET /encompass/v3/settings/personas` saved to disk.');
    push();
  } else {
    push('## Unresolved persona names');
    push();
    push('| CDO role name | Likely cause | Candidates in Encompass |');
    push('| --- | --- | --- |');
    for (const entry of bundle.personaReconciliation.unmatched) {
      const cause = entry.likelyMerged
        ? 'two names merged'
        : entry.likelyTruncated
          ? 'truncated at 20 chars'
          : 'no match';
      const candidates = entry.candidates.map((c) => c.name || c).join(', ') || '—';
      push(`| ${entry.role} | ${cause} | ${candidates} |`);
    }
    push();
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.input) {
    console.log('Usage: node scripts/tools/convert-conditions-cdo.mjs --input <cdo.json|cdo.xml> [--personas <file>] [--out <dir>]');
    process.exit(args.help ? 0 : 1);
  }

  const cdo = await readCdo(args.input);
  const personas = await readPersonas(args.personas);
  const bundle = buildMigrationBundle(cdo, { personas });

  await fs.mkdir(args.out, { recursive: true });
  const write = (name, value) =>
    fs.writeFile(path.join(args.out, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, 'utf8');

  await Promise.all([
    write('condition-types.json', bundle.conditionTypes),
    write('condition-templates.json', bundle.conditionTemplates),
    write('acl-profiles.json', { profiles: bundle.aclProfiles, assignments: bundle.aclAssignments }),
    write('normalized-conditions.json', bundle.conditions),
    write('data-quality-report.json', { summary: bundle.summary, issues: bundle.issues, personaReconciliation: bundle.personaReconciliation }),
    write('data-quality-report.md', renderReport(bundle)),
  ]);

  console.log(`Wrote dry-run artifacts to ${args.out}`);
  for (const [key, value] of Object.entries(bundle.summary)) console.log(`  ${key}: ${value}`);
  if (!personas.length) console.log('\nPersona reconciliation skipped (no --personas supplied).');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
