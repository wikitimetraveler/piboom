/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import {
  parseFamilyNumber,
  romanToInt,
  normalizeCarryForward,
  parseOcrYear,
  parseLifespan,
  parseChildBirthYear,
  stripRunningHeader,
  parsePedigree,
  parseFamilyHeader,
  extractChildren,
  decodeGenealogyRegister,
  buildNodeIndex,
  resolvePerson,
  buildGenealogyCodePlan,
  applyGenealogyCodePlan,
  summarizeRegister
} from '../../services/lane-genealogy-codes.service.js';
import { validateLaneData } from '../../services/genealogy-import.service.js';

// Squashed embedded-text style of the 1891 register (spaces stripped, OCR superscripts as ^ ' -).
const PAGES = [
  {
    pdfPage: 20,
    text:
      "8 WILLIAMLANEANDFAMILY.Hewasmadefreeman6May,1657.No.I.WILLIAMLANE'ofBoston,1650,cordwainer,andhisfirstw.MARY,had:\n" +
      'I.Samuel-,b.8Aug.,1648.(2)II.Samuel-,b.Boston,23Jan.,1651-2.(3)III.William^,b.Boston,1659.IV.Elizabeth^,b.1661.'
  },
  {
    pdfPage: 22,
    text:
      "10WILLIAMLANEANDFAMILY.No.2.SAMUELLANE2(William')1651-1690,ofHadley.HiswifewasSARAH(DICKINSON).Theirchildren:\n" +
      'I.Sarah3,b.1680.II.John3,b.3Apr.,1686,settledinConnecticut.' +
      'No.3.WILLIAMLANE--^(William^)1659-1749,tailor,ofBoston,andhiswife,SARAH(WEBSTER)had:I.JoHN-^,b.Boston,17Feb.,1685,m.7Mar.,1709,Mary.'
  }
];

function makeLaneData() {
  return {
    nodes: [
      { id: 4, name: 'William Lane (I)', birthYear: 1625, gender: 'M' },
      { id: 3, name: 'Mary (Brewer) Lane', gender: 'F' },
      { id: 6, name: 'Samuel Lane', birthYear: 1651, gender: 'M' },
      { id: 10, name: 'William Lane (II)', birthYear: 1659, gender: 'M' },
      { id: 11, name: 'Elizabeth Lane', birthYear: 1661, gender: 'F' },
      { id: 13, name: 'Sarah Dickinson', birthYear: 1655, gender: 'F' },
      { id: 19, name: 'Sarah Webster', birthYear: 1666, gender: 'F' },
      { id: 20, name: 'John Lane', birthYear: 1685, gender: 'M' },
      { id: 30, name: 'John Lane', birthYear: 1686, gender: 'M' },
      { id: 31, name: 'Sarah Lane', birthYear: 1680, gender: 'F' },
      { id: 88, name: 'William Lane', birthYear: 1660, gender: 'M' }
    ],
    links: [
      { source: 6, target: 4, relation: 'father', color: '#39F' },
      { source: 10, target: 4, relation: 'father', color: '#39F' },
      { source: 11, target: 4, relation: 'father', color: '#39F' },
      { source: 4, target: 3, relation: 'spouse', color: '#CC0' },
      { source: 10, target: 19, relation: 'spouse', color: '#CC0' },
      { source: 20, target: 88, relation: 'father', color: '#39F' }
    ]
  };
}

function runPipeline(laneData = makeLaneData()) {
  const index = buildNodeIndex(laneData);
  const register = decodeGenealogyRegister(PAGES, { givenSet: index.givenSet });
  const plan = buildGenealogyCodePlan(register, laneData);
  const applied = applyGenealogyCodePlan(laneData, plan);
  return { laneData, register, plan, ...applied };
}

