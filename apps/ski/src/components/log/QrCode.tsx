import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

interface Props {
  text: string;
  size?: number;
  label: string;
}

const QUIET = 4;

export default function QrCode({ text, size = 240, label }: Props) {
  const { path, span } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + QUIET},${r + QUIET}h1v1h-1z`;
    }
    return { path: d, span: n + QUIET * 2 };
  }, [text]);

  return (
    <svg
      className="log-qr"
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={span} height={span} fill="#fff" />
      <path d={path} fill="#071018" />
    </svg>
  );
}
