/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

await jest.unstable_mockModule('../../lib/knowledge/ice-knowledge.service.js', () => ({
  default: {
    search: jest.fn().mockResolvedValue([
      {
        title: 'Create Condition Templates',
        content: 'PATCH /encompass/v3/settings/loan/conditions/templates?action=add',
        sourceType: 'api_reference',
        url: 'https://example.test/templates',
        score: 8,
      },
    ]),
    getSummary: jest.fn().mockResolvedValue({
      totalRecords: 100,
      vectorAvailable: true,
      vectorCount: 40,
    }),
  },
}));

await jest.unstable_mockModule('../../services/encompass-docs.service.js', () => ({
  default: {
    searchDocs: jest.fn().mockResolvedValue([
      {
        title: 'Working with Enhanced Conditions',
        content: 'Guide to enhanced conditions setup',
        category: 'guides',
        url: 'https://developer.icemortgagetechnology.com/developer-connect/docs/working-with-enhanced-conditions',
        score: 6,
      },
    ]),
    getSummary: jest.fn().mockResolvedValue({
      totalDocuments: 20,
      vectorAvailable: false,
      vectorCount: 0,
    }),
  },
}));

const {
  getConditionsExpertSummary,
  searchConditionsKnowledge,
} = await import('../../services/conditions-assistant.service.js');

describe('conditions-assistant.service', () => {
  it('loads curated expert summary with RAG lanes', async () => {
    const summary = await getConditionsExpertSummary();
    expect(summary.title).toMatch(/Enhanced Conditions/i);
    expect(summary.conceptCount).toBeGreaterThan(3);
    expect(summary.apiCount).toBeGreaterThan(5);
    expect(summary.surfaces.some((s) => s.path.includes('enhanced-conditions-expert'))).toBe(true);
    expect(summary.rag.lanes).toHaveLength(3);
    expect(summary.rag.lanes.find((l) => l.label.includes('ICE')).vectorReady).toBe(true);
    expect(summary.officialLinks.length).toBeGreaterThan(5);
    expect(summary.officialLinks.every((l) => l.url && l.title)).toBe(true);
  });

  it('searches curated + ICE/docs knowledge', async () => {
    const results = await searchConditionsKnowledge('condition templates postman', 8);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => /template|Enhanced Conditions/i.test(r.title))).toBe(true);
  });
});
