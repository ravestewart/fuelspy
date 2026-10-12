// Pure route, detour, discount and settings logic for FuelSpy v2.
// No browser or network calls here, so every function can be unit-checked with Node
// (scripts/check-geo.mjs). Spec: Documents\ABN\FuelSpy\FuelSpy_v2_ChangeSpec_2026-10-12.md.

export type LngLat = [number, number];
export type Pt = { lat: number; lng: number };

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: Pt, b: Pt): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Local flat projection (km) around a reference latitude: accurate to well under 1% at corridor scale.
function toXY(p: Pt, lat0: number): [number, number] {
  return [rad(p.lng) * Math.cos(rad(lat0)) * R_KM, rad(p.lat) * R_KM];
}

export type RouteIndex = {
  pts: Pt[];          // route vertices
  cum: number[];      // cumulative km at each vertex
  totalKm: number;
};

export function indexRoute(geometry: LngLat[]): RouteIndex {
  const pts = geometry.map(([lng, lat]) => ({ lat, lng }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversineKm(pts[i - 1], pts[i]));
  return { pts, cum, totalKm: cum[cum.length - 1] || 0 };
}

export type Projection = { distKm: number; alongKm: number; seg: number };

// F9: project a point onto every route segment (not just vertices); return the nearest.
export function projectToRoute(route: RouteIndex, p: Pt): Projection {
  const { pts, cum } = route;
  if (pts.length === 1) return { distKm: haversineKm(pts[0], p), alongKm: 0, seg: 0 };
  let best: Projection = { distKm: Infinity, alongKm: 0, seg: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const lat0 = pts[i].lat;
    const [ax, ay] = toXY(pts[i], lat0);
    const [bx, by] = toXY(pts[i + 1], lat0);
    const [px, py] = toXY(p, lat0);
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const qx = ax + t * dx, qy = ay + t * dy;
    const d = Math.hypot(px - qx, py - qy);
    if (d < best.distKm) best = { distKm: d, alongKm: cum[i] + t * (cum[i + 1] - cum[i]), seg: i };
  }
  return best;
}

// The point on the route at a given distance along it (clamped to the ends).
export function pointAt(route: RouteIndex, alongKm: number): Pt {
  const { pts, cum, totalKm } = route;
  const d = Math.max(0, Math.min(totalKm, alongKm));
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < d) i++;
  const span = cum[i + 1] - cum[i];
  const t = span > 0 ? (d - cum[i]) / span : 0;
  return { lat: pts[i].lat + t * (pts[i + 1].lat - pts[i].lat), lng: pts[i].lng + t * (pts[i + 1].lng - pts[i].lng) };
}

export type Step = { distance_m: number; duration_s: number; way_points: [number, number] };

// Speed (km per second) of the ORS step that contains route vertex index `seg`; null if unknown.
export function stepSpeedAt(steps: Step[], seg: number): number | null {
  for (const s of steps) {
    if (seg >= s.way_points[0] && seg < Math.max(s.way_points[1], s.way_points[0] + 1)) {
      return s.duration_s > 0 ? s.distance_m / 1000 / s.duration_s : null;
    }
  }
  return null;
}

// F9 window: larger of 1 km and 90 s at the local step speed, capped at 5 km.
export function windowKm(speedKmPerS: number | null): number {
  const w = speedKmPerS ? speedKmPerS * 90 : 1;
  return Math.min(5, Math.max(1, w));
}

export function abPoints(route: RouteIndex, proj: Projection, steps: Step[]): { a: Pt; b: Pt } {
  const w = windowKm(stepSpeedAt(steps, proj.seg));
  return { a: pointAt(route, proj.alongKm - w), b: pointAt(route, proj.alongKm + w) };
}

// §5.3 corridor half-width.
export function corridorHalfWidthKm(mode: 'min' | 'km', value: number): number {
  return mode === 'min' ? Math.max(1.5, value * 0.6) : Math.max(1.5, value / 2);
}

// ── Discounts (F4, §6.4) ───────────────────────────────────────────────────────
export type Discount = { siteId: number; name: string; fuelIds: 'all' | number[]; centsPerLitre: number; minSpend: number };

