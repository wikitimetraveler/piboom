/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { getLaneTradingCardById, getLaneTradingCards } from '../../services/genealogy.service.js';

describe('lane trading cards service', () => {
  test('returns first edition card listing with citations and taxonomy', () => {
    const listing = getLaneTradingCards();
    expect(listing).toBeTruthy();
    expect(listing.edition).toBe('First Edition');
    expect(listing.count).toBe(32);
    expect(listing.taxonomyVersion).toBeGreaterThanOrEqual(2);
    expect(listing.taxonomy?.tiers?.notable).toBeTruthy();
    expect(Array.isArray(listing.kinds)).toBe(true);
    expect(Array.isArray(listing.rarities)).toBe(true);
    expect(Array.isArray(listing.timelineSpine)).toBe(true);
    expect(listing.timelineSpine.length).toBeGreaterThanOrEqual(7);
    expect(Array.isArray(listing.cards)).toBe(true);
    listing.cards.forEach((card) => {
      expect(card.cardId).toBeTruthy();
      expect(['person', 'artifact', 'event']).toContain(card.cardKind);
      expect(Array.isArray(card.citations)).toBe(true);
      expect(card.citations.length).toBeGreaterThan(0);
      expect(Array.isArray(card.facts)).toBe(true);
      expect(card.facts.length).toBeGreaterThan(0);
      expect(card.rarity).not.toBe('uncommon');
    });
  });

  test('supports filtering by tag, branch, kind, and rarity', () => {
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

    const events = getLaneTradingCards({ cardKind: 'event' });
    expect(events.count).toBe(5);
    events.cards.forEach((card) => {
      expect(card.cardKind).toBe('event');
    });

    const legendary = getLaneTradingCards({ rarity: 'legendary' });
    expect(legendary.count).toBeGreaterThan(0);
    legendary.cards.forEach((card) => {
      expect(card.rarity).toBe('legendary');
    });
  });

  test('timeline spine enriches beats with linked card tier and kind', () => {
    const listing = getLaneTradingCards();
    const captivity = listing.timelineSpine.find((beat) => beat.cardId === 'event-captivity-canada-1704');
    expect(captivity).toBeTruthy();
    expect(captivity.cardKind).toBe('event');
    expect(captivity.cardRarity).toBeTruthy();
  });

  test('returns single card with related cards', () => {
    const card = getLaneTradingCardById('william-lane-i');
    expect(card).toBeTruthy();
    expect(card.cardId).toBe('william-lane-i');
    expect(card.rarity).toBe('legendary');
    expect(Array.isArray(card.relatedCards)).toBe(true);
    expect(card.relatedCards.length).toBeGreaterThan(0);
  });
});
