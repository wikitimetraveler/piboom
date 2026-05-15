import {
  normalizePipelineItems,
  parseNumber,
  parseDate,
  coercePositiveInteger,
  classifyEncompassError,
  normalizeUserProfile,
  filterUsersList,
  normalizeListParam,
  normalizeCounties,
} from '../../services/encompass-hub.service.js';

describe('encompass-hub service helpers', () => {
  test('normalizePipelineItems handles multiple shapes', () => {
    expect(normalizePipelineItems(null)).toEqual([]);
    expect(normalizePipelineItems([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(normalizePipelineItems({ items: [{ id: 2 }] })).toEqual([{ id: 2 }]);
    expect(normalizePipelineItems({ pipelineData: [{ id: 3 }] })).toEqual([{ id: 3 }]);
  });

  test('parseNumber returns null for empty or invalid values', () => {
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('100.5')).toBe(100.5);
  });

  test('parseDate returns iso string for valid dates', () => {
    expect(parseDate('invalid')).toBeNull();
    expect(parseDate('2024-01-01T00:00:00Z')).toBe('2024-01-01T00:00:00.000Z');
  });

  test('coercePositiveInteger respects fallback', () => {
    expect(coercePositiveInteger('5', 2)).toBe(5);
    expect(coercePositiveInteger('-1', 2)).toBe(2);
    expect(coercePositiveInteger('abc', 2)).toBe(2);
  });

  test('normalizeUserProfile builds consistent fields', () => {
    const normalized = normalizeUserProfile({
      id: 'u1',
      firstName: 'Jane',
      lastName: 'Doe',
      personaIds: [1, null, 2],
      personas: [{ entityName: 'Processor' }],
      workingFolder: 'My Pipeline',
      organization: { entityId: 'org1', entityName: 'Org' },
      createdDateTime: '2024-01-01T00:00:00Z',
    });

    expect(normalized.name).toBe('Jane Doe');
    expect(normalized.personaIds).toEqual([1, 2]);
    expect(normalized.personaNames).toEqual(['Processor']);
    expect(normalized.workingFolders).toEqual(['My Pipeline']);
    expect(normalized.organization).toEqual({
      id: 'org1',
      name: 'Org',
      uri: null,
    });
  });

  test('filterUsersList filters by enabled, persona id, persona name, and search', () => {
    const users = [
      {
        name: 'Alex Smith',
        loginName: 'asmith',
        email: 'a@ex.com',
        title: 'LO',
        enabled: true,
        personaIds: ['1'],
        personaNames: ['Loan Officer'],
      },
      {
        name: 'Jamie Doe',
        loginName: 'jdoe',
        email: 'j@ex.com',
        title: 'UW',
        enabled: false,
        personaIds: ['2'],
        personaNames: ['Processor'],
      },
    ];

    expect(filterUsersList(users, { enabled: true })).toHaveLength(1);
    expect(filterUsersList(users, { personaId: '2' })[0].name).toBe('Jamie Doe');
    expect(filterUsersList(users, { search: 'alex' })[0].name).toBe('Alex Smith');
    expect(filterUsersList(users, { personaName: 'process' })[0].name).toBe('Jamie Doe');
    expect(filterUsersList(users, { personaName: 'officer' })[0].name).toBe('Alex Smith');
  });

  test('normalizeListParam and normalizeCounties normalize values', () => {
    expect(normalizeListParam('a, b, c')).toEqual(['a', 'b', 'c']);
    expect(normalizeListParam(['x', 'y'])).toEqual(['x', 'y']);
    expect(normalizeCounties('King, Pierce')).toEqual(['king', 'pierce']);
  });

  test('classifyEncompassError marks known transient statuses as recoverable', () => {
    const out = classifyEncompassError({ response: { status: 503 } });
    expect(out.recoverable).toBe(true);
    expect(out.statusCode).toBe(503);
  });

  test('classifyEncompassError parses retry-after seconds', () => {
    const out = classifyEncompassError({ response: { status: 429, headers: { 'retry-after': '2' } } });
    expect(out.recoverable).toBe(true);
    expect(out.retryAfterMs).toBe(2000);
  });
});
