import crypto from 'crypto';

let _eurInrRate = null;
let _eurInrFetched = 0;
async function getEurToInrRate() {
  if (_eurInrRate && Date.now() - _eurInrFetched < 3_600_000) return _eurInrRate;
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR&to=INR');
    const data = await res.json();
    _eurInrRate = data.rates?.INR ?? 90;
  } catch {
    _eurInrRate = 90;
  }
  _eurInrFetched = Date.now();
  return _eurInrRate;
}

const ACT_KEY  = process.env.HOTELBEDS_ACTIVITIES_API_KEY || '';
const ACT_SEC  = process.env.HOTELBEDS_ACTIVITIES_SECRET  || '';
const BASE_URL = process.env.HOTELBEDS_BASE_URL || 'https://api.test.hotelbeds.com';

function getHeaders() {
  const ts  = Math.floor(Date.now() / 1000).toString();
  const sig = crypto.createHash('sha256').update(ACT_KEY + ACT_SEC + ts).digest('hex');
  return {
    'Api-key':      ACT_KEY,
    'X-Signature':  sig,
    'Accept':       'application/json',
    'Content-Type': 'application/json',
  };
}

export async function searchActivities(destinationCode, dateFrom, dateTo, adults = 2) {
  const body = {
    filters:  [{ type: 'destination', value: destinationCode }],
    from:     dateFrom,
    to:       dateTo,
    paxes:    Array.from({ length: Math.max(1, adults) }, () => ({ age: 30 })),
    language: 'en',
  };

  console.log('[searchActivities] request:', JSON.stringify({ destinationCode, dateFrom, dateTo, adults, body }));

  const res = await fetch(`${BASE_URL}/activity-api/3.0/activities`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const rawText = await res.text();
    console.error(`[searchActivities] HTTP ${res.status}:`, rawText.slice(0, 500));
    let errCode = '';
    let errMsg  = '';
    try {
      const err = JSON.parse(rawText);
      errCode = err.errors?.[0]?.code || '';
      errMsg  = err.errors?.[0]?.text || err.error?.message || err.message || rawText.slice(0, 200);
    } catch {
      errMsg = rawText.slice(0, 200);
    }
    return { activities: [], error: `HTTP ${res.status} ${errCode}: ${errMsg}` };
  }

  const data = await res.json();
  const list = (data.activities || []).slice(0, 10);

  const firstCurrency = list[0]?.currency || 'EUR';
  const fxRate = firstCurrency === 'EUR' ? await getEurToInrRate() : 1;
  const displayCurrency = firstCurrency === 'EUR' ? 'INR' : firstCurrency;

  return {
    activities: list.map(a => ({
      code:        a.code,
      name:        a.name,
      description: (a.description || '').slice(0, 200),
      minAmount:   fxRate !== 1 ? Math.round((a.amountFrom || 0) * fxRate) : (a.amountFrom || 0),
      currency:    displayCurrency,
      imageUrl:    a.images?.[0]?.url || null,
      categories:  (a.categories || []).slice(0, 3).map(c => c.name || String(c)),
    })),
  };
}

export async function getActivityDetails(activityCode, dateFrom, dateTo, adults = 2) {
  const body = {
    code:     activityCode,
    from:     dateFrom,
    to:       dateTo,
    paxes:    Array.from({ length: Math.max(1, adults) }, () => ({ age: 30 })),
    language: 'en',
  };

  const res = await fetch(`${BASE_URL}/activity-api/3.0/activities/details`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[getActivityDetails] error:', res.status, JSON.stringify(err));
    return { error: err.error?.message || err.message || `API error ${res.status}` };
  }

  const data = await res.json();
  const act  = data.activity || data;

  let rateKey  = null;
  let amount   = null;
  let currency = act.currency || 'EUR';

  outer: for (const mod of (act.modalities || [])) {
    for (const rate of (mod.rates || [])) {
      if (rate.rateKey) {
        rateKey = rate.rateKey;
        const rawAmt = rate.totalAmount?.amount ?? rate.totalAmount;
        const rawCur = rate.totalAmount?.currency || currency;
        if (rawCur === 'EUR') {
          const fx = await getEurToInrRate();
          amount   = Math.round(parseFloat(rawAmt) * fx);
          currency = 'INR';
        } else {
          amount   = parseFloat(rawAmt);
          currency = rawCur;
        }
        break outer;
      }
    }
  }

  console.log(`[getActivityDetails] code=${activityCode} rateKey=${rateKey} amount=${amount} currency=${currency}`);
  return { code: act.code, name: act.name, rateKey, amount, currency };
}

export async function bookActivity({ rateKey, dateFrom, dateTo, adults, holder, clientReference }) {
  const paxes = Array.from({ length: Math.max(1, adults || 1) }, () => ({
    age:     30,
    name:    holder.firstName,
    surname: holder.lastName,
    type:    'ADULT',
  }));

  const body = {
    language:        'en',
    clientReference: clientReference || `PARGO-ACT-${Date.now()}`,
    holder: {
      name:      holder.firstName,
      surname:   holder.lastName,
      email:     holder.email,
      telephone: holder.phone || '',
      address:   '',
      city:      '',
      country:   'IN',
    },
    activities: [{
      rateKey,
      from:  dateFrom,
      to:    dateTo,
      paxes,
    }],
  };

  const res = await fetch(`${BASE_URL}/activity-api/3.0/bookings`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[bookActivity] error:', res.status, JSON.stringify(result));
    return { error: result.error?.message || result.message || `API error ${res.status}` };
  }

  const booking  = result.booking || result;
  const actEntry = booking.activities?.[0];
  const rawAmt   = booking.totalAmount?.amount ?? booking.totalAmount ?? 0;
  const rawCur   = booking.totalAmount?.currency || 'EUR';
  const fxRate   = rawCur === 'EUR' ? await getEurToInrRate() : 1;

  return {
    bookingReference: booking.reference || booking.id || `REF-${Date.now()}`,
    status:           booking.status,
    activityName:     actEntry?.name || 'Activity',
    dateFrom:         actEntry?.from  || dateFrom,
    dateTo:           actEntry?.to    || dateTo,
    totalAmount:      fxRate !== 1 ? Math.round(parseFloat(rawAmt) * fxRate) : parseFloat(rawAmt),
    currency:         rawCur === 'EUR' ? 'INR' : rawCur,
    holderName:       `${holder.firstName} ${holder.lastName}`,
  };
}