describe('lane genealogy codes — OCR primitives', () => {
  test('family numbers repair OCR digits and keep "a" suffixes', () => {
    expect(parseFamilyNumber('II')).toEqual({ no: 11, suffix: '', key: '11' });
    expect(parseFamilyNumber('103a')).toEqual({ no: 103, suffix: 'a', key: '103a' });
    expect(parseFamilyNumber('No')).toBeNull();
  });

  test('roman numerals and carry-forward markers', () => {
    expect(romanToInt('XIV')).toBe(14);
    expect(romanToInt('abc')).toBeNull();
    expect(normalizeCarryForward('4:')).toBe(4);
    expect(normalizeCarryForward('XI')).toBe(11);
    expect(normalizeCarryForward('I3')).toBe(13);
    expect(normalizeCarryForward('')).toBeNull();
  });

  test('years: OCR swaps, lifespan anchored to the header, child b. clause only', () => {
    expect(parseOcrYear('1S25')).toBe(1825);
    expect(parseOcrYear('i746')).toBe(1746);
    expect(parseOcrYear('2025')).toBeNull();
    expect(parseLifespan('1651-1690,a soldier')).toEqual({ birthYear: 1651, deathYear: 1690 });
    expect(parseLifespan(',1802-andhisw.')).toEqual({ birthYear: 1802, deathYear: null });
    expect(parseLifespan('ofBoston,1650,cordwainer')).toEqual({ birthYear: null, deathYear: null });
    expect(parseChildBirthYear('b.Boston,23Jan.,1651-2.')).toBe(1651);
    expect(parseChildBirthYear('b.,m.6Oct.,1709,AbigailHovey')).toBeNull();
    expect(parseChildBirthYear('Sarah3.')).toBeNull();
  });

  test('running headers: even-page printed number is not read from "WILLIAM"', () => {
    expect(stripRunningHeader('10WILLIAMLANEANDFAMILY.No.2.SAMUELLANE')).toEqual({ text: 'No.2.SAMUELLANE', printedPage: 10 });
    expect(stripRunningHeader('NUMBERTHREE.11II.Sarah', 11)).toEqual({ text: 'II.Sarah', printedPage: 11 });
  });
});

describe('lane genealogy codes — headers, pedigrees, children', () => {
  test('pedigree chains expand abbreviations without eating the leading S', () => {
    expect(parsePedigree('Sam.4,Sam.3,Wm.2').names).toEqual(['Samuel', 'Samuel', 'William']);
    expect(parsePedigree('Sam.^VVm.i').names).toEqual(['Samuel', 'William']);
    expect(parsePedigree('s.of Sim.,Wm.').names).toEqual(['Simeon', 'William']);
  });

  test('family header: head, pedigree, wife maiden name', () => {
    const { head, wives } = parseFamilyHeader("SAMUELLANE3(Sam.^VVm.i)andhisw.,ABI.(HOVEY),hadb.inSuffield,Conn.:*I.Sarah'',b.18Mar.,1710.");
    expect(head).toMatchObject({ given: 'Samuel', surname: 'Lane', pedigree: ['Samuel', 'William'] });
    expect(wives).toHaveLength(1);
    expect(wives[0]).toMatchObject({ given: 'Abi', maiden: 'Hovey', order: 1 });
  });

  test('family header: titles, dagger before pedigree, lifespan', () => {
    const { head, wives } = parseFamilyHeader("CORNETJOHNLANE^t(Jn.^,Wm.2,Wm.'),1709-1784,ofHampton,andhisw.MARY(BATCHELDER)had:");
    expect(head).toMatchObject({ given: 'John', titles: ['Cornet'], pedigree: ['John', 'William', 'William'], birthYear: 1709, deathYear: 1784 });
    expect(wives[0]).toMatchObject({ given: 'Mary', maiden: 'Batchelder' });
  });

  test('"By his (2) w. DAVID LANE had:" restates the husband and is not a second wife', () => {
    const { wives } = parseFamilyHeader('DAVIDLANE(Sam.,Jn.)1808-1888,andhisw.LYDIA(CURRIER)had:I.Ann,b.1830.Byhis(2)w.DAVIDLANE^had:VI.Harriet,b.1840.');
    expect(wives.map((w) => w.displayName)).toEqual(['Lydia (Currier)']);
  });

  test('children keep roman order, carry-forward codes, and stop the birth year at the marriage clause', () => {
    const kids = extractChildren('had:(4:)I-Samuel^,b.,m.6Oct.,1709,AbigailHovey.II.Sarah3.III.Mary^,b.Suffield,Ct.,7May,1684,m.11Dec,1707,JonathanSykes.', []);
    expect(kids.map((k) => [k.level, k.order, k.name, k.birthYear, k.carryForward])).toEqual([
      [1, 'I', 'Samuel', null, 4],
      [1, 'II', 'Sarah', null, null],
      [1, 'III', 'Mary', 1684, null]
    ]);
  });
});

describe('lane genealogy codes — register decode', () => {
  test('numbered families link through (N) carry-forward codes', () => {
    const { register } = runPipeline();
    expect(register.families.map((f) => f.familyNo)).toEqual([1, 2, 3]);
    const [f1, f2, f3] = register.families;
    expect(f1.children.map((c) => `${c.carryForward ?? ''}${c.order}:${c.name}:${c.birthYear}`)).toEqual([
      'I:Samuel:1648',
      '2II:Samuel:1651',
      '3III:William:1659',
      'IV:Elizabeth:1661'
    ]);
    expect(f2.parentLink).toMatchObject({ familyNo: 1, childOrder: 'II', carryForwardNo: 2, method: 'carry-forward', confidence: 'high' });
    expect(f3.parentLink).toMatchObject({ familyNo: 1, childOrder: 'III', carryForwardNo: 3 });
    expect(f3.generation).toBe(2);
    expect(f2.pdfPage).toBe(22);
  });
});

