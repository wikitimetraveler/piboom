/**
 * Development work by David Lane
 */
import { describe, test, expect } from '@jest/globals';
import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  normalizeSpreadsheetPropertyRow,
  evaluatePropertyAgainstDisasters,
  analyzePropertySpreadsheet,
} from '../../services/disaster-spreadsheet.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientModulePath = path.resolve(
  __dirname,
  '../../public/finance/js/disasters-unified/spreadsheet-analyzer.js'
);

function loadClientSpreadsheetAnalyzer() {
  const sandbox = { window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(clientModulePath, 'utf8'), sandbox);
  return sandbox.DuSpreadsheetAnalyzer;
}

describe('disaster-spreadsheet.service', () => {
  test('normalizeSpreadsheetPropertyRow maps flexible spreadsheet column headers', () => {
    const row = normalizeSpreadsheetPropertyRow(
      {
        'Loan #': 'LN-9001',
        Borrower: 'Alice Morgan',
        'Property Address': '100 Main St',
        City: 'Tampa',
        County: 'Hillsborough County',
        State: 'fl',
        ZIP: '33606',
        'Loan Amount': '$650,000',
        Stage: 'Clear to Close',
        'Flood Zone': 've',
        Lat: '27.9506',
        Lng: '-82.4572',
      },
      0
    );

    expect(row.loan_number).toBe('LN-9001');
    expect(row.borrower_name).toBe('Alice Morgan');
    expect(row.county).toBe('Hillsborough');
    expect(row.state).toBe('FL');
    expect(row.loan_amount).toBe(650000);
    expect(row.flood_zone).toBe('VE');
    expect(row.latitude).toBeCloseTo(27.9506, 4);
    expect(row.longitude).toBeCloseTo(-82.4572, 4);
  });

  test('evaluatePropertyAgainstDisasters flags FEMA declared counties with closing hold & 1004D inspection', () => {
    const prop = normalizeSpreadsheetPropertyRow({
      loan_number: 'LN-101',
      property_address: '16420 Sunset Blvd',
      city: 'Pacific Palisades',
      county: 'Los Angeles',
      state: 'CA',
      loan_amount: 1100000,
      milestone: 'Clear to Close',
      flood_zone: 'X',
      latitude: 34.0481,
      longitude: -118.5262,
    });

    const disasters = [
      {
        id: 1,
        source: 'fema',
        event_type: 'wildfire',
        county_name: 'Los Angeles',
        state_abbr: 'CA',
        start_time: new Date().toISOString(),
        title: 'DR-4856-CA Severe Wildfires',
        lat: 34.0522,
        lng: -118.4912,
        source_id: 'DR-4856',
      },
      {
        id: 2,
        source: 'firms',
        event_type: 'wildfire',
        county_name: 'Los Angeles',
        state_abbr: 'CA',
        start_time: new Date().toISOString(),
        title: 'VIIRS Wildfire Cluster',
        lat: 34.061,
        lng: -118.538,
        source_id: 'firms-1',
      },
    ];

    const evaluated = evaluatePropertyAgainstDisasters(prop, disasters, { radiusMiles: 25 });
    expect(evaluated.femaDeclared).toBe(true);
    expect(evaluated.matchedCount).toBe(2);
    expect(evaluated.triageScore).toBeGreaterThanOrEqual(4);
    expect(evaluated.lenderRequirements.statusCode).toBe('hold_inspection');
    expect(evaluated.lenderRequirements.collateralAction).toMatch(/1004D|Post-Disaster/i);
  });

  test('analyzePropertySpreadsheet computes portfolio summary rollups and hotspots', async () => {
    const disasters = [
      {
        id: 10,
        source: 'fema',
        event_type: 'hurricane',
        county_name: 'Hillsborough',
        state_abbr: 'FL',
        start_time: new Date().toISOString(),
        title: 'DR-4834-FL Hurricane',
        lat: 27.9506,
        lng: -82.4572,
      },
    ];

    const properties = [
      {
        loan_number: 'LN-1',
        borrower_name: 'Borrower A',
        property_address: '412 Bayshore Blvd',
        city: 'Tampa',
        county: 'Hillsborough',
        state: 'FL',
        loan_amount: 500000,
        flood_zone: 'VE',
        latitude: 27.9369,
        longitude: -82.4609,
      },
      {
        loan_number: 'LN-2',
        borrower_name: 'Borrower B',
        property_address: '900 E Camelback Rd',
        city: 'Phoenix',
        county: 'Maricopa',
        state: 'AZ',
        loan_amount: 300000,
        flood_zone: 'X',
        latitude: 33.5092,
        longitude: -111.9838,
      },
    ];

    const result = await analyzePropertySpreadsheet(properties, { disasters, radiusMiles: 25 });
    expect(result.summary.totalProperties).toBe(2);
    expect(result.summary.totalUpb).toBe(800000);
    expect(result.summary.femaImpactedCount).toBe(1);
    expect(result.summary.holdClosingCount).toBe(1);
    expect(result.summary.floodActionCount).toBe(1);
    expect(result.summary.clearCount).toBe(1);
    expect(result.portfolioHotspots[0].county).toBe('Hillsborough');
  });

  test('client DuSpreadsheetAnalyzer parses CSV/TSV and builds hotspot lender guidance', () => {
    const client = loadClientSpreadsheetAnalyzer();
    expect(client.SAMPLE_LENDER_TAPE.length).toBeGreaterThanOrEqual(10);

    const parsed = client.parseDelimitedText(
      'Loan Number,Borrower,State,County,Loan Amount,Flood Zone\nLN-55,Jane Doe,CA,Los Angeles,750000,AE'
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]['Loan Number']).toBe('LN-55');
    expect(parsed[0]['Flood Zone']).toBe('AE');

    const guidance = client.buildLenderGuidanceForHotspot({
      county: 'Los Angeles',
      state: 'CA',
      sources: ['fema', 'firms'],
      femaCount: 2,
      peakRisk: 11,
      dominantType: 'wildfire',
    });
    expect(guidance.filterCategory).toBe('fema_hold');
    expect(guidance.collateralNeed).toMatch(/Inspection/i);
  });
});
