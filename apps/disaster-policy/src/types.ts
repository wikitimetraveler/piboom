export type PolicyKind = 'declared' | 'pending';
export type PolicyStatus = 'draft' | 'active' | 'ended';

export interface PolicyArea {
  id?: string;
  countyCode: string;
  countyName: string;
  state: string;
  zipCode?: string | null;
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
  governorDeclarationDate?: string | null;
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
  matchMethod?: 'fips' | 'name' | string;
  treasuryHold: boolean;
  fundingSuspension: boolean;
}

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY',
] as const;
