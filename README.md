# FuelSpy

Dave Stewart's Queensland fuel-price app: the cheapest fuel near you (Find), the cheapest stop along a trip (Trip), station discounts, and a vehicle garage. Live at https://fuelspy-103.pages.dev — installable to a phone home screen.

## How it is built

- Front end: React + Vite, in `src/` (`App.tsx` main screens, `Trip.tsx` fuel along the way, `Discounts.tsx` station discounts, `geo.ts` the route, detour and discount maths).
- Server: Cloudflare Pages Functions in `functions/api/`:
  - `fuelproxy` — all QLD station prices from the Queensland Fuel Price Reporting API (cached 5 minutes).
  - `routematrix` — road distance and time from one point to many servos (openrouteservice).
  - `route` — the full driving route between two points, with named steps and toll sections (openrouteservice).
  - `detours` — the extra time and distance of stopping at each candidate servo (openrouteservice).
  - `_middleware` — only FuelSpy's own pages may call these from a browser.
- Secrets, held in Cloudflare (Workers & Pages → fuelspy → Settings → Variables and Secrets), never in code: `FUELSPY_TOKEN` and `ORS_TOKEN`. Both Production and Preview need both.

## Making a change

1. Work on a branch. Cloudflare builds every branch to its own preview address (`<branch>.fuelspy-103.pages.dev`).
2. Test on the preview, including on a phone.
3. Merge to `main`: that goes live.
4. To undo: in Cloudflare, Deployments → the previous production deployment → "Rollback to this deployment"; or revert the merge on `main`.

Build locally: `npm ci && npm run build`. Unit checks for the maths: `node --experimental-strip-types scripts/check-geo.mjs`.

## Routing service

openrouteservice (HeiGIT), on the free Standard plan. Its daily and per-minute limits for Directions and Matrix are on the plans page: https://account.heigit.org/info/plans. Each `/api/detours` response reports `orsCalls`, the matrix calls it used. The terms (https://account.heigit.org/info/tos) require results to show "© openrouteservice by HeiGIT | Data from OpenStreetMap" (Settings tab and Trip results).
