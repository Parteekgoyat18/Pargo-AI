import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const key = new TextEncoder().encode(process.env.SESSION_SECRET)

async function decrypt(token) {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] })
    return payload
  } catch {
    return null
  }
}

export async function proxy(request) {
  const { pathname } = request.nextUrl
  const isPublic = pathname === '/login'

  const token = request.cookies.get('session')?.value
  const session = token ? await decrypt(token) : null

  if (!isPublic && !session?.userId) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isPublic && session?.userId) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
