import crypto from 'crypto';
import { createBooking } from '@/app/lib/hotelbeds';

export async function POST(request) {
  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    rateKey,
    guest,
  } = await request.json();

  // Verify Razorpay signature
  const body     = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return Response.json({ error: 'Payment verification failed' }, { status: 400 });
  }

  const booking = await createBooking({
    rateKey,
    holderName:    guest.firstName,
    holderSurname: guest.lastName,
    email:         guest.email,
    phone:         guest.phone,
    clientReference: `PAY-${razorpay_payment_id}`,
  });

  if (booking.error) {
    return Response.json({ error: booking.error }, { status: 400 });
  }

  return Response.json(booking);
}
