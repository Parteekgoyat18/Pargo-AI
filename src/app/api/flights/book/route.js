import { createFlightOrder } from '@/app/lib/flights';
import { getSession } from '@/app/lib/session';

export async function POST(request) {
  const session = await getSession();
  if (!session?.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { offerId, passengerIds, guests, guest, flightMeta } = await request.json();
  const guestList = guests || (guest ? [guest] : []);

  if (!offerId || !passengerIds?.length || !guestList.length) {
    return Response.json({ error: 'Missing required booking details' }, { status: 400 });
  }

  const result = await createFlightOrder(offerId, passengerIds, guestList, 0, flightMeta || null);

  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
