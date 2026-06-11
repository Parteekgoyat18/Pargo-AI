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
  madrid: 'MXP',
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
  const h = (isoDuration.match(/(\d+)H/) || [])[1];
  const m = (isoDuration.match(/(\d+)M/) || [])[1];
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  if (m) return `${m}m`;
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
  const slices = [{ origin, destination, departure_date: departureDate }];
  if (returnDate) slices.push({ origin: destination, destination: origin, departure_date: returnDate });

  const passengers = Array.from({ length: Number(adults) || 1 }, () => ({ type: 'adult' }));

  const body = {
    data: {
      slices,
      passengers,
      cabin_class: cabinClass || 'economy',
    },
  };

  console.log('[searchFlights] request:', JSON.stringify({ origin, destination, departureDate, returnDate, adults, cabinClass }));

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

export async function createFlightOrder(offerId, passengerIds, guestInfo) {
  // Fetch current offer to get live price and currency for payment
  const offerRes = await fetch(`${DUFFEL_BASE}/air/offers/${offerId}`, { headers: duffelHeaders() });
  if (!offerRes.ok) return { error: 'Could not retrieve flight offer. It may have expired.' };

  const offerData = await offerRes.json();
  const offer = offerData.data;

  const gender = guestInfo.gender || (
    ['ms', 'mrs', 'miss'].includes((guestInfo.title || '').toLowerCase()) ? 'f' : 'm'
  );

  const passengers = passengerIds.map(id => ({
    id,
    title:       (guestInfo.title || 'mr').toLowerCase(),
    gender,
    given_name:  guestInfo.firstName,
    family_name: guestInfo.lastName,
    born_on:     guestInfo.dob,
    email:       guestInfo.email,
    phone_number: guestInfo.phone,
  }));

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
    passengerName:    `${guestInfo.firstName} ${guestInfo.lastName}`,
    totalAmount:      amountInr,
    currency:         'INR',
  };
}
