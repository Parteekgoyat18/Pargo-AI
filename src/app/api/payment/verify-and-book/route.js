import crypto from 'crypto';
import { createBooking } from '@/app/lib/hotelbeds';
import { createFlightOrder } from '@/app/lib/flights';
import { bookTransfer } from '@/app/lib/transfers';
import { getSession } from '@/app/lib/session';

export async function POST(request) {
  const session = await getSession();
  if (!session?.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { type, razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return Response.json({ error: 'Missing payment verification details' }, { status: 400 });
  }

  // Verify Razorpay signature — proves this payment_id genuinely belongs to this order
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return Response.json({ error: 'Payment verification failed' }, { status: 400 });
  }

  let result;

  if (type === 'hotel') {
    const { rateKey, guests } = body;
    result = await createBooking({
      rateKey,
      guests,
      clientReference: `PAY-${razorpay_payment_id}`,
    });
  } else if (type === 'flight') {
    const { offerId, passengerIds, guests, flightMeta } = body;
    result = await createFlightOrder(offerId, passengerIds, guests, 0, flightMeta || null);
  } else if (type === 'transfer') {
    const { rateKey, fromCode, toCode, date, time, adults, guests } = body;
    const lead = guests[0];
    result = await bookTransfer({
      rateKey,
      fromCode,
      toCode,
      date,
      time,
      adults: adults || 1,
      holder: {
        firstName: lead.firstName,
        lastName:  lead.lastName,
        email:     lead.email,
        phone:     lead.phone,
      },
      clientReference: `PAY-${razorpay_payment_id}`,
    });
  } else {
    return Response.json({ error: 'Invalid booking type' }, { status: 400 });
  }

  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
