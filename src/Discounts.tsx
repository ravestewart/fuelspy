// Garage tab — Station discounts editor (spec F4, §6.4).
import { useState } from 'react';
import { upsertDiscount, validDiscount, type Discount } from './geo';

type Site = { id: number; name: string; brand: string; suburb: string };

const FUEL_CHOICES: { label: string; ids: number[] }[] = [
  { label: 'Diesel', ids: [3, 14] }, { label: 'E10', ids: [12] }, { label: 'Unleaded 91', ids: [2] },
  { label: 'Premium 95', ids: [5] }, { label: 'Premium 98', ids: [8] },
];

const field = {
  background: '#111827', border: '1px solid #374151', borderRadius: '4px', color: '#f3f4f6', padding: '10px 12px',
  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px', minHeight: '44px', boxSizing: 'border-box' as const, width: '100%',
};
const button = (primary: boolean) => ({
  minHeight: '44px', padding: '10px 14px', background: primary ? '#f59e0b' : '#1f2937', border: primary ? 'none' : '1px solid #374151',
  borderRadius: '4px', color: primary ? '#0e1117' : '#d1d5db', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
  fontSize: '14px', cursor: 'pointer',
});

export default function DiscountsEditor(props: {
  discounts: Discount[];
  setDiscounts: (d: Discount[]) => void;
  loadSites: () => Promise<Site[]>;
  sectionLabel: object;
}) {
  const { discounts, setDiscounts, loadSites, sectionLabel } = props;
  const [adding, setAdding] = useState(false);
  const [sites, setSites] = useState<Site[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [site, setSite] = useState<Site | null>(null);
  const [cents, setCents] = useState('4');
  const [minSpend, setMinSpend] = useState('');
  const [fuel, setFuel] = useState<'all' | number[]>('all');

  async function open() {
    setAdding(true);
    if (!sites) {
      try { setSites(await loadSites()); } catch (e) { setLoadErr(`Couldn't load stations: ${(e as Error).message}`); }
    }
  }
  const matches = sites && query.trim().length >= 2
    ? sites.filter((s) => `${s.name} ${s.brand} ${s.suburb}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];
  const draft = site ? { siteId: site.id, name: `${site.brand} ${site.name} (${site.suburb})`, fuelIds: fuel, centsPerLitre: Number(cents), minSpend: minSpend === '' ? 0 : Number(minSpend) } : null;
  const ok = draft ? validDiscount(draft) : false;

  function save() {
    if (!draft || !ok) return;
    setDiscounts(upsertDiscount(discounts, draft as Discount));
    setAdding(false); setSite(null); setQuery(''); setCents('4'); setMinSpend(''); setFuel('all');
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={sectionLabel}>Station discounts</div>
      {discounts.length === 0 && !adding && (
        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>None yet. A discount lowers that servo's price in Find and Trip when your fill meets the minimum spend.</div>
      )}
      {discounts.map((d) => (
        <div key={d.siteId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', background: '#111827', border: '1px solid #1f2937', borderRadius: '4px', padding: '10px 12px', marginBottom: '8px' }}>
          <div style={{ fontSize: '14px', color: '#d1d5db' }}>
            {d.name}<br />
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>
              −{d.centsPerLitre}c/L · min spend ${d.minSpend.toFixed(2)} · {d.fuelIds === 'all' ? 'all fuels' : FUEL_CHOICES.filter((f) => f.ids.some((id) => (d.fuelIds as number[]).includes(id))).map((f) => f.label).join(', ')}
            </span>
          </div>
          <button onClick={() => setDiscounts(discounts.filter((x) => x.siteId !== d.siteId))} style={button(false)}>DELETE</button>
        </div>
      ))}
      {!adding ? (
        <button onClick={open} style={{ ...button(false), width: '100%' }}>+ ADD STATION DISCOUNT</button>
      ) : (
        <div style={{ background: '#111827', border: '1px solid #374151', borderRadius: '4px', padding: '12px', display: 'grid', gap: '10px' }}>
          {loadErr && <div style={{ fontSize: '13px', color: '#ef4444' }}>{loadErr}</div>}
          {!site ? (
            <>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={sites ? 'Search servo by name or suburb…' : 'Loading stations…'} style={field} disabled={!sites} />
              {matches.map((s) => (
                <button key={s.id} onClick={() => setSite(s)} style={{ ...button(false), textAlign: 'left' as const }}>
                  {s.brand} {s.name} · {s.suburb}
                </button>
              ))}
            </>
          ) : (
            <div style={{ fontSize: '14px', color: '#10b981' }}>{'✓'} {site.brand} {site.name} · {site.suburb} <button onClick={() => setSite(null)} style={{ ...button(false), marginLeft: '8px', minHeight: '36px', padding: '4px 10px' }}>change</button></div>
          )}
          <label style={{ fontSize: '13px', color: '#9ca3af' }}>Cents off per litre
            <input inputMode="decimal" value={cents} onChange={(e) => setCents(e.target.value)} style={field} />
          </label>
          <label style={{ fontSize: '13px', color: '#9ca3af' }}>Minimum spend ($, leave empty for none)
            <input inputMode="decimal" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} style={field} />
          </label>
          <label style={{ fontSize: '13px', color: '#9ca3af' }}>Applies to
            <select value={fuel === 'all' ? 'all' : FUEL_CHOICES.find((f) => f.ids.join() === (fuel as number[]).join())?.label}
              onChange={(e) => setFuel(e.target.value === 'all' ? 'all' : FUEL_CHOICES.find((f) => f.label === e.target.value)!.ids)} style={field}>
              <option value="all">All fuels</option>
              {FUEL_CHOICES.map((f) => <option key={f.label} value={f.label}>{f.label}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={save} disabled={!ok} style={{ ...button(true), flex: 1, opacity: ok ? 1 : 0.5 }}>SAVE</button>
            <button onClick={() => setAdding(false)} style={{ ...button(false), flex: 1 }}>CANCEL</button>
          </div>
          {site && !ok && <div style={{ fontSize: '12px', color: '#ef4444' }}>Cents must be 0.1–50 and minimum spend 0 or more.</div>}
        </div>
      )}
    </div>
  );
}
