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
      oracle: 'Rose turns the ram face-up. Start before you feel ready. The parlor rewards a clean first step more than a perfect map.',
      shadow: 'Heat without a door — you can scorch the room you meant to warm.',
      gift: 'The nerve to begin.',
      askRose: 'Read Aries for me',
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
      oracle: 'Rose lays the bull on velvet. Stay with what is already good. Pleasure is a plan when you keep it honest.',
      shadow: 'Stubborn comfort — the orchard can become a fence.',
      gift: 'Making a room feel like home.',
      askRose: 'Read Taurus for me',
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
      oracle: 'Rose fans the twins. Ask the second question. The parlor likes a mind that can hold two lamps at once.',
      shadow: 'Talk that never lands — sparks without a letter.',
      gift: 'Wit that opens a door.',
      askRose: 'Read Gemini for me',
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
      oracle: 'Rose slides the crab toward the candle. Guard what you love, then let one person in. Memory is armor, not a locked cellar.',
      shadow: 'A shell so thick the table never gets set.',
      gift: 'A table always ready for kin.',
      askRose: 'Read Cancer for me',
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
      oracle: 'Rose tips the lion into the light. Take the center without apology, then share the warmth. Applause is a gift you can give back.',
      shadow: 'Pride that eats the room it meant to light.',
      gift: 'Courage to stand in the middle.',
      askRose: 'Read Leo for me',
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
      oracle: 'Rose sorts the sheaf. Name one small repair. The parlor loves a clean stitch more than a grand speech.',
      shadow: 'A checklist that never lets the harvest rest.',
      gift: 'Work done cleanly, offered without fuss.',
      askRose: 'Read Virgo for me',
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
      oracle: 'Rose levels the scales. Choose the missing weight, not the prettier pan. Harmony is a backbone, not a smile that never argues.',
      shadow: 'Peace so polished nobody can tell what you want.',
      gift: 'An eye for the missing weight.',
      askRose: 'Read Libra for me',
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
      oracle: 'Rose sets the hook beside the candle. Keep the vow, then molt. Depth is a gift until it becomes a well with no ladder.',
      shadow: 'A private vow that turns into a trap.',
      gift: 'The nerve to shed a skin.',
      askRose: 'Read Scorpio for me',
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
      oracle: 'Rose looses the arrow across the cloth. Tell the true joke, then walk. The parlor likes a far road more than a finished fence.',
      shadow: 'Restless honesty that never unpacks a bag.',
      gift: 'Aim that outruns the old map.',
      askRose: 'Read Sagittarius for me',
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
      oracle: 'Rose plants the sea-goat on the rail. Take the next stair, not the summit speech. Time is a tool if you let it be dry-witted.',
      shadow: 'A climb that forgets why the mountain mattered.',
      gift: 'Patience with a dry joke in the pack.',
      askRose: 'Read Capricorn for me',
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
      oracle: 'Rose tips the jar. Pour the idea where people can drink. Tomorrow is kinder when the whole street gets a cup.',
      shadow: 'A future so cool nobody can sit beside you.',
      gift: 'Friendship with the whole street.',
      askRose: 'Read Aquarius for me',
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
      oracle: 'Rose draws the silver cord. Listen at the door, then choose one current. Kindness soaks the edges — do not dissolve.',
      shadow: 'A dream so porous the self leaks out.',
      gift: 'Music under the door, offered as care.',
      askRose: 'Read Pisces for me',
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

  function parseReadingQuery(search) {
    const raw = String(search || '').replace(/^\?/, '');
    if (!raw || raw.startsWith('#')) return false;
    const params = new URLSearchParams(raw);
    const value = String(params.get('reading') || '').toLowerCase();
    return value === '1' || value === 'true' || value === 'yes';
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleCopy(list, rng) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function spreadForMonthDay(month, day) {
    const sun = signForMonthDay(month, day);
    if (!sun) return null;
    const seed = (Number(month) * 100 + Number(day)) * 2654435761;
    const rest = shuffleCopy(
      SIGNS.filter((sign) => sign.id !== sun.id),
      mulberry32(seed >>> 0 || 1)
    );
    return {
      sun,
      cross: rest[0],
      path: rest[1],
      month: Number(month),
      day: Number(day),
    };
  }

  function spreadPrompt(spread) {
    if (!spread || !spread.sun || !spread.cross || !spread.path) return '';
    return `Read this Sun / Cross / Path: ${spread.sun.name}, ${spread.cross.name}, ${spread.path.name}`;
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

  function wheelWedgePath(index, inner, outer) {
    const start = ((index * 30 - 15 - 90) * Math.PI) / 180;
    const end = ((index * 30 + 15 - 90) * Math.PI) / 180;
    const cx = 100;
    const cy = 100;
    const x1 = cx + Math.cos(start) * outer;
    const y1 = cy + Math.sin(start) * outer;
    const x2 = cx + Math.cos(end) * outer;
    const y2 = cy + Math.sin(end) * outer;
    const x3 = cx + Math.cos(end) * inner;
    const y3 = cy + Math.sin(end) * inner;
    const x4 = cx + Math.cos(start) * inner;
    const y4 = cy + Math.sin(start) * inner;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outer} ${outer} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${inner} ${inner} 0 0 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
  }

  function wheelWedgesSvg() {
    const wedges = SIGNS.map((sign, index) => {
      return `<path class="astro-wedge" data-sign="${sign.id}" data-element="${sign.element}" d="${wheelWedgePath(index, 34, 96)}"/>`;
    }).join('');
    return `<g class="astro-wedges">${wedges}</g>`;
  }

  root.AstrologyZodiac = {
    SIGNS,
    ELEMENTS,
    textGlyph,
    signById,
    signForMonthDay,
    signForDate,
    parseSignQuery,
    parseReadingQuery,
    spreadForMonthDay,
    spreadPrompt,
    constellationSvg,
    wheelWedgesSvg,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
