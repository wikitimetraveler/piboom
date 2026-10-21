/**
 * Loan-flight question draw: 10 per unit, unseen first, harder product lines as difficulty rises.
 * Development work by David Lane
 */

export const PASS_RATIO = 0.8;

export function validateBank(bank) {
  const errors = [];
  const ids = new Set();
  const questions = bank?.questions || [];
  const perUnit = Number(bank?.perUnit) || 10;
  for (const q of questions) {
    if (!q?.id || ids.has(q.id)) errors.push(`duplicate or missing id ${q?.id || ''}`);
    ids.add(q.id);
    if (!q.unit || !q.difficulty) errors.push(`incomplete ${q.id}`);
    if (q.bind) continue;
    const correct = (q.options || []).filter((o) => o.correct);
    if (!q.question || correct.length !== 1) errors.push(`options ${q.id}`);
  }
  for (const unit of bank?.units || []) {
    const n = questions.filter((q) => q.unit === unit.id && Number(q.difficulty) === 1).length;
    if (n < perUnit) errors.push(`${unit.id} has ${n} difficulty-1 questions`);
  }
  for (const level of [2, 3]) {
    const n = questions.filter((q) => q.unit === 'product-lines' && Number(q.difficulty) === level).length;
    if (n < perUnit) errors.push(`product-lines difficulty ${level} has ${n}`);
  }
  return errors;
}

/**
 * @param {{ bank: object[], unitIds: string[], difficulty: number, seenIds?: string[], count?: number }} args
 * Fresh questions at the current difficulty come first, then easier unseen ones.
 * Seen questions return only after that pool is short, oldest first.
 */
export function drawDeck({ bank, unitIds, difficulty, seenIds = [], count = 10 }) {
  const level = Math.max(1, Number(difficulty) || 1);
  const seenList = (Array.isArray(seenIds) ? seenIds : []).map(String);
  const seen = new Set(seenList);
  const deck = {};
  for (const unit of unitIds) {
    const pool = (bank || []).filter((q) => q.unit === unit && Number(q.difficulty) <= level);
    const byId = new Map(pool.map((q) => [q.id, q]));
    const picked = [];
    const take = (list, recycled) => {
      for (const q of list) {
        if (picked.length >= count) return;
        if (picked.some((p) => p.id === q.id)) continue;
        picked.push({ ...q, recycled });
      }
    };
    take(pool.filter((q) => Number(q.difficulty) === level && !seen.has(q.id)), false);
    take(pool.filter((q) => Number(q.difficulty) < level && !seen.has(q.id)), false);
    if (picked.length < count) {
      const used = new Set(picked.map((q) => q.id));
      take(seenList.filter((id) => byId.has(id) && !used.has(id)).map((id) => byId.get(id)), true);
      take(pool.filter((q) => !picked.some((p) => p.id === q.id)), true);
    }
    deck[unit] = picked.slice(0, count);
  }
  return deck;
}

export function nextDifficulty(level, ratio, maxLevel = 3) {
  const current = Math.max(1, Number(level) || 1);
  const cap = Math.max(current, Number(maxLevel) || 3);
  if (Number(ratio) >= PASS_RATIO && current < cap) return current + 1;
  return current;
}

export function difficultyLabel(level, difficulties = []) {
  const found = (difficulties || []).find((d) => Number(d.level) === Number(level));
  return found?.label || `Level ${level}`;
}
