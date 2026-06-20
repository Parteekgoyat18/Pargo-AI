import crypto from 'crypto';

let _eurInrRate = null;
let _eurInrFetched = 0;
async function getEurToInrRate() {
  if (_eurInrRate && Date.now() - _eurInrFetched < 3_600_000) return _eurInrRate;
  try {
    const res  = await fetch('https://api.frankfurter.app/latest?from=EUR&to=INR');
    const data = await res.json();
    _eurInrRate = data.rates?.INR ?? 90;
  } catch {
    _eurInrRate = 90;
  }
  _eurInrFetched = Date.now();
  return _eurInrRate;
}

const TRF_KEY  = process.env.HOTELBEDS_TRANSFERS_API_KEY || '';
const TRF_SEC  = process.env.HOTELBEDS_TRANSFERS_SECRET  || '';
const BASE_URL = process.env.HOTELBEDS_BASE_URL || 'https://api.test.hotelbeds.com';

function getHeaders() {
  const ts  = Math.floor(Date.now() / 1000).toString();
  const sig = crypto.createHash('sha256').update(TRF_KEY + TRF_SEC + ts).digest('hex');
  return {
    'Api-key':      TRF_KEY,
    'X-Signature':  sig,
    'Accept':       'application/json',
    'Content-Type': 'application/json',
  };
}

export async function searchTransferLocations({ query, locationType }) {
  const params = new URLSearchParams({ language: 'en', query });
  const res = await fetch(`${BASE_URL}/transfer-api/1.0/content/destinations?${params}`, {
    headers: getHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[searchTransferLocations] error:', res.status, text.slice(0, 300));
    return { locations: [], error: `HTTP ${res.status}` };
  }

  const data = await res.json();
  const items = data.destinations || data.terminals || data.items || data.content || [];
  return {
    locationType,
    locations: items
      .filter(t => !locationType || (t.type || '').toUpperCase() === locationType)
      .slice(0, 10)
      .map(t => ({
        code:    t.code  || t.id,
        name:    t.name  || t.description || t.label,
        type:    t.type  || locationType,
        country: t.country?.name || t.countryName || '',
      })),
  };
}

export async function searchTransfers({ fromCode, fromType = 'IATA', toCode, toType = 'ATLAS', date, time, adults = 2 }) {
  const body = {
    language:  'en',
    fromCode,
    fromType,
    toCode,
    toType,
    outboundTransfer: {
      date,
      time,
      adults:   Math.max(1, adults),
      children: 0,
      infants:  0,
    },
  };

  console.log('[searchTransfers] request:', JSON.stringify(body));

  const res = await fetch(`${BASE_URL}/transfer-api/1.0/availabilities`, {
    method:  'POST',
    headers: getHeaders(),
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const rawText = await res.text();
    console.error(`[searchTransfers] HTTP ${res.status}:`, rawText.slice(0, 500));
    let errMsg = rawText.slice(0, 200);
    try {
      const err = JSON.parse(rawText);
      errMsg = err.message || err.error?.message || errMsg;
    } catch {}
    return { transfers: [], error: `HTTP ${res.status}: ${errMsg}` };
  }

  const data = await res.json();
  console.log('[searchTransfers] response top-level keys:', Object.keys(data));

  const services = data.services || data.transfers || data.content || [];
  const list = services.slice(0, 8);

  if (!list.length) return { transfers: [], message: 'No transfers found for these details.' };

  const rawCurrency =
    list[0]?.transferContent?.pricing?.totalAmount?.currency ||
    list[0]?.pricing?.currency ||
    list[0]?.currency ||
    'EUR';
  const fxRate         = rawCurrency === 'EUR' ? await getEurToInrRate() : 1;
  const displayCurrency = rawCurrency === 'EUR' ? 'INR' : rawCurrency;

  return {
    transfers: list.map(t => {
      const content  = t.transferContent || t;
      const pricing  = content.pricing || content.price || {};
      const rawAmt   =
        pricing.totalAmount?.amount ??
        pricing.amount             ??
        content.totalAmount        ??
        t.price                    ??
        0;
      return {
        id:       t.id       || content.id       || String(Date.now() + Math.random()),
        rateKey:  t.rateKey  || content.rateKey  || t.id,
        type:     content.category?.name  || content.transferType?.name || content.type || 'Shared Transfer',
        vehicle:  content.vehicle?.name   || content.vehicleName        || 'Vehicle',
        maxPax:   content.vehicle?.maxPax || content.maxPax             || adults,
        price:    fxRate !== 1 ? Math.round(parseFloat(rawAmt) * fxRate) : parseFloat(rawAmt),
        currency: displayCurrency,
        duration: content.duration || '',
        imageUrl: content.images?.[0]?.url || null,
      };
    }),
  };
}

export async function bookTransfer({ rateKey, fromCode, toCode, date, time, adults, holder, clientReference }) {
  const body = {
    language:        'en',
    clientReference: clientReference || `PARGO-TRF-${Date.now()}`,
    holder: {
      name:    holder.firstName,
      surname: holder.lastName,
      email:   holder.email,
      phone:   holder.phone || '',
    },
    transfers: [{
      rateKey,
      outboundTransfer: {
        date,
        time,
        adults:   Math.max(1, adults || 1),
        children: 0,
        infants:  0,
      },
    }],
  };

  const res = await fetch(`${BASE_URL}/transfer-api/1.0/bookings`, {
    method:  'POST',
    headers: getHeaders(),
    body:    JSON.stringify(body),
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[bookTransfer] error:', res.status, JSON.stringify(result));
    return { error: result.message || result.error?.message || `API error ${res.status}` };
  }

  const booking = result.booking || result.bookings?.[0] || result;
  const rawAmt  = booking.totalAmount?.amount ?? booking.price ?? 0;
  const rawCur  = booking.totalAmount?.currency ?? booking.currency ?? 'EUR';
  const fxRate  = rawCur === 'EUR' ? await getEurToInrRate() : 1;

  return {
    bookingReference: booking.reference || booking.id || `REF-${Date.now()}`,
    status:           booking.status    || 'CONFIRMED',
    transferType:     booking.category?.name || booking.type || 'Transfer',
    vehicleType:      booking.vehicle?.name  || 'Vehicle',
    from:             fromCode,
    to:               toCode,
    pickupDate:       date,
    pickupTime:       time,
    holderName:       `${holder.firstName} ${holder.lastName}`,
    totalAmount:      fxRate !== 1 ? Math.round(parseFloat(rawAmt) * fxRate) : parseFloat(rawAmt),
    currency:         rawCur === 'EUR' ? 'INR' : rawCur,
  };
}
