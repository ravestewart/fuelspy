// POST /api/route — full driving route via openrouteservice directions (spec §3).
// Body: { origin:{lat,lng}, destination:{lat,lng}, avoidTolls?: boolean }
// Returns { distance_m, duration_s, geometry:[[lng,lat],...], steps:[{name,distance_m,duration_s,way_points}],
//           tollways:[[from,to,0|1],...], attribution }
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
const ATTRIBUTION = '© openrouteservice by HeiGIT | Data from OpenStreetMap';
const MAX_STRAIGHT_KM = 5000;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

function validPoint(p) {
  return p && typeof p.lat === 'number' && typeof p.lng === 'number' &&
    p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180;
}

function straightKm(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function onRequestPost(context) {
  const ORS_TOKEN = context.env.ORS_TOKEN;
  if (!ORS_TOKEN) return json({ error: 'ORS token not configured' }, 500);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid request body' }, 400); }
  const { origin, destination, avoidTolls } = body || {};
  if (!validPoint(origin) || !validPoint(destination)) return json({ error: 'origin and destination need numeric lat and lng' }, 400);
  if (straightKm(origin, destination) > MAX_STRAIGHT_KM) return json({ error: 'route too long' }, 400);

  try {
    const res = await fetch(ORS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ORS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
        instructions: true,
        extra_info: ['tollways'],
        units: 'm',
        options: { avoid_features: avoidTolls ? ['ferries', 'tollways'] : ['ferries'] },
      }),
    });
    if (!res.ok) return json({ error: `ORS ${res.status}: ${(await res.text()).slice(0, 300)}` }, 502);
    const data = await res.json();
    const f = data.features && data.features[0];
    if (!f) return json({ error: 'ORS returned no route' }, 502);
    const props = f.properties || {};
    const seg = (props.segments && props.segments[0]) || {};
    return json({
      distance_m: props.summary ? props.summary.distance : seg.distance,
      duration_s: props.summary ? props.summary.duration : seg.duration,
      geometry: f.geometry.coordinates,
      steps: (seg.steps || []).map((s) => ({ name: s.name || '', distance_m: s.distance, duration_s: s.duration, way_points: s.way_points })),
      tollways: (props.extras && props.extras.tollways && props.extras.tollways.values) || [],
      attribution: ATTRIBUTION,
    });
  } catch (err) {
    return json({ error: err.message }, 502);
  }
}
