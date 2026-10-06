import type { SkiPage } from '../lib/page';
import { goPage } from '../lib/page';

export default function SkiSwitch({ page }: { page: SkiPage }) {
  return (
    <nav className="ski-switch" aria-label="Ski desk">
      <button type="button" className={page === 'drive' ? 'is-on' : ''} onClick={() => goPage('drive')}>
        Drive desk
      </button>
      <button type="button" className={page === 'areas' ? 'is-on' : ''} onClick={() => goPage('areas')}>
        Ski areas
      </button>
    </nav>
  );
}
