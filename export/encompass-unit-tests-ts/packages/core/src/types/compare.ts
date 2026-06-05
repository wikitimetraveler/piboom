export type CompareMode =
  | 'equals'
  | 'approx'
  | 'date'
  | 'contains'
  | 'regex'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'not';

export interface CompareOptions {
  epsilon?: number;
  caseInsensitive?: boolean;
}
