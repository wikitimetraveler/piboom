import { useEffect, useRef, useState } from 'react';
import { uploadPhoto } from '../../lib/logApi';
import type { MemberDay, TripPass } from '../../lib/logTypes';
import { readPhotoMeta, shrinkPhoto, type PhotoMeta } from '../../lib/photoPrep';
import { runTitle } from '../../lib/trails';
import type { Fix } from '../../lib/tracker';

interface Props {
  pass: TripPass;
  recentFix: Fix | null;
  mine: MemberDay | null;
  onPosted: () => void;
}

interface Draft {
  blob: Blob;
  url: string;
  meta: PhotoMeta;
  takenAt: number;
}

const PLACE_COPY: Record<string, string> = {
  exif: 'pinned from the photo’s own location',
  track: 'pinned from your track at that moment',
  device: 'pinned where you are now',
  run: 'pinned on the run you picked',
};

export default function PhotoButton({ pass, recentFix, mine, onPosted }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [caption, setCaption] = useState('');
  const [runId, setRunId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(
    () => () => {
      if (draft) URL.revokeObjectURL(draft.url);
    },
    [draft]
  );

  const todaysRuns = Array.from(
    new Map(
      (mine?.segments || []).filter((s) => s.kind === 'run' && s.run).map((s) => [s.run!.id, s.run!])
    ).values()
  );

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setMsg('');
    try {
      const [meta, blob] = await Promise.all([readPhotoMeta(file), shrinkPhoto(file)]);
      const takenAt = meta.takenAt || file.lastModified || Date.now();
      setDraft({ blob, url: URL.createObjectURL(blob), meta, takenAt });
      setCaption('');
      setRunId('');
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function post() {
    if (!draft) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('photo', draft.blob, 'photo.jpg');
      form.append('ts', String(draft.takenAt));
      if (draft.meta.lat != null && draft.meta.lng != null) {
        form.append('exifLat', String(draft.meta.lat));
        form.append('exifLng', String(draft.meta.lng));
      }
      if (recentFix && Date.now() - recentFix.ts < 120_000) {
        form.append('deviceLat', String(recentFix.lat));
        form.append('deviceLng', String(recentFix.lng));
        form.append('deviceTs', String(recentFix.ts));
      }
      if (runId) form.append('runId', runId);
      if (caption.trim()) form.append('caption', caption.trim());
      const res = await uploadPhoto(pass, form);
      setDraft(null);
      setMsg(
        res.placeSource
          ? `Posted — ${PLACE_COPY[res.placeSource] || 'pinned'}${res.runName ? ` on ${res.runName}` : ''}.`
          : 'Posted. It is not pinned on the map, but it shows in Today and the recap.'
      );
      onPosted();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const needsRun = draft && draft.meta.lat == null && !(recentFix && Date.now() - recentFix.ts < 120_000);

  return (
    <div className="log-photo">
      <input ref={input} type="file" accept="image/*" hidden onChange={onPick} />
      {!draft ? (
        <button type="button" className="log-big log-big--photo" onClick={() => input.current?.click()} disabled={busy}>
          <strong>{busy ? 'Getting the photo ready…' : 'Add a photo'}</strong>
          <span>Camera or library — it gets pinned to the run</span>
        </button>
      ) : (
        <div className="log-photo-form">
          <img src={draft.url} alt="Photo to post" />
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={140} placeholder="Caption (optional)" />
          {needsRun && todaysRuns.length ? (
            <select value={runId} onChange={(e) => setRunId(e.target.value)} aria-label="Which run was this on?">
              <option value="">Which run was this on? (optional)</option>
              {todaysRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {runTitle(r)}
                </option>
              ))}
            </select>
          ) : null}
          <div className="log-photo-form__row">
            <button type="button" className="log-ghost" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="log-primary" onClick={post} disabled={busy}>
              {busy ? 'Posting…' : 'Post photo'}
            </button>
          </div>
        </div>
      )}
      {msg ? <p className="log-note">{msg}</p> : null}
    </div>
  );
}
