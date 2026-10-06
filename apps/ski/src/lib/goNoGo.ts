import type { GoScore } from './types';

export function scoreLabel(score: GoScore): string {
  if (score === 'go') return 'Go';
  if (score === 'no-go') return 'Stay home';
  return 'Caution';
}

export function mapsDirUrl(dest: string, origin = 'Fountain Valley, CA'): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}`;
}

export function formatFt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Math.round(Number(n)).toLocaleString()} ft`;
}

export function formatTemp(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Math.round(Number(n))}°F`;
}
