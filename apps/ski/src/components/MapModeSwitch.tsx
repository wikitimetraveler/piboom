import { useState } from 'react';

export type MapMode = 'topo' | 'maps' | 'earth';

const KEY = 'ski.mapMode';
const MODES: { id: MapMode; label: string; icon: string }[] = [
  { id: 'topo', label: 'Topo 3D', icon: 'bi-triangle' },
  { id: 'maps', label: 'Google Maps', icon: 'bi-map' },
  { id: 'earth', label: 'Google Earth', icon: 'bi-globe-americas' },
];

export function useMapMode(): [MapMode, (m: MapMode) => void] {
  const [mode, setMode] = useState<MapMode>(() => {
    const saved = localStorage.getItem(KEY);
    return saved === 'maps' || saved === 'earth' ? saved : 'topo';
  });
  return [
    mode,
    (m) => {
      localStorage.setItem(KEY, m);
      setMode(m);
    },
  ];
}

export default function MapModeSwitch({ mode, onMode }: { mode: MapMode; onMode: (m: MapMode) => void }) {
  return (
    <div className="ski-mode-switch" role="tablist" aria-label="Map view">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          role="tab"
          aria-selected={mode === m.id}
          className={mode === m.id ? 'is-on' : ''}
          onClick={() => onMode(m.id)}
        >
          <i className={`bi ${m.icon}`} aria-hidden="true" /> {m.label}
        </button>
      ))}
    </div>
  );
}
