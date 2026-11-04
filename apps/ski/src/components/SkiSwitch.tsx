import type { SkiPage } from '../lib/page';
import { goPage } from '../lib/page';

export default function SkiSwitch({ page, selectedId }: { page: SkiPage; selectedId?: string }) {
  return (
    <nav className="ski-switch" aria-label="Ski desk">
      <button type="button" className={page === 'drive' ? 'is-on' : ''} onClick={() => goPage('drive', selectedId)}>
        Drive desk
      </button>
      <button type="button" className={page === 'areas' ? 'is-on' : ''} onClick={() => goPage('areas', selectedId)}>
        Ski areas
      </button>
      <button type="button" className={page === 'cams' ? 'is-on' : ''} onClick={() => goPage('cams', selectedId)}>
        Cams
      </button>
      <button type="button" className={page === 'log' ? 'is-on' : ''} onClick={() => goPage('log', selectedId)}>
        Crew log
      </button>
    </nav>
  );
}
