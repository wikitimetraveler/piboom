import DrivePanel from '../components/DrivePanel';
import OnTheWay from '../components/OnTheWay';
import WeatherBoard from '../components/WeatherBoard';
import type { BriefPayload, DestinationBrief, OnTheWayStop } from '../lib/types';

interface Props {
  brief: BriefPayload;
  dest: DestinationBrief | undefined;
  selectedId: string;
  onSelect: (id: string) => void;
  stops: OnTheWayStop[];
}

export default function DriveDesk({ brief, dest, selectedId, onSelect, stops }: Props) {
  return (
    <>
      <header className="ski-hero">
        <h1>Ski Drive</h1>
        <p>
          Weather desk for the Fountain Valley run to Wrightwood, Big Bear, and Mammoth. Chains and
          on-the-way stops live here. Mountain topography is on Ski Areas.
        </p>
        <p className="ski-disclaimer">{brief.disclaimer}</p>
      </header>
      <WeatherBoard destinations={brief.destinations} selectedId={selectedId} onSelect={onSelect} />
      <DrivePanel dest={dest} homeName={brief.home.name} />
      <OnTheWay stops={stops} />
    </>
  );
}
