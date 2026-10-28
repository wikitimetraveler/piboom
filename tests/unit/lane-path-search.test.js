/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import { searchLanePeople, findKinshipPathInGraph, searchPeople, findKinshipPath } from '../../services/genealogy.service.js';

const PEOPLE = [
  {
    id: 4,
    name: 'William Lane (I)',
    gender: 'M',
    birthYear: 1625,
    deathYear: 'aft. May 1676',
    born: 'England; Boston, Mass.',
    generation: 0,
    occupation: [{ job: 'labourer' }],
    genealogyCode: { section: 'boston', familyNo: 1, familyKey: '1', label: 'No. 1 · Gen 1' },
    text: 'Freeman of Boston.'
  },
  {
    id: 10,
    name: 'William Lane (II)',
    gender: 'M',
    birthYear: 1659,
    born: 'Boston, Mass.',
    generation: 1,
    genealogyCode: { section: 'boston', familyNo: 3, familyKey: '3', label: 'No. 3 · Gen 2' }
  },
  {
    id: 19,
    name: 'Sarah Webster',
    gender: 'F',
    birthYear: 1666,
    born: 'Hampton, New Hampshire',
    generation: 1
  },
  {
    id: 20,
    name: 'John Lane',
    gender: 'M',
    birthYear: 1685,
    generation: 2,
    occupation: [{ job: 'tanner' }, { government: 'selectman' }]
  },
  {
    id: 21,
    name: 'Mary Lane',
    gender: 'F',
    birthYear: 1688,
    generation: 2
  },
  {
    id: 50,
    name: 'Isaac Lane',
    gender: 'M',
    birthYear: 1765,
    generation: 4
  },
  {
    id: 51,
    name: 'John Lane',
    gender: 'M',
    birthYear: 1734,
    born: 'Buxton',
    generation: 3
  },
  {
    id: 90,
    name: 'Abigail Smith',
    gender: 'F',
    birthYear: 1700,
    text: 'A deed mentions William Lane beside this household.'
  }
];

const LINKS = [
  { source: 10, target: 4, relation: 'father' },
  { source: 10, target: 19, relation: 'spouse' },
  { source: 20, target: 10, relation: 'father' },
  { source: 20, target: 19, relation: 'mother' },
  { source: 21, target: 10, relation: 'father' },
  { source: 21, target: 19, relation: 'mother' },
  { source: 50, target: 51, relation: 'father' }
];

const GRAPH = { nodes: PEOPLE, links: LINKS };

describe('Lane super search', () => {
  test('ranks a full name above a notes-only mention', () => {
    const out = searchLanePeople(PEOPLE, 'William Lane', { limit: 5 });
    expect(out.total).toBeGreaterThanOrEqual(2);
    expect(out.results[0].name).toMatch(/William Lane/);
    expect(out.results[0].match.why).toMatch(/name/);
    expect(out.results.some((person) => person.id === 90)).toBe(true);
    expect(out.results[0].match.score).toBeGreaterThan(out.results.find((person) => person.id === 90).match.score);
  });

  test('field prefixes, years, register codes, and work', () => {
    expect(searchLanePeople(PEOPLE, 'place:Hampton').results.map((p) => p.id)).toEqual([19]);
    expect(searchLanePeople(PEOPLE, '1659').results.map((p) => p.id)).toContain(10);
    const ranged = searchLanePeople(PEOPLE, '1650-1700').results.map((p) => p.id);
    expect(ranged).toEqual(expect.arrayContaining([4, 10, 19, 20, 21]));
    expect(ranged).not.toContain(50);
    expect(ranged).not.toContain(51);
    expect(searchLanePeople(PEOPLE, 'no 3').results.map((p) => p.id)).toEqual([10]);
    expect(searchLanePeople(PEOPLE, 'work:tanner').results.map((p) => p.id)).toEqual([20]);
    expect(searchLanePeople(PEOPLE, 'work:selectman').results.map((p) => p.id)).toEqual([20]);
    expect(searchLanePeople(PEOPLE, 'id:20').results.map((p) => p.id)).toEqual([20]);
    expect(searchLanePeople(PEOPLE, 'gen 2').results.map((p) => p.id)).toEqual(expect.arrayContaining([20, 21]));
  });

  test('requires every term and rejects a one-letter query', () => {
    expect(searchLanePeople(PEOPLE, 'William zzzz').total).toBe(0);
    const short = searchLanePeople(PEOPLE, 'w');
    expect(short.total).toBe(0);
    expect(short.notice).toMatch(/two letters/);
  });

  test('live graph search still finds William Lane (I) by work', () => {
    const out = searchPeople('work:labourer', { detailed: true, limit: 8 });
    const william = out.results.find((person) => person.id === 4);
    expect(william).toBeTruthy();
    expect(william.match.why).toMatch(/work/);
  });
});

