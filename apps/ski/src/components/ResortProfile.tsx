import type { DestinationBrief } from '../lib/types';
import { formatFt } from '../lib/goNoGo';

interface Props {
  dest: DestinationBrief | undefined;
}

export default function ResortProfile({ dest }: Props) {
  if (!dest) return null;
  return (
    <div className="ski-profile">
      <h3>{dest.name} elevation</h3>
      <dl>
        <dt>Base</dt>
        <dd>{formatFt(dest.baseFt)}</dd>
        <dt>Summit</dt>
        <dd>{formatFt(dest.summitFt)}</dd>
        <dt>Vertical</dt>
        <dd>{formatFt(dest.verticalFt)}</dd>
      </dl>
    </div>
  );
}
