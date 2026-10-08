/**
 * Mesozoic catalog — eras, species, body plans, and scale helpers.
 * Entertainment page data; lengths are commonly cited adult estimates.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const HUMAN_HEIGHT_M = 1.75;
  const SCHOOL_BUS_M = 12;
  const FEET_PER_METER = 3.28084;

  const ERAS = [
    {
      id: 'triassic',
      name: 'Triassic',
      startMa: 252,
      endMa: 201,
      kicker: 'Dawn of the dinosaurs',
      blurb: 'One supercontinent, Pangaea, baking under a red sun. The first dinosaurs are small, quick, and easy to miss among the crocodile cousins.',
      sky: {
        zenith: '#2a1830',
        horizon: '#f08a4b',
        sun: '#ffd27a',
        haze: '#c9573a',
        cloud: '#f6b08a',
        ridge: '#3a1a1c',
      },
      ground: '#a4532f',
      groundDeep: '#5c2617',
      fog: '#d27046',
      rim: '#ffb36b',
      ember: 0.25,
      flora: 'arid',
      defaultSpecies: 'coelophysis',
    },
    {
      id: 'jurassic',
      name: 'Jurassic',
      startMa: 201,
      endMa: 145,
      kicker: 'Age of giants',
      blurb: 'Pangaea splits and the air turns humid. Fern prairies and conifer forests feed the biggest animals ever to walk on land.',
      sky: {
        zenith: '#0f2a2e',
        horizon: '#9fc59a',
        sun: '#f4f0c0',
        haze: '#4f8a6c',
        cloud: '#d8e8cc',
        ridge: '#13302a',
      },
      ground: '#3f6b32',
      groundDeep: '#1d3a1c',
      fog: '#6f9f7c',
      rim: '#d9f2b0',
      ember: 0.05,
      flora: 'fern',
      defaultSpecies: 'stegosaurus',
    },
    {
      id: 'cretaceous',
      name: 'Cretaceous',
      startMa: 145,
      endMa: 66,
      kicker: 'Last light of the Mesozoic',
      blurb: 'Flowers bloom, seas rise, volcanoes vent — and the reign ends 66 million years ago when a 10 km asteroid strikes the Yucatán.',
      sky: {
        zenith: '#140c18',
        horizon: '#e0542c',
        sun: '#ffb04a',
        haze: '#7a2a20',
        cloud: '#5a3a3c',
        ridge: '#1a0c0e',
      },
      ground: '#3a2a22',
      groundDeep: '#1a110d',
      fog: '#8a3a26',
      rim: '#ff7a3a',
      ember: 1,
      flora: 'volcanic',
      defaultSpecies: 'tyrannosaurus',
    },
  ];

  /*
   * body: plan + proportions consumed by the procedural mesh builder.
   *   form: theropod | prosauropod | sauropod | stegosaur | ceratopsian | ankylosaur
   *   torso [length, height, width], neck [segments, length, lift 0..1], head [size, snout],
   *   tail [segments, length], legs [hind, fore], plus optional armour flags.
   */
  const SPECIES = [
    {
      id: 'coelophysis',
      name: 'Coelophysis',
      era: 'triassic',
      ma: [216, 203],
      lengthM: 3,
      diet: 'carnivore',
      found: 'Ghost Ranch, New Mexico',
      meaning: 'Hollow form',
      blurb: 'A whip-thin early hunter with hollow bones. Hundreds were found together at Ghost Ranch, frozen in a single flood.',
      palette: { skin: '#b8763a', belly: '#e8c58a', accent: '#5a2f18' },
      body: { form: 'theropod', torso: [0.9, 0.42, 0.34], neck: [4, 0.75, 0.55], head: [0.24, 1.6], tail: [9, 1.9], legs: [0.95, 0.32] },
    },
    {
      id: 'herrerasaurus',
      name: 'Herrerasaurus',
      era: 'triassic',
      ma: [233, 228],
      lengthM: 6,
      diet: 'carnivore',
      found: 'Ischigualasto, Argentina',
      meaning: "Herrera's lizard",
      blurb: 'One of the oldest known dinosaurs — a sharp-toothed predator of the Valley of the Moon with a flexible lower jaw.',
      palette: { skin: '#8a4a2c', belly: '#d6a070', accent: '#2e1a12' },
      body: { form: 'theropod', torso: [1.05, 0.55, 0.42], neck: [3, 0.55, 0.45], head: [0.34, 1.45], tail: [8, 1.75], legs: [0.9, 0.36] },
    },
    {
      id: 'plateosaurus',
      name: 'Plateosaurus',
      era: 'triassic',
      ma: [214, 204],
      lengthM: 8,
      diet: 'herbivore',
      found: 'Trossingen, Germany',
      meaning: 'Broad lizard',
      blurb: 'A long-necked plant eater that walked on two legs — an early cousin of the giant sauropods still millions of years away.',
      palette: { skin: '#7d6a3a', belly: '#d8c48e', accent: '#43361c' },
      body: { form: 'prosauropod', torso: [1.2, 0.68, 0.55], neck: [5, 1.05, 0.6], head: [0.22, 1.2], tail: [9, 1.85], legs: [0.95, 0.5] },
    },
    {
      id: 'stegosaurus',
      name: 'Stegosaurus',
      era: 'jurassic',
      ma: [155, 150],
      lengthM: 9,
      diet: 'herbivore',
      found: 'Morrison Formation, western USA',
      meaning: 'Roof lizard',
      blurb: 'Seventeen bony plates down its back and four tail spikes — the thagomizer — to keep Allosaurus honest.',
      palette: { skin: '#5d7a3c', belly: '#c8c890', accent: '#b8462e' },
      body: { form: 'stegosaur', torso: [1.45, 0.82, 0.72], neck: [3, 0.45, 0.05], head: [0.2, 1.35], tail: [8, 1.6], legs: [0.7, 0.48], plates: 9, spikes: 4 },
    },
    {
      id: 'allosaurus',
      name: 'Allosaurus',
      era: 'jurassic',
      ma: [155, 145],
      lengthM: 8.5,
      diet: 'carnivore',
      found: 'Morrison Formation, western USA',
      meaning: 'Different lizard',
      blurb: 'The apex predator of the Late Jurassic, with brow horns and a hatchet bite that slashed rather than crushed.',
      palette: { skin: '#6e5a3a', belly: '#d2bb8c', accent: '#8a2a1e' },
      body: { form: 'theropod', torso: [1.2, 0.7, 0.55], neck: [3, 0.55, 0.5], head: [0.42, 1.5], tail: [9, 1.85], legs: [1.0, 0.36], browHorns: true },
    },
    {
      id: 'brachiosaurus',
      name: 'Brachiosaurus',
      era: 'jurassic',
      ma: [154, 153],
      lengthM: 22,
      diet: 'herbivore',
      found: 'Grand River Valley, Colorado',
      meaning: 'Arm lizard',
      blurb: 'Front legs longer than its back legs gave it a giraffe stance, browsing treetops some 12 metres off the ground.',
      palette: { skin: '#5f7270', belly: '#b9c4b4', accent: '#36443f' },
      body: { form: 'sauropod', torso: [1.7, 1.0, 0.85], neck: [7, 2.6, 0.92], head: [0.26, 1.15], tail: [10, 2.1], legs: [1.15, 1.45] },
    },
    {
      id: 'tyrannosaurus',
      name: 'Tyrannosaurus',
      era: 'cretaceous',
      ma: [68, 66],
      lengthM: 12.3,
      diet: 'carnivore',
      found: 'Hell Creek Formation, Montana',
      meaning: 'Tyrant lizard',
      blurb: 'A bone-crushing bite, binocular vision, and arms that could still curl a few hundred kilos. Rex ruled to the very end.',
      palette: { skin: '#4e3e30', belly: '#b49a7a', accent: '#a8341e' },
      body: { form: 'theropod', torso: [1.5, 0.95, 0.78], neck: [3, 0.55, 0.45], head: [0.62, 1.35], tail: [9, 2.0], legs: [1.15, 0.2], tinyArms: true },
    },
    {
      id: 'triceratops',
      name: 'Triceratops',
      era: 'cretaceous',
      ma: [68, 66],
      lengthM: 9,
      diet: 'herbivore',
      found: 'Hell Creek Formation, Montana',
      meaning: 'Three-horned face',
      blurb: 'A skull up to two and a half metres long, a solid bone frill, and three horns — sparring partner of the last T. rex.',
      palette: { skin: '#5a4632', belly: '#c4ad86', accent: '#d8a040' },
      body: { form: 'ceratopsian', torso: [1.4, 0.95, 0.85], neck: [2, 0.3, 0.1], head: [0.55, 1.1], tail: [6, 0.95], legs: [0.66, 0.6], frill: true, horns: 3 },
    },
    {
      id: 'ankylosaurus',
      name: 'Ankylosaurus',
      era: 'cretaceous',
      ma: [68, 66],
      lengthM: 8,
      diet: 'herbivore',
      found: 'Hell Creek, Montana · Alberta',
      meaning: 'Fused lizard',
      blurb: 'A living tank: bony armour plates fused into its skin and a tail club that could break a tyrant’s ankle.',
      palette: { skin: '#5c5442', belly: '#a89a78', accent: '#2e2a20' },
      body: { form: 'ankylosaur', torso: [1.5, 0.62, 1.0], neck: [2, 0.25, 0.05], head: [0.34, 0.95], tail: [7, 1.3], legs: [0.48, 0.44], club: true, armour: true },
    },
  ];

  function eraById(id) {
    const key = String(id || '').toLowerCase();
    return ERAS.find((era) => era.id === key) || null;
  }

  function speciesById(id) {
    const key = String(id || '').toLowerCase();
    return SPECIES.find((sp) => sp.id === key) || null;
  }

  function speciesForEra(eraId) {
    const key = String(eraId || '').toLowerCase();
    return SPECIES.filter((sp) => sp.era === key);
  }

  function defaultSpeciesForEra(eraId) {
    const era = eraById(eraId);
    return era ? speciesById(era.defaultSpecies) : null;
  }

  function maxLengthM() {
    return SPECIES.reduce((max, sp) => Math.max(max, sp.lengthM), 0);
  }

  function metersToFeet(m) {
    return Math.round(Number(m) * FEET_PER_METER);
  }

  function formatLength(m) {
    const value = Number(m);
    if (!Number.isFinite(value) || value <= 0) return '';
    const meters = Number.isInteger(value) ? String(value) : value.toFixed(1);
    return `${meters} m · ${metersToFeet(value)} ft`;
  }

  function formatMa(range) {
    if (!Array.isArray(range) || range.length < 2) return '';
    const [a, b] = range;
    return a === b ? `${a} Ma` : `${a}–${b} Ma`;
  }

  /** Adults lying head-to-toe needed to span the animal (min 1). */
  function humansLong(lengthM) {
    const value = Number(lengthM);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.max(1, Math.round(value / HUMAN_HEIGHT_M));
  }

  /** 0..1 share of the longest animal in the catalog. */
  function scaleShare(lengthM) {
    const max = maxLengthM();
    const value = Number(lengthM);
    if (!max || !Number.isFinite(value) || value <= 0) return 0;
    return Math.min(1, value / max);
  }

  function hexToRgb01(hex) {
    const clean = String(hex || '').replace('#', '').trim();
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    if (!/^[0-9a-f]{6}$/i.test(full)) return [0, 0, 0];
    const n = parseInt(full, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  root.DinosaursCatalog = {
    HUMAN_HEIGHT_M,
    SCHOOL_BUS_M,
    ERAS,
    SPECIES,
    eraById,
    speciesById,
    speciesForEra,
    defaultSpeciesForEra,
    maxLengthM,
    metersToFeet,
    formatLength,
    formatMa,
    humansLong,
    scaleShare,
    hexToRgb01,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
