// Live currency→INR rate cache (1-hour TTL, keyed by currency code)
const _rateCache = new Map();
const _rateTTL = 3_600_000;

async function toInr(amount, currency) {
  if (!amount) return 0;
  if (currency === 'INR') return Math.round(parseFloat(amount));
  const cached = _rateCache.get(currency);
  if (cached && Date.now() - cached.fetchedAt < _rateTTL) {
    return Math.round(parseFloat(amount) * cached.rate);
  }
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=INR`);
    const data = await res.json();
    const rate = data.rates?.INR ?? 100;
    _rateCache.set(currency, { rate, fetchedAt: Date.now() });
    return Math.round(parseFloat(amount) * rate);
  } catch {
    _rateCache.set(currency, { rate: 100, fetchedAt: Date.now() });
    return Math.round(parseFloat(amount) * 100);
  }
}

const DUFFEL_TOKEN = process.env.DUFFEL_TOKEN || '';
const DUFFEL_BASE  = 'https://api.duffel.com';

function duffelHeaders() {
  return {
    Authorization: `Bearer ${DUFFEL_TOKEN}`,
    'Duffel-Version': 'v2',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

// Common city → IATA code lookup (avoids an extra API call for popular routes)
const CITY_TO_IATA = {
  // India
  mumbai: 'BOM', bombay: 'BOM',
  delhi: 'DEL', 'new delhi': 'DEL',
  bangalore: 'BLR', bengaluru: 'BLR', bengalore: 'BLR',
  chennai: 'MAA', madras: 'MAA',
  kolkata: 'CCU', calcutta: 'CCU',
  hyderabad: 'HYD',
  goa: 'GOI',
  pune: 'PNQ',
  ahmedabad: 'AMD',
  jaipur: 'JAI',
  kochi: 'COK', cochin: 'COK',
  lucknow: 'LKO',
  amritsar: 'ATQ',
  varanasi: 'VNS',
  srinagar: 'SXR',
  indore: 'IDR',
  bhopal: 'BHO',
  nagpur: 'NAG',
  bhubaneswar: 'BBI',
  thiruvananthapuram: 'TRV', trivandrum: 'TRV',
  coimbatore: 'CJB',
  // International
  dubai: 'DXB',
  'abu dhabi': 'AUH',
  sharjah: 'SHJ',
  singapore: 'SIN',
  bangkok: 'BKK',
  london: 'LHR',
  'new york': 'JFK',
  paris: 'CDG',
  tokyo: 'NRT',
  sydney: 'SYD',
  toronto: 'YYZ',
  amsterdam: 'AMS',
  frankfurt: 'FRA',
  'hong kong': 'HKG',
  'kuala lumpur': 'KUL',
  doha: 'DOH',
  istanbul: 'IST',
  rome: 'FCO',
  barcelona: 'BCN',
  berlin: 'BER',
  madrid: 'MAD',
  zurich: 'ZRH',
  vienna: 'VIE',
  brussels: 'BRU',
  milan: 'MXP',
  manchester: 'MAN',
  'los angeles': 'LAX',
  chicago: 'ORD',
  miami: 'MIA',
  'san francisco': 'SFO',
  seattle: 'SEA',
  boston: 'BOS',
  dallas: 'DFW',
  washington: 'IAD',
  atlanta: 'ATL',
  houston: 'IAH',
  vancouver: 'YVR',
  montreal: 'YUL',
  melbourne: 'MEL',
  auckland: 'AKL',
  johannesburg: 'JNB',
  cairo: 'CAI',
  nairobi: 'NBO',
  'mexico city': 'MEX',
  'sao paulo': 'GRU',
  'buenos aires': 'EZE',
  riyadh: 'RUH',
  muscat: 'MCT',
  colombo: 'CMB',
  kathmandu: 'KTM',
  dhaka: 'DAC',
  lahore: 'LHE',
  karachi: 'KHI',
  islamabad: 'ISB',
  beijing: 'PEK',
  shanghai: 'PVG',
  seoul: 'ICN',
  osaka: 'KIX',
  taipei: 'TPE',
  jakarta: 'CGK',
  manila: 'MNL',
  'ho chi minh': 'SGN', 'ho chi minh city': 'SGN',
  hanoi: 'HAN',
  kuala: 'KUL',
};

function cityToIata(query) {
  const q = query.trim().toLowerCase();
  if (q.length <= 4 && /^[A-Z]+$/i.test(q)) return q.toUpperCase(); // already IATA
  return CITY_TO_IATA[q] || null;
}

export async function searchAirports(query) {
  const iata = cityToIata(query);
  if (iata) return { airports: [{ iataCode: iata, name: query, city: query }] };

  try {
    const qs = new URLSearchParams({ name: query });
    const res = await fetch(`${DUFFEL_BASE}/air/airports?${qs}`, { headers: duffelHeaders() });
    if (!res.ok) return { airports: [], error: `API error ${res.status}` };
    const data = await res.json();
    const airports = (data.data || []).slice(0, 5).map(a => ({
      iataCode: a.iata_code,
      name: a.name,
      city: a.city?.name || a.city_name || a.name,
    }));
    return { airports };
  } catch (err) {
    return { airports: [], error: err.message };
  }
}

function parseDuration(isoDuration) {
  if (!isoDuration) return '';
  const d = parseInt((isoDuration.match(/(\d+)D/) || [])[1] || '0', 10);
  const h = parseInt((isoDuration.match(/(\d+)H/) || [])[1] || '0', 10);
  const m = parseInt((isoDuration.match(/(\d+)M/) || [])[1] || '0', 10);
  const totalH = d * 24 + h;
  if (totalH && m) return `${totalH}h ${m}m`;
  if (totalH)      return `${totalH}h`;
  if (m)           return `${m}m`;
  return '';
}

function fmtDT(dt) {
  if (!dt) return { date: '', time: '' };
  const d = new Date(dt);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const time = d.toTimeString().slice(0, 5);
  return { date, time };
}

export async function searchFlights(origin, destination, departureDate, returnDate, adults = 1, cabinClass = 'economy') {
  // Resolve city names to IATA codes in case the AI skips search_airports
  const originCode = cityToIata(origin) || origin.toUpperCase();
  const destCode   = cityToIata(destination) || destination.toUpperCase();

  const slices = [{ origin: originCode, destination: destCode, departure_date: departureDate }];
  if (returnDate) slices.push({ origin: destCode, destination: originCode, departure_date: returnDate });

  const passengers = Array.from({ length: Number(adults) || 1 }, () => ({ type: 'adult' }));

  const body = {
    data: {
      slices,
      passengers,
      cabin_class: cabinClass || 'economy',
    },
  };

  console.log('[searchFlights] request:', JSON.stringify({ origin: originCode, destination: destCode, departureDate, returnDate, adults, cabinClass }));

  const res = await fetch(`${DUFFEL_BASE}/air/offer_requests`, {
    method: 'POST',
    headers: duffelHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.errors?.[0]?.message || err.error?.message || `API error ${res.status}`;
    console.error('[searchFlights] error:', msg);
    return { flights: [], error: msg };
  }

  const data = await res.json();
  const offers = data.data?.offers || [];
  console.log(`[searchFlights] offers received: ${offers.length}`);

  if (offers.length === 0) return { flights: [], message: 'No flights found for these dates. Try adjusting your dates or route.' };

  // Sort cheapest first, take top 8
  const sorted = [...offers]
    .sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount))
    .slice(0, 8);

  const flights = await Promise.all(sorted.map(async offer => {
    const outSlice = offer.slices?.[0];
    const firstSeg = outSlice?.segments?.[0];
    const lastSeg  = outSlice?.segments?.[outSlice.segments.length - 1];
    const stops    = Math.max(0, (outSlice?.segments?.length || 1) - 1);

    const dep = fmtDT(firstSeg?.departing_at);
    const arr = fmtDT(lastSeg?.arriving_at);

    const amountInr = await toInr(offer.total_amount, offer.total_currency);

    return {
      offerId:         offer.id,
      airline:         offer.owner?.name || firstSeg?.marketing_carrier?.name || 'Unknown',
      airlineCode:     offer.owner?.iata_code || firstSeg?.marketing_carrier?.iata_code || '',
      origin:          outSlice?.origin?.iata_code || origin,
      destination:     outSlice?.destination?.iata_code || destination,
      originName:      outSlice?.origin?.name || '',
      destinationName: outSlice?.destination?.name || '',
      departure:       dep,
      arrival:         arr,
      duration:        parseDuration(outSlice?.duration || firstSeg?.duration),
      stops,
      amount:          amountInr,
      currency:        'INR',
      cabinClass:      cabinClass || 'economy',
      passengerIds:    offer.passengers?.map(p => p.id) || [],
    };
  }));

  return { flights };
}

const MONTH_MAP = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};

function parseFriendlyDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.trim().split(' ');
  if (parts.length === 2) {
    const day   = parseInt(parts[0], 10);
    const month = MONTH_MAP[parts[1]];
    if (!isNaN(day) && month !== undefined) {
      const today = new Date();
      let year = today.getFullYear();
      const candidate = new Date(year, month, day);
      if (candidate < today) candidate.setFullYear(year + 1);
      return candidate.toISOString().split('T')[0];
    }
  }
  return null;
}

async function _refreshOfferFromMeta(flightMeta, guestInfo) {
  const parts = (flightMeta?.route || '').split(' to ');
  const origin      = parts[0]?.trim().toUpperCase();
  const destination = parts[1]?.trim().toUpperCase();
  const departDate  = parseFriendlyDate(flightMeta?.departureDate);
  if (!origin || !destination || !departDate) return null;

  const guestList      = Array.isArray(guestInfo) ? guestInfo : [guestInfo];
  const passengerTypes = guestList.map(g => dobToPassengerType(g.dob));
  const cabin          = flightMeta?.cabinClass || 'economy';

  const reqRes = await fetch(`${DUFFEL_BASE}/air/offer_requests`, {
    method:  'POST',
    headers: duffelHeaders(),
    body:    JSON.stringify({
      data: {
        slices:      [{ origin, destination, departure_date: departDate }],
        passengers:  passengerTypes.map(type => ({ type })),
        cabin_class: cabin,
      },
    }),
  });
  if (!reqRes.ok) return null;

  const reqData = await reqRes.json();
  const offers  = reqData.data?.offers || [];
  if (offers.length === 0) return null;

  const airlineName = (flightMeta?.airline || '').toLowerCase();
  const best = offers.find(o => o.owner?.name?.toLowerCase() === airlineName)
    || [...offers].sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount))[0];

  return { offerId: best.id, passengerIds: best.passengers?.map(p => p.id) || [] };
}

async function _refreshOffer(expiredOffer) {
  const slice = expiredOffer.slices?.[0];
  if (!slice) return null;

  const origin      = slice.origin?.iata_code;
  const destination = slice.destination?.iata_code;
  const departDate  = slice.segments?.[0]?.departing_at?.split('T')[0];
  if (!origin || !destination || !departDate) return null;

  const adults = (expiredOffer.passengers || []).filter(p => p.type === 'adult').length || 1;

  // Derive cabin class from the marketing name in the first segment
  const mktName  = slice.segments?.[0]?.passengers?.[0]?.cabin_class_marketing_name?.toLowerCase() || '';
  const cabinMap = { 'premium economy': 'premium_economy', 'business': 'business', 'first': 'first' };
  const cabin    = cabinMap[mktName] || 'economy';

  const body = {
    data: {
      slices:      [{ origin, destination, departure_date: departDate }],
      passengers:  Array.from({ length: adults }, () => ({ type: 'adult' })),
      cabin_class: cabin,
    },
  };

  const res = await fetch(`${DUFFEL_BASE}/air/offer_requests`, {
    method: 'POST', headers: duffelHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) return null;

  const data  = await res.json();
  const offers = data.data?.offers || [];
  if (offers.length === 0) return null;

  const best = [...offers].sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount))[0];
  return { offerId: best.id, passengerIds: best.passengers?.map(p => p.id) || [] };
}

function dobToPassengerType(dob) {
  if (!dob) return 'adult';
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  if (age < 2) return 'infant_without_seat';
  if (age < 18) return 'child';
  return 'adult';
}

async function _createOfferWithTypes(offer, passengerTypes) {
  const slice = offer.slices?.[0];
  const origin      = slice?.origin?.iata_code;
  const destination = slice?.destination?.iata_code;
  const departDate  = slice?.segments?.[0]?.departing_at?.split('T')[0];
  if (!origin || !destination || !departDate) return null;

  const mktName  = slice?.segments?.[0]?.passengers?.[0]?.cabin_class_marketing_name?.toLowerCase() || '';
  const cabinMap = { 'premium economy': 'premium_economy', business: 'business', first: 'first' };
  const cabin    = cabinMap[mktName] || 'economy';

  const reqRes = await fetch(`${DUFFEL_BASE}/air/offer_requests`, {
    method: 'POST',
    headers: duffelHeaders(),
    body: JSON.stringify({
      data: {
        slices:      [{ origin, destination, departure_date: departDate }],
        passengers:  passengerTypes.map(type => ({ type })),
        cabin_class: cabin,
      },
    }),
  });
  if (!reqRes.ok) return null;

  const reqData = await reqRes.json();
  const offers  = reqData.data?.offers || [];
  if (offers.length === 0) return null;

  const origAirline = offer.owner?.iata_code;
  const best = offers.find(o => o.owner?.iata_code === origAirline)
    || [...offers].sort((a, b) => parseFloat(a.total_amount) - parseFloat(b.total_amount))[0];

  return { offerId: best.id, passengerIds: best.passengers?.map(p => p.id) || [] };
}

// _depth: 0 = first attempt, 1 = after type fix, 2 = final retry (no more retries)
export async function createFlightOrder(offerId, passengerIds, guestInfo, _depth = 0, flightMeta = null) {
  const offerRes = await fetch(`${DUFFEL_BASE}/air/offers/${offerId}`, { headers: duffelHeaders() });
  if (!offerRes.ok) {
    if (_depth < 2 && flightMeta) {
      console.log('[createFlightOrder] offer fetch failed, refreshing from meta');
      const refreshed = await _refreshOfferFromMeta(flightMeta, guestInfo);
      if (refreshed) {
        return createFlightOrder(refreshed.offerId, refreshed.passengerIds, guestInfo, _depth + 1, null);
      }
    }
    return { error: 'Could not retrieve flight offer. It may have expired — please search again.' };
  }

  const offerData = await offerRes.json();
  const offer = offerData.data;

  const guestList    = Array.isArray(guestInfo) ? guestInfo : [guestInfo];
  const neededTypes  = guestList.map(g => dobToPassengerType(g.dob));
  const offerTypes   = (offer.passengers || []).map(p => p.type);
  const typesMismatch = neededTypes.some((t, i) => t !== (offerTypes[i] || 'adult'));

  // Re-create offer with correct passenger types (only on first attempt)
  if (typesMismatch && _depth === 0) {
    console.log('[createFlightOrder] passenger type mismatch, re-creating offer with types:', neededTypes);
    const retyped = await _createOfferWithTypes(offer, neededTypes);
    if (retyped) {
      return createFlightOrder(retyped.offerId, retyped.passengerIds, guestInfo, 1, flightMeta);
    }
  }

  const canonicalIds = offer.passengers?.map(p => p.id) || [...new Set(passengerIds)];

  const passengers = canonicalIds.map((id, idx) => {
    const g = guestList[idx] || guestList[0];
    const gender = g.gender || (['ms', 'mrs', 'miss'].includes((g.title || '').toLowerCase()) ? 'f' : 'm');
    return {
      id,
      title:        (g.title || 'mr').toLowerCase(),
      gender,
      given_name:   g.firstName,
      family_name:  g.lastName,
      born_on:      g.dob,
      email:        g.email,
      phone_number: g.phone,
    };
  });

  const body = {
    data: {
      selected_offers: [offerId],
      passengers,
      payments: [{
        type:     'balance',
        currency: offer.total_currency,
        amount:   offer.total_amount,
      }],
    },
  };

  const res = await fetch(`${DUFFEL_BASE}/air/orders`, {
    method: 'POST',
    headers: duffelHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.errors?.[0]?.message || data.error?.message || `API error ${res.status}`;
    console.error('[createFlightOrder] error:', msg);

    if (_depth < 2 && /offer|availability|select another/i.test(msg)) {
      console.log('[createFlightOrder] availability error, refreshing offer (depth', _depth, '):', msg);
      const refreshed = await _refreshOffer(offer);
      if (refreshed) {
        return createFlightOrder(refreshed.offerId, refreshed.passengerIds, guestInfo, _depth + 1, flightMeta);
      }
    }

    if (/same name/i.test(msg)) {
      return { error: 'We were unable to complete this booking. Please try selecting a different flight.' };
    }

    return { error: msg };
  }

  const order = data.data;
  const slice = order.slices?.[0];
  const firstSeg = slice?.segments?.[0];
  const lastSeg  = slice?.segments?.[slice.segments.length - 1];
  const amountInr = await toInr(order.total_amount, order.total_currency);

  return {
    bookingReference: order.booking_reference,
    orderId:          order.id,
    airline:          order.owner?.name || '',
    origin:           slice?.origin?.iata_code || '',
    destination:      slice?.destination?.iata_code || '',
    departureAt:      firstSeg?.departing_at || '',
    arrivalAt:        lastSeg?.arriving_at || '',
    passengerName:    `${guestList[0].firstName} ${guestList[0].lastName}`,
    totalAmount:      amountInr,
    currency:         'INR',
  };
}
