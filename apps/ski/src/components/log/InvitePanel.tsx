import { useEffect, useState } from 'react';
import { getTrip, keepTrip, shareUrl, signedIn } from '../../lib/logApi';
import type { TripPass } from '../../lib/logTypes';
import QrCode from './QrCode';

interface Props {
  pass: TripPass;
  resortName: string;
  onClose: () => void;
}

export default function InvitePanel({ pass, resortName, onClose }: Props) {
  const url = shareUrl(pass.code);
  const [keep, setKeep] = useState<boolean | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getTrip(pass)
      .then((r) => live && setKeep(Boolean(r.trip.keep)))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [pass]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function share() {
    const text = `Join "${pass.tripName}" on Crew log — code ${pass.code}`;
    try {
      if (navigator.share) await navigator.share({ title: pass.tripName, text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setNote('Invite link copied.');
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  async function keepIt() {
    setBusy(true);
    try {
      setKeep(Boolean((await keepTrip(pass)).trip.keep));
      setNote('');
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="log-invite" aria-label="Invite riders">
      <div className="log-invite__top">
        <h2 className="log-h">Invite your crew</h2>
        <button type="button" className="log-ghost" onClick={onClose}>
          Done
        </button>
      </div>
      <QrCode text={url} label={`QR code to join ${pass.tripName}`} />
      <p className="log-invite__code">{pass.code}</p>
      <p className="log-invite__how">
        Scan with a phone camera to join <strong>{pass.tripName}</strong> at {resortName}, or type the code on the Crew
        log page. Up to 24 riders.
      </p>
      <button type="button" className="log-primary" onClick={share}>
        {typeof navigator.share === 'function' ? 'Share invite link' : 'Copy invite link'}
      </button>
      {note ? <p className="log-note">{note}</p> : null}
      {keep === null ? null : keep ? (
        <p className="log-fine">Kept — this trip never expires.</p>
      ) : (
        <p className="log-fine">
          This trip is deleted after 30 days with no riding, check-ins, or photos.{' '}
          {signedIn() ? (
            <button type="button" className="log-link" onClick={keepIt} disabled={busy}>
              Keep it
            </button>
          ) : null}
        </p>
      )}
    </section>
  );
}
