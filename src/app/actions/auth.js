'use server'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import USERS from '@/app/lib/users.json'
import { createSession, deleteSession } from '@/app/lib/session'

export async function loginAction(prevState, formData) {
  const email = formData.get('email')?.toString().toLowerCase().trim()
  const password = formData.get('password')?.toString()

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const user = USERS.find(u => u.email === email)
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

export async function logoutAction() {
  await deleteSession()
  redirect('/login')
}
