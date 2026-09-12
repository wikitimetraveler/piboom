/**
 * Western tropical zodiac catalog + birthday lookup.
 * Entertainment page data — not astronomy.
 * Development work by David Lane
 */
(function (root) {
  'use strict';

  const ELEMENTS = {
    fire: { id: 'fire', label: 'Fire', motto: 'Spark and stride' },
    earth: { id: 'earth', label: 'Earth', motto: 'Root and craft' },
    air: { id: 'air', label: 'Air', motto: 'Thought and talk' },
    water: { id: 'water', label: 'Water', motto: 'Tide and feeling' },
  };

  const DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const SIGNS = [
    {
      id: 'aries',
      name: 'Aries',
      glyph: '♈',
      dates: 'Mar 21 – Apr 19',
      start: [3, 21],
      end: [4, 19],
      element: 'fire',
      modality: 'cardinal',
      ruler: 'Mars',
      symbol: 'Ram',
      kicker: 'First spark of the year.',
      traits: ['bold', 'initiating', 'direct'],
      blurb: 'Aries kicks the wheel. Gold horns, a forward lean, and the nerve to start before the map is finished.',
      stars: [[40, 88], [68, 62], [96, 48], [128, 40], [158, 52]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
    },
    {
      id: 'taurus',
      name: 'Taurus',
      glyph: '♉',
      dates: 'Apr 20 – May 20',
      start: [4, 20],
      end: [5, 20],
      element: 'earth',
      modality: 'fixed',
      ruler: 'Venus',
      symbol: 'Bull',
      kicker: 'Slow luxury, sure ground.',
      traits: ['steady', 'sensual', 'loyal'],
      blurb: 'Taurus holds the orchard. A V of stars, a patient appetite, and the gift of making a room feel like home.',
      stars: [[42, 48], [72, 70], [108, 82], [142, 70], [168, 46], [108, 118]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]],
    },
    {
      id: 'gemini',
      name: 'Gemini',
      glyph: '♊',
      dates: 'May 21 – Jun 20',
      start: [5, 21],
      end: [6, 20],
      element: 'air',
      modality: 'mutable',
      ruler: 'Mercury',
      symbol: 'Twins',
      kicker: 'Two voices, one sky.',
      traits: ['curious', 'quick', 'witty'],
      blurb: 'Gemini splits the conversation into sparks. Twin columns of light, messages crossing, never one story only.',
      stars: [[70, 36], [70, 78], [70, 122], [130, 40], [130, 82], [130, 126], [100, 80]],
      lines: [[0, 1], [1, 2], [3, 4], [4, 5], [1, 6], [4, 6]],
    },
    {
      id: 'cancer',
      name: 'Cancer',
      glyph: '♋',
      dates: 'Jun 21 – Jul 22',
      start: [6, 21],
      end: [7, 22],
      element: 'water',
      modality: 'cardinal',
      ruler: 'Moon',
      symbol: 'Crab',
      kicker: 'A silver shell around the heart.',
      traits: ['protective', 'intuitive', 'tender'],
      blurb: 'Cancer keeps the tide chart. A soft crab of dim stars, memory as armor, and a table always set for kin.',
      stars: [[58, 70], [88, 52], [118, 52], [148, 70], [128, 102], [78, 102], [103, 80]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 6], [2, 6]],
    },
    {
      id: 'leo',
      name: 'Leo',
      glyph: '♌',
      dates: 'Jul 23 – Aug 22',
      start: [7, 23],
      end: [8, 22],
      element: 'fire',
      modality: 'fixed',
      ruler: 'Sun',
      symbol: 'Lion',
      kicker: 'Mane of daylight.',
      traits: ['radiant', 'generous', 'proud'],
      blurb: 'Leo wears the sickle of summer. A warm roar, a gift of applause, and the courage to stand in the middle of the room.',
      stars: [[46, 58], [78, 42], [112, 48], [138, 72], [152, 108], [118, 122], [86, 96]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 2]],
    },
    {
      id: 'virgo',
      name: 'Virgo',
      glyph: '♍',
      dates: 'Aug 23 – Sep 22',
      start: [8, 23],
      end: [9, 22],
      element: 'earth',
      modality: 'mutable',
      ruler: 'Mercury',
      symbol: 'Maiden',
      kicker: 'The harvest, sorted.',
      traits: ['precise', 'helpful', 'discerning'],
      blurb: 'Virgo gilds the details. A sheaf of stars, a calm checklist, and the quiet pride of work done cleanly.',
      stars: [[52, 46], [78, 68], [104, 88], [128, 108], [150, 132], [96, 118], [70, 98]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 1]],
    },
    {
      id: 'libra',
      name: 'Libra',
      glyph: '♎',
      dates: 'Sep 23 – Oct 22',
      start: [9, 23],
      end: [10, 22],
      element: 'air',
      modality: 'cardinal',
      ruler: 'Venus',
      symbol: 'Scales',
      kicker: 'Balance as an art.',
      traits: ['fair', 'graceful', 'diplomatic'],
      blurb: 'Libra hangs the gold scales at dusk. Beauty with a backbone, a gift for harmony, and an eye for the missing weight.',
      stars: [[40, 88], [88, 88], [112, 52], [136, 88], [184, 88], [88, 128], [136, 128]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [3, 6], [5, 6]],
    },
    {
      id: 'scorpio',
      name: 'Scorpio',
      glyph: '♏',
      dates: 'Oct 23 – Nov 21',
      start: [10, 23],
      end: [11, 21],
      element: 'water',
      modality: 'fixed',
      ruler: 'Pluto · Mars',
      symbol: 'Scorpion',
      kicker: 'The hook that remembers.',
      traits: ['intense', 'loyal', 'transforming'],
      blurb: 'Scorpio draws a dark hook across the sky. Depth, a private vow, and the nerve to shed a skin when the old one pinches.',
      stars: [[36, 58], [64, 70], [92, 78], [122, 82], [150, 74], [168, 98], [158, 128], [138, 146]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
    },
    {
      id: 'sagittarius',
      name: 'Sagittarius',
      glyph: '♐',
      dates: 'Nov 22 – Dec 21',
      start: [11, 22],
      end: [12, 21],
      element: 'fire',
      modality: 'mutable',
      ruler: 'Jupiter',
      symbol: 'Archer',
      kicker: 'Aim past the map.',
      traits: ['restless', 'honest', 'expansive'],
      blurb: 'Sagittarius looses the arrow. A teapot of stars, a far road, and the joke told at the campfire just before dawn.',
      stars: [[48, 108], [82, 92], [118, 78], [152, 58], [96, 128], [132, 118], [168, 102]],
      lines: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [2, 5], [5, 6]],
    },
    {
      id: 'capricorn',
      name: 'Capricorn',
      glyph: '♑',
      dates: 'Dec 22 – Jan 19',
      start: [12, 22],
      end: [1, 19],
      element: 'earth',
      modality: 'cardinal',
      ruler: 'Saturn',
      symbol: 'Sea-goat',
      kicker: 'Climb, then keep climbing.',
      traits: ['ambitious', 'patient', 'dry-witted'],
      blurb: 'Capricorn takes the long switchback. A goat with a fish-tail, time as a tool, and a summit that still has stairs.',
      stars: [[50, 128], [78, 96], [108, 68], [142, 48], [160, 82], [148, 118], [118, 138]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]],
    },
    {
      id: 'aquarius',
      name: 'Aquarius',
      glyph: '♒',
      dates: 'Jan 20 – Feb 18',
      start: [1, 20],
      end: [2, 18],
      element: 'air',
      modality: 'fixed',
      ruler: 'Uranus · Saturn',
      symbol: 'Water-bearer',
      kicker: 'The jar that pours the future.',
      traits: ['inventive', 'independent', 'humane'],
      blurb: 'Aquarius tips a vessel of stars. A cool current of ideas, a friendship with the whole street, and a taste for tomorrow.',
      stars: [[46, 58], [78, 50], [112, 58], [144, 50], [52, 102], [86, 114], [120, 102], [154, 114]],
      lines: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7]],
    },
    {
      id: 'pisces',
      name: 'Pisces',
      glyph: '♓',
      dates: 'Feb 19 – Mar 20',
      start: [2, 19],
      end: [3, 20],
      element: 'water',
      modality: 'mutable',
      ruler: 'Neptune · Jupiter',
      symbol: 'Fishes',
      kicker: 'Two fish, one silver cord.',
      traits: ['dreamy', 'compassionate', 'porous'],
      blurb: 'Pisces swims both ways at once. A cord between two lights, music under the door, and kindness that soaks the edges.',
      stars: [[44, 48], [68, 70], [88, 96], [112, 96], [136, 70], [162, 46], [100, 128]],
      lines: [[0, 1], [1, 2], [2, 6], [6, 3], [3, 4], [4, 5]],
    },
  ];

  function textGlyph(sign) {
    const glyph = sign && sign.glyph ? String(sign.glyph) : '';
    return glyph ? glyph + '\uFE0E' : '';
  }

  function signById(id) {
    const key = String(id || '').trim().toLowerCase();
    if (!key) return null;
    return SIGNS.find((sign) => sign.id === key) || null;
  }

  function signForMonthDay(month, day) {
    const m = Number(month);
    const d = Number(day);
    if (!Number.isInteger(m) || !Number.isInteger(d)) return null;
    if (m < 1 || m > 12 || d < 1 || d > DAYS_IN_MONTH[m]) return null;
    const md = m * 100 + d;
    for (let i = 0; i < SIGNS.length; i += 1) {
      const sign = SIGNS[i];
      const start = sign.start[0] * 100 + sign.start[1];
      const end = sign.end[0] * 100 + sign.end[1];
      if (start <= end) {
        if (md >= start && md <= end) return sign;
      } else if (md >= start || md <= end) {
        return sign;
      }
    }
    return null;
  }

  function signForDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    return signForMonthDay(date.getMonth() + 1, date.getDate());
  }

  function parseSignQuery(search) {
    const raw = String(search || '');
    const query = raw.startsWith('#') ? '' : raw.replace(/^\?/, '');
    const hash = raw.startsWith('#') ? raw.slice(1) : '';
    let id = hash;
    if (query) {
      const params = new URLSearchParams(query);
      id = params.get('sign') || hash;
    }
    return signById(id);
  }

  function constellationSvg(sign) {
    if (!sign || !Array.isArray(sign.stars)) return '';
    const dots = sign.stars
      .map(([x, y], i) => `<circle class="astro-const__star" cx="${x}" cy="${y}" r="${i === 0 ? 3.2 : 2.4}"/>`)
      .join('');
    const segs = (sign.lines || [])
      .map(([a, b]) => {
        const from = sign.stars[a];
        const to = sign.stars[b];
        if (!from || !to) return '';
        return `<line x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}"/>`;
      })
      .join('');
    return `<svg class="astro-const" viewBox="0 0 200 180" role="img" aria-label="${sign.name} asterism">${segs}${dots}</svg>`;
  }

  root.AstrologyZodiac = {
    SIGNS,
    ELEMENTS,
    textGlyph,
    signById,
    signForMonthDay,
    signForDate,
    parseSignQuery,
    constellationSvg,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
