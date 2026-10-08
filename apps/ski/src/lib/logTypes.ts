import type { LatLng } from './types';
import type { Tier } from './trails';

export interface TripInfo {
  id?: number;
  code: string;
  name: string;
  resortId: string;
  startDate: string;
}

export interface Member {
  id: number;
  name: string;
  color: string;
  isOwner?: boolean;
}

export interface TripPass {
  code: string;
  token: string;
  tripName: string;
  resortId: string;
  memberId: number;
  memberName: string;
  color: string;
  isOwner: boolean;
}

export interface RunRef {
  id: string;
  name: string | null;
  difficulty: string;
  tier: Tier;
  resort: string;
  verticalFt: number | null;
  avgPitchDeg: number | null;
  maxPitchDeg: number | null;
  aspect: string | null;
}

export interface Segment {
  kind: 'run' | 'lift';
  source: 'gps' | 'checkin';
  memberId: number;
  demId: string | null;
  startTs: number;
  endTs: number;
  durationS: number;
  verticalFt: number;
  distanceM: number;
  topSpeedMph: number | null;
  matchedShare: number;
  path: LatLng[];
  run: RunRef | null;
  runs: RunRef[];
  lift: { id: string; name: string | null; type: string; resort: string } | null;
  offPiste: boolean;
  resort: string | null;
}

export interface DayStats {
  runs: number;
  verticalFt: number;
  distanceMi: number;
  topSpeedMph: number | null;
  liftRides: number;
  byDifficulty: Record<Tier, number>;
  longestRun: { name: string; verticalFt: number; runId: string | null } | null;
  steepestRun: { name: string; maxPitchDeg: number; runId: string; tier: Tier } | null;
  firstTs: number | null;
  lastTs: number | null;
}

export interface LogPhoto {
  id: string;
  memberId: number;
  ts: number;
  lat: number | null;
  lng: number | null;
  placeSource: 'exif' | 'track' | 'device' | 'run' | null;
  demId: string | null;
  runId: string | null;
  runName: string | null;
  caption: string | null;
  width: number;
  height: number;
}

export interface MemberDay {
  id: number;
  name: string;
  color: string;
  stats: DayStats;
  segments: Segment[];
  track: [number, number, number][];
  lastFix: { ts: number; lat: number; lng: number } | null;
}

export interface TripDay {
  date: string;
  trip: TripInfo;
  areas: string[];
  members: MemberDay[];
  leaderboard: { id: number; name: string; color: string; runs: number; verticalFt: number }[];
  crew: DayStats;
  photos: LogPhoto[];
  days: string[];
  me: number;
}

export interface SnapCandidate extends RunRef {
  distanceM: number;
}

export interface CrewPosition {
  memberId: number;
  name: string;
  color: string;
  lat: number;
  lng: number;
  acc: number | null;
  ts: number;
}
