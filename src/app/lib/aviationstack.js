const AV_KEY = process.env.AVIATIONSTACK_API_KEY || '';

export async function getFlightStatus(flightIata, date) {
  const clean  = flightIata.toUpperCase().replace(/\s/g, '');
  const params = new URLSearchParams({ access_key: AV_KEY, flight_iata: clean });
  if (date) params.set('flight_date', date);

  console.log(`[getFlightStatus] querying ${clean}${date ? ` on ${date}` : ''}`);

  let res;
  try {
    res = await fetch(`http://api.aviationstack.com/v1/flights?${params}`);
  } catch (err) {
    return { found: false, error: `Network error: ${err.message}` };
  }

  if (!res.ok) return { found: false, error: `API error ${res.status}` };

  const data = await res.json();
  if (data.error) return { found: false, error: data.error.info || 'AviationStack error' };

  const flights = data.data || [];
  if (!flights.length) return { found: false, message: `No information found for flight ${flightIata}.` };

  const f = flights[0];
  return {
    found:      true,
    flightIata: f.flight?.iata   || flightIata,
    airline:    f.airline?.name  || 'Unknown',
    status:     f.flight_status  || 'scheduled',
    departure: {
      airport:   f.departure?.airport   || '',
      iata:      f.departure?.iata      || '',
      terminal:  f.departure?.terminal  || '',
      gate:      f.departure?.gate      || '',
      scheduled: f.departure?.scheduled || '',
      estimated: f.departure?.estimated || f.departure?.scheduled || '',
      actual:    f.departure?.actual    || '',
      delay:     f.departure?.delay     || 0,
    },
    arrival: {
      airport:   f.arrival?.airport   || '',
      iata:      f.arrival?.iata      || '',
      terminal:  f.arrival?.terminal  || '',
      gate:      f.arrival?.gate      || '',
      scheduled: f.arrival?.scheduled || '',
      estimated: f.arrival?.estimated || f.arrival?.scheduled || '',
      actual:    f.arrival?.actual    || '',
      delay:     f.arrival?.delay     || 0,
    },
  };
}
