'use client'
import { useActionState } from 'react'
import { loginAction } from '@/app/actions/auth'

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined)

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0d0d0d',
      fontFamily: 'inherit',
      padding: '24px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        background: '#1a1a1a',
        borderRadius: 16,
        padding: '36px 32px',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: '#fff', color: '#000',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700,
          }}>P</div>
          <h1 style={{
            color: '#fff', fontSize: 20, fontWeight: 600,
            margin: '12px 0 4px', letterSpacing: '-0.2px',
          }}>
            Sign in to Pargo AI
          </h1>
          <p style={{ color: '#666', fontSize: 13, margin: 0 }}>
            Enter your credentials to continue
          </p>
        </div>

        {state?.error && (
          <div style={{
            color: '#ff6b6b',
            background: 'rgba(255,107,107,0.08)',
            border: '1px solid rgba(255,107,107,0.2)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            marginBottom: 16,
            textAlign: 'center',
          }}>
            {state.error}
          </div>
        )}

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                background: '#2a2a2a',
                border: '1px solid #333',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = '#555'}
              onBlur={e => e.target.style.borderColor = '#333'}
            />
          </div>

          <div>
            <label style={{ color: '#aaa', fontSize: 13, display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                background: '#2a2a2a',
                border: '1px solid #333',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = '#555'}
              onBlur={e => e.target.style.borderColor = '#333'}
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            style={{
              marginTop: 6,
              padding: '11px',
              background: pending ? '#333' : '#fff',
              color: pending ? '#666' : '#000',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: pending ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
