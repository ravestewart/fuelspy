// Trip tab — fuel along the way (spec §5). Ranking logic lives in geo.ts.
import { useState, type ReactNode } from 'react';
import {
  indexRoute, projectToRoute, abPoints, corridorHalfWidthKm, effectivePriceDPL, lowerBound,
  shouldStop, tripTotal, tripCompare, navigateUrl,
  type Discount, type Pt, type Step, type Settings,
} from './geo';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const ATTRIBUTION = '© openrouteservice by HeiGIT | Data from OpenStreetMap';
const LEGS_PER_CALL = 25;
const MAX_CALLS = 4;

type Station = {
  id: number; fuelId?: number; name: string; brand: string; suburb: string; address: string;
  lat: number; lng: number; priceCPL: number; priceDPL: number; lastUpdate: string; fuelType: string;
};
type Vehicle = { tankL: number; consumption: number; fuelType: string };
type Place = { pt: Pt; label: string } | null;
type Result = Station & {
  effDPL: number; discountCPL: number; extraMin: number; extraKm: number;
  fill: number; detour: number; total: number;
};

async function geocode(text: string): Promise<Place> {
  const url = `${NOMINATIM}/search?q=${encodeURIComponent(text + ', Queensland, Australia')}&format=json&limit=1&countrycodes=au`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en-AU' } });
  const r = await res.json();
  if (!r.length) return null;
  return { pt: { lat: parseFloat(r[0].lat), lng: parseFloat(r[0].lon) }, label: r[0].display_name.split(',').slice(0, 2).join(',') };
}

async function reverse(p: Pt): Promise<string> {
  try {
    const r = await (await fetch(`${NOMINATIM}/reverse?lat=${p.lat}&lon=${p.lng}&format=json&zoom=14`, { headers: { 'Accept-Language': 'en-AU' } })).json();
    return r.address?.suburb || r.address?.town || r.address?.city || 'Current location';
  } catch { return 'Current location'; }
}

const fmt$ = (n: number) => `$${n.toFixed(2)}`;
const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Brisbane' }) : '—';

const inputStyle = {
  flex: 1, minWidth: 0, background: '#111827', border: '1px solid #374151', borderRadius: '4px', color: '#f3f4f6',
  padding: '10px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px', outline: 'none', minHeight: '44px',
} as const;
const btn = (primary: boolean) => ({
  minHeight: '44px', padding: '10px 14px', background: primary ? '#f59e0b' : '#1f2937', border: primary ? 'none' : '1px solid #374151',
  borderRadius: '4px', color: primary ? '#0e1117' : '#d1d5db', fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700, fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' as const,
});

