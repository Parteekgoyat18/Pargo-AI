import crypto from 'crypto';

export async function GET() {
  const ACT_KEY  = process.env.HOTELBEDS_ACTIVITIES_API_KEY || '';
  const ACT_SEC  = process.env.HOTELBEDS_ACTIVITIES_SECRET  || '';
  const BASE_URL = process.env.HOTELBEDS_BASE_URL || 'https://api.test.hotelbeds.com';

  function makeHeaders() {
    const ts  = Math.floor(Date.now() / 1000).toString();
    const sig = crypto.createHash('sha256').update(ACT_KEY + ACT_SEC + ts).digest('hex');
    return { 'Api-key': ACT_KEY, 'X-Signature': sig, 'Accept': 'application/json', 'Content-Type': 'application/json' };
  }

  async function testDest(code) {
    const body = {
      filters:  [{ type: 'destination', value: code }],
      from:     '2026-07-01',
      to:       '2026-07-07',
      paxes:    [{ age: 30 }, { age: 30 }],
      language: 'en',
    };
    const res  = await fetch(`${BASE_URL}/activity-api/3.0/activities`, { method: 'POST', headers: makeHeaders(), body: JSON.stringify(body) });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { dest: code, status: res.status, ok: res.ok, activityCount: parsed?.activities?.length ?? 0, errors: parsed?.errors || null, raw: parsed };
  }

  try {
    const [bcn, pmh, dxb, lon] = await Promise.all([
      testDest('BCN'),
      testDest('PMH'),
      testDest('DXB'),
      testDest('LON'),
    ]);
    return Response.json({
      keyUsed: ACT_KEY.slice(0, 8) + '...',
      baseUrl: BASE_URL,
      results: { BCN: bcn, PMH: pmh, DXB: dxb, LON: lon },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