describe('lane genealogy codes — resolve, plan, apply', () => {
  test('resolvePerson requires a birth-year agreement and rejects a conflicting existing parent when strict', () => {
    const index = buildNodeIndex(makeLaneData());
    expect(resolvePerson(index, { given: 'John', surname: 'Lane', birthYear: 1686 })?.id).toBe(30);
    expect(resolvePerson(index, { given: 'John', surname: 'Lane', birthYear: 1700 })).toBeNull();
    expect(resolvePerson(index, { given: 'Samuel', surname: 'Lane', birthYear: 1651, fatherGiven: 'Thomas' }, { strictParents: true })).toBeNull();
    expect(resolvePerson(index, { given: 'Samuel', surname: 'Lane', birthYear: 1651, fatherGiven: 'William' }, { strictParents: true })?.id).toBe(6);
  });

  test('head without a lifespan is inferred from the children\'s shared laneData father', () => {
    const { plan } = runPipeline();
    const f1 = plan.families.find((f) => f.familyNo === 1);
    expect(f1.resolved.headId).toBe(4);
    expect(f1.resolved.headMethod).toBe('children-majority');
    expect(f1.resolved.childIds).toEqual([null, 6, 10, 11]);
  });

  test('wives resolve by maiden name; unmatched names go to review, never new nodes', () => {
    const { plan, laneData: out } = runPipeline();
    expect(plan.families.find((f) => f.familyNo === 2).resolved.wifeIds).toEqual([13]);
    expect(plan.review.some((r) => r.type === 'child' && r.name === 'Samuel' && r.birthYear === 1648)).toBe(true);
    expect(out.nodes).toHaveLength(makeLaneData().nodes.length);
  });

  test('apply: confirms existing links, adds new ones with provenance, records conflicts without writing them', () => {
    const original = makeLaneData();
    const { laneData: out, stats } = runPipeline(original);

    expect(stats.added).toEqual({ father: 2, mother: 3, spouse: 1 });
    expect(stats.confirmed).toBe(4);
    expect(stats.conflicts).toHaveLength(1);
    expect(stats.conflicts[0]).toMatchObject({
      relation: 'father',
      child: { id: 20 },
      existingParent: { id: 88 },
      bookParent: { id: 10 },
      provenance: { familyNo: 3, childOrder: 'I', pdfPage: 22 }
    });
    expect(out.links.some((l) => l.source === 20 && l.target === 10 && l.relation === 'father')).toBe(false);

    const confirmed = out.links.find((l) => l.source === 10 && l.target === 4 && l.relation === 'father');
    expect(confirmed.provenance).toMatchObject({
      source: 'lanegenealogies01chap.pdf',
      by: 'lane-genealogy-codes',
      method: 'carry-forward',
      familyNo: 1,
      childOrder: 'III',
      carryForwardNo: 3,
      confirmed: true
    });

    const added = out.links.find((l) => l.source === 30 && l.target === 6 && l.relation === 'father');
    expect(added).toMatchObject({ color: '#39F', provenance: { method: 'child-list', familyNo: 2, childOrder: 'II', pdfPage: 22 } });
    expect(added.provenance.confirmed).toBeUndefined();

    expect(original.links).toHaveLength(6);
    expect(validateLaneData(out).valid).toBe(true);
  });

  test('genealogyCode on people carries family No., carry-forward, pedigree and page', () => {
    const { laneData: out } = runPipeline();
    const william2 = out.nodes.find((n) => n.id === 10);
    expect(william2.genealogyCode).toMatchObject({
      section: 'boston',
      familyNo: 3,
      familyKey: '3',
      generation: 2,
      pedigree: ['William'],
      lifespan: '1659-1749',
      parentFamilyNo: 1,
      childOrder: 'III',
      carryForwardNo: 3,
      pdfPage: 22,
      label: 'No. 3 · (3) III of No. 1 · Gen 2',
      source: 'lanegenealogies01chap.pdf'
    });
    expect(out.nodes.find((n) => n.id === 13).genealogyCode.wifeOfFamilies).toEqual(['2']);
  });

  test('summarizeRegister produces the lane-genealogy-codes dataset document', () => {
    const { plan, stats } = runPipeline();
    const doc = summarizeRegister(plan, stats);
    expect(doc.source).toBe('lanegenealogies01chap.pdf');
    expect(doc.legend.carryForwardNo).toMatch(/heads family No\. N/);
    expect(doc.stats).toMatchObject({ families: 3, familiesWithResolvedHead: 3, familiesLinkedToParentFamily: 2, conflicts: 1 });
    expect(doc.families[1].children[1]).toMatchObject({ order: 'II', name: 'John', personId: 30 });
  });
});
