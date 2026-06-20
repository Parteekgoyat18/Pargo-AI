import { bookActivity } from '../../../lib/activities';
import { getSession } from '../../../lib/session';

export async function POST(request) {
  const session = await getSession();
  if (!session?.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { rateKey, dateFrom, dateTo, adults, guest } = await request.json();

    if (!rateKey || !dateFrom || !dateTo || !guest) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await bookActivity({ rateKey, dateFrom, dateTo, adults: adults || 1, holder: guest });
    if (result.error) return Response.json({ error: result.error }, { status: 400 });
    return Response.json(result);
  } catch (err) {
    console.error('[activities/book] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
