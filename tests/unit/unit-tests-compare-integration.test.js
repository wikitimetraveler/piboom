/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import '../../public/shared/calcEngineLibrary.js';
import { compareValues } from '../../public/shared/unit-tests-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(
  __dirname,
  '../../public/finance/fixtures/unit-tests-compare-cases.json',
);
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

describe('unit-tests compare integration fixture', () => {
  test.each(fixture.cases)(
    'compareValues mode=$mode pass=$pass',
    ({ actual, expected, mode, pass }) => {
      expect(compareValues(actual, expected, mode)).toBe(pass);
    },
  );

  test('hub mock field reader shape matches COMPARE workflow', async () => {
    const { loanGuid, fieldReader } = fixture.hubMock;
    const fieldId = 'CX.DEMO';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        fields: [{ id: fieldId, value: fieldReader[fieldId] }],
      }),
    });
    global.fetch = fetchMock;

    const response = await fetch(`/api/encompass-hub/loans/${loanGuid}/field-reader`, {
      method: 'POST',
      body: JSON.stringify([fieldId]),
    });
    const data = await response.json();
    const actual = data.fields?.[0]?.value;
    const expected = 'ExpectedValue';
    expect(compareValues(actual, expected, 'equals')).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });
});