export function validDiscount(d: Partial<Discount>): boolean {
  const c = Number(d.centsPerLitre);
  const m = d.minSpend === undefined || (d.minSpend as unknown) === '' ? 0 : Number(d.minSpend);
  const fuelOk = d.fuelIds === 'all' || (Array.isArray(d.fuelIds) && d.fuelIds.length > 0);
  return Number.isFinite(c) && c >= 0.1 && c <= 50 && Number.isFinite(m) && m >= 0 && fuelOk && d.siteId !== undefined;
}

// One entry per station: a new entry for the same siteId replaces the old one.
export function upsertDiscount(list: Discount[], d: Discount): Discount[] {
  return [...list.filter((x) => x.siteId !== d.siteId), d];
}

// Effective $/L for a station: discount applies when the fill at pump price meets the minimum spend.
export function effectivePriceDPL(
  station: { id: number; fuelId?: number; priceDPL: number },
  litres: number,
  discounts: Discount[],
): { priceDPL: number; discountCPL: number } {
  const d = discounts.find((x) => x.siteId === station.id);
  if (!d) return { priceDPL: station.priceDPL, discountCPL: 0 };
  const fuelOk = d.fuelIds === 'all' || (station.fuelId !== undefined && d.fuelIds.includes(station.fuelId));
  const meets = litres * station.priceDPL >= (d.minSpend || 0);
  if (!fuelOk || !meets) return { priceDPL: station.priceDPL, discountCPL: 0 };
  return { priceDPL: station.priceDPL - d.centsPerLitre / 100, discountCPL: d.centsPerLitre };
}

// ── Trip ranking (F8, §5.5) ────────────────────────────────────────────────────
// Lower bound of a station's total: its fill at the effective price, zero detour.
// With a full tank (fill under 1 L) the bound is 0 for everyone, so order falls back to price.
export function lowerBound(fillLitres: number, effDPL: number): number {
  return fillLitres >= 1 ? fillLitres * effDPL : 0;
}

export type Evaluated = { id: number; total: number };

// Should evaluation stop before the next station? Stop once its lower bound is no less than the best total.
export function shouldStop(nextLowerBound: number, bestTotal: number | null, fullTank: boolean): boolean {
  if (fullTank || bestTotal === null) return false;
  return nextLowerBound >= bestTotal;
}

// Total and sort key for a station once its detour is known.
export function tripTotal(fillLitres: number, effDPL: number, extraKm: number, lPer100: number) {
  const fill = fillLitres >= 1 ? fillLitres * effDPL : 0;
  const detour = (extraKm * lPer100) / 100 * effDPL;
  return { fill, detour, total: fill + detour };
}

// Sort: by total; with a full tank, by detour cost then price (§5.5).
export function tripCompare(fullTank: boolean) {
  return (x: { total: number; detour: number; effDPL: number }, y: { total: number; detour: number; effDPL: number }) =>
    fullTank ? x.detour - y.detour || x.effDPL - y.effDPL : x.total - y.total || x.effDPL - y.effDPL;
}

// ── Settings merge (§6.4) ──────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  maxTravelMins: 15,
  fuelLevel: 0.5,
  tripDetourMode: 'min' as 'min' | 'km',
  tripDetourMins: 5,
  tripDetourKm: 3,
  tripAvoidTolls: false,
};
export type Settings = typeof DEFAULT_SETTINGS;

export function mergeSettings(stored: unknown): Settings {
  const s = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (typeof s.maxTravelMins === 'number') out.maxTravelMins = s.maxTravelMins;
  if (typeof s.fuelLevel === 'number') out.fuelLevel = s.fuelLevel;
  if (s.tripDetourMode === 'min' || s.tripDetourMode === 'km') out.tripDetourMode = s.tripDetourMode;
  if (typeof s.tripDetourMins === 'number') out.tripDetourMins = s.tripDetourMins;
  if (typeof s.tripDetourKm === 'number') out.tripDetourKm = s.tripDetourKm;
  if (typeof s.tripAvoidTolls === 'boolean') out.tripAvoidTolls = s.tripAvoidTolls;
  return out;
}

// Google Maps navigate link (Maps URLs: `avoid` accepts tolls).
export function navigateUrl(origin: Pt, dest: Pt, via: Pt, avoidTolls: boolean): string {
  const f = (p: Pt) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${f(origin)}&destination=${f(dest)}&waypoints=${f(via)}&travelmode=driving${avoidTolls ? '&avoid=tolls' : ''}`;
}
