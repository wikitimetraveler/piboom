export type PolicyKind = 'declared' | 'pending';
export type PolicyStatus = 'draft' | 'active' | 'ended';

/** A county area has no zipCode; a ZIP area is one ZIP Code inside its county. */
export interface PolicyArea {
  id?: string;
  countyCode: string;
  countyName: string;
  state: string;
  zipCode?: string | null;
  /** City/area label for a ZIP — pick-list display only, not stored. */
  zipCity?: string;
  incidentBeginDate?: string | null;
  incidentEndDate?: string | null;
  inspectionRequiredAppraisalsOnOrBefore?: string | null;
}

export interface PolicyEvent {
  id: string;
  kind: PolicyKind;
  status: PolicyStatus;
  eventName: string;
  disasterType?: string | null;
  femaDeclarationNumber?: string | null;
  femaEmergencyDeclarationDate?: string | null;
  femaMajorDisasterDeclarationDate?: string | null;
  presidentialDeclarationDate?: string | null;
  acmeEmergencyDeclarationDate?: string | null;
  acmeDisasterAnnouncement?: string | null;
  acmeTreasuryHold: boolean;
  acmeFundingSuspension: boolean;
  incidentBeginDate?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  areas: PolicyArea[];
}

export interface CountyOption {
  county_fips: string;
  name: string;
  state_abbr: string;
}

export interface ZipOption {
  zip: string;
  city: string;
}

export type ChannelId = 'delegated' | 'non_delegated' | 'consumer' | 'unassigned';

export interface ImpactedLoan {
  id: number;
  loanNumber: string;
  borrowerName: string;
  propertyAddress: string;
  city: string;
  state: string;
  county: string;
  countyFips?: string | null;
  zipCode: string;
  milestone: string;
  loanAmount: number;
  disasterRiskScore: number;
  channel: ChannelId;
  loanBook: 'pipeline' | 'inventory' | 'servicing';
  matchMethod: 'zip' | 'fips' | 'name';
  matchedArea: string | null;
  /** Set once every area the loan sits in has passed its Incident Period End Date. */
  incidentEndDate: string | null;
  treasuryHold: boolean;
  fundingSuspension: boolean;
}

export interface ReportBucket {
  count: number;
  amount: number;
}

export interface ReportChannel extends ReportBucket {
  id: ChannelId;
  label: string;
  byMilestone: Record<string, ReportBucket>;
}

export interface ImpactReport {
  generatedAt: string;
  totals: ReportBucket & { treasuryHold: number; fundingSuspension: number };
  pipeline: ReportBucket & { milestones: string[]; channels: ReportChannel[] };
  inventory: ReportBucket;
  servicing: ReportBucket;
  channelNotRecorded: number;
}

export interface ImpactResult {
  loans: ImpactedLoan[];
  count: number;
  truncated: boolean;
  matchCounts: { byZip: number; byFips: number; byName: number };
  report: ImpactReport;
  /** Which report dimensions the loans table can supply; absent when no database is attached. */
  loanColumns?: { channel: boolean; loanBook: boolean };
  mode?: 'memory';
}

export const DISASTER_TYPES = [
  'Hurricane',
  'Tropical Storm',
  'Wildfire',
  'Flood',
  'Tornado',
  'Earthquake',
  'Winter Storm',
  'High Wind',
] as const;

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY','PR','VI','GU','AS','MP',
] as const;