export default function TripTab(props: {
  vehicle: Vehicle | undefined;
  fuelLevel: number;
  discounts: Discount[];
  settings: Settings;
  setSettings: (s: Settings) => void;
  loadStations: (fuelType: string) => Promise<Station[]>;
  vehicleAndFuel: ReactNode;
  sectionLabel: object;
}) {
  const { vehicle, fuelLevel, discounts, settings, setSettings, loadStations, vehicleAndFuel, sectionLabel } = props;
  const [startText, setStartText] = useState('');
  const [destText, setDestText] = useState('');
  const [start, setStart] = useState<Place>(null);
  const [dest, setDest] = useState<Place>(null);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ km: number; min: number } | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [baseline, setBaseline] = useState<number | null>(null);
  const [checkedLabel, setCheckedLabel] = useState<string>('');
  const [unchecked, setUnchecked] = useState<Station[]>([]);
  const [planFullTank, setPlanFullTank] = useState(false); // fixed at Plan time, so the saving line matches the results shown
  const [planKey, setPlanKey] = useState<string | null>(null); // the inputs the shown results were planned with

  const mode = settings.tripDetourMode;
  const limit = mode === 'min' ? settings.tripDetourMins : settings.tripDetourKm;
  const limitText = mode === 'min' ? `${limit} min` : `${limit} km`;

  // Results are for the inputs at Plan time. When the vehicle, fuel level, discounts or detour settings
  // change, the results are hidden, so no card shows totals or savings for inputs that are no longer set.
  // A plan still running when an input changes finishes hidden for the same reason.
  const inputsKey = JSON.stringify([vehicle?.tankL, vehicle?.consumption, vehicle?.fuelType, fuelLevel, discounts, mode, limit, settings.tripAvoidTolls]);
  const isCurrent = planKey === inputsKey;

  async function resolve(which: 'start' | 'dest') {
    const text = (which === 'start' ? startText : destText).trim();
    const current = which === 'start' ? start : dest;
    if (!text || current) return; // already resolved for this text (typing clears it)
    setPlaceError(null);
    try {
      const p = await geocode(text);
      if (!p) { setPlaceError(`Couldn't find '${text}'`); (which === 'start' ? setStart : setDest)(null); return; }
      (which === 'start' ? setStart : setDest)(p);
    } catch { setPlaceError(`Couldn't look up '${text}' — check your connection`); }
  }

  function gps() {
    if (!navigator.geolocation) { setPlaceError('GPS not available on this device.'); return; }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const label = await reverse(pt);
      setStart({ pt, label }); setStartText(label);
    }, (e) => setPlaceError(`GPS error: ${e.message}`), { enableHighAccuracy: true, timeout: 12000 });
  }

  async function plan() {
    if (!start || !dest || !vehicle) return;
    setPlanKey(inputsKey);
    setError(null); setNote(null); setResults([]); setUnchecked([]); setBaseline(null); setCheckedLabel(''); setRouteInfo(null);
    const avoidTolls = settings.tripAvoidTolls;
    try {
      // 1. Route
      setStage('Getting route…');
      const rr = await fetch('/api/route', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: start.pt, destination: dest.pt, avoidTolls }),
      });
      const route = await rr.json();
      if (!rr.ok || route.error || !route.geometry?.length) {
        setError("Couldn't get a route — check the places and try again."); return;
      }
      setRouteInfo({ km: route.distance_m / 1000, min: route.duration_s / 60 });
      const ri = indexRoute(route.geometry);
      const steps: Step[] = route.steps || [];

      // 2. Corridor
      setStage('Finding servos…');
      const all = await loadStations(vehicle.fuelType);
      const half = corridorHalfWidthKm(mode, limit);
      const lats = ri.pts.map((p) => p.lat), lngs = ri.pts.map((p) => p.lng);
      const padLat = half / 111, padLng = half / (111 * Math.cos((lats[0] * Math.PI) / 180));
      const box = { minLat: Math.min(...lats) - padLat, maxLat: Math.max(...lats) + padLat, minLng: Math.min(...lngs) - padLng, maxLng: Math.max(...lngs) + padLng };
      const litres = vehicle.tankL * (1 - fuelLevel);
      const fullTank = litres < 1;
      setPlanFullTank(fullTank);
      const notes: string[] = [];
      if (fullTank) notes.push('Tank is full — set your fuel level. Ranked by detour cost, then price.');
      setNote(notes.length ? notes.join(' ') : null);
      const corridor = all
        .filter((s) => s.lat > box.minLat && s.lat < box.maxLat && s.lng > box.minLng && s.lng < box.maxLng)
        .map((s) => ({ s, proj: projectToRoute(ri, s) }))
        .filter(({ proj }) => proj.distKm <= half)
        .map(({ s, proj }) => {
          const eff = effectivePriceDPL(s, litres, discounts);
          return { s, proj, eff, bound: lowerBound(litres, eff.priceDPL) };
        })
        .sort((x, y) => x.bound - y.bound || x.eff.priceDPL - y.eff.priceDPL);
      if (!corridor.length) { setError(`No servos within ${limitText} of your route — try a bigger detour.`); return; }

      // 3. Detours, in lower-bound order, 25 per call, at most 4 calls; stop early when no better total is possible.
      setStage('Checking detours…');
      const kept: Result[] = [];
      let best: number | null = null, checked = 0, calls = 0, stopped = false, unrouted = 0, routed = 0;
      for (let i = 0; i < corridor.length; i += LEGS_PER_CALL) {
        if (shouldStop(corridor[i].bound, best, fullTank)) { stopped = true; break; }
        if (calls >= MAX_CALLS) break;
        const batch = corridor.slice(i, i + LEGS_PER_CALL);
        const legs = batch.map(({ s, proj }) => ({ ...abPoints(ri, proj, steps), s: { lat: s.lat, lng: s.lng } }));
        const dr = await fetch('/api/detours', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ legs, avoidTolls }),
        });
        calls++;
        const d = await dr.json();
        if (!dr.ok || d.error) {
          if (!kept.length) {
            setUnchecked(corridor.slice().sort((x, y) => x.proj.distKm - y.proj.distKm).slice(0, 10).map((c) => c.s));
            setError('Detours not checked — showing the servos nearest your route.');
            return;
          }
          break;
        }
        checked += batch.length;
        unrouted += d.unresolved || 0;
        const batchAllNull = d.detours.every((x: unknown) => x === null);
        batch.forEach(({ s, eff }, k) => {
          const det = d.detours[k];
          if (!det) return;
          routed++;
          const extraMin = det.extra_s / 60, extraKm = det.extra_m / 1000;
          if ((mode === 'min' ? extraMin : extraKm) > limit) return;
          const t = tripTotal(litres, eff.priceDPL, extraKm, vehicle.consumption);
          kept.push({ ...s, effDPL: eff.priceDPL, discountCPL: eff.discountCPL, extraMin, extraKm, ...t });
          if (!fullTank && (best === null || t.total < best)) best = t.total;
        });
        if (batchAllNull) break; // nothing in this batch could be routed: don't spend more calls on the next
      }
      const ranOut = !stopped && checked < corridor.length;
      if (ranOut) setCheckedLabel(`best of ${checked} checked`);
      if (unrouted) notes.push(`${unrouted} servo${unrouted === 1 ? '' : 's'} couldn't be routed and ${unrouted === 1 ? 'was' : 'were'} skipped.`);
      setNote(notes.length ? notes.join(' ') : null);
      if (!kept.length) {
        const noneRouted = checked > 0 && routed === 0;
        setError(noneRouted ? `None of the ${checked} servos checked could be routed — try again later.` : ranOut ? `No servo in the ${checked} checked is within ${limitText} — try a bigger detour.` : `No servos within ${limitText} of your route — try a bigger detour.`);
        return;
      }
      kept.sort(tripCompare(fullTank));
      const onRoute = kept.filter((r) => r.extraMin < 1).sort(tripCompare(fullTank));
      const base = onRoute.length ? onRoute[0] : [...kept].sort((x, y) => projectToRoute(ri, x).alongKm - projectToRoute(ri, y).alongKm)[0];
      setBaseline(fullTank ? base.detour : base.total);
      setResults(kept);
    } catch (e) {
      setError(`Something went wrong: ${(e as Error).message}`);
    } finally {
      setStage(null);
    }
  }

  const set = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch });
  const fullTank = planFullTank;

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div style={sectionLabel}>From</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <input value={startText} onChange={(e) => { setStartText(e.target.value); setStart(null); }} onBlur={() => resolve('start')}
            onKeyDown={(e) => e.key === 'Enter' && resolve('start')} placeholder="Start suburb or address…" style={inputStyle} />
          <button onClick={gps} style={btn(false)} title="Use GPS">{'📍'}</button>
        </div>
        {start && <div style={{ marginTop: '6px', fontSize: '12px', color: '#10b981' }}>{'✓'} {start.label}</div>}
      </div>
      <div style={{ marginBottom: '16px' }}>
        <div style={sectionLabel}>To</div>
        <input value={destText} onChange={(e) => { setDestText(e.target.value); setDest(null); }} onBlur={() => resolve('dest')}
          onKeyDown={(e) => e.key === 'Enter' && resolve('dest')} placeholder="Destination suburb or address…" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        {dest && <div style={{ marginTop: '6px', fontSize: '12px', color: '#10b981' }}>{'✓'} {dest.label}</div>}
        {placeError && <div style={{ marginTop: '6px', fontSize: '12px', color: '#ef4444' }}>{placeError}</div>}
      </div>

      {vehicleAndFuel}

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={sectionLabel}>Max Detour</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#f59e0b' }}>{limitText}</div>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <button onClick={() => set({ tripDetourMode: 'min' })} style={{ ...btn(mode === 'min'), flex: 1 }}>MINUTES</button>
          <button onClick={() => set({ tripDetourMode: 'km' })} style={{ ...btn(mode === 'km'), flex: 1 }}>KM</button>
        </div>
        {mode === 'min' ? (
          <input type="range" min="1" max="30" step="1" value={settings.tripDetourMins}
            onChange={(e) => set({ tripDetourMins: Number(e.target.value) })} style={{ width: '100%', accentColor: '#f59e0b', minHeight: '44px' }} />
        ) : (
          <input type="range" min="0.5" max="20" step="0.5" value={settings.tripDetourKm}
            onChange={(e) => set({ tripDetourKm: Number(e.target.value) })} style={{ width: '100%', accentColor: '#f59e0b', minHeight: '44px' }} />
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', fontSize: '14px', color: '#d1d5db', cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.tripAvoidTolls} onChange={(e) => set({ tripAvoidTolls: e.target.checked })}
            style={{ width: '22px', height: '22px', accentColor: '#f59e0b' }} />
          Avoid tolls
        </label>
      </div>

      <button onClick={plan} disabled={!start || !dest || !vehicle || !!stage}
        style={{ ...btn(true), width: '100%', fontSize: '16px', padding: '14px', marginBottom: '16px', opacity: !start || !dest ? 0.5 : 1 }}>
        {stage ? stage.toUpperCase() : !start || !dest ? 'SET FROM AND TO' : 'PLAN FUEL STOP'}
      </button>

      {planKey !== null && !isCurrent && !stage && (
        <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '10px' }}>Vehicle, fuel level, discounts or detour changed — press Plan for new results.</div>
      )}
      {isCurrent && note && <div style={{ fontSize: '13px', color: '#f59e0b', marginBottom: '10px' }}>{note}</div>}
      {isCurrent && routeInfo && (
        <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '10px' }}>
          Route {routeInfo.km.toFixed(1)} km · {Math.round(routeInfo.min)} min{settings.tripAvoidTolls ? ' · avoiding tolls' : ''}
          {checkedLabel && <span style={{ color: '#f59e0b' }}> · {checkedLabel}</span>}
        </div>
      )}
      {isCurrent && error && (
        <div style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: '4px', padding: '12px', marginBottom: '12px', fontSize: '13px', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {isCurrent && unchecked.map((s) => (
        <div key={s.id} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '4px', padding: '12px', marginBottom: '8px' }}>
          <div style={{ fontWeight: 700, fontSize: '16px' }}>{s.brand} <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '13px' }}>{s.name}</span></div>
          <div style={{ fontSize: '13px', color: '#9ca3af' }}>{s.suburb} · {s.priceCPL.toFixed(1)}¢ · detours not checked</div>
        </div>
      ))}

      {isCurrent && results.map((r, i) => {
        const saving = baseline === null ? 0 : baseline - (fullTank ? r.detour : r.total);
        return (
          <div key={r.id} style={{ background: '#111827', border: `1px solid ${i === 0 ? '#f59e0b44' : '#1f2937'}`, borderLeft: `4px solid ${saving > 0.005 ? '#10b981' : '#6b7280'}`, borderRadius: '4px', padding: '14px', marginBottom: '8px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '10px', right: '10px', background: i === 0 ? '#f59e0b' : '#1f2937', color: i === 0 ? '#0e1117' : '#9ca3af', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 700, padding: '2px 7px', borderRadius: '2px' }}>
              {i === 0 ? '★ BEST' : `#${i + 1}`}
            </div>
            <div style={{ fontWeight: 700, fontSize: '16px', color: '#f3f4f6', paddingRight: '70px' }}>{r.brand} <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '13px' }}>{r.name}</span></div>
            <div style={{ fontSize: '13px', color: '#9ca3af' }}>{r.suburb} · {r.address}</div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '22px', fontWeight: 700, color: '#f59e0b' }}>{(r.effDPL * 100).toFixed(1)}¢</div>
                {r.discountCPL > 0 && <div style={{ fontSize: '12px', color: '#10b981' }}>−{r.discountCPL.toFixed(1)}c/L applied</div>}
              </div>
              <div style={{ borderLeft: '1px solid #374151', paddingLeft: '16px' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '16px', color: '#d1d5db' }}>+{Math.round(r.extraMin)} min</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#9ca3af' }}>+{r.extraKm.toFixed(1)} km detour</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '12px', background: '#0e1117', borderRadius: '3px', padding: '10px', textAlign: 'center' }}>
              {[['FILL', r.fill], ['DETOUR', r.detour], ['TOTAL', r.total]].map(([l, v]) => (
                <div key={l as string}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', color: l === 'TOTAL' ? '#f3f4f6' : '#9ca3af', fontWeight: l === 'TOTAL' ? 700 : 400 }}>{fmt$(v as number)}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', letterSpacing: '0.08em' }}>{l}</div>
                </div>
              ))}
            </div>
            {baseline !== null && Math.abs(saving) > 0.005 && (
              <div style={{ marginTop: '6px', fontSize: '13px', color: saving > 0 ? '#10b981' : '#ef4444' }}>
                {saving > 0 ? `▲ Save ${fmt$(saving)} vs stopping on your route` : `▼ ${fmt$(-saving)} more than stopping on your route`}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Price last changed {fmtDate(r.lastUpdate)} AEST</div>
              {start && dest && (
                <a href={navigateUrl(start.pt, dest.pt, { lat: r.lat, lng: r.lng }, settings.tripAvoidTolls)} target="_blank" rel="noopener noreferrer"
                  style={{ ...btn(false), display: 'inline-flex', alignItems: 'center', textDecoration: 'none', fontSize: '13px' }}>
                  {'🗺'} NAVIGATE
                </a>
              )}
            </div>
          </div>
        );
      })}

      {isCurrent && (results.length > 0 || error || routeInfo) && (
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>{ATTRIBUTION}</div>
      )}
    </div>
  );
}
