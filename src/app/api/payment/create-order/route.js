export async function POST(request) {
  const { amount, currency } = await request.json();

  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return Response.json({ error: 'Payment gateway not configured' }, { status: 500 });
  }

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount:   Math.round(amount),
      currency: currency || 'INR',
      receipt:  `pargo_${Date.now()}`,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return Response.json({ error: err.error?.description || 'Failed to create order' }, { status: 400 });
  }

  const order = await res.json();
  return Response.json({ orderId: order.id, amount: order.amount, currency: order.currency, key: keyId });
}
