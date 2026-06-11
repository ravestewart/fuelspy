import { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const OSRM_BASE = 'https://router.project-osrm.org';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

const DEFAULT_VEHICLES = [
  {
    id: 'v1',
    year: 2011,
    make: 'Ford',
    model: 'Mondeo Titanium Wagon',
    fuelType: 'Diesel',hh
    tankL: 70,
    consumption: 6.2,
  },
  {
    id: 'v2',
    year: 2016,
    make: 'Ford',
    model: 'Mondeo Titanium Wagon',
    fuelType: 'Diesel',
    tankL: 62.5,
    consumption: 5.3,
  },
  {
    id: 'v3',
    year: 2018,
    make: 'Nissan',
    model: 'Navara NP300 King Cab',
    fuelType: 'Diesel',
    tankL: 80,
    consumption: 7.0,
  },
];

const FUEL_LEVELS = [
  { label: '¼ Tank', value: 0.25, litresFn: (t: number) => t * 0.75 },
  { label: '½ Tank', value: 0.5, litresFn: (t: number) => t * 0.5 },
  { label: '¾ Tank', value: 0.75, litresFn: (t: number) => t * 0.25 },
  { label: 'Full', value: 1.0, litresFn: () => 0 },
];

const FUEL_TYPES = ['Diesel', 'E10', 'Unleaded 91', 'Premium 95', 'Premium 98'];

const BRAND_COLOURS = {
  bp: '#009900',
  caltex: '#c8102e',
  ampol: '#d4003c',
  shell: '#ffcf00',
  '7-eleven': '#ff6600',
  '7eleven': '#ff6600',
  united: '#0057a8',
  liberty: '#0057a8',
  puma: '#e63329',
  metro: '#9333ea',
  pearl: '#7c3aed',
  speedway: '#16a34a',
  coles: '#e11d48',
  woolworths: '#16a34a',
};

function brandColour(brand = '') {
  const b = brand.toLowerCase();
  for (const [key, col] of Object.entries(BRAND_COLOURS)) {
    if (b.includes(key)) return col;
  }
  return '#6b7280';
}

// ─────────────────────────────────────────────────────────────────────────────
// MATHS & GEO
// ─────────────────────────────────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Bounding box for a radius (km) from a centre point
function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING — OSRM table (one call for N destinations), fallback to haversine×1.3
// ─────────────────────────────────────────────────────────────────────────────
async function getRouteDistances(
  originLat: number,
  originLng: number,
  destinations: any[]
) {
  // destinations: [{lat, lng}, ...]
  // Returns: [{km, approx}, ...] in same order
  try {
    const coords = [
      `${originLng},${originLat}`,
      ...destinations.map((d: any) => `${d.lng},${d.lat}`),
    ].join(';');
    const destIndices = destinations
      .map((_: any, i: number) => i + 1)
      .join(',');
    const url = `${OSRM_BASE}/table/v1/driving/${coords}?sources=0&destinations=${destIndices}&annotations=distance`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    if (data.code !== 'Ok') throw new Error(data.message);

    // distances[0] = array of distances in metres from source 0 to each destination
    return data.distances[0].map((m: any) => ({
      km: m === null ? null : m / 1000,
      approx: m === null,
    }));
  } catch {
    // Fallback: haversine × 1.3 (Brisbane road factor)
    return destinations.map((d: any) => ({
      km: haversineKm(originLat, originLng, d.lat, d.lng) * 1.3,
      approx: true,
    }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOMINATIM — reverse geocode for suburb display
// ─────────────────────────────────────────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number) {
  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en-AU' },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return (
      data.address?.suburb || data.address?.town || data.address?.city || null
    );
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE API — calls Netlify proxy which reads FUELSPY_TOKEN server-side
// ─────────────────────────────────────────────────────────────────────────────
async function fetchLiveStations(fuelType: string) {
  const res = await fetch('/api/fuelproxy', { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Proxy ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const fuelTypeMap: Record<number, string> = {};
  for (const ft of (data.fuelTypes || [])) fuelTypeMap[ft.FuelId] = ft.Name;
  const FUEL_ID_MAP: Record<string, number[]> = {
    'Diesel': [3, 14], 'E10': [12], 'Unleaded 91': [2], 'Premium 95': [5], 'Premium 98': [8],
  };
  const targetIds = FUEL_ID_MAP[fuelType] || [3];
  const seen = new Map();
  for (const s of (data.stations || [])) {
    if (!targetIds.includes(s.fuelId)) continue;
    if (seen.has(s.siteId)) continue;
    if (!s.lat || !s.lng) continue;
    seen.set(s.siteId, {
      id: s.siteId,
      name: s.name || s.brand || 'Station',
      brand: s.brand || 'Independent',
      address: s.address || '',
      suburb: s.address || '',
      state: 'QLD',
      postcode: s.postcode || '',
      lat: s.lat,
      lng: s.lng,
      fuelType,
      priceTenths: s.price,
      priceCPL: s.price / 10,
      priceDPL: s.price / 1000,
      lastUpdate: s.lastUpdate,
    });
  }
  return Array.from(seen.values()).filter(s => !isNaN(s.lat) && !isNaN(s.lng));
}
// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmt$(n: number) {
  return `$${n.toFixed(2)}`;
}
function fmtCPL(n: number) {
  return `${n.toFixed(1)}¢`;
}
function fmtKm(n: number, approx: boolean) {
  return `${approx ? '~' : ''}${n.toFixed(1)} km`;
}
function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Australia/Brisbane',
  });
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function TabBar({ tab, setTab }) {
  const tabs = [
    { id: 'find', icon: '⛽', label: 'Find Fuel' },
    { id: 'garage', icon: '🚗', label: 'My Garage' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid #1f2937',
        background: '#0e1117',
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            flex: 1,
            padding: '12px 4px',
            background: 'none',
            border: 'none',
            borderBottom:
              tab === t.id ? '2px solid #f59e0b' : '2px solid transparent',
            color: tab === t.id ? '#f59e0b' : '#6b7280',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <span style={{ fontSize: '18px' }}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function VehiclePill({ v, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        background: selected ? '#f59e0b' : '#1f2937',
        border: `1px solid ${selected ? '#f59e0b' : '#374151'}`,
        borderRadius: '4px',
        color: selected ? '#0e1117' : '#d1d5db',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: '13px',
        fontWeight: selected ? 700 : 400,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {v.year} {v.make} {v.model}
    </button>
  );
}

function StationCard({ s, rank, savings, nearestId }) {
  const isNearest = s.id === nearestId;
  const isCheapest = rank === 0;
  const savingsAmt = savings;
  const col = isNearest ? '#6b7280' : savings > 0 ? '#10b981' : '#ef4444';

  return (
    <div
      style={{
        background: '#111827',
        border: `1px solid ${isCheapest ? '#f59e0b44' : '#1f2937'}`,
        borderLeft: `4px solid ${col}`,
        borderRadius: '4px',
        padding: '14px',
        marginBottom: '8px',
        position: 'relative',
      }}
    >
      {/* Rank badge */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: isCheapest ? '#f59e0b' : '#1f2937',
          color: isCheapest ? '#0e1117' : '#9ca3af',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          fontWeight: 700,
          padding: '2px 7px',
          borderRadius: '2px',
        }}
      >
        {isCheapest ? '★ BEST' : `#${rank + 1}`}
      </div>

      {/* Station name & suburb */}
      <div
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
          fontSize: '16px',
          color: '#f3f4f6',
          paddingRight: '60px',
        }}
      >
        {s.brand}
        {isNearest && (
          <span
            style={{
              color: '#6b7280',
              fontSize: '11px',
              fontWeight: 400,
              marginLeft: '8px',
            }}
          >
            NEAREST
          </span>
        )}
      </div>
      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '1px' }}>
        {s.suburb} · {s.address}
      </div>

      {/* Price + Distance row */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginTop: '10px',
          alignItems: 'baseline',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '22px',
              fontWeight: 700,
              color: '#f59e0b',
              lineHeight: 1,
            }}
          >
            {fmtCPL(s.priceCPL)}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: '#6b7280',
              fontFamily: "'Barlow Condensed', sans-serif",
              marginTop: '1px',
            }}
          >
            {s.fuelType.toUpperCase()}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid #374151', paddingLeft: '16px' }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '16px',
              color: '#d1d5db',
              lineHeight: 1,
            }}
          >
            {fmtKm(s.roadKm, s.distApprox)}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: '#6b7280',
              fontFamily: "'Barlow Condensed', sans-serif",
              marginTop: '1px',
            }}
          >
            {s.distApprox ? 'EST DISTANCE' : 'ROAD DISTANCE'}
          </div>
        </div>
      </div>

      {/* Cost breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '6px',
          marginTop: '12px',
          background: '#0e1117',
          borderRadius: '3px',
          padding: '10px',
        }}
      >
        {[
          { label: 'FILL', val: fmt$(s.fillCost) },
          { label: 'DRIVE', val: fmt$(s.drivingCost) },
          { label: 'TOTAL', val: fmt$(s.totalCost), highlight: true },
        ].map(({ label, val, highlight }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '15px',
                fontWeight: highlight ? 700 : 400,
                color: highlight ? '#f3f4f6' : '#9ca3af',
              }}
            >
              {val}
            </div>
            <div
              style={{
                fontSize: '9px',
                color: '#6b7280',
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: '0.08em',
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Saving vs nearest */}
      {!isNearest && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '12px',
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >
          {savingsAmt > 0 ? (
            <span style={{ color: '#10b981' }}>
              ▲ Save {fmt$(savingsAmt)} vs nearest servo
            </span>
          ) : (
            <span style={{ color: '#ef4444' }}>
              ▼ {fmt$(Math.abs(savingsAmt))} more than nearest servo
            </span>
          )}
        </div>
      )}

      {/* Last updated */}
      <div
        style={{
          marginTop: '6px',
          fontSize: '10px',
          color: '#4b5563',
          fontFamily: "'Barlow Condensed', sans-serif",
        }}
      >
        Price last changed {fmtDate(s.lastUpdate)} AEST
      </div>
    </div>
  );
}

function AddVehicleForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    year: '',
    make: '',
    model: '',
    fuelType: 'Diesel',
    tankL: '',
    consumption: '',
  });
  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid =
    form.year && form.make && form.model && form.tankL && form.consumption;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#0e1117',
    border: '1px solid #374151',
    borderRadius: '3px',
    color: '#f3f4f6',
    padding: '8px 10px',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        background: '#111827',
        border: '1px solid #374151',
        borderRadius: '4px',
        padding: '16px',
        marginTop: '12px',
      }}
    >
      <div
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
          color: '#f59e0b',
          fontSize: '14px',
          marginBottom: '12px',
          letterSpacing: '0.08em',
        }}
      >
        ADD VEHICLE
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}
      >
        {[
          { k: 'year', label: 'Year', type: 'number', placeholder: '2018' },
          { k: 'make', label: 'Make', type: 'text', placeholder: 'Nissan' },
        ].map(({ k, label, type, placeholder }) => (
          <div key={k}>
            <label
              style={{
                display: 'block',
                fontSize: '10px',
                color: '#6b7280',
                fontFamily: "'Barlow Condensed', sans-serif",
                marginBottom: '3px',
                letterSpacing: '0.08em',
              }}
            >
              {label.toUpperCase()}
            </label>
            <input
              type={type}
              placeholder={placeholder}
              value={form[k]}
              onChange={set(k)}
              style={inputStyle}
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop: '8px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '10px',
            color: '#6b7280',
            fontFamily: "'Barlow Condensed', sans-serif",
            marginBottom: '3px',
            letterSpacing: '0.08em',
          }}
        >
          MODEL
        </label>
        <input
          type="text"
          placeholder="Navara NP300 King Cab"
          value={form.model}
          onChange={set('model')}
          style={inputStyle}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '8px',
          marginTop: '8px',
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '10px',
              color: '#6b7280',
              fontFamily: "'Barlow Condensed', sans-serif",
              marginBottom: '3px',
              letterSpacing: '0.08em',
            }}
          >
            FUEL TYPE
          </label>
          <select
            value={form.fuelType}
            onChange={set('fuelType')}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {FUEL_TYPES.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '10px',
              color: '#6b7280',
              fontFamily: "'Barlow Condensed', sans-serif",
              marginBottom: '3px',
              letterSpacing: '0.08em',
            }}
          >
            TANK (L)
          </label>
          <input
            type="number"
            placeholder="80"
            value={form.tankL}
            onChange={set('tankL')}
            style={inputStyle}
          />
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '10px',
              color: '#6b7280',
              fontFamily: "'Barlow Condensed', sans-serif",
              marginBottom: '3px',
              letterSpacing: '0.08em',
            }}
          >
            L/100km
          </label>
          <input
            type="number"
            placeholder="7.0"
            step="0.1"
            value={form.consumption}
            onChange={set('consumption')}
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <button
          disabled={!valid}
          onClick={() =>
            onSave({
              id: uid(),
              year: parseInt(form.year),
              make: form.make,
              model: form.model,
              fuelType: form.fuelType,
              tankL: parseFloat(form.tankL),
              consumption: parseFloat(form.consumption),
            })
          }
          style={{
            flex: 1,
            padding: '10px',
            background: valid ? '#f59e0b' : '#374151',
            border: 'none',
            borderRadius: '3px',
            color: valid ? '#0e1117' : '#6b7280',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            fontSize: '13px',
            cursor: valid ? 'pointer' : 'not-allowed',
            letterSpacing: '0.08em',
          }}
        >
          SAVE VEHICLE
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: '1px solid #374151',
            borderRadius: '3px',
            color: '#9ca3af',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function FuelSpy() {
  const [tab, setTab] = useState('find');
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [fuelLevel, setFuelLevel] = useState(0.5);
  const [radius, setRadius] = useState(15);
  const [location, setLocation] = useState(null);
  const [locationSuburb, setLocationSuburb] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState(null);
  const [locInput, setLocInput] = useState('');
  const [stations, setStations] = useState([]);
  const [stationLoading, setStationLoading] = useState(false);
  const [stationError, setStationError] = useState(null);
  const [isLiveData, setIsLiveData] = useState(false);  const [hasSearched, setHasSearched] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [storageReady, setStorageReady] = useState(true);
  const [nearestId, setNearestId] = useState(null);

  const selectedVehicle =
    vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0];

  // ── Load from storage on mount ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        // Garage
        try {
          const g = await Promise.resolve(
            localStorage.getItem('fuelspy-garage')
              ? { value: localStorage.getItem('fuelspy-garage') }
              : null
          );
          if (g) {
            const saved = JSON.parse(g.value);
            if (saved?.vehicles?.length) {
              setVehicles(saved.vehicles);
              setSelectedVehicleId(saved.vehicles[0].id);
            } else throw new Error('empty');
          } else throw new Error('no data');
        } catch {
          setVehicles(DEFAULT_VEHICLES);
          setSelectedVehicleId(DEFAULT_VEHICLES[0].id);
          localStorage.setItem(
            'fuelspy-garage',
            JSON.stringify({ vehicles: DEFAULT_VEHICLES })
          );
        }


        // Settings
        try {
          const s = await Promise.resolve(
            localStorage.getItem('fuelspy-settings')
              ? { value: localStorage.getItem('fuelspy-settings') }
              : null
          );
          if (s?.value) {
            const settings = JSON.parse(s.value);
            if (settings.radius) setRadius(settings.radius);
            if (settings.fuelLevel) setFuelLevel(settings.fuelLevel);
          }
        } catch {}
      } finally {
        setStorageReady(true);
      }
    })();
  }, []);

  // ── Persist garage ───────────────────────────────────────────────────────
  const saveGarage = async (newVehicles: any[]) => {
    setVehicles(newVehicles);
    try {
      localStorage.setItem(
        'fuelspy-garage',
        JSON.stringify({ vehicles: newVehicles })
      );
    } catch {}
  };

  const deleteVehicle = async (id: string) => {
    const updated = vehicles.filter((v) => v.id !== id);
    await saveGarage(updated);
    if (selectedVehicleId === id) setSelectedVehicleId(updated[0]?.id ?? null);
  };

  const addVehicle = async (v: any) => {
    const updated = [...vehicles, v];
    await saveGarage(updated);
    setShowAddVehicle(false);
  };

  // ── Persist settings ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem(
      'fuelspy-settings',
      JSON.stringify({ radius, fuelLevel })
    );
  }, [radius, fuelLevel, storageReady]);

  // ── Geocode suburb/postcode input via Nominatim ──────────────────────────
  const getLocation = useCallback(async () => {
    const query = locInput.trim();
    if (!query) {
      setLocError('Enter a suburb or postcode first.');
      return;
    }
    setLocError(null);
    setLocLoading(true);
    try {
      const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(
        query + ', Queensland, Australia'
      )}&format=json&limit=1&countrycodes=au`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en-AU', 'User-Agent': 'FuelSpy/1.0' },
      });
      const results = await res.json();
      if (!results.length) throw new Error(`No results found for "${query}"`);
      const loc = {
        lat: parseFloat(results[0].lat),
        lng: parseFloat(results[0].lon),
      };
      setLocation(loc);
      // Use the display name to extract suburb
      const parts = results[0].display_name.split(',');
      setLocationSuburb(parts[0].trim());
    } catch (err) {
      setLocError(err.message);
    } finally {
      setLocLoading(false);
    }
  }, [locInput]);

  // ── GPS fallback (works outside artifact sandbox) ─────────────────────────
  const getGPS = useCallback(() => {
    setLocError(null);
    setLocLoading(true);
    if (!navigator.geolocation) {
      setLocError('Geolocation not available.');
      setLocLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        setLocLoading(false);
        const suburb = await reverseGeocode(loc.lat, loc.lng);
        setLocationSuburb(suburb);
        if (suburb) setLocInput(suburb);
      },
      (err) => {
        setLocError(`GPS error: ${err.message}`);
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, []);

  // ── Find stations ────────────────────────────────────────────────────────
  const findStations = useCallback(async () => {
    if (!location) {
      getLocation();
      return;
    }
    if (!selectedVehicle) return;

    setHasSearched(true);      setStationLoading(true);
    setStationError(null);
    setStations([]);
    setNearestId(null);

    try {
      // 1. Fetch live data
        const raw = await fetchLiveStations(selectedVehicle.fuelType);
        setIsLiveData(true);

      // 2. Bounding box filter (fast), then crow-flies radius filter
      const bb = boundingBox(location.lat, location.lng, radius);
      const inBox = raw.filter(
        (s) =>
          s.lat > bb.minLat &&
          s.lat < bb.maxLat &&
          s.lng > bb.minLng &&
          s.lng < bb.maxLng &&
          haversineKm(location.lat, location.lng, s.lat, s.lng) <= radius
      );

      if (!inBox.length) {
        setStationError(
          `No ${selectedVehicle.fuelType} stations found within ${radius} km.`
        );
        setStationLoading(false);
        return;
      }

      // 3. Sort by crow-flies, take top 30 for routing
      const candidates = inBox
        .sort(
          (a, b) =>
            haversineKm(location.lat, location.lng, a.lat, a.lng) -
            haversineKm(location.lat, location.lng, b.lat, b.lng)
        )
        .slice(0, 30);

      // 4. Road distances (one OSRM table call with fallback)
      const distResults = await getRouteDistances(
        location.lat,
        location.lng,
        candidates.map((s) => ({ lat: s.lat, lng: s.lng }))
      );

      // 5. Compute costs
      const litresNeeded = selectedVehicle.tankL * (1 - fuelLevel);
      const enriched = candidates.map((s, i) => {
        const roadKm =
          distResults[i].km ??
          haversineKm(location.lat, location.lng, s.lat, s.lng) * 1.3;
        const distApprox = distResults[i].approx;
        const fillCost = litresNeeded * s.priceDPL;
        const driveCost =
          ((roadKm * 2 * selectedVehicle.consumption) / 100) * s.priceDPL;
        return {
          ...s,
          roadKm,
          distApprox,
          litresNeeded,
          fillCost,
          drivingCost: driveCost,
          totalCost: fillCost + driveCost,
        };
      });

      // 6. Find nearest (by road), sort by total cost
      const byRoad = [...enriched].sort((a, b) => a.roadKm - b.roadKm);
      const nearest = byRoad[0];
      setNearestId(nearest?.id ?? null);

      const sorted = enriched.sort((a, b) => a.totalCost - b.totalCost);
      setStations(sorted);
    } catch (err) {
      setStationError(`Error loading stations: ${err.message}`);
    } finally {
      setStationLoading(false);
    }
  }, [location, selectedVehicle, fuelLevel, radius, getLocation]);

  // ── Save token ───────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────────────────────
  const sectionLabel = {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: '8px',
  };

  const nearestStation = stations.find((s) => s.id === nearestId);
  const nearestTotalCost = nearestStation?.totalCost ?? 0;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Barlow+Condensed:wght@300;400;600;700&display=swap"
        rel="stylesheet"
      />
      <div
        style={{
          background: '#0e1117',
          minHeight: '100vh',
          color: '#f3f4f6',
          fontFamily: "'Barlow Condensed', sans-serif",
          maxWidth: '480px',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: '#0e1117',
            borderBottom: '1px solid #1f2937',
            padding: '14px 16px 10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px' }}>⛽</span>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '20px',
                  letterSpacing: '0.05em',
                  lineHeight: 1,
                }}
              >
                FUELSPY
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: '#6b7280',
                  letterSpacing: '0.1em',
                }}
              >
                QLD DIESEL TRACKER
              </div>
            </div>
            {isLiveData && (
              <div
                style={{
                  marginLeft: 'auto',
                  background: '#10b98122',
                  border: '1px solid #10b98144',
                  borderRadius: '3px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  color: '#10b981',
                  letterSpacing: '0.08em',
                }}
              >
                ● LIVE
              </div>
            )}
            {hasSearched && !isLiveData && (
              <div
                style={{
                  marginLeft: 'auto',
                  background: '#f59e0b22',
                  border: '1px solid #f59e0b44',
                  borderRadius: '3px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  color: '#f59e0b',
                  letterSpacing: '0.08em',
                }}
              >
                ⚠ MONTHLY DATA
              </div>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <TabBar tab={tab} setTab={setTab} />

        {/* Content */}
        <div style={{ padding: '16px', overflowY: 'auto' }}>
          {/* ─── FIND FUEL TAB ─────────────────────────────────────────── */}
          {tab === 'find' && (
            <div>

              {/* Location */}
              <div style={{ marginBottom: '16px' }}>
                <div style={sectionLabel}>Your Location</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={locInput}
                    onChange={(e) => setLocInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && getLocation()}
                    placeholder="Suburb or postcode…"
                    style={{
                      flex: 1,
                      background: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '4px',
                      color: '#f3f4f6',
                      padding: '10px 12px',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '15px',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={getLocation}
                    disabled={locLoading}
                    style={{
                      padding: '10px 14px',
                      background: '#f59e0b',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#0e1117',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: locLoading ? 'wait' : 'pointer',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {locLoading ? '…' : 'SEARCH'}
                  </button>
                  <button
                    onClick={getGPS}
                    title="Use GPS (requires real browser)"
                    style={{
                      padding: '10px 10px',
                      background: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '4px',
                      color: '#9ca3af',
                      fontSize: '16px',
                      cursor: 'pointer',
                    }}
                  >
                    📍
                  </button>
                </div>
                {location && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '12px',
                      color: '#10b981',
                    }}
                  >
                    ✓{' '}
                    {locationSuburb ||
                      `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
                    <button
                      onClick={() => {
                        setLocation(null);
                        setLocationSuburb(null);
                        setStations([]);
                      }}
                      style={{
                        marginLeft: '10px',
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      ✕ clear
                    </button>
                  </div>
                )}
                {locError && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#ef4444',
                      marginTop: '6px',
                    }}
                  >
                    {locError}
                  </div>
                )}
              </div>

              {/* Vehicle selector */}
              <div style={{ marginBottom: '16px' }}>
                <div style={sectionLabel}>Vehicle</div>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    overflowX: 'auto',
                    paddingBottom: '4px',
                  }}
                >
                  {vehicles.map((v) => (
                    <VehiclePill
                      key={v.id}
                      v={v}
                      selected={selectedVehicle?.id === v.id}
                      onClick={() => setSelectedVehicleId(v.id)}
                    />
                  ))}
                </div>
                {selectedVehicle && (
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '11px',
                      color: '#6b7280',
                    }}
                  >
                    Tank:{' '}
                    <span style={{ color: '#9ca3af' }}>
                      {selectedVehicle.tankL}L
                    </span>
                    &nbsp;·&nbsp;Consumption:{' '}
                    <span style={{ color: '#9ca3af' }}>
                      {selectedVehicle.consumption} L/100km
                    </span>
                    &nbsp;·&nbsp;Fuel:{' '}
                    <span style={{ color: '#9ca3af' }}>
                      {selectedVehicle.fuelType}
                    </span>
                  </div>
                )}
              </div>

              {/* Fuel level */}
              <div style={{ marginBottom: '16px' }}>
                <div style={sectionLabel}>Current Fuel Level</div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '6px',
                  }}
                >
                  {FUEL_LEVELS.map((fl) => (
                    <button
                      key={fl.value}
                      onClick={() => setFuelLevel(fl.value)}
                      style={{
                        padding: '10px 6px',
                        background:
                          fuelLevel === fl.value ? '#f59e0b' : '#1f2937',
                        border: `1px solid ${
                          fuelLevel === fl.value ? '#f59e0b' : '#374151'
                        }`,
                        borderRadius: '4px',
                        color: fuelLevel === fl.value ? '#0e1117' : '#9ca3af',
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontSize: '14px',
                        fontWeight: fuelLevel === fl.value ? 700 : 400,
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div>{fl.label}</div>
                      {selectedVehicle && (
                        <div
                          style={{
                            fontSize: '10px',
                            marginTop: '2px',
                            opacity: 0.8,
                          }}
                        >
                          {fl.value === 1
                            ? 'Full'
                            : `${(
                                selectedVehicle.tankL *
                                (1 - fl.value)
                              ).toFixed(0)}L`}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Radius */}
              <div style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <div style={sectionLabel}>Search Radius</div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '14px',
                      color: '#f59e0b',
                    }}
                  >
                    {radius} km
                  </div>
                </div>
                <input
                  type="range"
                  min="3"
                  max="50"
                  step="1"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#f59e0b' }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10px',
                    color: '#6b7280',
                  }}
                >
                  <span>3 km</span>
                  <span>50 km</span>
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#4b5563',
                    marginTop: '4px',
                  }}
                >
                  Crow-flies filter. Sorted by road distance + drive cost.
                </div>
              </div>

              {/* Find button */}
              <button
                onClick={findStations}
                disabled={stationLoading || !selectedVehicle}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: stationLoading ? '#374151' : '#f59e0b',
                  border: 'none',
                  borderRadius: '4px',
                  color: stationLoading ? '#9ca3af' : '#0e1117',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  cursor: stationLoading ? 'wait' : 'pointer',
                  marginBottom: '16px',
                }}
              >
                {stationLoading
                  ? 'FINDING STATIONS…'
                  : location
                  ? `FIND ${
                      selectedVehicle?.fuelType?.toUpperCase() || 'DIESEL'
                    } NEAR ME`
                  : 'GET LOCATION & FIND'}
              </button>

              {/* Error */}
              {stationError && (
                <div
                  style={{
                    background: '#450a0a',
                    border: '1px solid #7f1d1d',
                    borderRadius: '4px',
                    padding: '12px',
                    marginBottom: '12px',
                    fontSize: '13px',
                    color: '#fca5a5',
                  }}
                >
                  {stationError}
                </div>
              )}

              {/* Results header */}
              {stations.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <div style={sectionLabel}>
                      {stations.length} STATIONS FOUND
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>
                      {stations.some((s) => s.distApprox)
                        ? '~ = est. distance'
                        : 'Road distances'}
                    </div>
                  </div>
                  {selectedVehicle && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        marginBottom: '8px',
                      }}
                    >
                      Filling{' '}
                      <span style={{ color: '#9ca3af' }}>
                        {(selectedVehicle.tankL * (1 - fuelLevel)).toFixed(1)}L
                      </span>{' '}
                      — sorted by total cost (fill + round trip driving)
                    </div>
                  )}
                </div>
              )}

              {/* Station cards */}
              {stations.map((s, i) => (
                <StationCard
                  key={s.id}
                  s={s}
                  rank={i}
                  savings={nearestTotalCost - s.totalCost}
                  nearestId={nearestId}
                />
              ))}
            </div>
          )}

          {/* ─── GARAGE TAB ────────────────────────────────────────────── */}
          {tab === 'garage' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '18px' }}>
                  MY GARAGE
                </div>
                <button
                  onClick={() => setShowAddVehicle(!showAddVehicle)}
                  style={{
                    padding: '8px 14px',
                    background: '#f59e0b',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#0e1117',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    letterSpacing: '0.05em',
                  }}
                >
                  + ADD VEHICLE
                </button>
              </div>

              {showAddVehicle && (
                <AddVehicleForm
                  onSave={addVehicle}
                  onCancel={() => setShowAddVehicle(false)}
                />
              )}

              <div style={{ marginTop: showAddVehicle ? '16px' : '0' }}>
                {vehicles.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      background: '#111827',
                      border: `1px solid ${
                        selectedVehicle?.id === v.id ? '#f59e0b44' : '#1f2937'
                      }`,
                      borderRadius: '4px',
                      padding: '14px',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedVehicleId(v.id);
                        setTab('find');
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '16px' }}>
                        {v.year} {v.make} {v.model}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#9ca3af',
                          marginTop: '4px',
                        }}
                      >
                        {v.fuelType} · {v.tankL}L tank · {v.consumption} L/100km
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#4b5563',
                          marginTop: '3px',
                        }}
                      >
                        Max fill:{' '}
                        <span style={{ color: '#6b7280' }}>
                          {v.tankL.toFixed(0)}L ({(v.tankL * 1.82).toFixed(0)}–
                          {(v.tankL * 2.05).toFixed(0)} est. cost range)
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        alignItems: 'flex-end',
                        flexShrink: 0,
                        marginLeft: '10px',
                      }}
                    >
                      <button
                        onClick={() => {
                          setSelectedVehicleId(v.id);
                          setTab('find');

                        }}
                        style={{
                          padding: '5px 10px',
                          background: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '3px',
                          color: '#9ca3af',
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        SELECT
                      </button>
                      <button
                        onClick={() => deleteVehicle(v.id)}
                        style={{
                          padding: '5px 10px',
                          background: 'none',
                          border: '1px solid #7f1d1d44',
                          borderRadius: '3px',
                          color: '#ef444488',
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                ))}
                {vehicles.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '40px 20px',
                      color: '#6b7280',
                      fontSize: '14px',
                    }}
                  >
                    No vehicles saved.
                    <br />
                    Add one to get started.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── SETTINGS TAB ──────────────────────────────────────────── */}
          {tab === 'settings' && (
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '18px',
                  marginBottom: '20px',
                }}
              >
                SETTINGS
              </div>

              {/* Data Source */}
              <div
                style={{
                  background: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: '4px',
                  padding: '16px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#f59e0b', marginBottom: '8px' }}>
                  Data Source
                </div>
                <div style={{ padding: '12px', background: '#0e1117', borderRadius: '3px', fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>
                  <div style={{ color: '#10b981', marginBottom: '4px' }}>● Live API connected</div>
                  <div>Prices from Queensland Government Fuel Price Reporting Scheme.</div>
                  <div style={{ marginTop: '6px' }}>Updated within 30 minutes of any bowser price change.</div>
                </div>
              </div>

              {/* About */}
              <div
                style={{
                  background: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: '4px',
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '15px',
                    marginBottom: '8px',
                  }}
                >
                  About
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    Data: Queensland Government Fuel Price Reporting Scheme
                  </div>
                  <div>
                    Routing: OSRM (road distance) with haversine fallback
                  </div>
                  <div>
                    Savings calculated as: total fill cost + round-trip drive
                    cost vs. nearest servo
                  </div>
                  <div style={{ marginTop: '8px', color: '#4b5563' }}>
                    Phase 2: route-based fuel lookup (NSW FuelCheck style)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
