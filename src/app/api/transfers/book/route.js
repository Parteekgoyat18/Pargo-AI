import { bookTransfer } from '../../../lib/transfers';
import { getSession } from '../../../lib/session';

export async function POST(request) {
  const session = await getSession();
  if (!session?.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { rateKey, fromCode, toCode, date, time, adults, guest } = await request.json();

    if (!rateKey || !guest?.firstName || !guest?.lastName) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await bookTransfer({
      rateKey,
      fromCode,
      toCode,
      date,
      time,
      adults: adults || 1,
      holder: {
        firstName: guest.firstName,
        lastName:  guest.lastName,
        email:     guest.email,
        phone:     guest.phone,
      },
      clientReference: `PARGO-TRF-${Date.now()}`,
    });

    if (result.error) return Response.json({ error: result.error }, { status: 400 });
    return Response.json(result);
  } catch (err) {
    console.error('[transfers/book] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
