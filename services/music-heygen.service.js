/**
 * HeyGen script builders for Music Research — booth popup + HyperFrames narration.
 * Spoken scripts align with docs/MUSIC_RESEARCH_HEYGEN_SCRIPT.md.
 */

/** ~25s booth / QR popup — Music Research Historian welcome. */
export const HISTORIAN_DEMO_SHORT_SCRIPT = [
  'Welcome to Music Research — your Historian guide to artists through era, place, and evidence.',
  'Search a name above: timeline, map, and sources assemble around the artist.',
  'Ask in chat — I separate documented fact from interpretation.',
  'Tap Open Music Research below to explore — or try Time Machine and the Pilgrimage Atlas for deeper roads.'
].join(' ');

export const HISTORIAN_DEMO_SHORT_TITLE = 'Music Research Demo';

/** ~45s full Historian intro (manual HeyGen paste — not auto-rendered by default). */
export const HISTORIAN_INTRO_SCRIPT = [
  'Welcome to Music Research at DevConnect Labs.',
  'I am your Historian — here to help you read an artist through era, place, and evidence.',
  'Search a name: Knowledge Graph facts, a chronological timeline, birth and formation points on the map, and chat grounded in documented sources.',
  'For any calendar date, open Music Time Machine.',
  'For Grateful Dead tour stops, open the Live Music Pilgrimage Atlas.',
  'Let us start with an artist you love.'
].join(' ');

export const HISTORIAN_INTRO_TITLE = 'Music Historian — Welcome';

/** HyperFrames body beats — use Google TTS in video/music-research/, not HeyGen. */
export const HYPERFRAMES_SCENES = [
  {
    id: 's0',
    kicker: 'Music Research',
    title: 'One search, many lenses',
    body: 'Search once — timeline, map, and sources assemble around the artist.',
    onScreen: 'music-research.html — search box → Knowledge Graph card'
  },
  {
    id: 's1',
    kicker: 'Knowledge Graph',
    title: 'Fast factual anchor',
    body: "Google's entity card gives a quick anchor before we go deeper.",
    onScreen: 'Mode badge · KG entity card'
  },
  {
    id: 's2',
    kicker: 'Timeline',
    title: 'Chronological context',
    body: 'Births, band formation, releases — era at a glance.',
    onScreen: 'Timeline panel — birth / formation / album markers'
  },
  {
    id: 's3',
    kicker: 'Map',
    title: 'Place matters',
    body: 'Teal pins mark personal origins; amber marks where the band formed.',
    onScreen: 'Map infowindow — birth vs formation badges'
  },
  {
    id: 's4',
    kicker: 'Historian',
    title: 'Ask with guardrails',
    body: 'Chat separates documented fact from interpretation — no invented setlists.',
    onScreen: 'Chat mode · sample Historian answer'
  },
  {
    id: 's5',
    kicker: 'Next stops',
    title: 'Time Machine · Atlas',
    body: 'Time Machine for on-this-date history; Pilgrimage Atlas for the Dead tour.',
    onScreen: 'Deep links to music-time-machine.html · music-pilgrimage-atlas.html'
  }
];

export function getHistorianDemoShort() {
  return {
    title: HISTORIAN_DEMO_SHORT_TITLE,
    script: HISTORIAN_DEMO_SHORT_SCRIPT,
    aspectRatio: '16:9'
  };
}

export function getHistorianIntro() {
  return {
    title: HISTORIAN_INTRO_TITLE,
    script: HISTORIAN_INTRO_SCRIPT,
    aspectRatio: '16:9'
  };
}

export function getHyperFramesScenes() {
  return HYPERFRAMES_SCENES.map((scene) => ({ ...scene }));
}
