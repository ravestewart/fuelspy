const API_HOST = 'https://fppdirectapi-prod.fuelpricesqld.com.au';

function toArray(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') {
    for (const key of Object.keys(val)) {
      if (Array.isArray(val[key])) return val[key];
    }
  }
  return [];
}

export async function onRequest(context) {
  const TOKEN = context.env.FUELSPY_TOKEN;
  if (!TOKEN) {
    return new Response(JSON.stringify({ error: 'API token not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const headers = {
    'Authorization': `FPDAPI SubscriberToken=${TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    const [sitesRes, pricesRes, fuelTypesRes, brandsRes] = await Promise.all([
      fetch(`${API_HOST}/Subscriber/GetFullSiteDetails?countryId=21&geoRegionLevel=3&geoRegionId=1`, { headers }),
      fetch(`${API_HOST}/Price/GetSitesPrices?countryId=21&geoRegionLevel=3&geoRegionId=1`, { headers }),
      fetch(`${API_HOST}/Subscriber/GetCountryFuelTypes?countryId=21`, { headers }),
      fetch(`${API_HOST}/Subscriber/GetCountryBrands?countryId=21`, { headers })
    ]);

    if (!sitesRes.ok) throw new Error(`Sites API ${sitesRes.status}`);
    if (!pricesRes.ok) throw new Error(`Prices API ${pricesRes.status}`);

    const sitesRaw = await sitesRes.json();
    const pricesRaw = await pricesRes.json();
    const fuelRaw = fuelTypesRes.ok ? await fuelTypesRes.json() : {};
    const brandsRaw = brandsRes.ok ? await brandsRes.json() : {};

    const sitesArr = toArray(sitesRaw.S ?? sitesRaw);
    const pricesArr = toArray(pricesRaw.SitePrices ?? pricesRaw);
    const fuelArr = toArray(fuelRaw);
    const brandsArr = toArray(brandsRaw);

    const siteMap = {};
    for (const s of sitesArr) siteMap[s.SiteId] = s;

    const brandMap = {};
    for (const b of brandsArr) brandMap[b.BrandId] = b.Name;

    const stations = [];
    for (const p of pricesArr) {
      if (p.Price === 9999) continue;
      const site = siteMap[p.SiteId];
      if (!site || !site.Lat || !site.Lng) continue;
      stations.push({
        siteId: p.SiteId,
        fuelId: p.FuelId,
        price: p.Price,
        lastUpdate: p.TransactionDateUtc,
        name: site.Name,
        address: site.Address,
        postcode: site.Postcode,
        lat: site.Lat,
        lng: site.Lng,
        brand: brandMap[site.BrandId] ?? 'Independent'
      });
    }

    return new Response(JSON.stringify({ stations, fuelTypes: fuelArr, timestamp: new Date().toISOString() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
