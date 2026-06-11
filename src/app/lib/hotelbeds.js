import crypto from 'crypto';

// Live EUR→INR rate, cached for 1 hour
let _eurInrRate = null;
let _eurInrFetched = 0;
async function getEurToInrRate() {
  if (_eurInrRate && Date.now() - _eurInrFetched < 3_600_000) return _eurInrRate;
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=INR');
    const data = await res.json();
    _eurInrRate = data.rates?.INR ?? 90;
  } catch {
    _eurInrRate = 90; // fallback if exchange API is unreachable
  }
  _eurInrFetched = Date.now();
  return _eurInrRate;
}

const API_KEY    = process.env.HOTELBEDS_API_KEY    || '';
const SECRET     = process.env.HOTELBEDS_SECRET     || '';
const BASE_URL   = process.env.HOTELBEDS_BASE_URL   || 'https://api.test.hotelbeds.com';

// Module-level image cache — populated during searchHotels, read by getHotelImages.
// Both routes run in the same Next.js process so the cache persists between requests.
const _imageCache = new Map();

function getHeaders() {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHash('sha256').update(API_KEY + SECRET + timestamp).digest('hex');
  return {
    'Api-key': API_KEY,
    'X-Signature': signature,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function searchHotels(destinationCode, checkIn, checkOut, adults = 2, currency = 'INR') {
  const body = {
    stay: { checkIn, checkOut },
    occupancies: [{ rooms: 1, adults, children: 0 }],
    destination: { code: destinationCode },
    currency,
  };

  const res = await fetch(`${BASE_URL}/hotel-api/1.0/hotels`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { hotels: [], error: err.error?.message || err.message || `API error ${res.status}` };
  }
  const data = await res.json();
  if (!data.hotels?.hotels) return { hotels: [], message: 'No hotels found' };

  const hotelList = data.hotels.hotels.slice(0, 10);
  const apiCurrency = data.hotels.currency || data.hotels.hotels[0]?.currency || 'EUR';
  const codes = hotelList.map(h => h.code).join(',');

  // Run exchange-rate lookup and content fetch (facilities + images) in parallel
  const [rate, facilitiesMap] = await Promise.all([
    apiCurrency === 'EUR' ? getEurToInrRate() : Promise.resolve(1),
    (async () => {
      const map = {};
      try {
        const qs = new URLSearchParams({ codes, fields: 'facilities,images', language: 'ENG', from: '1', to: String(hotelList.length) });
        const res = await fetch(`${BASE_URL}/hotel-content-api/1.0/hotels?${qs}`, { headers: getHeaders() });
        if (res.ok) {
          (await res.json()).hotels?.forEach(h => {
            const codeStr = String(h.code);
            map[codeStr] = (h.facilities || []).slice(0, 8).map(f => f.facilityName?.content).filter(Boolean);

            // Build image URLs and populate the module-level cache
            const images = h.images || [];
            const sorted = [...images].sort((a, b) => {
              if (a.imageTypeCode === 'GEN' && b.imageTypeCode !== 'GEN') return -1;
              if (b.imageTypeCode === 'GEN' && a.imageTypeCode !== 'GEN') return 1;
              return (a.visualOrder || 99) - (b.visualOrder || 99);
            });
            const seen = new Set();
            const urls = [];
            for (const img of sorted) {
              if (!img.path || seen.has(img.path)) continue;
              seen.add(img.path);
              // path may or may not already include a size prefix — normalise to avoid doubling
              const cleanPath = img.path.replace(/^(small|medium|bigger|xl|xxl)\//, '');
              urls.push(`https://photos.hotelbeds.com/giata/bigger/${cleanPath}`);
              if (urls.length === 5) break;
            }
            _imageCache.set(codeStr, urls);
            console.log(`[searchHotels] hotel ${codeStr}: ${urls.length} images cached`);
            if (urls[0]) console.log(`[searchHotels] sample URL:`, urls[0]);
          });
        }
      } catch (err) {
        console.error('[searchHotels] content fetch error:', err.message);
      }
      return map;
    })(),
  ]);
  const displayCurrency = apiCurrency === 'EUR' ? 'INR' : apiCurrency;

  return {
    hotels: hotelList.map(h => ({
      code: h.code,
      name: h.name,
      categoryName: h.categoryName,
      minRate: rate !== 1 ? Math.round(h.minRate * rate) : h.minRate,
      currency: displayCurrency,
      rateKey: h.rooms?.[0]?.rates?.[0]?.rateKey,
      facilities: facilitiesMap[String(h.code)] || [],
    })),
  };
}

export async function getHotelDetails(hotelCode) {
  const qs = new URLSearchParams({ codes: hotelCode, fields: 'all', language: 'ENG', from: '1', to: '1' });
  const res = await fetch(`${BASE_URL}/hotel-content-api/1.0/hotels?${qs}`, {
    headers: getHeaders(),
  });

  if (!res.ok) return { error: `API error ${res.status}` };
  const data = await res.json();
  const h = data.hotels?.[0];
  if (!h) return { error: 'Hotel not found' };

  return {
    name: h.name?.content,
    description: h.description?.content,
    address: h.address?.content,
    phone: h.phones?.[0]?.phoneNumber,
    facilities: h.facilities?.slice(0, 10).map(f => f.facilityName?.content).filter(Boolean),
  };
}

// Hotelbeds country codes for common regions — used to narrow destination search
const COUNTRY_HINTS = {
  india: 'IN', mumbai: 'IN', delhi: 'IN', bangalore: 'IN', bengaluru: 'IN',
  goa: 'IN', chennai: 'IN', kolkata: 'IN', hyderabad: 'IN', jaipur: 'IN',
  usa: 'US', 'new york': 'US', 'los angeles': 'US', chicago: 'US',
  uk: 'GB', london: 'GB', manchester: 'GB',
  france: 'FR', paris: 'FR',
  thailand: 'TH', bangkok: 'TH', phuket: 'TH',
  indonesia: 'ID', bali: 'ID',
  uae: 'AE', dubai: 'AE',
};

function guessCountryCode(query) {
  const q = query.toLowerCase();
  for (const [keyword, code] of Object.entries(COUNTRY_HINTS)) {
    if (q.includes(keyword)) return code;
  }
  return null;
}

export async function searchDestinations(query) {
  const countryCode = guessCountryCode(query);

  // Try country-scoped search first (much smaller result set, faster, more accurate)
  if (countryCode) {
    const { destinations, error } = await fetchDestinations({ countryCodes: countryCode, from: 1, to: 500 });
    if (error) return { destinations: [], error };
    const matches = filterDestinations(destinations, query);
    if (matches.length > 0) return { destinations: matches };
  }

  // Fallback: broad search across first 2000 destinations
  const { destinations, error } = await fetchDestinations({ from: 1, to: 2000 });
  if (error) return { destinations: [], error };
  return { destinations: filterDestinations(destinations, query) };
}

async function fetchDestinations(params) {
  const qs = new URLSearchParams({ fields: 'all', language: 'ENG', ...params });
  const url = `${BASE_URL}/hotel-content-api/1.0/locations/destinations?${qs}`;
  const res = await fetch(url, { headers: getHeaders() });
  console.log(`[fetchDestinations] ${res.status} ${url}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.error?.message || body.message || `HTTP ${res.status}`;
    console.error('[fetchDestinations] error body:', JSON.stringify(body));
    return { destinations: [], error: res.status === 403 ? 'API quota exceeded for today — try again tomorrow' : msg };
  }
  const data = await res.json();
  return { destinations: data.destinations || [] };
}

function destName(d) {
  if (typeof d.name === 'string') return d.name;
  if (Array.isArray(d.name)) return d.name[0]?.content || '';
  if (d.name && typeof d.name === 'object') return d.name.content || '';
  return '';
}

function filterDestinations(list, query) {
  const q = query.toLowerCase();
  // Strip "airport" / "near" noise words for matching
  const stripped = q.replace(/\b(airport|near|hotels?|in)\b/g, '').trim();
  return list
    .filter(d => {
      const name = destName(d).toLowerCase();
      const iso = typeof d.isoCode === 'string' ? d.isoCode.toLowerCase() : '';
      return name.includes(stripped) || name.includes(q) || iso.includes(stripped);
    })
    .slice(0, 5)
    .map(d => ({ code: d.code, name: destName(d), countryCode: d.countryCode }));
}

export async function checkRate(rateKey) {
  const body = { rooms: [{ rateKey }] };

  const res = await fetch(`${BASE_URL}/hotel-api/1.0/checkrates`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: err.error?.message || err.message || `API error ${res.status}` };
  }
  const data = await res.json();
  const room = data.hotel?.rooms?.[0];
  if (!room) return { error: 'Rate not found' };

  const rateData = room.rates?.[0];
  const apiCurrency = data.hotel.currency || 'EUR';
  const fxRate = apiCurrency === 'EUR' ? await getEurToInrRate() : 1;
  const displayCurrency = apiCurrency === 'EUR' ? 'INR' : apiCurrency;

  return {
    hotelName: data.hotel.name,
    net: fxRate !== 1 ? Math.round(parseFloat(rateData?.net) * fxRate) : rateData?.net,
    currency: displayCurrency,
    cancellationPolicies: rateData?.cancellationPolicies,
  };
}

export async function createBooking({ rateKey, holderName, holderSurname, email, phone, clientReference }) {
  const body = {
    holder: { name: holderName, surname: holderSurname },
    rooms: [
      {
        rateKey,
        paxes: [{ roomId: 1, type: 'AD', name: holderName, surname: holderSurname }],
      },
    ],
    clientReference: clientReference || `BOT-${Date.now()}`,
    remark: `Contact: ${email} | ${phone}`,
  };

  const res = await fetch(`${BASE_URL}/hotel-api/1.0/bookings`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error?.message || data.message || `API error ${res.status}` };
  }

  const booking = data.booking;
  const apiCurrency = booking?.currency || 'EUR';
  const fxRate = apiCurrency === 'EUR' ? await getEurToInrRate() : 1;
  const displayCurrency = apiCurrency === 'EUR' ? 'INR' : apiCurrency;

  return {
    bookingReference: booking?.reference,
    status: booking?.status,
    hotelName: booking?.hotel?.name,
    checkIn: booking?.hotel?.checkIn,
    checkOut: booking?.hotel?.checkOut,
    totalNet: fxRate !== 1 ? Math.round(parseFloat(booking?.totalNet) * fxRate) : booking?.totalNet,
    currency: displayCurrency,
    holderName: `${booking?.holder?.name} ${booking?.holder?.surname}`,
    cancellationPolicies: booking?.hotel?.rooms?.[0]?.rates?.[0]?.cancellationPolicies,
  };
}

/* Returns up to 5 photo URLs per hotel code.
   Images are pre-cached during searchHotels, so this is usually a synchronous cache lookup. */
export async function getHotelImages(codes) {
  const codeList = codes.split(',').map(c => c.trim()).filter(Boolean);
  const result = {};
  const missing = [];

  for (const code of codeList) {
    if (_imageCache.has(code)) {
      result[code] = _imageCache.get(code);
    } else {
      missing.push(code);
    }
  }
  console.log(`[getHotelImages] cache hit: ${codeList.length - missing.length}/${codeList.length}, missing: ${missing.length}`);

  if (missing.length === 0) return result;

  // Fallback: fetch any codes that weren't in the cache
  try {
    const missingStr = missing.join(',');
    const qs = new URLSearchParams({ codes: missingStr, fields: 'images', language: 'ENG', from: '1', to: String(missing.length) });
    const url = `${BASE_URL}/hotel-content-api/1.0/hotels?${qs}`;
    console.log('[getHotelImages] fallback fetch:', url);
    const res = await fetch(url, { headers: getHeaders() });
    console.log('[getHotelImages] fallback status:', res.status);
    if (!res.ok) {
      const body = await res.text();
      console.error('[getHotelImages] fallback error:', body.slice(0, 300));
      return result;
    }
    const data = await res.json();
    console.log('[getHotelImages] fallback hotels:', data.hotels?.length);
    if (data.hotels?.[0]?.images?.[0]) {
      console.log('[getHotelImages] sample image object:', JSON.stringify(data.hotels[0].images[0]));
    }
    (data.hotels || []).forEach(h => {
      const images = h.images || [];
      const sorted = [...images].sort((a, b) => {
        if (a.imageTypeCode === 'GEN' && b.imageTypeCode !== 'GEN') return -1;
        if (b.imageTypeCode === 'GEN' && a.imageTypeCode !== 'GEN') return 1;
        return (a.visualOrder || 99) - (b.visualOrder || 99);
      });
      const seen = new Set();
      const urls = [];
      for (const img of sorted) {
        if (!img.path || seen.has(img.path)) continue;
        seen.add(img.path);
        const cleanPath = img.path.replace(/^(small|medium|bigger|xl|xxl)\//, '');
        urls.push(`https://photos.hotelbeds.com/giata/bigger/${cleanPath}`);
        if (urls.length === 5) break;
      }
      const codeStr = String(h.code);
      result[codeStr] = urls;
      _imageCache.set(codeStr, urls);
    });
  } catch (err) {
    console.error('[getHotelImages] fallback exception:', err.message);
  }
  return result;
}
