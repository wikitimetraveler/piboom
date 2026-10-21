/**
 * Loan-flight question bank: 10 per unit, product lines do not repeat inside a difficulty.
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import { drawDeck, nextDifficulty, validateBank } from '../../services/loan-flight-questions.js';

const bank = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/loan-flight-question-bank.json'), 'utf8'));
const unitIds = bank.units.map((unit) => unit.id);

describe('loan flight question bank', () => {
  test('every unit can serve 10 fresh difficulty-1 questions', () => {
    expect(validateBank(bank)).toEqual([]);
    const deck = drawDeck({
      bank: bank.questions,
      unitIds,
      difficulty: 1,
      seenIds: [],
      count: bank.perUnit
    });
    for (const id of unitIds) {
      expect(deck[id]).toHaveLength(10);
      expect(new Set(deck[id].map((q) => q.id)).size).toBe(10);
      expect(deck[id].every((q) => q.recycled === false)).toBe(true);
      expect(drawDeck({
        bank: bank.questions,
        unitIds: [id],
        difficulty: 1,
        count: 3
      })[id]).toHaveLength(3);
    }
  });

  test('product-line questions name the catalog lines and do not repeat until that tier is used', () => {
    const first = drawDeck({
      bank: bank.questions,
      unitIds: ['product-lines'],
      difficulty: 1,
      count: 10
    })['product-lines'];
    const blob = first.map((q) => `${q.question} ${q.options.map((o) => o.text).join(' ')}`).join(' ');
    expect(blob).toMatch(/HomeReady/);
    expect(blob).toMatch(/Home Possible/);
    expect(blob).toMatch(/203\(b\)/);
    expect(blob).toMatch(/IRRRL/);
    expect(blob).toMatch(/USDA/);
    const seen = first.map((q) => q.id);
    const again = drawDeck({
      bank: bank.questions,
      unitIds: ['product-lines'],
      difficulty: 1,
      seenIds: seen,
      count: 10
    })['product-lines'];
    expect(again.every((q) => q.recycled === true)).toBe(true);
    const officer = drawDeck({
      bank: bank.questions,
      unitIds: ['product-lines'],
      difficulty: 2,
      seenIds: seen,
      count: 10
    })['product-lines'];
    expect(officer.every((q) => q.difficulty === 2 && q.recycled === false)).toBe(true);
    expect(officer.map((q) => q.id).some((id) => seen.includes(id))).toBe(false);
  });

  test('first officer and captain each have a fresh set on every stage', () => {
    for (const level of [2, 3]) {
      const deck = drawDeck({
        bank: bank.questions,
        unitIds,
        difficulty: level,
        count: 10
      });
      for (const id of unitIds) {
        expect(deck[id]).toHaveLength(10);
        expect(deck[id].every((q) => q.difficulty === level && q.recycled === false)).toBe(true);
      }
    }
    const officer = drawDeck({
      bank: bank.questions,
      unitIds: ['application', 'funding'],
      difficulty: 2,
      count: 10
    });
    const blob = ['application', 'funding']
      .flatMap((id) => officer[id])
      .map((q) => `${q.question} ${q.explain}`)
      .join(' ');
    expect(blob).toMatch(/Investor A|660|45%/);
    expect(blob).toMatch(/medium|high|reserves/);
  });

  test('80% advances difficulty and a miss keeps the pilot on the same rung', () => {
    expect(nextDifficulty(1, 0.8, 3)).toBe(2);
    expect(nextDifficulty(2, 1, 3)).toBe(3);
    expect(nextDifficulty(3, 1, 3)).toBe(3);
    expect(nextDifficulty(1, 0.79, 3)).toBe(1);
  });
});

describe('captain before the answer', () => {
  test('does not name a choice', async () => {
    const { replyBeforeReveal } = await import('../../services/loan-flight.service.js');
    const line = replyBeforeReveal();
    expect(line).toMatch(/will not choose/i);
    expect(line).not.toMatch(/HomeReady|correct choice|Yes\b/);
  });
});
