import { createBooking } from '@/app/lib/hotelbeds';

export async function POST(request) {
  const { rateKey, guest } = await request.json();

  const booking = await createBooking({
    rateKey,
    holderName:      guest.firstName,
    holderSurname:   guest.lastName,
    email:           guest.email,
    phone:           guest.phone,
    clientReference: `PARGO-${Date.now()}`,
  });

  if (booking.error) {
    return Response.json({ error: booking.error }, { status: 400 });
  }

  return Response.json(booking);
}
