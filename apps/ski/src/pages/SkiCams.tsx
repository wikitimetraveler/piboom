import { useEffect, useState } from 'react';
import { camsPath, camsResortFromPath } from '../lib/page';
import type { DestinationBrief } from '../lib/types';

interface SkiCam {
  id: number;
  name: string;
  source: string;
  sourceLabel: string;
  distanceMi: number;
  imageUrl: string;
  pageUrl: string | null;
  route: string | null;
  refreshMinutes: number | null;
}

interface CamLink {
  label: string;
  url: string;
}

interface CamsPayload {
  resort: { id: string; name: string; area: string; baseFt: number; summitFt: number; chainHighways: string[] };
  official: CamLink[];
  regional: CamLink[];
  mountain: SkiCam[];
  nearby: SkiCam[];
  roads: SkiCam[];
  note: string;
  fetchedAt: string;
}

interface Props {
  destinations: DestinationBrief[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const REFRESH_MS = 5 * 60 * 1000;

function withTick(url: string, tick: number) {
  return tick ? `${url}${url.includes('?') ? '&' : '?'}t=${tick}` : url;
}

function CamCard({ cam, tick, chain }: { cam: SkiCam; tick: number; chain?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [tick]);
  const body = (
    <>
      {broken ? (
        <div className="ski-cam__missing">Image unavailable</div>
      ) : (
        <img src={withTick(cam.imageUrl, tick)} alt={cam.name} loading="lazy" onError={() => setBroken(true)} />
      )}
      <figcaption>
        <strong>{cam.name}</strong>
        <span>
          {cam.route ? <b className={chain ? 'is-chain' : ''}>{cam.route}</b> : null}
          {cam.sourceLabel} · {cam.distanceMi} mi
        </span>
      </figcaption>
    </>
  );
  return (
    <figure className="ski-cam">
      {cam.pageUrl ? (
        <a href={cam.pageUrl} target="_blank" rel="noreferrer">
          {body}
        </a>
      ) : (
        body
      )}
    </figure>
  );
}

function CamGroup({ title, hint, cams, tick, chain = [] }: { title: string; hint: string; cams: SkiCam[]; tick: number; chain?: string[] }) {
  return (
    <section className="ski-cam-group" aria-label={title}>
      <h2>
        {title} <small>{cams.length}</small>
      </h2>
      <p className="ski-disclaimer">{hint}</p>
      {cams.length ? (
        <div className="ski-cam-grid">
          {cams.map((cam) => (
            <CamCard key={cam.id} cam={cam} tick={tick} chain={Boolean(cam.route && chain.includes(cam.route))} />
          ))}
        </div>
      ) : (
        <p className="ski-cam-empty">No cams in the catalog for this group yet.</p>
      )}
    </section>
  );
}

const chainRoute = (hw: string) => hw.replace(/^CA-/, 'SR-');

export default function SkiCams({ destinations, selectedId, onSelect }: Props) {
  const fromPath = camsResortFromPath();
  const resortId = destinations.some((d) => d.id === fromPath) ? fromPath : selectedId;
  const [data, setData] = useState<CamsPayload | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (fromPath && fromPath !== selectedId && destinations.some((d) => d.id === fromPath)) onSelect(fromPath);
  }, [fromPath, selectedId, destinations, onSelect]);

  useEffect(() => {
    if (!resortId) return;
    let live = true;
    setError('');
    fetch(`/api/ski/cams/${resortId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((payload: CamsPayload) => {
        if (live) setData(payload);
      })
      .catch(() => {
        if (live) setError('Cam list unavailable. Restart the Node server to mount /api/ski/cams.');
      });
    return () => {
      live = false;
    };
  }, [resortId]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const pick = (id: string) => {
    onSelect(id);
    window.history.replaceState({ page: 'cams' }, '', camsPath(id));
  };

  const current = data && data.resort.id === resortId ? data : null;
  const chain = (current?.resort.chainHighways || []).map(chainRoute);

  return (
    <>
      <header className="ski-hero">
        <h1>Mountain cams</h1>
        <p>
          Official resort cams, fire-lookout and summit cams on the mountain, and Caltrans cams on the roads in. Stills
          refresh every 5 minutes; click any cam for its live page.
        </p>
      </header>
      <nav className="ski-cam-resorts" aria-label="Pick a resort">
        {destinations.map((d) => (
          <button key={d.id} type="button" className={d.id === resortId ? 'is-on' : ''} aria-pressed={d.id === resortId} onClick={() => pick(d.id)}>
            {d.name}
          </button>
        ))}
      </nav>
      {error ? <p className="ski-disclaimer">{error}</p> : null}
      {current ? (
        <>
          <section className="ski-cam-group" aria-label="Official resort cams">
            <h2>{current.resort.name} official cams</h2>
            <ul className="ski-cam-links">
              {[...current.official, ...current.regional].map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.label} <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
            {current.note ? <p className="ski-disclaimer">{current.note}</p> : null}
          </section>
          <CamGroup
            title="On the mountain"
            hint={`Fire-lookout and summit cams within 3 miles of the base or summit (${current.resort.baseFt.toLocaleString()}–${current.resort.summitFt.toLocaleString()} ft).`}
            cams={current.mountain}
            tick={tick}
          />
          <CamGroup
            title="Roads in"
            hint={`Caltrans cams on the drive up, within 35 miles. Chain-control routes (${current.resort.chainHighways.join(', ') || 'none listed'}) come first.`}
            cams={current.roads}
            tick={tick}
            chain={chain}
          />
          <CamGroup title="Nearby peaks" hint="Other mountain cams within 20 miles." cams={current.nearby} tick={tick} />
          <p className="ski-disclaimer">
            Cams from ALERTCalifornia (UC San Diego), HPWREN, and Caltrans CWWP2. Desk aid only, not official chain
            control.
          </p>
        </>
      ) : !error ? (
        <p className="ski-disclaimer">Loading cams…</p>
      ) : null}
    </>
  );
}
