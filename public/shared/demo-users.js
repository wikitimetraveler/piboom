/**
 * Corp-friendly demo user profiles (login, collections, finance demos).
 * Load before user-selector.js or user-login.js.
 */
(function () {
  const LEGACY_DEMO_USER_ID_MAP = {
    'cosmic-turtle': 'demo-analyst-1',
    'wizened-wizard': 'demo-analyst-2',
    'jerry-garcia': 'demo-analyst-3',
    'easy-levi': 'demo-analyst-4',
    'fuzz-maestro': 'demo-analyst-5',
  };

  const DEMO_USERS = [
    {
      id: 'demo-analyst-1',
      name: 'Harrison Ford',
      avatar: '/images/demo-avatars/analyst-1.svg',
      color: '#0d6efd',
      description: 'Watch together profile',
    },
    {
      id: 'demo-analyst-2',
      name: 'Sigourney Weaver',
      avatar: '/images/demo-avatars/analyst-2.svg',
      color: '#5a6a85',
      description: 'Watch together profile',
    },
    {
      id: 'demo-analyst-3',
      name: 'Denzel Washington',
      avatar: '/images/demo-avatars/analyst-3.svg',
      color: '#198754',
      description: 'Watch together profile',
    },
    {
      id: 'demo-analyst-4',
      name: 'Meryl Streep',
      avatar: '/images/demo-avatars/analyst-4.svg',
      color: '#6f42c1',
      description: 'Watch together profile',
    },
    {
      id: 'demo-analyst-5',
      name: 'Keanu Reeves',
      avatar: '/images/demo-avatars/analyst-5.svg',
      color: '#fd7e14',
      description: 'Watch together profile',
    },
  ];

  function migrateLegacyDemoUserIds() {
    try {
      ['loggedInUserId', 'currentUserId'].forEach((key) => {
        const stored = localStorage.getItem(key);
        if (stored && LEGACY_DEMO_USER_ID_MAP[stored]) {
          localStorage.setItem(key, LEGACY_DEMO_USER_ID_MAP[stored]);
        }
      });
    } catch (_) {}
  }

  migrateLegacyDemoUserIds();

  window.DEMO_USERS = DEMO_USERS;
  window.USERS = DEMO_USERS;
  window.DEMO_USERS_LEGACY_ID_MAP = LEGACY_DEMO_USER_ID_MAP;
  window.migrateLegacyDemoUserIds = migrateLegacyDemoUserIds;
})();
