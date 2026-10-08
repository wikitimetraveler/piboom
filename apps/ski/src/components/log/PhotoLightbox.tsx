import { useEffect, useState } from 'react';
import { deletePhoto, photoUrl } from '../../lib/logApi';
import type { LogPhoto, TripDay, TripPass } from '../../lib/logTypes';
import { fmtClock } from '../../lib/logFormat';

interface Props {
  pass: TripPass;
  day: TripDay | null;
  photo: LogPhoto;
  onClose: () => void;
  onChanged: () => void;
}

export default function PhotoLightbox({ pass, day, photo, onClose, onChanged }: Props) {
  const [error, setError] = useState('');
  const who = day?.members.find((m) => m.id === photo.memberId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function remove() {
    try {
      await deletePhoto(pass, photo.id);
      onClose();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="log-lightbox" role="dialog" aria-modal="true" aria-label="Photo" onClick={onClose}>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={photoUrl(pass.code, photo.id)} alt={photo.caption || 'Crew photo'} />
        <figcaption>
          {photo.caption ? <strong>{photo.caption}</strong> : null}
          <span>
            {who?.name || 'Crew'} · {fmtClock(photo.ts)}
            {photo.runName ? ` · ${photo.runName}` : ''}
          </span>
        </figcaption>
        <div className="log-photo-form__row">
          {photo.memberId === pass.memberId ? (
            <button type="button" className="log-ghost" onClick={remove}>
              Delete
            </button>
          ) : null}
          <button type="button" className="log-primary" onClick={onClose}>
            Close
          </button>
        </div>
        {error ? <p className="log-error">{error}</p> : null}
      </figure>
    </div>
  );
}
