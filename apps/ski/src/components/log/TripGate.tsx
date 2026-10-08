import { useEffect, useState } from 'react';
import { createTrip, joinTrip, listPasses, previewTrip, switchPass } from '../../lib/logApi';
import type { TripPass } from '../../lib/logTypes';
import type { DestinationBrief } from '../../lib/types';

interface Props {
  destinations: DestinationBrief[];
  onReady: (pass: TripPass) => void;
}

const NAME_KEY = 'skiLog.lastName';

function todayLocal() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}

export default function TripGate({ destinations, onReady }: Props) {
  const invite = new URLSearchParams(window.location.search).get('trip') || '';
  const [mode, setMode] = useState<'join' | 'start'>(invite ? 'join' : 'start');
  const [displayName, setDisplayName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [code, setCode] = useState(invite.toUpperCase());
  const [tripName, setTripName] = useState('');
  const [resortId, setResortId] = useState('');
  const [date, setDate] = useState(todayLocal);
  const [preview, setPreview] = useState<{ name: string; resortId: string; riders: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saved = listPasses();

  useEffect(() => {
    if (!resortId && destinations.length) setResortId(destinations[0].id);
  }, [destinations, resortId]);

  useEffect(() => {
    const clean = code.replace(/[^A-Za-z0-9]/g, '');
    if (mode !== 'join' || clean.length !== 6) {
      setPreview(null);
      return;
    }
    let live = true;
    previewTrip(clean)
      .then((p) => live && (setPreview(p), setError('')))
      .catch((e: Error) => live && (setPreview(null), setError(e.message)));
    return () => {
      live = false;
    };
  }, [code, mode]);

  const resortName = (id: string) => destinations.find((d) => d.id === id)?.name || id;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      localStorage.setItem(NAME_KEY, displayName.trim());
      const pass =
        mode === 'start'
          ? await createTrip({
              name: tripName.trim() || `${resortName(resortId)} trip`,
              resortId,
              date,
              displayName: displayName.trim(),
            })
          : await joinTrip(code, displayName.trim());
      if (invite) window.history.replaceState(null, '', '/ski/log');
      onReady(pass);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="log-gate">
      <h1>Crew log</h1>
      <p className="log-lede">
        Log every run on the real trail map, see the crew on the mountain, and get a recap at the end of the day.
      </p>

      {saved.length ? (
        <div className="log-saved">
          <h2>Your trips</h2>
          {saved.map((p) => (
            <button
              type="button"
              key={p.code}
              className="log-saved__trip"
              onClick={() => {
                switchPass(p.code);
                onReady(p);
              }}
            >
              <span>{p.tripName}</span>
              <small>
                {p.code} · riding as {p.memberName}
              </small>
            </button>
          ))}
        </div>
      ) : null}

      <div className="log-seg" role="tablist" aria-label="Start or join">
        <button type="button" role="tab" aria-selected={mode === 'start'} className={mode === 'start' ? 'is-on' : ''} onClick={() => setMode('start')}>
          Start a trip
        </button>
        <button type="button" role="tab" aria-selected={mode === 'join'} className={mode === 'join' ? 'is-on' : ''} onClick={() => setMode('join')}>
          Join with a code
        </button>
      </div>

      <form className="log-form" onSubmit={submit}>
        <label>
          Your name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={24} required autoComplete="nickname" />
        </label>

        {mode === 'start' ? (
          <>
            <label>
              Trip name
              <input value={tripName} onChange={(e) => setTripName(e.target.value)} maxLength={60} placeholder="Mammoth weekend" />
            </label>
            <label>
              Resort
              <select value={resortId} onChange={(e) => setResortId(e.target.value)}>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              First day
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label>
              Trip code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="POW-4K7"
                maxLength={8}
                autoCapitalize="characters"
                autoComplete="off"
                required
              />
            </label>
            {preview ? (
              <p className="log-preview">
                {preview.name} · {resortName(preview.resortId)} · {preview.riders} rider{preview.riders === 1 ? '' : 's'}
              </p>
            ) : null}
          </>
        )}

        {error ? <p className="log-error">{error}</p> : null}
        <button type="submit" className="log-primary" disabled={busy || !displayName.trim() || (mode === 'join' && !preview)}>
          {busy ? 'One sec…' : mode === 'start' ? 'Start trip' : 'Join trip'}
        </button>
      </form>
      <p className="log-fine">
        No account needed. Anyone with the trip code can see the trip, so share it only with your crew.
      </p>
    </section>
  );
}
