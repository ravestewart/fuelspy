// Unit checks for src/geo.ts. Run: node --experimental-strip-types scripts/check-geo.mjs
import * as g from '../src/geo.ts';

let fails = 0;
const ok = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) fails++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// A straight east-west route 10 km long at Brisbane latitude, vertices every 1 km.
const lat = -27.5, lng0 = 152.9;
const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180);
const geom = Array.from({ length: 11 }, (_, i) => [lng0 + i / kmPerDegLng, lat]);
const route = g.indexRoute(geom);
ok('route length ~10 km', near(route.totalKm, 10, 0.05));

// Projection onto a segment midpoint, 0.8 km north of the 4.5 km mark
const p = { lat: lat + 0.8 / 111.2, lng: lng0 + 4.5 / kmPerDegLng };
const pr = g.projectToRoute(route, p);
ok('projection distance 0.8 km (not to a vertex)', near(pr.distKm, 0.8, 0.02));
ok('projection along 4.5 km', near(pr.alongKm, 4.5, 0.05));

// Corridor widths
ok('corridor min mode 5 min -> 3 km', g.corridorHalfWidthKm('min', 5) === 3);
ok('corridor min mode 1 min floor 1.5 km', g.corridorHalfWidthKm('min', 1) === 1.5);
ok('corridor km mode 3 km -> 1.5 km', g.corridorHalfWidthKm('km', 3) === 1.5);
ok('corridor km mode 10 km -> 5 km', g.corridorHalfWidthKm('km', 10) === 5);

// F9 window: 100 km/h step -> 2.5 km; slow step -> 1 km floor; very fast -> 5 km cap
const steps100 = [{ distance_m: 10000, duration_s: 360, way_points: [0, 10] }];
ok('window 100 km/h = 2.5 km', near(g.windowKm(g.stepSpeedAt(steps100, 3)), 2.5, 0.01));
ok('window floor 1 km', g.windowKm(10 / 3600) === 1);
ok('window cap 5 km', g.windowKm(300 / 3600) === 5);
ok('window unknown speed = 1 km', g.windowKm(null) === 1);
const ab = g.abPoints(route, pr, steps100);
ok('a is 2.5 km back', near(g.projectToRoute(route, ab.a).alongKm, 2.0, 0.05));
ok('b is 2.5 km forward', near(g.projectToRoute(route, ab.b).alongKm, 7.0, 0.05));
const prEnd = g.projectToRoute(route, { lat, lng: lng0 + 9.8 / kmPerDegLng });
const abEnd = g.abPoints(route, prEnd, steps100);
ok('b clamped to route end', near(g.projectToRoute(route, abEnd.b).alongKm, 10, 0.05));

// Discounts
const st = { id: 7, fuelId: 3, priceDPL: 2.0 };
const disc = [{ siteId: 7, name: 'Karana Downs', fuelIds: 'all', centsPerLitre: 4, minSpend: 50 }];
ok('discount applies when fill meets min spend', near(g.effectivePriceDPL(st, 30, disc).priceDPL, 1.96, 1e-9));
ok('no discount when fill below min spend', g.effectivePriceDPL(st, 20, disc).priceDPL === 2.0);
ok('no discount for other fuel', g.effectivePriceDPL(st, 30, [{ ...disc[0], fuelIds: [12] }]).discountCPL === 0);
ok('discount for listed fuel', g.effectivePriceDPL(st, 30, [{ ...disc[0], fuelIds: [3, 14] }]).discountCPL === 4);
const up = g.upsertDiscount(disc, { ...disc[0], centsPerLitre: 6 });
ok('second entry replaces first', up.length === 1 && up[0].centsPerLitre === 6);
ok('empty fuel list invalid', !g.validDiscount({ siteId: 1, fuelIds: [], centsPerLitre: 4, minSpend: 0 }));
ok('cents out of range invalid', !g.validDiscount({ siteId: 1, fuelIds: 'all', centsPerLitre: 0, minSpend: 0 }));
ok('empty min spend = 0 valid', g.validDiscount({ siteId: 1, fuelIds: 'all', centsPerLitre: 4, minSpend: '' }));

// F8 lower bound order and early stop
const lb = (litres, p) => g.lowerBound(litres, p);
ok('lower bound = fill at effective price', near(lb(40, 1.9), 76, 1e-9));
ok('stop when next bound >= best total', g.shouldStop(80, 79.5, false));
ok('continue when next bound < best total', !g.shouldStop(79, 79.5, false));
ok('never stop early with a full tank', !g.shouldStop(0, 0, true));
ok('no stop before any result', !g.shouldStop(10, null, false));
// Budget run-out: simulate 120 corridor stations, none feasible -> evaluate exactly 100 (4 x 25), label "best of 100 checked"
{
  const cands = Array.from({ length: 120 }, (_, i) => ({ id: i, bound: 70 + i * 0.01 }));
  let checked = 0, best = null, calls = 0;
  for (let i = 0; i < cands.length && calls < 4; i += 25) {
    if (g.shouldStop(cands[i].bound, best, false)) break;
    calls++;
    checked += Math.min(25, cands.length - i); // all infeasible: best stays null
  }
  const label = checked < cands.length && best === null ? `best of ${checked} checked` : '';
  ok('budget run-out evaluates 100 and labels', checked === 100 && label === 'best of 100 checked');
}

// Totals and ranking
const t = g.tripTotal(40, 1.9, 3, 10);
ok('trip total = fill + detour fuel', near(t.total, 76 + 0.57, 1e-9));
const full = [
  { id: 1, total: 0.3, detour: 0.3, effDPL: 2.0 },
  { id: 2, total: 0.3, detour: 0.3, effDPL: 1.9 },
  { id: 3, total: 0.1, detour: 0.1, effDPL: 2.1 },
].sort(g.tripCompare(true));
ok('full tank: rank by detour then price', full.map((x) => x.id).join() === '3,2,1');
ok('full tank fill is 0', g.tripTotal(0.5, 2, 1, 10).fill === 0);

// Settings merge: an old v1 object keeps its two values and gains defaults
const m = g.mergeSettings({ maxTravelMins: 30, fuelLevel: 0 });
ok('settings keep maxTravelMins', m.maxTravelMins === 30);
ok('settings keep fuelLevel 0 (falsy kept)', m.fuelLevel === 0);
ok('settings gain trip defaults', m.tripDetourMode === 'min' && m.tripDetourMins === 5 && m.tripDetourKm === 3 && m.tripAvoidTolls === false);
ok('settings ignore junk', g.mergeSettings('x').maxTravelMins === 15);

// Navigate URL
const u = g.navigateUrl({ lat: -27.5, lng: 152.9 }, { lat: -27.45, lng: 153.13 }, { lat: -27.47, lng: 153.0 }, true);
ok('navigate url has waypoint and avoid=tolls', u.includes('waypoints=-27.470000,153.000000') && u.endsWith('&avoid=tolls'));

console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
