import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { getClientPromise } from '@/app/lib/mongodb';

async function getCol() {
  const client = await getClientPromise();
  return client.db().collection('conversations');
}

// GET /api/history  — returns { convList, messageMap }
export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const col  = await getCol();
    const docs = await col.find({ userId: session.userId }).toArray();
    const convList   = docs.map(d => ({ id: d.convId, title: d.title, updatedAt: d.updatedAt, pinned: d.pinned || false }));
    const messageMap = Object.fromEntries(docs.map(d => [d.convId, d.messages || []]));
    return NextResponse.json({ convList, messageMap });
  } catch (err) {
    console.error('[history GET]', err.message);
    return NextResponse.json({ convList: [], messageMap: {} });
  }
}

// POST /api/history  — upserts one conversation { convId, title, messages, pinned, updatedAt }
export async function POST(request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { convId, title, messages, pinned, updatedAt } = await request.json();
  if (!convId) return NextResponse.json({ error: 'convId required' }, { status: 400 });

  try {
    const col = await getCol();
    await col.updateOne(
      { userId: session.userId, convId },
      { $set: { userId: session.userId, convId, title, messages, pinned: pinned || false, updatedAt: updatedAt || new Date().toISOString() } },
      { upsert: true },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[history POST]', err.message);
    return NextResponse.json({ ok: false });
  }
}

// DELETE /api/history?convId=xxx  — deletes one conversation
export async function DELETE(request) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const convId = new URL(request.url).searchParams.get('convId');
  if (!convId) return NextResponse.json({ error: 'convId required' }, { status: 400 });

  try {
    const col = await getCol();
    await col.deleteOne({ userId: session.userId, convId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[history DELETE]', err.message);
    return NextResponse.json({ ok: false });
  }
}
