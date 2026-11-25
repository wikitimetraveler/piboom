import BensWeather from '../components/BensWeather';
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
          Weather desk for the Fountain Valley run to Mt. Baldy, Wrightwood, Big Bear, Mammoth, and Palisades
          Tahoe. Ben&apos;s Weather is the local forecast for Bear Mountain, Snow Summit, and Snow Valley. The
          Tahoe drive is I-5 to I-80 over Donner Pass, then CA-89 into Olympic Valley. Chains and on-the-way
          stops live here. Mountain topography is on Ski Areas.
        </p>
        <p className="ski-disclaimer">{brief.disclaimer}</p>
      </header>
      <BensWeather />
      <WeatherBoard destinations={brief.destinations} selectedId={selectedId} onSelect={onSelect} />
      {dest ? (
        <>
          <DrivePanel dest={dest} homeName={brief.home.name} />
          <OnTheWay stops={stops} />
        </>
      ) : (
        <p className="ski-empty">
          Select a ski area above to load its drive route, chain-control highways, and stops along the way.
        </p>
      )}
    </>
  );
}