describe('path between two Lane people', () => {
  test('walks back from John to his grandfather', () => {
    const path = findKinshipPathInGraph(GRAPH, 20, 4, { via: 'blood' });
    expect(path.found).toBe(true);
    expect(path.hops).toBe(2);
    expect(path.kinship).toBe('grandfather');
    expect(path.headline).toBe('William Lane (I) is the grandfather of John Lane.');
    expect(path.steps.map((step) => step.step?.direction ?? 'start')).toEqual(['start', 'back', 'back']);
    expect(path.summary).toMatch(/father/);
  });

  test('walks forward from William I to his grandson', () => {
    const path = findKinshipPathInGraph(GRAPH, 4, 20, { via: 'blood' });
    expect(path.kinship).toBe('grandson');
    expect(path.steps.slice(1).every((step) => step.step.direction === 'forward')).toBe(true);
  });

  test('names a sister and the shared parent', () => {
    const path = findKinshipPathInGraph(GRAPH, 20, 21, { via: 'blood' });
    expect(path.kinship).toBe('sister');
    expect(path.shape).toBe('collateral');
    expect(path.hinge.id).toBe(10);
    expect(path.ups).toBe(1);
    expect(path.downs).toBe(1);
  });

  test('mother, spouse, and a disconnected branch', () => {
    expect(findKinshipPathInGraph(GRAPH, 20, 19, { via: 'blood' }).kinship).toBe('mother');
    const married = findKinshipPathInGraph(GRAPH, 19, 10);
    expect(married.kinship).toBe('spouse');
    expect(married.steps[1].step.direction).toBe('across');
    const none = findKinshipPathInGraph(GRAPH, 50, 4, { via: 'kin' });
    expect(none.found).toBe(false);
    expect(none.reason).toBe('no-path');
  });

  test('same person and unknown id', () => {
    const same = findKinshipPathInGraph(GRAPH, 4, 4);
    expect(same.hops).toBe(0);
    expect(same.shape).toBe('same');
    const missing = findKinshipPathInGraph(GRAPH, 4, 999);
    expect(missing.reason).toBe('person-not-found');
    expect(missing.missing).toEqual([999]);
  });

  test('a marriage shortcut is labeled by-marriage and blood can still connect', () => {
    const viaSpouse = findKinshipPathInGraph(GRAPH, 19, 4, { via: 'kin' });
    expect(viaSpouse.found).toBe(true);
    expect(viaSpouse.shape).toBe('by-marriage');
    expect(viaSpouse.hops).toBe(2);
    const blood = findKinshipPathInGraph(GRAPH, 19, 4, { via: 'blood' });
    expect(blood.found).toBe(true);
    expect(blood.shape).not.toBe('by-marriage');
  });

  test('live blood path reaches William Lane (I) from John Lane', () => {
    const path = findKinshipPath(20, 4, { via: 'blood' });
    expect(path.found).toBe(true);
    expect(path.steps[0].person.id).toBe(20);
    expect(path.steps[path.steps.length - 1].person.id).toBe(4);
    expect(path.steps.slice(1).every((step) => step.step.direction === 'back' || step.step.direction === 'forward')).toBe(true);
  });
});
