/**
 * Server-side demo user seed + legacy ID migration (matches public/shared/demo-users.js).
 */
export const LEGACY_DEMO_USER_ID_MAP = {
  'cosmic-turtle': 'demo-analyst-1',
  'wizened-wizard': 'demo-analyst-2',
  'jerry-garcia': 'demo-analyst-3',
  'easy-levi': 'demo-analyst-4',
  'fuzz-maestro': 'demo-analyst-5',
};

/** @type {{ id: string, name: string, password: string, avatar: string, color: string, description: string }[]} */
export const DEMO_USERS_SEED = [
  {
    id: 'demo-analyst-1',
    name: 'Harrison Ford',
    password: 'Dufus',
    avatar: '/images/demo-avatars/analyst-1.svg',
    color: '#0d6efd',
    description: 'Watch together profile',
  },
  {
    id: 'demo-analyst-2',
    name: 'Sigourney Weaver',
    password: 'P@te1374',
    avatar: '/images/demo-avatars/analyst-2.svg',
    color: '#5a6a85',
    description: 'Watch together profile',
  },
  {
    id: 'demo-analyst-3',
    name: 'Denzel Washington',
    password: 'Fooze',
    avatar: '/images/demo-avatars/analyst-3.svg',
    color: '#198754',
    description: 'Watch together profile',
  },
  {
    id: 'demo-analyst-4',
    name: 'Meryl Streep',
    password: 'Zip Knot',
    avatar: '/images/demo-avatars/analyst-4.svg',
    color: '#6f42c1',
    description: 'Watch together profile',
  },
  {
    id: 'demo-analyst-5',
    name: 'Keanu Reeves',
    password: 'Fly Dog',
    avatar: '/images/demo-avatars/analyst-5.svg',
    color: '#fd7e14',
    description: 'Watch together profile',
  },
];

/** Tables with a user_id column to rewrite during legacy ID migration. */
export const DEMO_USER_ID_MIGRATION_TABLES = [
  'records',
  'catches',
  'rock_specimens',
  'bikes',
  'customers',
  'trees',
  'critters',
  'finds',
  'messages',
  'conversations',
  'user_concert_collections',
];
