import { useState } from 'react';
import { photoUrl } from '../../lib/logApi';
import type { LogPhoto, TripDay, TripPass } from '../../lib/logTypes';
import PhotoLightbox from './PhotoLightbox';

interface Props {
  pass: TripPass;
  day: TripDay | null;
  focus: number | 'crew';
  onChanged: () => void;
}

export default function PhotoStrip({ pass, day, focus, onChanged }: Props) {
  const [open, setOpen] = useState<LogPhoto | null>(null);
  const photos = (day?.photos || []).filter((p) => focus === 'crew' || p.memberId === focus);
  const who = (id: number) => day?.members.find((m) => m.id === id);

  if (!photos.length) return null;

  return (
    <>
      <h3 className="log-h">Photos</h3>
      <div className="log-photos">
        {photos.map((p) => (
          <button type="button" key={p.id} onClick={() => setOpen(p)} style={{ borderColor: who(p.memberId)?.color }}>
            <img src={photoUrl(pass.code, p.id, true)} alt={p.caption || `Photo by ${who(p.memberId)?.name || 'the crew'}`} loading="lazy" />
          </button>
        ))}
      </div>
      {open ? (
        <PhotoLightbox pass={pass} day={day} photo={open} onClose={() => setOpen(null)} onChanged={onChanged} />
      ) : null}
    </>
  );
}
