'use client'
import { useActionState, useState } from 'react'
import Link from 'next/link'
import { loginAction } from '@/app/actions/auth'

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#0D0B0A',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Aurora blobs — warm amber, matching main app */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-8%',
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.06) 0%, rgba(140,100,30,0.025) 40%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'auroraA 26s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-5%',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(160,80,20,0.045) 0%, rgba(100,50,10,0.018) 45%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'auroraB 32s ease-in-out infinite reverse',
      }} />

      {/* Scrollable layer — keeps the card fully reachable even when it's taller than the viewport */}
      <div className="auth-scroll" style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        display: 'flex',
        padding: '24px 16px',
      }}>
        <div style={{ margin: 'auto', width: '100%', maxWidth: 420, zIndex: 1 }}>

          {/* Brand lockup, above the card */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: 'linear-gradient(145deg, #E8C56A 0%, #C9A84C 55%, #9A7A2E 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19, fontWeight: 800, color: '#171308',
              boxShadow: '0 0 24px rgba(201,168,76,0.35)',
            }}>P</div>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#F2EDD4', letterSpacing: '-0.3px' }}>Pargo AI</span>
          </div>

          {/* Card */}
          <div style={{
            background: '#151109',
            border: '1px solid rgba(201,168,76,0.14)',
            borderRadius: 20,
            padding: '40px 36px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
          }}>

            <h1 style={{
              fontSize: 24, fontWeight: 700, color: '#F2EDD4',
              margin: '0 0 28px', letterSpacing: '-0.3px',
            }}>
              Log in to Pargo AI
            </h1>

            {/* Error message */}
            {state?.error && (
              <div style={{
                color: '#F87171',
                background: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 10,
                padding: '11px 14px',
                fontSize: 13,
                marginBottom: 20,
              }}>
                {state.error}
              </div>
            )}

            <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Email */}
              <div>
                <label style={{ color: '#B8AA82', fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 8 }}>
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  style={inputStyle}
                  onFocus={focusInput}
                  onBlur={blurInput}
                />
              </div>

              {/* Password */}
              <div>
                <label style={{ color: '#B8AA82', fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 8 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    style={{ ...inputStyle, padding: '14px 46px 14px 16px' }}
                    onFocus={focusInput}
                    onBlur={blurInput}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 0, display: 'flex', alignItems: 'center',
                      color: '#8A7A56',
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={pending}
                style={{
                  marginTop: 8,
                  padding: '14px',
                  background: pending ? 'rgba(201,168,76,0.15)' : '#C9A84C',
                  color: pending ? '#8A7A56' : '#171308',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: pending ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s, transform 0.15s',
                }}
                onMouseEnter={e => { if (!pending) e.currentTarget.style.background = '#DDBB5A'; }}
                onMouseLeave={e => { if (!pending) e.currentTarget.style.background = '#C9A84C'; }}
              >
                {pending ? 'Logging in…' : 'Log in'}
              </button>
            </form>

            {/* Footer */}
            <p style={{ marginTop: 24, textAlign: 'center', color: '#8A7A56', fontSize: 14 }}>
              Don&apos;t have an account?{' '}
              <Link href="/register" style={{ color: '#E8C56A', fontWeight: 600, textDecoration: 'none' }}>
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 10,
  background: 'rgba(201,168,76,0.05)',
  border: '1px solid rgba(201,168,76,0.16)',
  color: '#F0E6C8',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

function focusInput(e) {
  e.target.style.borderColor = 'rgba(201,168,76,0.6)';
  e.target.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.1)';
}

function blurInput(e) {
  e.target.style.borderColor = 'rgba(201,168,76,0.16)';
  e.target.style.boxShadow = 'none';
}
