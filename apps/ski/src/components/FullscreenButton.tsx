import { useEffect, useState, type RefObject } from 'react';

interface DocWithWebkit extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface ElWithWebkit extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

function getFullscreenEl(): Element | null {
  const doc = document as DocWithWebkit;
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

function resolveStage(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  return (el.closest('.ski-stage-slot, .log-map__stage, .log-recap__stage') as HTMLElement | null) || el;
}

export default function FullscreenButton({ targetRef }: { targetRef: RefObject<HTMLElement | null> }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => {
      const stage = resolveStage(targetRef.current);
      const fsEl = getFullscreenEl();
      const isNative = Boolean(stage && fsEl && (fsEl === stage || stage.contains(fsEl)));
      const isFallback = Boolean(stage?.classList.contains('is-fullscreen'));
      setActive(isNative || isFallback);
      window.dispatchEvent(new Event('resize'));
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      const stage = resolveStage(targetRef.current);
      if (stage?.classList.contains('is-fullscreen')) {
        stage.classList.remove('is-fullscreen');
        document.body.classList.remove('ski-body-fullscreen');
        sync();
      }
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    window.addEventListener('keydown', onKey);
    sync();
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      window.removeEventListener('keydown', onKey);
    };
  }, [targetRef]);

  const toggle = async () => {
    const stage = resolveStage(targetRef.current) as ElWithWebkit | null;
    if (!stage) return;
    const doc = document as DocWithWebkit;
    const fsEl = getFullscreenEl();

    if (fsEl) {
      try {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      } catch {
        /* ignore */
      }
      return;
    }

    if (stage.classList.contains('is-fullscreen')) {
      stage.classList.remove('is-fullscreen');
      document.body.classList.remove('ski-body-fullscreen');
      setActive(false);
      window.dispatchEvent(new Event('resize'));
      return;
    }

    try {
      if (stage.requestFullscreen) {
        await stage.requestFullscreen();
        return;
      }
      if (stage.webkitRequestFullscreen) {
        await stage.webkitRequestFullscreen();
        return;
      }
    } catch {
      /* fall through to CSS fullscreen fallback */
    }

    stage.classList.add('is-fullscreen');
    document.body.classList.add('ski-body-fullscreen');
    setActive(true);
    window.dispatchEvent(new Event('resize'));
  };

  return (
    <button
      type="button"
      className={`ski-fullscreen-btn${active ? ' is-on' : ''}`}
      onClick={toggle}
      aria-pressed={active}
      aria-label={active ? 'Exit full screen' : 'Full screen map'}
      title={active ? 'Exit full screen (Esc)' : 'Full screen map'}
    >
      <i className={`bi ${active ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'}`} aria-hidden="true" />
      <span>{active ? 'Exit' : 'Full screen'}</span>
    </button>
  );
}
