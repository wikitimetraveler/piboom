export type GoScore = 'go' | 'caution' | 'no-go';

export type StopKind = 'smoke' | 'dispensary' | 'thrift' | 'viewpoint' | 'town' | 'food' | 'lake';

export interface WeatherSnap {
  tempF?: number | null;
  precipIn?: number | null;
  snowfallIn?: number | null;
  snowDepthIn?: number | null;
  freezeLevelFt?: number | null;
}

export interface AlertSnap {
  event: string;
  severity?: string;
  headline?: string;
}

export interface DestinationBrief {
  id: string;
  name: string;
  area: string;
  route: 'wrightwood' | 'big-bear';
  dem: 'wrightwood' | 'big-bear' | 'snow-valley';
  lat: number;
  lng: number;
  baseFt: number;
  summitFt: number;
  verticalFt: number;
  highways: string[];
  chainHighways: string[];
  mapsDest: string;
  typicalDriveMin: number;
  driveMin: number;
  driveSource: string;
  weather: WeatherSnap;
  forecast?: { shortForecast?: string; name?: string } | null;
  alerts: AlertSnap[];
  score: GoScore;
  chainsLikely: boolean;
}

export interface BriefPayload {
  home: { id: string; name: string; lat: number; lng: number; elevFt: number };
  disclaimer: string;
  fetchedAt: string;
  destinations: DestinationBrief[];
}

export interface OnTheWayStop {
  id: string;
  name: string;
  route: string;
  kind: StopKind | string;
  town?: string;
  note?: string;
  lat?: number;
  lng?: number;
  source?: 'seed' | 'live' | string;
  ageRestricted?: boolean;
}

export type LatLng = [number, number];

export interface SkiRun {
  id: string;
  name: string | null;
  difficulty: string;
  grooming?: string | null;
  resort: string;
  paths: LatLng[][];
  label?: string;
  lengthFt?: number;
  verticalFt?: number;
  topFt?: number;
  bottomFt?: number;
  avgPitchDeg?: number;
  maxPitchDeg?: number;
  aspectDeg?: number;
  aspect?: string;
  profile?: [number, number][];
}

export interface SkiLift {
  id: string;
  name: string | null;
  type: string;
  occupancy?: number | null;
  resort: string;
  coords: LatLng[];
  lengthFt?: number;
  riseFt?: number;
  bottomFt?: number;
  topFt?: number;
}

export interface TrailsPayload {
  id: string;
  name: string;
  source: string;
  attribution: string;
  fetchedAt?: string;
  resorts: { id: string; name: string }[];
  runs: SkiRun[];
  lifts: SkiLift[];
}

export interface DemGrid {
  id: string;
  name: string;
  south: number;
  north: number;
  west: number;
  east: number;
  rows: number;
  cols: number;
  units: string;
  source?: string;
  heights: number[];
}
