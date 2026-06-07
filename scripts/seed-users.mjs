import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'

// Run with: node --env-file=.env.local scripts/seed-users.mjs

const USERS = [
  { name: 'Admin',      email: 'admin@hotelgpt.com',  password: 'admin123!' },
  { name: 'Demo Staff', email: 'staff@hotelgpt.com',  password: 'staff456!' },
]

async function seed() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI not found. Run with: node --env-file=.env.local scripts/seed-users.mjs')
    process.exit(1)
  }

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db()
    const col = db.collection('users')

    await col.createIndex({ email: 1 }, { unique: true })

    for (const u of USERS) {
      const hashed = await bcrypt.hash(u.password, 12)
      await col.updateOne(
        { email: u.email },
        { $set: { name: u.name, email: u.email, password: hashed, updatedAt: new Date() } },
        { upsert: true }
      )
      console.log(`✓ Seeded: ${u.email}`)
    }
    console.log('\nDone! Users are ready to log in.')
  } finally {
    await client.close()
  }
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})
