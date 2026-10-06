import type { SkiLift, SkiRun } from './types';

export type Tier = 'green' | 'blue' | 'black' | 'double' | 'unrated';

export const TIERS: Tier[] = ['green', 'blue', 'black', 'double'];

export const TIER_META: Record<Tier, { label: string; line: number; casing: number; css: string }> = {
  green: { label: 'Easier', line: 0x3fbf74, casing: 0x0a1a10, css: '#3fbf74' },
  blue: { label: 'More difficult', line: 0x3d8bfd, casing: 0x07122a, css: '#3d8bfd' },
  black: { label: 'Most difficult', line: 0x0b0d10, casing: 0xf2f6f8, css: '#0b0d10' },
  double: { label: 'Experts only', line: 0x0b0d10, casing: 0xffa94d, css: '#0b0d10' },
  unrated: { label: 'Unrated', line: 0x9aa5b1, casing: 0x1a2129, css: '#9aa5b1' },
};

export function tierOf(difficulty: string): Tier {
  switch (difficulty) {
    case 'novice':
    case 'easy':
      return 'green';
    case 'intermediate':
      return 'blue';
    case 'advanced':
      return 'black';
    case 'expert':
    case 'freeride':
      return 'double';
    default:
      return 'unrated';
  }
}

export function runTitle(run: Pick<SkiRun, 'name'>): string {
  return run.name || 'Unnamed connector';
}

const LIFT_LABELS: Record<string, string> = {
  chair_lift: 'Chair',
  gondola: 'Gondola',
  cable_car: 'Tram',
  mixed_lift: 'Chondola',
  drag_lift: 'Surface lift',
  't-bar': 'T-bar',
  'j-bar': 'J-bar',
  platter: 'Platter',
  rope_tow: 'Rope tow',
  magic_carpet: 'Carpet',
};

export function liftTitle(lift: Pick<SkiLift, 'name' | 'type'>): string {
  const kind = LIFT_LABELS[lift.type] || 'Lift';
  return lift.name ? `${lift.name} · ${kind}` : kind;
}

export function fmtFt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Math.round(n).toLocaleString()} ft`;
}

export function fmtDeg(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(1)}°`;
}

/** Along-run pitch → color band (green cruise, blue, steep, very steep). */
export function pitchColor(deg: number): string {
  if (deg < 12) return '#3fbf74';
  if (deg < 20) return '#3d8bfd';
  if (deg < 28) return '#e8edf2';
  return '#ff7a59';
}

export const FACINGS = [
  { id: '', label: 'Any facing' },
  { id: 'north', label: 'North-facing' },
  { id: 'east', label: 'East-facing' },
  { id: 'south', label: 'South-facing' },
  { id: 'west', label: 'West-facing' },
];

const FACE_SET: Record<string, string[]> = {
  north: ['N', 'NE', 'NW'],
  east: ['E', 'NE', 'SE'],
  south: ['S', 'SE', 'SW'],
  west: ['W', 'NW', 'SW'],
};

export type SortKey = 'vertical' | 'length' | 'pitch' | 'name';

export interface RunFilter {
  tiers: Set<Tier>;
  facing: string;
  maxPitch: number | null;
  namedOnly: boolean;
}

export function filterActive(f: RunFilter): boolean {
  return f.tiers.size > 0 || Boolean(f.facing) || f.maxPitch != null || f.namedOnly;
}

export function filterRuns(runs: SkiRun[], f: RunFilter): SkiRun[] {
  const faces = f.facing ? FACE_SET[f.facing] : null;
  return runs.filter((r) => {
    if (f.tiers.size && !f.tiers.has(tierOf(r.difficulty))) return false;
    if (faces && (!r.aspect || !faces.includes(r.aspect))) return false;
    if (f.maxPitch != null && (r.avgPitchDeg == null || r.avgPitchDeg > f.maxPitch)) return false;
    if (f.namedOnly && !r.name) return false;
    return true;
  });
}

export function sortRuns(runs: SkiRun[], key: SortKey): SkiRun[] {
  const list = [...runs];
  if (key === 'name') return list.sort((a, b) => runTitle(a).localeCompare(runTitle(b)));
  const val = (r: SkiRun) =>
    key === 'vertical' ? r.verticalFt ?? -1 : key === 'length' ? r.lengthFt ?? -1 : r.avgPitchDeg ?? -1;
  return list.sort((a, b) => val(b) - val(a));
}
