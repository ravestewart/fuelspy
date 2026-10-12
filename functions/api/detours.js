// POST /api/detours — detour cost for up to 25 candidate stations in one ORS matrix call (spec §4).
// Body: { legs:[{a:{lat,lng}, s:{lat,lng}, b:{lat,lng}}], avoidTolls?: boolean }
// For each leg: via = a->s + s->b, direct = a->b, extra = via - direct (clamped at 0). Null if unroutable.
const ORS_URL = 'https://api.openrouteservice.org/v2/matrix/driving-car';
const MAX_LEGS = 25;

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

  const n = legs.length;
  const ll = (p) => [p.lng, p.lat];
  const locations = [...legs.map((l) => ll(l.a)), ...legs.map((l) => ll(l.s)), ...legs.map((l) => ll(l.b))];
  const sources = [...Array(2 * n).keys()];                    // a1..an, s1..sn
  const destinations = [...Array(2 * n).keys()].map((i) => i + n); // s1..sn, b1..bn

  try {
    const res = await fetch(ORS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ORS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations, sources, destinations,
        metrics: ['distance', 'duration'],
        options: { avoid_features: body.avoidTolls ? ['ferries', 'tollways'] : ['ferries'] },
      }),
    });
    if (!res.ok) return json({ error: `ORS ${res.status}: ${(await res.text()).slice(0, 300)}` }, 502);
    const m = await res.json();
    const D = m.distances, T = m.durations;
    // Row index: source i (a_i = i, s_i = n + i). Column index: destination j (s_j = j, b_j = n + j).
    const num = (v) => (typeof v === 'number' ? v : null);
    const detours = legs.map((_, i) => {
      const as_m = num(D[i][i]), sb_m = num(D[n + i][n + i]), ab_m = num(D[i][n + i]);
      const as_s = num(T[i][i]), sb_s = num(T[n + i][n + i]), ab_s = num(T[i][n + i]);
      if ([as_m, sb_m, ab_m, as_s, sb_s, ab_s].some((v) => v === null)) return null;
      const via_m = as_m + sb_m, via_s = as_s + sb_s;
      return {
        via_m, via_s, direct_m: ab_m, direct_s: ab_s,
        extra_m: Math.max(0, via_m - ab_m), extra_s: Math.max(0, via_s - ab_s),
      };
    });
    return json({ detours });
  } catch (err) {
    return json({ error: err.message }, 502);
  }
}
