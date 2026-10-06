import type { DestinationBrief } from '../lib/types';
import { mapsDirUrl } from '../lib/goNoGo';

interface Props {
  dest: DestinationBrief | undefined;
  homeName: string;
}

export default function DrivePanel({ dest, homeName }: Props) {
  if (!dest) return null;
  return (
    <section className="ski-drive" aria-label="Drive from Fountain Valley">
      <strong>
        {homeName} → {dest.name}
      </strong>
      <span>~{dest.driveMin} min · {(dest.highways || []).join(' · ')}</span>
      <span>Weekend traffic is usually longer than the catalog time.</span>
      <span>Chain notes: {(dest.chainHighways || []).join(', ') || '—'}</span>
      <a href={mapsDirUrl(dest.mapsDest)} target="_blank" rel="noreferrer">
        Maps directions
      </a>
    </section>
  );
}
