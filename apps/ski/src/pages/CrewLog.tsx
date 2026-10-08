import { useCallback, useEffect, useRef, useState } from 'react';
import ImportTrack from '../components/log/ImportTrack';
import MapPanel from '../components/log/MapPanel';
import PhotoButton from '../components/log/PhotoButton';
import PhotoStrip from '../components/log/PhotoStrip';
import SkiPanel from '../components/log/SkiPanel';
import TodayPanel from '../components/log/TodayPanel';
import TripGate from '../components/log/TripGate';
import { currentPass, getDay, shareUrl, switchPass } from '../lib/logApi';
import type { TripDay, TripPass } from '../lib/logTypes';
import { todayLocal } from '../lib/logFormat';
import { Tracker, type TrackerState } from '../lib/tracker';
import type { DestinationBrief } from '../lib/types';
import '../log.css';

type Tab = 'ski' | 'today' | 'map' | 'recap';

const TABS: { id: Tab; label: string }[] = [
  { id: 'ski', label: 'Ski' },
  { id: 'today', label: 'Today' },
  { id: 'map', label: 'Map' },
  { id: 'recap', label: 'Recap' },
];

const IDLE: TrackerState = { tracking: false, lastFix: null, queued: 0, uploaded: 0, awake: false, error: '' };

interface Props {
  destinations: DestinationBrief[];
}

export default function CrewLog({ destinations: briefed }: Props) {
  const [pass, setPass] = useState<TripPass | null>(() => currentPass());
  const [catalog, setCatalog] = useState<DestinationBrief[]>([]);
  useEffect(() => {
    if (briefed.length) return;
    let live = true;
    fetch('/data/ski/destinations.json')
      .then((r) => r.json())
      .then((raw) => live && setCatalog(Array.isArray(raw.destinations) ? raw.destinations : []))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [briefed.length]);
  const destinations = briefed.length ? briefed : catalog;
  if (!pass) return <TripGate destinations={destinations} onReady={setPass} />;
  return (
    <TripView
      key={pass.code}
      pass={pass}
      destinations={destinations}
      onLeave={() => {
        switchPass(null);
        setPass(null);
      }}
    />
  );
}

function TripView({ pass, destinations, onLeave }: { pass: TripPass; destinations: DestinationBrief[]; onLeave: () => void }) {
  const [tab, setTab] = useState<Tab>('ski');
  const [date, setDate] = useState(todayLocal);
  const [day, setDay] = useState<TripDay | null>(null);
  const [focus, setFocus] = useState<number | 'crew'>(pass.memberId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tracker, setTracker] = useState<TrackerState>(IDLE);
  const [shared, setShared] = useState('');
  const trackerRef = useRef<Tracker | null>(null);
  const resort = destinations.find((d) => d.id === pass.resortId);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await trackerRef.current?.flush();
      setDay(await getDay(pass, date));
      setError('');
    } catch (e) {
      const err = e as Error & { status?: number };
      setError(err.status === 401 ? 'This phone is no longer on the trip — join again.' : err.message);
    } finally {
      setLoading(false);
    }
  }, [pass, date]);

  useEffect(() => {
    const t = new Tracker(pass, setTracker);
    trackerRef.current = t;
    setTracker(t.snapshot);
    if (Tracker.wasTracking(pass.code)) t.start();
    else void t.flush();
    return () => {
      t.dispose();
      trackerRef.current = null;
    };
  }, [pass]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (date !== todayLocal()) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [date, refresh]);

  const toggleTrack = () => {
    const t = trackerRef.current;
    if (!t) return;
    if (t.snapshot.tracking) {
      t.stop();
      window.setTimeout(() => void refresh(), 1500);
    } else t.start();
  };

  async function share() {
    const url = shareUrl(pass.code);
    const text = `Join "${pass.tripName}" on Crew log — code ${pass.code}`;
    try {
      if (navigator.share) await navigator.share({ title: pass.tripName, text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShared('Invite link copied.');
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  const mine = day?.members.find((m) => m.id === pass.memberId) || null;

  return (
    <section className="log">
      <header className="log-head">
        <div>
          <h1>{pass.tripName}</h1>
          <p>
            {resort?.name || pass.resortId} · riding as <span style={{ color: pass.color }}>{pass.memberName}</span>
          </p>
        </div>
        <div className="log-head__actions">
          <button type="button" className="log-code" onClick={share} title="Share the trip">
            {pass.code}
            <small>Invite</small>
          </button>
          <button type="button" className="log-ghost" onClick={onLeave}>
            Trips
          </button>
        </div>
      </header>
      {shared ? <p className="log-note">{shared}</p> : null}

      <nav className="log-tabs" role="tablist" aria-label="Crew log">
        {TABS.map((t) => (
          <button
            type="button"
            role="tab"
            key={t.id}
            aria-selected={tab === t.id}
            className={tab === t.id ? 'is-on' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'ski' ? (
        <SkiPanel pass={pass} tracker={tracker} mine={mine} onToggleTrack={toggleTrack} onLogged={refresh}>
          <PhotoButton pass={pass} recentFix={tracker.lastFix} mine={mine} onPosted={refresh} />
        </SkiPanel>
      ) : null}

      {tab === 'today' ? (
        <TodayPanel
          day={day}
          date={date}
          onDate={setDate}
          focus={focus}
          onFocus={setFocus}
          loading={loading}
          error={error}
          onRefresh={refresh}
        >
          <PhotoStrip pass={pass} day={day} focus={focus} onChanged={refresh} />
          <ImportTrack
            pass={pass}
            onImported={(d) => {
              if (d === date) void refresh();
              else setDate(d);
            }}
          />
        </TodayPanel>
      ) : null}

      {tab === 'map' ? (
        <MapPanel
          pass={pass}
          day={day}
          date={date}
          focus={focus}
          onFocus={setFocus}
          destinations={destinations}
          onChanged={refresh}
        />
      ) : null}
      {tab === 'recap' ? <p className="log-note">Recaps are coming next.</p> : null}
    </section>
  );
}
