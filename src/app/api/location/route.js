import { searchAirports } from '../../lib/flights';
import { searchDestinations } from '../../lib/hotelbeds';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) return Response.json({ error: 'lat and lng required' }, { status: 400 });

  try {
    // Reverse geocode
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'PargoAI/1.0' } }
    );
    if (!geoRes.ok) return Response.json({ error: 'Geocoding failed' }, { status: 502 });

    const data = await geoRes.json();
    const addr = data.address || {};
    const city    = addr.city || addr.town || addr.village || addr.county || addr.state || '';
    const state   = addr.state   || '';
    const country = addr.country || '';
    const countryCode = (addr.country_code || '').toUpperCase();

    // Check which services are available at this location — run in parallel
    const [airportResult, hotelResult] = await Promise.allSettled([
      city ? searchAirports(city) : Promise.resolve({ airports: [] }),
      city ? searchDestinations(city) : Promise.resolve({ destinations: [] }),
    ]);

    const airports    = airportResult.status  === 'fulfilled' ? (airportResult.value?.airports  || []) : [];
    const destinations = hotelResult.status   === 'fulfilled' ? (hotelResult.value?.destinations || []) : [];

    const nearestAirport = airports[0] || null;
    const hasFlights   = airports.length > 0;
    const hasTransfers = airports.length > 0;   // transfers available wherever there's an airport
    // If hotel check fails (quota/error), assume hotels are available so we don't hide the service
    const hasHotels = hotelResult.status !== 'fulfilled' || hotelResult.value?.error
      ? true
      : destinations.length > 0;

    console.log(`[/api/location] ${city}, ${country} | hotels:${hasHotels} flights:${hasFlights} transfers:${hasTransfers}`);

    return Response.json({
      city,
      state,
      country,
      countryCode,
      displayName: [city, country].filter(Boolean).join(', '),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      nearestAirport,          // { iataCode, name, city } or null
      services: {
        hotels:    hasHotels,
        flights:   hasFlights,
        transfers: hasTransfers,
      },
    });
  } catch (err) {
    console.error('[/api/location]', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
