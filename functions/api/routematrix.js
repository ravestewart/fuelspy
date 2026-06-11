export async function onRequestPost(context) {
  const ORS_TOKEN = context.env.ORS_TOKEN;
  if (!ORS_TOKEN) {
    return new Response(JSON.stringify({ error: 'ORS token not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { origin, destinations } = body;
  if (!origin || !destinations?.length) {
    return new Response(JSON.stringify({ error: 'Missing origin or destinations' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const locations = [
    [origin.lng, origin.lat],
    ...destinations.map((d) => [d.lng, d.lat]),
  ];
  const destIndices = destinations.map((_, i) => i + 1);

  try {
    const orsRes = await fetch(
      'https://api.openrouteservice.org/v2/matrix/driving-car',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ORS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locations,
          sources: [0],
          destinations: destIndices,
          metrics: ['distance', 'duration'],
          options: {
            avoid_features: ['ferries', 'tollways'],
          },
        }),
      }
    );

    if (!orsRes.ok) {
      const errText = await orsRes.text();
      throw new Error(`ORS ${orsRes.status}: ${errText}`);
    }

    const data = await orsRes.json();

    return new Response(
      JSON.stringify({
        distances: data.distances[0],
        durations: data.durations[0],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
