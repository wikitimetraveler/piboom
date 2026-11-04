export type GoScore = 'go' | 'caution' | 'no-go';

export type StopKind = 'thrift' | 'pizza' | 'aw' | 'viewpoint' | 'town' | 'food' | 'lake' | 'hike' | 'history';

export interface WeatherSnap {
  tempF?: number | null;
  precipIn?: number | null;
  snowfallIn?: number | null;
  snowDepthIn?: number | null;
  freezeLevelFt?: number | null;
}

export interface GoogleWeatherSnap {
  tempF: number | null;
  snowIn: number | null;
  precipProb: number | null;
  windMph: number | null;
  gustMph: number | null;
  visibilityMi: number | null;
  condition: string;
  time?: string | null;
}

export interface GoogleWeatherBrief {
  source?: 'google' | 'open-meteo';
  base: GoogleWeatherSnap | null;
  summit: GoogleWeatherSnap | null;
  hours: GoogleWeatherSnap[];
  windHold: boolean;
  summitGustMph: number | null;
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
  route: 'mt-baldy' | 'wrightwood' | 'big-bear' | 'eastern-sierra';
  dem: 'mt-baldy' | 'wrightwood' | 'big-bear' | 'snow-valley' | 'mammoth' | 'june';
  lat: number;
  lng: number;
  summitLat?: number;
  summitLng?: number;
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
  googleWeather?: GoogleWeatherBrief | null;
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
  treeCoverPct?: number | null;
  coverLabel?: 'tree' | 'glade' | 'open' | string | null;
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
