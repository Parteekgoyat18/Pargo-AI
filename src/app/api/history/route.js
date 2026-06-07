import { NextResponse } from 'next/server'
import { getSession } from '@/app/lib/session'
import { getClientPromise } from '@/app/lib/mongodb'

async function getDb() {
  const client = await getClientPromise()
  return client.db().collection('chat_histories')
}

export async function GET() {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ messages: [] }, { status: 401 })
  }

  try {
    const col = await getDb()
    const doc = await col.findOne({ userId: session.userId })
    return NextResponse.json({ messages: doc?.messages ?? [] })
  } catch (err) {
    console.error('[history GET]', err.message)
    return NextResponse.json({ messages: [] })
  }
}

export async function POST(request) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages } = await request.json()

  try {
    const col = await getDb()
    await col.updateOne(
      { userId: session.userId },
      { $set: { userId: session.userId, messages, updatedAt: new Date() } },
      { upsert: true }
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[history POST]', err.message)
    return NextResponse.json({ ok: false })
  }
}

export async function DELETE() {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const col = await getDb()
    await col.deleteOne({ userId: session.userId })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[history DELETE]', err.message)
    return NextResponse.json({ ok: false })
  }
}
