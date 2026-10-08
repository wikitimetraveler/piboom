import { useRef, useState } from 'react';
import { importTrack } from '../../lib/logApi';
import type { TripPass } from '../../lib/logTypes';
import { fmtDay } from '../../lib/logFormat';

interface Props {
  pass: TripPass;
  onImported: (lastDay: string) => void;
}

export default function ImportTrack({ pass, onImported }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setMsg('');
    setError('');
    try {
      const res = await importTrack(pass, file);
      const days = res.days.map(fmtDay).join(', ');
      setMsg(
        `Imported ${res.inserted.toLocaleString()} points for ${days}` +
          (res.skippedAsDuplicate ? ` (skipped ${res.skippedAsDuplicate.toLocaleString()} already tracked live)` : '') +
          '.'
      );
      if (res.days.length) onImported(res.days[res.days.length - 1]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="log-import">
      <summary>Import a track from Slopes, Strava, or Apple Watch</summary>
      <ul>
        <li>
          <strong>Slopes:</strong> open the day → share → Export GPX, save to Files.
        </li>
        <li>
          <strong>Strava:</strong> on strava.com open the activity → ⋯ → Export GPX.
        </li>
        <li>
          <strong>Apple Watch:</strong> Health → your photo → Export All Health Data; unzip in Files and pick the day from{' '}
          <code>workout-routes</code>. Apps like HealthFit can export one workout as GPX directly.
        </li>
        <li>
          <strong>Garmin:</strong> export the activity as GPX or TCX.
        </li>
      </ul>
      <input
        ref={input}
        type="file"
        accept=".gpx,.tcx,application/gpx+xml,application/xml,text/xml"
        hidden
        onChange={onPick}
      />
      <button type="button" className="log-ghost" onClick={() => input.current?.click()} disabled={busy}>
        {busy ? 'Importing…' : 'Choose a GPX or TCX file'}
      </button>
      {msg ? <p className="log-note">{msg}</p> : null}
      {error ? <p className="log-error">{error}</p> : null}
    </details>
  );
}
