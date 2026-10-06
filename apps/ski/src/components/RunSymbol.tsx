import { TIER_META, type Tier } from '../lib/trails';

interface Props {
  tier: Tier;
  size?: number;
}

export default function RunSymbol({ tier, size = 14 }: Props) {
  const label = TIER_META[tier].label;
  const common = { width: tier === 'double' ? size * 1.8 : size, height: size, role: 'img', 'aria-label': label };
  if (tier === 'green') {
    return (
      <svg {...common} viewBox="0 0 14 14" className="ski-sym">
        <circle cx="7" cy="7" r="6" fill="#3fbf74" />
      </svg>
    );
  }
  if (tier === 'blue') {
    return (
      <svg {...common} viewBox="0 0 14 14" className="ski-sym">
        <rect x="1.5" y="1.5" width="11" height="11" fill="#3d8bfd" />
      </svg>
    );
  }
  if (tier === 'black' || tier === 'double') {
    const diamond = (cx: number) => (
      <path
        d={`M${cx} 0.8 L${cx + 6.2} 7 L${cx} 13.2 L${cx - 6.2} 7 Z`}
        fill="#0b0d10"
        stroke="#e8f1f6"
        strokeWidth="1"
      />
    );
    return (
      <svg {...common} viewBox={tier === 'double' ? '0 0 25 14' : '0 0 14 14'} className="ski-sym">
        {diamond(7)}
        {tier === 'double' ? diamond(18) : null}
      </svg>
    );
  }
  return (
    <svg {...common} viewBox="0 0 14 14" className="ski-sym">
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="#9aa5b1" strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  );
}
