import { verifySession } from '@/app/lib/dal'
import ChatUI from './ChatUI'

export default async function Page() {
  const session = await verifySession()
  return (
    <ChatUI
      user={{
        id: session.userId,
        name: session.name,
        email: session.email,
      }}
    />
  )
}
