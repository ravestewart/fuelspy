import { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const OSRM_BASE = 'https://router.project-osrm.org';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

const DEFAULT_VEHICLES = [
  {
    id: 'v1',
    year: 2011,
    make: 'Ford',
    model: 'Mondeo Titanium Wagon',
    fuelType: 'Diesel',
    tankL: 70,
    consumption: 6.2,
  },
  {
    id: 'v2',
    year: 2016,
    make: 'Ford',
    model: 'Mondeo Titanium Wagon',
    fuelType: 'Diesel',
    tankL: 62.5,
    consumption: 5.3,
  },
  {
    id: 'v3',
    year: 2018,
    make: 'Nissan',
    model: 'Navara NP300 King Cab',
    fuelType: 'Diesel',
    tankL: 80,
    consumption: 7.0,
  },
];


const FUEL_TYPES = ['Diesel', 'E10', 'Unleaded 91', 'Premium 95', 'Premium 98'];

const BRAND_COLOURS = {
  bp: '#009900',
  caltex: '#c8102e',
  ampol: '#d4003c',
  shell: '#ffcf00',
  '7-eleven': '#ff6600',
  '7eleven': '#ff6600',
  united: '#0057a8',
  liberty: '#0057a8',
  puma: '#e63329',
  metro: '#9333ea',
  pearl: '#7c3aed',
  speedway: '#16a34a',
  coles: '#e11d48',
  woolworths: '#16a34a',
};


// ─────────────────────────────────────────────────────────────────────────────
// QLD POSTCODE → SUBURB LOOKUP
// Source: Australian Postcodes dataset (public domain) — 463 QLD postcodes
// ─────────────────────────────────────────────────────────────────────────────
const QLD_POSTCODES: Record<string, string> = {"4000":"Brisbane","4001":"Brisbane","4002":"Brisbane Albert Street Bc","4003":"George Street","4004":"Spring Hill","4005":"New Farm","4006":"Bowen Bridge","4007":"Ascot","4008":"Brisbane Airport","4009":"Eagle Farm","4010":"Albion","4011":"Clayfield","4012":"Nundah","4013":"Northgate","4014":"Banyo","4017":"Bracken Ridge","4018":"Fitzgibbon","4019":"Clontarf","4020":"Newport","4021":"Kippa-Ring","4022":"Rothwell","4025":"Bulwer","4029":"Royal Brisbane Hospital","4030":"Eildon Hill","4031":"Glen Kedron","4032":"Chermside","4034":"Aspley","4035":"Albany Creek","4036":"Bald Hills","4037":"Eatons Hill","4051":"Alderley","4053":"Brookside Centre","4054":"Arana Hills","4055":"Bunya","4059":"Ballymore","4060":"Ashgrove","4061":"The Gap","4064":"Baroona","4065":"Bardon","4066":"Auchenflower","4067":"Ironside","4068":"Chelmer","4069":"Brookfield","4070":"Anstead","4072":"University Of Queensland","4073":"Seventeen Mile Rocks","4074":"Jamboree Heights","4075":"Corinda","4076":"Darra","4077":"Doolandella","4078":"Ellen Grove","4101":"Highgate Hill","4102":"Buranda","4103":"Annerley","4104":"Yeronga","4105":"Clifton Hill","4106":"Brisbane Market","4107":"Salisbury","4108":"Archerfield","4109":"Altandi","4110":"Acacia Ridge","4111":"Griffith University","4112":"Kuraby","4113":"Eight Mile Plains","4114":"Kingston","4115":"Algester","4116":"Calamvale","4117":"Berrinba","4118":"Browns Plains","4119":"Underwood","4120":"Greenslopes","4121":"Ekibin","4122":"Mansfield","4123":"Priests Gully","4124":"Boronia Heights","4125":"Munruben","4127":"Chatswood Hills","4128":"Kimberley Park","4129":"Logandale","4130":"Carbrook","4131":"Loganlea","4132":"Crestmead","4133":"Chambers Flat","4151":"Coorparoo","4152":"Camp Hill","4153":"Belmont","4154":"Gumdale","4155":"Chandler","4156":"Burbank","4157":"Capalaba","4158":"Thorneside","4159":"Birkdale","4160":"Erobin","4161":"Alexandra Hills","4163":"Cleveland","4164":"Pinklands","4165":"Mount Cotton","4169":"East Brisbane","4170":"Cannon Hill","4171":"Balmoral","4172":"Murarrie","4173":"Tingalpa","4174":"Doboy","4178":"Lindum","4179":"Lota","4183":"Amity","4184":"Coochiemudlo Island","4205":"Bethania","4207":"Alberton","4208":"Burnside","4209":"Canowindra","4210":"Guanaba","4211":"Advancetown","4212":"Boykambil","4213":"Austinville","4214":"Arundel","4215":"Australia Fair","4216":"Anglers Paradise","4217":"Benowa","4218":"Broadbeach","4219":"West Burleigh","4220":"Burleigh Bc","4221":"Elanora","4222":"Griffith University","4223":"Currumbin","4224":"Tugun","4225":"Bilinga","4226":"Clear Island Waters","4227":"Reedy Creek","4228":"Ingleside","4229":"Bond University","4230":"Robina Town Centre","4270":"Tamborine","4271":"Eagle Heights","4272":"Mount Tamborine","4275":"Benobble","4280":"Flagstone","4285":"Allenview","4287":"Barney View","4300":"Augustine Heights","4301":"Collingwood Park","4303":"Dinmore","4304":"Blackstone","4305":"Basin Pocket","4306":"Amberley","4307":"Coleyville","4309":"Aratula","4310":"Allandale","4311":"Atkinsons Dam","4312":"Bryden","4313":"Biarra","4314":"Avoca Vale","4340":"Ashwell","4341":"Blenheim","4342":"Crowley Vale","4343":"Adare","4344":"Carpendale","4345":"Gatton College","4346":"Marburg","4347":"Grantham","4350":"Athol","4352":"Amiens","4353":"Bergen","4354":"Douglas","4355":"Anduramba","4356":"Bongeen","4357":"Bringalily","4358":"Cambooya","4359":"Ascot","4360":"Nobby","4361":"Back Plains","4362":"Allora","4363":"Southbrook","4364":"Brookstead","4365":"Leyburn","4370":"Allan","4371":"Emu Vale","4372":"Tannymorel","4373":"Killarney","4374":"Dalveen","4375":"Cottonvale","4376":"Thulimbah","4377":"Glen Niven","4378":"Applethorpe","4380":"Amiens","4381":"Fletcher","4382":"Ballandean","4383":"Wallangarra","4384":"Limevale","4385":"Beebo","4387":"Brush Creek","4388":"Kurumbul","4390":"Billa Billa","4400":"Kingsthorpe","4401":"Acland","4402":"Cooyar","4403":"Brymaroo","4404":"Bowenville","4405":"Beelbee","4406":"Boondandilla","4407":"Cattle Creek","4408":"Bell","4410":"Burra Burri","4411":"Tuckerang","4412":"Brigalow","4413":"Auburn","4415":"Boortkoi","4416":"Barramornie","4417":"Noorindoo","4418":"Guluguba","4419":"Bundi","4420":"Baroondah","4421":"Goranba","4422":"Coomrith","4423":"Coomrith","4424":"Drillham","4425":"Bogandilla","4426":"Jackson","4427":"Clifford","4428":"Pickanjinnie","4454":"Arcadia Valley","4455":"Angellala","4461":"Muckadilla","4462":"Amby","4465":"Bargunyah","4467":"Mungallala","4468":"Boatman","4470":"Bakers Bend","4471":"Claverton","4472":"Blackall","4474":"Adavale","4475":"Cheepie","4477":"Augathella","4478":"Bayrick","4479":"Cooladdi","4480":"Eromanga","4481":"Farrars Creek","4482":"Birdsville","4486":"Dirranbandi","4487":"Begonia","4488":"Bargunyah","4489":"Wyandra","4490":"Barringun","4491":"Eulo","4492":"Bullawarra","4493":"Hungerford","4494":"Bungunya","4496":"North Talwood","4497":"Daymar","4498":"Kioma","4500":"Bray Park","4501":"Lawnton","4502":"Frenchs Forest","4503":"Dakabin","4504":"Narangba","4505":"Burpengary","4506":"Moorina","4507":"Banksia Beach","4508":"Deception Bay","4509":"Mango Hill","4510":"Balingool","4511":"Godwin Beach","4512":"Bracalba","4513":"Corymbia","4514":"Bellthorpe","4515":"Glenfern","4516":"Elimbah","4517":"Beerburrum","4518":"Glass House Mountains","4519":"Beerwah","4520":"Armstrong Creek","4521":"Campbells Pocket","4550":"Landsborough","4551":"Aroona","4552":"Bald Knob","4553":"Diamond Valley","4554":"Eudlo","4555":"Chevallum","4556":"Buderim","4557":"Mooloolaba","4558":"Cotton Tree","4559":"Diddillibah","4560":"Bli Bli","4561":"Bridges","4562":"Belli Park","4563":"Black Mountain","4564":"Marcoola","4565":"Boreen","4566":"Munna Point","4567":"Castaways Beach","4568":"Federal","4569":"Cooran","4570":"Amamoor","4571":"Como","4572":"Alexandra Headland","4573":"Coolum Beach","4574":"Coolabine","4575":"Birtinya","4580":"Cooloola","4581":"Eurong","4600":"Black Snake","4601":"Barambah","4605":"Barlil","4606":"Chelmsford","4608":"Charlestown","4610":"Alice Creek","4611":"Marshlands","4612":"Hivesville","4613":"Abbeywood","4614":"Neumgna","4615":"Barker Creek Flat","4620":"Aramara","4621":"Biggenden","4625":"Aranbanga","4626":"Beeron","4627":"Abercorn","4630":"Bancroft","4650":"Aldershot","4655":"Booral","4659":"Beelbi Creek","4660":"Abington","4662":"Torbanlea","4670":"Abbotsford","4671":"Boolboonda","4673":"Littabella","4674":"Baffle Creek","4676":"Gindoran","4677":"Agnes Water","4678":"Bororen","4680":"Barmundu","4694":"Aldoga","4695":"Ambrose","4697":"Raglan","4699":"Bajool","4700":"Allenstown","4701":"Berserker","4702":"Alberta","4703":"Adelaide Park","4704":"Wattlebank","4705":"Clarke Creek","4706":"Ogmore","4707":"Collaroy","4709":"Tieri","4710":"Emu Park","4711":"Glendale","4712":"Duaringa","4713":"Woorabinda","4714":"Baree","4715":"Biloela","4716":"Lawgi Dawes","4717":"Blackwater","4718":"Bauhinia","4719":"Camboon","4720":"Emerald","4721":"Argyll","4722":"Albinia","4723":"Belcong","4724":"Alpha","4725":"Barcaldine","4726":"Aramac","4727":"Ilfracombe","4728":"Dunrobin","4730":"Brixton","4731":"Isisford","4732":"Muttaburra","4733":"Corfield","4735":"Diamantina Lakes","4736":"Jundah","4737":"Armstrong Beach","4738":"Ilbilbie","4739":"Carmila","4740":"Alexandra","4741":"Ball Bay","4742":"Burton","4743":"Glenden","4744":"Moranbah","4745":"Dysart","4746":"Gurrumbah","4750":"Bucasia","4751":"Greenmount","4753":"Devereux Creek","4754":"Benholme","4756":"Finch Hatton","4757":"Broken River","4798":"Calen","4799":"Bloomsbury","4800":"Andromache","4801":"Hayman Island","4802":"Airlie Beach","4803":"Hamilton Island","4804":"Collinsville","4805":"Binbee","4806":"Arkendeith","4807":"Airdmillan","4808":"Brandon","4809":"Barratta","4810":"Belgian Gardens","4811":"Cluden","4812":"Currajong","4813":"Lavarack Barracks","4814":"Aitkenvale","4815":"Condon","4816":"Alligator Creek","4817":"Alice River","4818":"Beach Holm","4819":"Arcadia","4820":"Alabama Hill","4821":"Dutton River","4822":"Albion","4823":"Carpentaria","4824":"Cloncurry","4825":"Alexandria","4828":"Camooweal","4829":"Amaroo","4830":"Augustus Downs","4849":"Cardwell","4850":"Abergowrie","4852":"Bingil Bay","4854":"Bilyana","4855":"Daveson","4856":"Goolboo","4857":"Silkwood East","4858":"Comoon Loop","4859":"No 6 Branch","4860":"Bamboo Creek","4861":"Babinda","4865":"Goldsborough","4868":"Bayview Heights","4869":"Bentley Park","4870":"Aeroglen","4871":"Abingdon Downs","4872":"Barrine","4873":"Bailey Creek","4874":"Evans Landing","4875":"Badu Island","4876":"Bamaga","4877":"Craiglie","4878":"Barron","4879":"Buchan Point","4880":"Arriga","4881":"Koah","4882":"Tolga","4883":"Atherton","4884":"Gadgarra","4885":"Butchers Creek","4886":"Beatrice","4887":"Herberton","4888":"Evelyn","4890":"Howitt","4891":"Karumba","4892":"Abingdon Downs","4895":"Ayton","9000":"Brisbane","9001":"Brisbane","9002":"Brisbane","9005":"Brisbane","9007":"Brisbane","9009":"Brisbane","9010":"Brisbane","9013":"Brisbane","9015":"Brisbane","9464":"Northgate Mc","9726":"Gold Coast Mc"};

function postcodeToSuburb(postcode: string): string {
  return QLD_POSTCODES[postcode] ?? postcode;
}

function brandColour(brand = '') {
  const b = brand.toLowerCase();
  for (const [key, col] of Object.entries(BRAND_COLOURS)) {
    if (b.includes(key)) return col;
  }
  return '#6b7280';
}

// ─────────────────────────────────────────────────────────────────────────────
// MATHS & GEO
// ─────────────────────────────────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Bounding box for a radius (km) from a centre point
function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}
// ─────────────────────────────────────────────────────────────────────────────
// MOGGILL FERRY
// Fare: $2.00/way = $4.00 return — passenger car (all three EAS vehicles <4.5t GVM)
// Source: sealink.com.au/moggill/moggill-fares/ — last verified 11 June 2026
// ⚠ REVIEW ANNUALLY
// ─────────────────────────────────────────────────────────────────────────────
const MOGGILL_FERRY_RETURN_COST = 4.00;
const MOGGILL_EMBARK  = { lat: -27.5959, lng: 152.8579 }; // Moggill side
const MOGGILL_DISEMB  = { lat: -27.5964, lng: 152.8487 }; // Riverview side
const FERRY_RELEVANCE_KM = 20; // max crow-flies km from each crossing point

