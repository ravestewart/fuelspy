// CORS for every /api route (spec §3). The Allow-Origin header is sent only to FuelSpy's own
// addresses: the production site and its Cloudflare preview subdomains. Requests with no Origin
// (server-to-server, e.g. the eas-quote-rate skill) are answered without the header (F12).
const ALLOWED = /^https:\/\/([a-z0-9-]+\.)?fuelspy-103\.pages\.dev$/;

function corsHeaders(origin) {
  const h = { Vary: 'Origin' };
  if (origin && ALLOWED.test(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Max-Age'] = '86400';
  }
  return h;
}

export async function onRequest(context) {
  const origin = context.request.headers.get('Origin');
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  const res = await context.next();
  const out = new Response(res.body, res);
  out.headers.delete('Access-Control-Allow-Origin');
  for (const [k, v] of Object.entries(corsHeaders(origin))) out.headers.set(k, v);
  return out;
}
