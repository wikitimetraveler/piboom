import { useEffect, useRef, useState } from 'react';

interface Face {
  name?: string;
  avatarId?: string;
  voiceId?: string;
  greeting?: string;
}

interface Session {
  sessionId?: string;
  url?: string;
  playback?: string;
  fallback?: boolean;
  audioUrl?: string;
  accessToken?: string;
}

declare global {
  interface Window {
    skiApexSpeak?: (text: string) => void;
    HeygenLiveTile?: {
      isHls: (session: Session) => boolean;
      isPoster: (session: Session) => boolean;
      attachHls: (host: HTMLElement, url: string, className: string) => void;
      attachPoster: (host: HTMLElement, url: string, className: string, alt: string) => void;
      destroyHls: (el: HTMLVideoElement | null) => void;
      playAudio?: (url: string) => void;
    };
  }
}

export default function ApexLive() {
  const host = useRef<HTMLDivElement>(null);
  const face = useRef<Face | null>(null);
  const sessionId = useRef('');
  const [status, setStatus] = useState('');
  const [live, setLive] = useState(false);

  useEffect(() => {
    let on = true;
    fetch('/data/ski/apex-heygen-face.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Face | null) => {
        if (on) face.current = data;
      })
      .catch(() => {
        if (on) face.current = null;
      });
    window.skiApexSpeak = (text) => {
      const id = sessionId.current;
      const current = face.current;
      const clean = String(text || '').trim().slice(0, 900);
      if (!id || !clean || !current?.voiceId) return;
      fetch('/api/heygen/streaming/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: id,
          text: clean,
          avatarId: current.avatarId,
          voiceId: current.voiceId,
        }),
      }).catch(() => undefined);
    };
    return () => {
      on = false;
      window.skiApexSpeak = undefined;
      const id = sessionId.current;
      sessionId.current = '';
      if (!id) return;
      fetch('/api/heygen/streaming/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id }),
      }).catch(() => undefined);
    };
  }, []);

  async function stop() {
    const id = sessionId.current;
    sessionId.current = '';
    setLive(false);
    if (host.current) {
      window.HeygenLiveTile?.destroyHls(host.current.querySelector('video'));
      host.current.replaceChildren();
      host.current.hidden = true;
    }
    if (!id) return;
    await fetch('/api/heygen/streaming/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id }),
    }).catch(() => undefined);
  }

  async function start() {
    const current = face.current;
    if (!current?.avatarId || !current.voiceId) {
      setStatus('Apex’s face is not on file yet. Ask Apex in the chat still works.');
      return;
    }
    setStatus('Bringing Apex on…');
    const res = await fetch('/api/heygen/streaming/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatarId: current.avatarId,
        voiceId: current.voiceId,
        text: current.greeting || 'Apex here.',
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Session & { error?: string; success?: boolean };
    if (!res.ok || !data.url) {
      setStatus(data.error || 'HeyGen streaming needs a server key. The chat still works.');
      return;
    }
    const media = host.current;
    const tile = window.HeygenLiveTile;
    if (!media || !tile) {
      setStatus('Live tile is missing. The chat still works.');
      return;
    }
    sessionId.current = data.sessionId || '';
    media.hidden = false;
    if (tile.isPoster(data)) {
      tile.attachPoster(media, data.url, 'ski-apex__video', 'Apex');
      if (data.audioUrl) tile.playAudio?.(data.audioUrl);
      setStatus('Apex on voice. Live video is not on this HeyGen plan.');
    } else if (tile.isHls(data)) {
      tile.attachHls(media, data.url, 'ski-apex__video');
      setStatus('Apex live.');
    } else {
      setStatus('Apex answered, but this browser could not play the stream.');
    }
    setLive(true);
  }

  return (
    <section className="ski-apex" aria-label="Apex, ski racer">
      <div className="ski-apex__top">
        <div>
          <h2>Apex</h2>
          <p>Ski racer, super cruiser. Ask him which run is a carved line.</p>
        </div>
        <button type="button" onClick={() => (live ? stop() : start())}>
          {live ? 'Hide Apex' : 'Live Apex'}
        </button>
      </div>
      <div ref={host} className="ski-apex__media" hidden />
      {status ? <p className="ski-disclaimer">{status}</p> : null}
    </section>
  );
}