function isFerryRelevant(
  originLat: number, originLng: number,
  destLat: number,
  destLng: number
): boolean {
  // Ferry helps if origin is near one bank AND destination is near the other
  const oNearMoggill   = haversineKm(originLat, originLng, MOGGILL_EMBARK.lat,  MOGGILL_EMBARK.lng)  <= FERRY_RELEVANCE_KM;
  const dNearRiverview = haversineKm(destLat,   destLng,   MOGGILL_DISEMB.lat, MOGGILL_DISEMB.lng) <= FERRY_RELEVANCE_KM;
  const oNearRiverview = haversineKm(originLat, originLng, MOGGILL_DISEMB.lat, MOGGILL_DISEMB.lng) <= FERRY_RELEVANCE_KM;
  const dNearMoggill   = haversineKm(destLat,   destLng,   MOGGILL_EMBARK.lat,  MOGGILL_EMBARK.lng)  <= FERRY_RELEVANCE_KM;
  return (oNearMoggill && dNearRiverview) || (oNearRiverview && dNearMoggill);
}

function ferryRouteKm(
  originLat: number, originLng: number,
  destLat: number,
  destLng: number
): number {
  // Drive to embarkation + crossing (0.5km) + drive from disembarkation
  const toFerry   = haversineKm(originLat, originLng, MOGGILL_EMBARK.lat,  MOGGILL_EMBARK.lng)  * 1.2;
  const fromFerry = haversineKm(MOGGILL_DISEMB.lat, MOGGILL_DISEMB.lng, destLat, destLng) * 1.2;
  return toFerry + 0.5 + fromFerry;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING — OSRM table (one call for N destinations), fallback to haversine×1.3
// ─────────────────────────────────────────────────────────────────────────────
async function getRouteDistances(
  originLat: number,
  originLng: number,
  destinations: any[]
) {
  try {
    const res = await fetch('/api/routematrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        origin: { lat: originLat, lng: originLng },
        destinations: destinations.map((d: any) => ({ lat: d.lat, lng: d.lng })),
      }),
    });

    if (!res.ok) throw new Error(`Routing proxy ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    return (data.distances as number[]).map((m: number, i: number) => ({
      km: m / 1000,
      durationMins: (data.durations as number[])[i] / 60,
      approx: false,
    }));
  } catch {
    // Fallback: haversine × 1.3, 35 km/h average
    return destinations.map((d: any) => {
      const km = haversineKm(originLat, originLng, d.lat, d.lng) * 1.3;
      return {
        km,
        durationMins: (km / 35) * 60,
        approx: true,
      };
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NOMINATIM — reverse geocode for suburb display
// ─────────────────────────────────────────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number) {
  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en-AU' },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return (
      data.address?.suburb || data.address?.town || data.address?.city || null
    );
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE API — calls Netlify proxy which reads FUELSPY_TOKEN server-side
// ─────────────────────────────────────────────────────────────────────────────
async function fetchLiveStations(fuelType: string) {
  const res = await fetch('/api/fuelproxy', { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Proxy ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  const fuelTypeMap: Record<number, string> = {};
  for (const ft of (data.fuelTypes || [])) fuelTypeMap[ft.FuelId] = ft.Name;
  const FUEL_ID_MAP: Record<string, number[]> = {
    'Diesel': [3, 14], 'E10': [12], 'Unleaded 91': [2], 'Premium 95': [5], 'Premium 98': [8],
  };
  const targetIds = FUEL_ID_MAP[fuelType] || [3];
  const seen = new Map();
  for (const s of (data.stations || [])) {
    if (!targetIds.includes(s.fuelId)) continue;
    if (seen.has(s.siteId)) continue;
    if (!s.lat || !s.lng) continue;
    seen.set(s.siteId, {
      id: s.siteId,
      name: s.name || s.brand || 'Station',
      brand: s.brand || 'Independent',
      address: s.address || '',
      suburb: postcodeToSuburb(s.postcode || '') || s.postcode || '',
      state: 'QLD',
      postcode: s.postcode || '',
      lat: s.lat,
      lng: s.lng,
      fuelType,
      priceTenths: s.price,
      priceCPL: s.price / 10,
      priceDPL: s.price / 1000,
      lastUpdate: s.lastUpdate,
    });
  }
  return Array.from(seen.values()).filter(s => !isNaN(s.lat) && !isNaN(s.lng));
}
// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function fmt$(n: number) {
  return `$${n.toFixed(2)}`;
}
function fmtCPL(n: number) {
  return `${n.toFixed(1)}¢`;
}
function fmtKm(n: number, approx: boolean) {
  return `${approx ? '~' : ''}${n.toFixed(1)} km`;
}
function fmtMins(mins: number, approx: boolean): string {
  const prefix = approx ? '~' : '';
  if (mins < 60) return `${prefix}${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${prefix}${h} hr ${m} min` : `${prefix}${h} hr`;
}
function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Australia/Brisbane',
  });
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function TabBar({ tab, setTab }) {
  const tabs = [
    { id: 'find', icon: '⛽', label: 'Find Fuel' },
    { id: 'garage', icon: '🚗', label: 'My Garage' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: '1px solid #1f2937',
        background: '#0e1117',
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            flex: 1,
            padding: '12px 4px',
            background: 'none',
            border: 'none',
            borderBottom:
              tab === t.id ? '2px solid #f59e0b' : '2px solid transparent',
            color: tab === t.id ? '#f59e0b' : '#6b7280',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          <span style={{ fontSize: '18px' }}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function VehiclePill({ v, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        background: selected ? '#f59e0b' : '#1f2937',
        border: `1px solid ${selected ? '#f59e0b' : '#374151'}`,
        borderRadius: '4px',
        color: selected ? '#0e1117' : '#d1d5db',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: '13px',
        fontWeight: selected ? 700 : 400,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {v.year} {v.make} {v.model}
    </button>
  );
}

function StationCard({ s, rank, savings, nearestId }) {
  const isNearest = s.id === nearestId;
  const isCheapest = rank === 0;
  const savingsAmt = savings;
  const col = isNearest ? '#6b7280' : savings > 0 ? '#10b981' : '#ef4444';

  return (
    <div
      style={{
        background: '#111827',
        border: `1px solid ${isCheapest ? '#f59e0b44' : '#1f2937'}`,
        borderLeft: `4px solid ${col}`,
        borderRadius: '4px',
        padding: '14px',
        marginBottom: '8px',
        position: 'relative',
      }}
    >
      {/* Rank badge */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: isCheapest ? '#f59e0b' : '#1f2937',
          color: isCheapest ? '#0e1117' : '#9ca3af',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '11px',
          fontWeight: 700,
          padding: '2px 7px',
          borderRadius: '2px',
        }}
      >
        {isCheapest ? '★ BEST' : `#${rank + 1}`}
      </div>

      {/* Station name & suburb */}
      <div
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
          fontSize: '16px',
          color: '#f3f4f6',
          paddingRight: '60px',
        }}
      >
        {s.brand}
        {isNearest && (
          <span
            style={{
              color: '#6b7280',
              fontSize: '11px',
              fontWeight: 400,
              marginLeft: '8px',
            }}
          >
            NEAREST
          </span>
        )}
      </div>
      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '1px' }}>
        {s.suburb} · {s.address}
      </div>

      {/* Price + Distance row */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginTop: '10px',
          alignItems: 'baseline',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '22px',
              fontWeight: 700,
              color: '#f59e0b',
              lineHeight: 1,
            }}
          >
            {fmtCPL(s.priceCPL)}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: '#6b7280',
              fontFamily: "'Barlow Condensed', sans-serif",
              marginTop: '1px',
            }}
          >
            {s.fuelType.toUpperCase()}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid #374151', paddingLeft: '16px' }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '16px',
              color: '#d1d5db',
              lineHeight: 1,
            }}
          >
            {fmtKm(s.roadKm, s.distApprox)}
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '13px',
              color: '#6b7280',
              lineHeight: 1,
              marginTop: '4px',
            }}
          >
            {fmtMins(s.travelMins, s.distApprox)}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: '#6b7280',
              fontFamily: "'Barlow Condensed', sans-serif",
              marginTop: '3px',
            }}
          >
            {s.distApprox ? 'EST BY ROAD' : 'BY ROAD'}
          </div>
        </div>
      </div>

      {/* Cost breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '6px',
          marginTop: '12px',
          background: '#0e1117',
          borderRadius: '3px',
          padding: '10px',
        }}
      >
        {[
          { label: 'FILL', val: fmt$(s.fillCost) },
          { label: 'DRIVE', val: fmt$(s.drivingCost) },
          { label: 'TOTAL', val: fmt$(s.totalCost), highlight: true },
        ].map(({ label, val, highlight }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '15px',
                fontWeight: highlight ? 700 : 400,
                color: highlight ? '#f3f4f6' : '#9ca3af',
              }}
            >
              {val}
            </div>
            <div
              style={{
                fontSize: '9px',
                color: '#6b7280',
                fontFamily: "'Barlow Condensed', sans-serif",
                letterSpacing: '0.08em',
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Saving vs nearest */}
      {(s as any).ferryApplies && (
        <div style={{ marginTop: '6px', fontSize: '11px', color: '#93c5fd', fontFamily: "'Barlow Condensed', sans-serif" }}>
          🚢 Via Moggill Ferry — incl. $4.00 return toll
        </div>
      )}
      {!isNearest && (
        <div
          style={{
            marginTop: '4px',
            fontSize: '12px',
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >
          {savingsAmt > 0 ? (
            <span style={{ color: '#10b981' }}>
              ▲ Save {fmt$(savingsAmt)} vs nearest servo
            </span>
          ) : (
            <span style={{ color: '#ef4444' }}>
              ▼ {fmt$(Math.abs(savingsAmt))} more than nearest servo
            </span>
          )}
        </div>
      )}

      {/* Last updated + Directions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
        <div style={{ fontSize: '10px', color: '#4b5563', fontFamily: "'Barlow Condensed', sans-serif" }}>
          Price last changed {fmtDate(s.lastUpdate)} AEST
        </div>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '4px 10px',
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '3px',
            color: '#9ca3af',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textDecoration: 'none',
            whiteSpace: 'nowrap' as const,
          }}
        >
          🗺 DIRECTIONS
        </a>
      </div>
    </div>
  );
}

function AddVehicleForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    year: '',
    make: '',
    model: '',
    fuelType: 'Diesel',
    tankL: '',
    consumption: '',
  });
  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid =
    form.year && form.make && form.model && form.tankL && form.consumption;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#0e1117',
    border: '1px solid #374151',
    borderRadius: '3px',
    color: '#f3f4f6',
    padding: '8px 10px',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        background: '#111827',
        border: '1px solid #374151',
        borderRadius: '4px',
        padding: '16px',
        marginTop: '12px',
      }}
    >
      <div
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
          color: '#f59e0b',
          fontSize: '14px',
          marginBottom: '12px',
          letterSpacing: '0.08em',
        }}
      >
        ADD VEHICLE
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}
      >
        {[
          { k: 'year', label: 'Year', type: 'number', placeholder: '2018' },
          { k: 'make', label: 'Make', type: 'text', placeholder: 'Nissan' },
        ].map(({ k, label, type, placeholder }) => (
          <div key={k}>
            <label
              style={{
                display: 'block',
                fontSize: '10px',
                color: '#6b7280',
                fontFamily: "'Barlow Condensed', sans-serif",
                marginBottom: '3px',
                letterSpacing: '0.08em',
              }}
            >
              {label.toUpperCase()}
            </label>
            <input
              type={type}
              placeholder={placeholder}
              value={form[k]}
              onChange={set(k)}
              style={inputStyle}
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop: '8px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '10px',
            color: '#6b7280',
            fontFamily: "'Barlow Condensed', sans-serif",
            marginBottom: '3px',
            letterSpacing: '0.08em',
          }}
        >
          MODEL
        </label>
        <input
          type="text"
          placeholder="Navara NP300 King Cab"
          value={form.model}
          onChange={set('model')}
          style={inputStyle}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '8px',
          marginTop: '8px',
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '10px',
              color: '#6b7280',
              fontFamily: "'Barlow Condensed', sans-serif",
              marginBottom: '3px',
              letterSpacing: '0.08em',
            }}
          >
            FUEL TYPE
          </label>
          <select
            value={form.fuelType}
            onChange={set('fuelType')}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {FUEL_TYPES.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '10px',
              color: '#6b7280',
              fontFamily: "'Barlow Condensed', sans-serif",
              marginBottom: '3px',
              letterSpacing: '0.08em',
            }}
          >
            TANK (L)
          </label>
          <input
            type="number"
            placeholder="80"
            value={form.tankL}
            onChange={set('tankL')}
            style={inputStyle}
          />
        </div>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '10px',
              color: '#6b7280',
              fontFamily: "'Barlow Condensed', sans-serif",
              marginBottom: '3px',
              letterSpacing: '0.08em',
            }}
          >
            L/100km
          </label>
          <input
            type="number"
            placeholder="7.0"
            step="0.1"
            value={form.consumption}
            onChange={set('consumption')}
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <button
          disabled={!valid}
          onClick={() =>
            onSave({
              id: uid(),
              year: parseInt(form.year),
              make: form.make,
              model: form.model,
              fuelType: form.fuelType,
              tankL: parseFloat(form.tankL),
              consumption: parseFloat(form.consumption),
            })
          }
          style={{
            flex: 1,
            padding: '10px',
            background: valid ? '#f59e0b' : '#374151',
            border: 'none',
            borderRadius: '3px',
            color: valid ? '#0e1117' : '#6b7280',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            fontSize: '13px',
            cursor: valid ? 'pointer' : 'not-allowed',
            letterSpacing: '0.08em',
          }}
        >
          SAVE VEHICLE
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: '1px solid #374151',
            borderRadius: '3px',
            color: '#9ca3af',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function FuelSpy() {
  const [tab, setTab] = useState('find');
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [fuelLevel, setFuelLevel] = useState(0.5);
  const [radius, setRadius] = useState(15);
  const [location, setLocation] = useState(null);
  const [locationSuburb, setLocationSuburb] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState(null);
  const [locInput, setLocInput] = useState('');
  const [stations, setStations] = useState([]);
  const [stationLoading, setStationLoading] = useState(false);
  const [stationError, setStationError] = useState(null);
  const [isLiveData, setIsLiveData] = useState(false);  const [hasSearched, setHasSearched] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [storageReady, setStorageReady] = useState(true);
  const [nearestId, setNearestId] = useState(null);
  const [allowFerry, setAllowFerry] = useState(false);

  const selectedVehicle =
    vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0];

  // ── Load from storage on mount ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        // Garage
        try {
          const g = await Promise.resolve(
            localStorage.getItem('fuelspy-garage')
              ? { value: localStorage.getItem('fuelspy-garage') }
              : null
          );
          if (g) {
            const saved = JSON.parse(g.value);
            if (saved?.vehicles?.length) {
              setVehicles(saved.vehicles);
              setSelectedVehicleId(saved.vehicles[0].id);
            } else throw new Error('empty');
          } else throw new Error('no data');
        } catch {
          setVehicles(DEFAULT_VEHICLES);
          setSelectedVehicleId(DEFAULT_VEHICLES[0].id);
          localStorage.setItem(
            'fuelspy-garage',
            JSON.stringify({ vehicles: DEFAULT_VEHICLES })
          );
        }


        // Settings
        try {
          const s = await Promise.resolve(
            localStorage.getItem('fuelspy-settings')
              ? { value: localStorage.getItem('fuelspy-settings') }
              : null
          );
          if (s?.value) {
            const settings = JSON.parse(s.value);
            if (settings.radius) setRadius(settings.radius);
            if (settings.fuelLevel) setFuelLevel(settings.fuelLevel);
          }
        } catch {}
      } finally {
        setStorageReady(true);
      }
    })();
  }, []);

  // ── Persist garage ───────────────────────────────────────────────────────
  const saveGarage = async (newVehicles: any[]) => {
    setVehicles(newVehicles);
    try {
      localStorage.setItem(
        'fuelspy-garage',
        JSON.stringify({ vehicles: newVehicles })
      );
    } catch {}
  };

  const deleteVehicle = async (id: string) => {
    const updated = vehicles.filter((v) => v.id !== id);
    await saveGarage(updated);
    if (selectedVehicleId === id) setSelectedVehicleId(updated[0]?.id ?? null);
  };

  const addVehicle = async (v: any) => {
    const updated = [...vehicles, v];
    await saveGarage(updated);
    setShowAddVehicle(false);
  };

  // ── Persist settings ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!storageReady) return;
    localStorage.setItem(
      'fuelspy-settings',
      JSON.stringify({ radius, fuelLevel })
    );
  }, [radius, fuelLevel, storageReady]);

  // ── Geocode suburb/postcode input via Nominatim ──────────────────────────
  const getLocation = useCallback(async () => {
    const query = locInput.trim();
    if (!query) {
      setLocError('Enter a suburb or postcode first.');
      return;
    }
    setLocError(null);
    setLocLoading(true);
    try {
      const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(
        query + ', Queensland, Australia'
      )}&format=json&limit=1&countrycodes=au`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en-AU', 'User-Agent': 'FuelSpy/1.0' },
      });
      const results = await res.json();
      if (!results.length) throw new Error(`No results found for "${query}"`);
      const loc = {
        lat: parseFloat(results[0].lat),
        lng: parseFloat(results[0].lon),
      };
      setLocation(loc);
      // Use the display name to extract suburb
      const parts = results[0].display_name.split(',');
      setLocationSuburb(parts[0].trim());
    } catch (err) {
      setLocError(err.message);
    } finally {
      setLocLoading(false);
    }
  }, [locInput]);

  // ── GPS fallback (works outside artifact sandbox) ─────────────────────────
  const getGPS = useCallback(() => {
    setLocError(null);
    setLocLoading(true);
    if (!navigator.geolocation) {
      setLocError('Geolocation not available.');
      setLocLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(loc);
        setLocLoading(false);
        const suburb = await reverseGeocode(loc.lat, loc.lng);
        setLocationSuburb(suburb);
        if (suburb) setLocInput(suburb);
      },
      (err) => {
        setLocError(`GPS error: ${err.message}`);
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, []);

  // ── Find stations ────────────────────────────────────────────────────────
  const findStations = useCallback(async () => {
    if (!location) {
      getLocation();
      return;
    }
    if (!selectedVehicle) return;

    setHasSearched(true);      setStationLoading(true);
    setStationError(null);
    setStations([]);
    setNearestId(null);

    try {
      // 1. Fetch live data
        const raw = await fetchLiveStations(selectedVehicle.fuelType);
        setIsLiveData(true);

      // 2. Bounding box filter (fast), then crow-flies radius filter
      const bb = boundingBox(location.lat, location.lng, radius);
      const inBox = raw.filter(
        (s) =>
          s.lat > bb.minLat &&
          s.lat < bb.maxLat &&
          s.lng > bb.minLng &&
          s.lng < bb.maxLng &&
          haversineKm(location.lat, location.lng, s.lat, s.lng) <= radius
      );

      if (!inBox.length) {
        setStationError(
          `No ${selectedVehicle.fuelType} stations found within ${radius} km.`
        );
        setStationLoading(false);
        return;
      }

      // 3. Sort by crow-flies, take top 30 for routing
      const candidates = inBox
        .sort(
          (a, b) =>
            haversineKm(location.lat, location.lng, a.lat, a.lng) -
            haversineKm(location.lat, location.lng, b.lat, b.lng)
        )
        .slice(0, 30);

      // 4. Road distances (one OSRM table call with fallback)
      const distResults = await getRouteDistances(
        location.lat,
        location.lng,
        candidates.map((s) => ({ lat: s.lat, lng: s.lng }))
      );

      // 5. Compute costs
      const litresNeeded = selectedVehicle.tankL * (1 - fuelLevel);
      const enriched = candidates.map((s, i) => {
        const roadKm    = distResults[i].km ?? haversineKm(location.lat, location.lng, s.lat, s.lng) * 1.3;
        const distApprox = distResults[i].approx;
        const travelMins = distResults[i].durationMins ?? (roadKm / 35) * 60;
        const fillCost   = litresNeeded * s.priceDPL;

        // Ferry cost override
        const ferryApplies = allowFerry && isFerryRelevant(location.lat, location.lng, s.lat, s.lng);
        const effectiveKm  = ferryApplies ? ferryRouteKm(location.lat, location.lng, s.lat, s.lng) : roadKm;
        const ferryCost    = ferryApplies ? MOGGILL_FERRY_RETURN_COST : 0;
        const driveCost    = ((effectiveKm * 2 * selectedVehicle.consumption) / 100) * s.priceDPL + ferryCost;

        return {
          ...s,
          roadKm: effectiveKm,
          distApprox: ferryApplies ? false : distApprox,
          travelMins,
          litresNeeded,
          fillCost,
          drivingCost: driveCost,
          ferryApplies,
          totalCost: fillCost + driveCost,
        };
      });

      // 6. Find nearest (by road), sort by total cost
      const byRoad = [...enriched].sort((a, b) => a.roadKm - b.roadKm);
      const nearest = byRoad[0];
      setNearestId(nearest?.id ?? null);

      const sorted = enriched.sort((a, b) => a.totalCost - b.totalCost);
      setStations(sorted);
    } catch (err) {
      setStationError(`Error loading stations: ${err.message}`);
    } finally {
      setStationLoading(false);
    }
  }, [location, selectedVehicle, fuelLevel, radius, allowFerry, getLocation]);

  // ── Save token ───────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // STYLES
  // ─────────────────────────────────────────────────────────────────────────
  const sectionLabel = {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: '8px',
  };

  const nearestStation = stations.find((s) => s.id === nearestId);
  const nearestTotalCost = nearestStation?.totalCost ?? 0;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Barlow+Condensed:wght@300;400;600;700&display=swap"
        rel="stylesheet"
      />
      <div
        style={{
          background: '#0e1117',
          minHeight: '100vh',
          color: '#f3f4f6',
          fontFamily: "'Barlow Condensed', sans-serif",
          maxWidth: '480px',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: '#0e1117',
            borderBottom: '1px solid #1f2937',
            padding: '14px 16px 10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px' }}>⛽</span>
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '20px',
                  letterSpacing: '0.05em',
                  lineHeight: 1,
                }}
              >
                FUELSPY
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: '#6b7280',
                  letterSpacing: '0.1em',
                }}
              >
                QLD DIESEL TRACKER
              </div>
            </div>
            {isLiveData && (
              <div
                style={{
                  marginLeft: 'auto',
                  background: '#10b98122',
                  border: '1px solid #10b98144',
                  borderRadius: '3px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  color: '#10b981',
                  letterSpacing: '0.08em',
                }}
              >
                ● LIVE
              </div>
            )}
            {hasSearched && !isLiveData && (
              <div
                style={{
                  marginLeft: 'auto',
                  background: '#f59e0b22',
                  border: '1px solid #f59e0b44',
                  borderRadius: '3px',
                  padding: '3px 8px',
                  fontSize: '10px',
                  color: '#f59e0b',
                  letterSpacing: '0.08em',
                }}
              >
                ⚠ MONTHLY DATA
              </div>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <TabBar tab={tab} setTab={setTab} />

        {/* Content */}
        <div style={{ padding: '16px', overflowY: 'auto' }}>
          {/* ─── FIND FUEL TAB ─────────────────────────────────────────── */}
          {tab === 'find' && (
            <div>

              {/* Location */}
              <div style={{ marginBottom: '16px' }}>
                <div style={sectionLabel}>Your Location</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={locInput}
                    onChange={(e) => setLocInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && getLocation()}
                    placeholder="Suburb or postcode…"
                    style={{
                      flex: 1,
                      background: '#111827',
                      border: '1px solid #374151',
                      borderRadius: '4px',
                      color: '#f3f4f6',
                      padding: '10px 12px',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: '15px',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={getLocation}
                    disabled={locLoading}
                    style={{
                      padding: '10px 14px',
                      background: '#f59e0b',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#0e1117',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: locLoading ? 'wait' : 'pointer',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {locLoading ? '…' : 'SEARCH'}
                  </button>
                  <button
                    onClick={getGPS}
                    title="Use GPS (requires real browser)"
                    style={{
                      padding: '10px 10px',
                      background: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '4px',
                      color: '#9ca3af',
                      fontSize: '16px',
                      cursor: 'pointer',
                    }}
                  >
                    📍
                  </button>
                </div>
                {location && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '12px',
                      color: '#10b981',
                    }}
                  >
                    ✓{' '}
                    {locationSuburb ||
                      `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
                    <button
                      onClick={() => {
                        setLocation(null);
                        setLocationSuburb(null);
                        setStations([]);
                      }}
                      style={{
                        marginLeft: '10px',
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      ✕ clear
                    </button>
                  </div>
                )}
                {locError && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#ef4444',
                      marginTop: '6px',
                    }}
                  >
                    {locError}
                  </div>
                )}
              </div>

              {/* Vehicle selector */}
              <div style={{ marginBottom: '16px' }}>
                <div style={sectionLabel}>Vehicle</div>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    overflowX: 'auto',
                    paddingBottom: '4px',
                  }}
                >
                  {vehicles.map((v) => (
                    <VehiclePill
                      key={v.id}
                      v={v}
                      selected={selectedVehicle?.id === v.id}
                      onClick={() => setSelectedVehicleId(v.id)}
                    />
                  ))}
                </div>
                {selectedVehicle && (
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '11px',
                      color: '#6b7280',
                    }}
                  >
                    Tank:{' '}
                    <span style={{ color: '#9ca3af' }}>
                      {selectedVehicle.tankL}L
                    </span>
                    &nbsp;·&nbsp;Consumption:{' '}
                    <span style={{ color: '#9ca3af' }}>
                      {selectedVehicle.consumption} L/100km
                    </span>
                    &nbsp;·&nbsp;Fuel:{' '}
                    <span style={{ color: '#9ca3af' }}>
                      {selectedVehicle.fuelType}
                    </span>
                  </div>
                )}
              </div>

              {/* Fuel level */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={sectionLabel}>Current Fuel Level</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', color: '#f59e0b' }}>
                    {['Empty','⅛','¼','⅜','½','⅝','¾','⅞','Full'][Math.round(fuelLevel * 8)]}
                    {selectedVehicle && fuelLevel < 1 && (
                      <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '6px' }}>
                        ({(selectedVehicle.tankL * (1 - fuelLevel)).toFixed(0)}L to fill)
                      </span>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="1"
                  value={Math.round(fuelLevel * 8)}
                  onChange={(e) => setFuelLevel(Number(e.target.value) / 8)}
                  style={{ width: '100%', accentColor: '#f59e0b' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                  <span>Empty</span><span>½</span><span>Full</span>
                </div>
              </div>
              {/* Radius */}
              <div style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <div style={sectionLabel}>Search Radius</div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '14px',
                      color: '#f59e0b',
                    }}
                  >
                    {radius} km
                  </div>
                </div>
                <input
                  type="range"
                  min="3"
                  max="50"
                  step="1"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#f59e0b' }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10px',
                    color: '#6b7280',
                  }}
                >
                  <span>3 km</span>
                  <span>50 km</span>
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    color: '#4b5563',
                    marginTop: '4px',
                  }}
                >
                  Crow-flies filter. Sorted by road distance + drive cost.
                </div>
              </div>

              {/* Moggill Ferry toggle */}
              <button
                onClick={() => setAllowFerry(f => !f)}
                style={{
                  width: '100%',
                  padding: '10px',
                  marginBottom: '10px',
                  background: allowFerry ? '#1e3a5f' : '#1f2937',
                  border: `1px solid ${allowFerry ? '#3b82f6' : '#374151'}`,
                  borderRadius: '4px',
                  color: allowFerry ? '#93c5fd' : '#6b7280',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                  textAlign: 'left' as const,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>🚢 Moggill Ferry</span>
                <span style={{
                  background: allowFerry ? '#3b82f6' : '#374151',
                  color: allowFerry ? '#fff' : '#9ca3af',
                  padding: '2px 10px',
                  borderRadius: '3px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                }}>
                  {allowFerry ? 'ALLOW' : 'AVOID'}
                </span>
              </button>
              {/* Find button */}
              <button
                onClick={findStations}
                disabled={stationLoading || !selectedVehicle}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: stationLoading ? '#374151' : '#f59e0b',
                  border: 'none',
                  borderRadius: '4px',
                  color: stationLoading ? '#9ca3af' : '#0e1117',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  cursor: stationLoading ? 'wait' : 'pointer',
                  marginBottom: '16px',
                }}
              >
                {stationLoading
                  ? 'FINDING STATIONS…'
                  : location
                  ? `FIND ${
                      selectedVehicle?.fuelType?.toUpperCase() || 'DIESEL'
                    } NEAR ME`
                  : 'GET LOCATION & FIND'}
              </button>

              {/* Error */}
              {stationError && (
                <div
                  style={{
                    background: '#450a0a',
                    border: '1px solid #7f1d1d',
                    borderRadius: '4px',
                    padding: '12px',
                    marginBottom: '12px',
                    fontSize: '13px',
                    color: '#fca5a5',
                  }}
                >
                  {stationError}
                </div>
              )}

              {/* Results header */}
              {stations.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <div style={sectionLabel}>
                      {stations.length} STATIONS FOUND
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>
                      {stations.some((s) => s.distApprox)
                        ? '~ = est. distance'
                        : 'Road distances'}
                    </div>
                  </div>
                  {selectedVehicle && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        marginBottom: '8px',
                      }}
                    >
                      Filling{' '}
                      <span style={{ color: '#9ca3af' }}>
                        {(selectedVehicle.tankL * (1 - fuelLevel)).toFixed(1)}L
                      </span>{' '}
                      — sorted by total cost (fill + round trip driving)
                    </div>
                  )}
                </div>
              )}

              {/* Station cards */}
              {stations.map((s, i) => (
                <StationCard
                  key={s.id}
                  s={s}
                  rank={i}
                  savings={nearestTotalCost - s.totalCost}
                  nearestId={nearestId}
                />
              ))}
            </div>
          )}

          {/* ─── GARAGE TAB ────────────────────────────────────────────── */}
          {tab === 'garage' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '18px' }}>
                  MY GARAGE
                </div>
                <button
                  onClick={() => setShowAddVehicle(!showAddVehicle)}
                  style={{
                    padding: '8px 14px',
                    background: '#f59e0b',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#0e1117',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    letterSpacing: '0.05em',
                  }}
                >
                  + ADD VEHICLE
                </button>
              </div>

              {showAddVehicle && (
                <AddVehicleForm
                  onSave={addVehicle}
                  onCancel={() => setShowAddVehicle(false)}
                />
              )}

              <div style={{ marginTop: showAddVehicle ? '16px' : '0' }}>
                {vehicles.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      background: '#111827',
                      border: `1px solid ${
                        selectedVehicle?.id === v.id ? '#f59e0b44' : '#1f2937'
                      }`,
                      borderRadius: '4px',
                      padding: '14px',
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedVehicleId(v.id);
                        setTab('find');
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '16px' }}>
                        {v.year} {v.make} {v.model}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#9ca3af',
                          marginTop: '4px',
                        }}
                      >
                        {v.fuelType} · {v.tankL}L tank · {v.consumption} L/100km
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#4b5563',
                          marginTop: '3px',
                        }}
                      >
                        Max fill:{' '}
                        <span style={{ color: '#6b7280' }}>
                          {v.tankL.toFixed(0)}L ({(v.tankL * 1.82).toFixed(0)}–
                          {(v.tankL * 2.05).toFixed(0)} est. cost range)
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        alignItems: 'flex-end',
                        flexShrink: 0,
                        marginLeft: '10px',
                      }}
                    >
                      <button
                        onClick={() => {
                          setSelectedVehicleId(v.id);
                          setTab('find');

                        }}
                        style={{
                          padding: '5px 10px',
                          background: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '3px',
                          color: '#9ca3af',
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        SELECT
                      </button>
                      <button
                        onClick={() => deleteVehicle(v.id)}
                        style={{
                          padding: '5px 10px',
                          background: 'none',
                          border: '1px solid #7f1d1d44',
                          borderRadius: '3px',
                          color: '#ef444488',
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                ))}
                {vehicles.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '40px 20px',
                      color: '#6b7280',
                      fontSize: '14px',
                    }}
                  >
                    No vehicles saved.
                    <br />
                    Add one to get started.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── SETTINGS TAB ──────────────────────────────────────────── */}
          {tab === 'settings' && (
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '18px',
                  marginBottom: '20px',
                }}
              >
                SETTINGS
              </div>

              {/* Data Source */}
              <div
                style={{
                  background: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: '4px',
                  padding: '16px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#f59e0b', marginBottom: '8px' }}>
                  Data Source
                </div>
                <div style={{ padding: '12px', background: '#0e1117', borderRadius: '3px', fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>
                  <div style={{ color: '#10b981', marginBottom: '4px' }}>● Live API connected</div>
                  <div>Prices from Queensland Government Fuel Price Reporting Scheme.</div>
                  <div style={{ marginTop: '6px' }}>Updated within 30 minutes of any bowser price change.</div>
                </div>
              </div>

              {/* About */}
              <div
                style={{
                  background: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: '4px',
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '15px',
                    marginBottom: '8px',
                  }}
                >
                  About
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    Data: Queensland Government Fuel Price Reporting Scheme
                  </div>
                  <div>
                    Routing: OSRM (road distance) with haversine fallback
                  </div>
                  <div>
                    Savings calculated as: total fill cost + round-trip drive
                    cost vs. nearest servo
                  </div>
                  <div style={{ marginTop: '8px', color: '#4b5563' }}>
                    Phase 2: route-based fuel lookup (NSW FuelCheck style)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
