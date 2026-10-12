// POST /api/detours — detour cost for up to 25 candidate stations in one ORS matrix call (spec §4).
// Body: { legs:[{a:{lat,lng}, s:{lat,lng}, b:{lat,lng}}], avoidTolls?: boolean }
// For each leg: via = a->s + s->b, direct = a->b, extra = via - direct (clamped at 0). Null if unroutable.
const ORS_URL = 'https://api.openrouteservice.org/v2/matrix/driving-car';
const MAX_LEGS = 25;
const MAX_ORS_CALLS = 12;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

const validPoint = (p) => p && typeof p.lat === 'number' && typeof p.lng === 'number' &&
  p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180;

export async function onRequestPost(context) {
  const ORS_TOKEN = context.env.ORS_TOKEN;
  if (!ORS_TOKEN) return json({ error: 'ORS token not configured' }, 500);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'Invalid request body' }, 400); }
  const legs = body && body.legs;
  if (!Array.isArray(legs) || legs.length < 1) return json({ error: 'legs required' }, 400);
  if (legs.length > MAX_LEGS) return json({ error: `at most ${MAX_LEGS} legs` }, 400);
  if (!legs.every((l) => l && validPoint(l.a) && validPoint(l.s) && validPoint(l.b))) return json({ error: 'each leg needs a, s and b points' }, 400);

  // ORS sometimes fails a whole matrix with code 6020 ("Search exceeds the limit of visited nodes")
  // because of one awkward point (seen near motorway tunnels). On 6020 the batch is split in half and
  // each half retried, so one bad leg costs only itself. At most MAX_ORS_CALLS matrix calls per request
  // (one bad leg in 25 takes 11 calls to isolate; ORS allows 40 a minute, so a trip that hits several bad batches can be refused and keeps what it has); legs left unresolved come back null.
  const options = { avoid_features: body.avoidTolls ? ['ferries', 'tollways'] : ['ferries'] };
  const detours = new Array(legs.length).fill(null);
  let orsCalls = 0, unresolved = 0;
  const work = [[0, legs.length]];
  try {
    while (work.length) {
      const [lo, hi] = work.shift();
      if (orsCalls >= MAX_ORS_CALLS) { unresolved += hi - lo; continue; }
      orsCalls++;
      const r = await matrix(ORS_TOKEN, legs.slice(lo, hi), options);
      if (r.ok) { r.detours.forEach((d, k) => { detours[lo + k] = d; }); continue; }
      if (r.code === 6020 && hi - lo > 1) { const mid = (lo + hi) >> 1; work.push([lo, mid], [mid, hi]); continue; }
      if (r.code === 6020) { unresolved += 1; continue; }
      return json({ error: r.error }, 502);   // anything else (quota, auth, outage) fails the request
    }
    return json({ detours, unresolved, orsCalls });
  } catch (err) {
    return json({ error: err.message }, 502);
  }
}

// One ORS matrix call for a set of legs. Locations [a..., s..., b...]; sources a,s; destinations s,b.
async function matrix(token, legs, options) {
  const n = legs.length;
  const ll = (p) => [p.lng, p.lat];
  const locations = [...legs.map((l) => ll(l.a)), ...legs.map((l) => ll(l.s)), ...legs.map((l) => ll(l.b))];
  const sources = [...Array(2 * n).keys()];                        // a1..an, s1..sn
  const destinations = [...Array(2 * n).keys()].map((i) => i + n); // s1..sn, b1..bn
  const res = await fetch(ORS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations, sources, destinations, metrics: ['distance', 'duration'], options }),
  });
  if (!res.ok) {
    const text = await res.text();
    let code = null;
    try { code = JSON.parse(text).error.code; } catch { /* not ORS JSON */ }
    return { ok: false, code, error: `ORS ${res.status}: ${text.slice(0, 300)}` };
  }
  const m = await res.json();
  const D = m.distances, T = m.durations;
  // Row: source i (a_i = i, s_i = n + i). Column: destination j (s_j = j, b_j = n + j).
  const num = (v) => (typeof v === 'number' ? v : null);
  return {
    ok: true,
    detours: legs.map((_, i) => {
      const as_m = num(D[i][i]), sb_m = num(D[n + i][n + i]), ab_m = num(D[i][n + i]);
      const as_s = num(T[i][i]), sb_s = num(T[n + i][n + i]), ab_s = num(T[i][n + i]);
      if ([as_m, sb_m, ab_m, as_s, sb_s, ab_s].some((v) => v === null)) return null;
      const via_m = as_m + sb_m, via_s = as_s + sb_s;
      return { via_m, via_s, direct_m: ab_m, direct_s: ab_s, extra_m: Math.max(0, via_m - ab_m), extra_s: Math.max(0, via_s - ab_s) };
    }),
  };
}
