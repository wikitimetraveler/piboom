import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { describe, expect, test } from 'vitest';
import { compareValues } from '../src/compare/unitTestsUtils.js';

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/unit-tests-compare-cases.json'
);
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  cases: { actual: unknown; expected: unknown; mode: string; pass: boolean }[];
  hubMock: { loanGuid: string; fieldReader: Record<string, string> };
};

describe('unit-tests compare integration fixture', () => {
  test.each(fixture.cases)(
    'compareValues mode=$mode pass=$pass',
    ({ actual, expected, mode, pass }) => {
      expect(compareValues(actual, expected, mode)).toBe(pass);
    }
  );

  test('loan snapshot mock field value matches COMPARE workflow', () => {
    const { fieldReader } = fixture.hubMock;
    const actual = fieldReader['CX.DEMO'];
    expect(compareValues(actual, 'ExpectedValue', 'equals')).toBe(true);
  });
});
