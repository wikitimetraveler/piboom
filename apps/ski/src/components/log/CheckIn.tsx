import { useState } from 'react';
import { checkIn, snapRuns } from '../../lib/logApi';
import type { SnapCandidate, TripPass } from '../../lib/logTypes';
import { runTitle } from '../../lib/trails';
import { getOneFix, type Fix } from '../../lib/tracker';
import RunSymbol from '../RunSymbol';

interface Props {
  pass: TripPass;
  recentFix: Fix | null;
  onLogged: () => void;
}

export default function CheckIn({ pass, recentFix, onLogged }: Props) {
  const [busy, setBusy] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);
  const [cands, setCands] = useState<SnapCandidate[] | null>(null);
  const [msg, setMsg] = useState('');

  async function start() {
    setBusy(true);
    setMsg('');
    setCands(null);
    try {
      const f = recentFix && Date.now() - recentFix.ts < 20_000 ? recentFix : await getOneFix();
      setFix(f);
      const snap = await snapRuns(pass, f.lat, f.lng);
      if (!snap.candidates.length) setMsg(snap.note || 'No mapped run within 200 m of you.');
      else setCands(snap.candidates);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function pick(c: SnapCandidate) {
    if (!fix) return;
    setBusy(true);
    try {
      const res = await checkIn(pass, { lat: fix.lat, lng: fix.lng, ts: Date.now(), runId: c.id });
      setCands(null);
      setMsg(`Logged ${runTitle(res.run)}.`);
      onLogged();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="log-checkin">
      <button type="button" className="log-big log-big--checkin" onClick={start} disabled={busy}>
        <strong>{busy && !cands ? 'Finding you…' : 'Check in'}</strong>
        <span>Tap at the top of a run</span>
      </button>
      {cands ? (
        <div className="log-cands" role="group" aria-label="Which run?">
          <p>Which run are you dropping into?</p>
          {cands.map((c) => (
            <button type="button" key={c.id} onClick={() => pick(c)} disabled={busy}>
              <RunSymbol tier={c.tier} />
              <span>{runTitle(c)}</span>
              <small>{c.distanceM} m</small>
            </button>
          ))}
          <button type="button" className="log-cands__none" onClick={() => setCands(null)}>
            None of these
          </button>
        </div>
      ) : null}
      {msg ? <p className="log-note">{msg}</p> : null}
    </div>
  );
}
