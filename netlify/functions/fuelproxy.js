const API_HOST = 'https://fppdirectapi-prod.fuelpricesqld.com.au';

exports.handler = async () => {
  const TOKEN = process.env.FUELSPY_TOKEN;
  if (!TOKEN) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API token not configured' }),
    };
  }

  const headers = {
    Authorization: `FPDAPI SubscriberToken=${TOKEN}`,
    'Content-Type': 'application/json',
  };

  try {
    const [sitesRes, pricesRes, fuelTypesRes, brandsRes] = await Promise.all([
      fetch(
        `${API_HOST}/Subscriber/GetFullSiteDetails?countryId=21&geoRegionLevel=3&geoRegionId=1`,
        { headers }
      ),
      fetch(
        `${API_HOST}/Price/GetSitesPrices?countryId=21&geoRegionLevel=3&geoRegionId=1`,
        { headers }
      ),
      fetch(`${API_HOST}/Subscriber/GetCountryFuelTypes?countryId=21`, {
        headers,
      }),
      fetch(`${API_HOST}/Subscriber/GetCountryBrands?countryId=21`, {
        headers,
      }),
    ]);

    if (!sitesRes.ok) throw new Error(`Sites API returned ${sitesRes.status}`);
    if (!pricesRes.ok)
      throw new Error(`Prices API returned ${pricesRes.status}`);

    const sitesData = await sitesRes.json();
    const pricesData = await pricesRes.json();
    const fuelTypes = fuelTypesRes.ok ? await fuelTypesRes.json() : [];
    const brands = brandsRes.ok ? await brandsRes.json() : [];

    const siteMap = {};
    for (const s of sitesData.S || []) {
      siteMap[s.S] = s;
    }
    const brandMap = {};
    for (const b of brands) {
      brandMap[b.BrandId] = b.Name;
    }

    const stations = [];
    const prices = Array.isArray(pricesData)
      ? pricesData
      : pricesData.SitePrices || [];
    for (const p of prices) {
      if (p.Price === 9999) continue;
      const site = siteMap[p.SiteId];
      if (!site || !site.Lat || !site.Lng) continue;
      stations.push({
        siteId: p.SiteId,
        fuelId: p.FuelId,
        price: p.Price,
        lastUpdate: p.TransactionDateUtc,
        name: site.N || '',
        address: site.A || '',
        postcode: site.P || '',
        lat: site.Lat,
        lng: site.Lng,
        brand: brandMap[site.B] || 'Independent',
      });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        stations,
        fuelTypes,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
