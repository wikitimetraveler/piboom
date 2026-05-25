/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  repairOcrRomanYears,
  splitPrimarySpouseSegments,
  parseBirthYear,
  parseChildLine
} from '../../services/genealogy-import.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');

describe('genealogy-import.service.js vitals', () => {
  it('repairOcrRomanYears fixes I/l before 3-digit year fragments', () => {
    expect(repairOcrRomanYears('b. Apr., I 778')).toContain('1778');
    expect(repairOcrRomanYears('no year I 300')).toContain('I 300');
  });

  it('splitPrimarySpouseSegments cuts before She married', () => {
    const { primary, spouse } = splitPrimarySpouseSegments(
      'II. Name, b. 1800. She married John'
    );
    expect(primary).toMatch(/Name/);
    expect(spouse).toMatch(/John/);
  });

  it('parseBirthYear prefers b. clause and OCR repair (Sus Anna style)', () => {
    const line =
      'II. Sus ANNA 6, b. 20 Apr., I 778 ; d. 26 May, 1865. She married Abraham Lane, b. in Candia.';
    expect(parseBirthYear(line)).toBe(1778);
  });

  it('parseChildLine returns repaired birth year', () => {
    const line =
      'II. Sus ANNA 6, b. 20 Apr., I 778 ; d. 26 May, 1865. She married Abraham Lane.';
    const c = parseChildLine(line);
    expect(c).not.toBeNull();
    expect(c.birthYear).toBe(1778);
  });
});

describe('parse_lane_pdf.py fixtures', () => {
  it('passes Python regression script', () => {
    const script = path.join(repoRoot, 'tests', 'unit', 'run_genealogy_lane_fixture.py');
    const r = spawnSync(process.platform === 'win32' ? 'python' : 'python3', [script], {
      encoding: 'utf-8',
      cwd: repoRoot
    });
    expect(r.status).toBe(0);
    expect((r.stdout || '').trim()).toBe('ok');
  });
});
