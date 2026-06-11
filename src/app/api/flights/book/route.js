import { createFlightOrder } from '@/app/lib/flights';

export async function POST(request) {
  const { offerId, passengerIds, guest } = await request.json();

  if (!offerId || !passengerIds?.length || !guest) {
    return Response.json({ error: 'Missing required booking details' }, { status: 400 });
  }

  const result = await createFlightOrder(offerId, passengerIds, guest);

  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
