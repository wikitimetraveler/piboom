import { getLaneTradingCardById, getLaneTradingCards } from '../../services/genealogy.service.js';

describe('lane trading cards service', () => {
  test('returns first edition card listing with citations', () => {
    const listing = getLaneTradingCards();
    expect(listing).toBeTruthy();
    expect(listing.edition).toBe('First Edition');
    expect(listing.count).toBe(25);
    expect(Array.isArray(listing.cards)).toBe(true);
    listing.cards.forEach((card) => {
      expect(card.cardId).toBeTruthy();
      expect(Array.isArray(card.citations)).toBe(true);
      expect(card.citations.length).toBeGreaterThan(0);
      expect(Array.isArray(card.facts)).toBe(true);
      expect(card.facts.length).toBeGreaterThan(0);
    });
  });

  test('supports basic filtering by tag and branch', () => {
    const byTag = getLaneTradingCards({ tag: 'revolution' });
    expect(byTag.count).toBeGreaterThan(0);
    byTag.cards.forEach((card) => {
      expect(card.tags).toContain('revolution');
    });

    const byBranch = getLaneTradingCards({ branch: 'Chester branch officers' });
    expect(byBranch.count).toBeGreaterThan(0);
    byBranch.cards.forEach((card) => {
      expect(card.branch).toBe('Chester branch officers');
    });
  });

  test('returns single card with related cards', () => {
    const card = getLaneTradingCardById('william-lane-i');
    expect(card).toBeTruthy();
    expect(card.cardId).toBe('william-lane-i');
    expect(Array.isArray(card.relatedCards)).toBe(true);
    expect(card.relatedCards.length).toBeGreaterThan(0);
  });
});
