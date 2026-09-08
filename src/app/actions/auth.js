'use server'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import USERS from '@/app/lib/users.json'
import { createSession, deleteSession } from '@/app/lib/session'
import { getClientPromise } from '@/app/lib/mongodb'

async function getUsersCol() {
  const client = await getClientPromise()
  return client.db().collection('users')
}

async function findUserByEmail(email) {
  const staticUser = USERS.find(u => u.email === email)
  if (staticUser) return staticUser
  const col = await getUsersCol()
  return col.findOne({ email })
}

export async function loginAction(prevState, formData) {
  const email = formData.get('email')?.toString().toLowerCase().trim()
  const password = formData.get('password')?.toString()

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const user = await findUserByEmail(email)
  if (!user) {
    return { error: 'Invalid credentials.' }
  }

  const valid = await bcrypt.compare(password, user.hash)
  if (!valid) {
    return { error: 'Invalid credentials.' }
  }

  await createSession(user)
  redirect('/')
}

export async function registerAction(prevState, formData) {
  const name = formData.get('name')?.toString().trim()
  const email = formData.get('email')?.toString().toLowerCase().trim()
  const password = formData.get('password')?.toString()
  const confirmPassword = formData.get('confirmPassword')?.toString()

  if (!name || !email || !password || !confirmPassword) {
    return { error: 'All fields are required.' }
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const existing = await findUserByEmail(email)
  if (existing) {
    return { error: 'An account with this email already exists.' }
  }

  const hash = await bcrypt.hash(password, 12)
  const col = await getUsersCol()
  const { insertedId } = await col.insertOne({ name, email, hash, createdAt: new Date().toISOString() })

  await createSession({ id: insertedId, name, email })
  redirect('/')
}

export async function logoutAction() {
  await deleteSession()
  redirect('/login')
}
