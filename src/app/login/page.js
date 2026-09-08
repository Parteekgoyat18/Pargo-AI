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
        padding: '16px',
      }}>
        <div style={{ margin: 'auto', width: '100%', maxWidth: 400, zIndex: 1 }}>

          {/* Card */}
          <div style={{
            background: '#151109',
            border: '1px solid rgba(201,168,76,0.14)',
            borderRadius: 20,
            padding: '24px 28px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
          }}>

            {/* Logo + heading */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ position: 'relative', width: 44, height: 44, margin: '0 auto 10px', display: 'inline-block' }}>
                <div style={{
                  position: 'absolute', inset: -10, borderRadius: '50%',
                  border: '1px solid rgba(201,168,76,0.18)',
                  boxShadow: '0 0 8px rgba(201,168,76,0.06)',
                  animation: 'quantumPulse 5s ease-in-out infinite',
                }} />
                <div style={{
                  position: 'absolute', inset: -17, borderRadius: '50%',
                  border: '1px solid rgba(201,168,76,0.08)',
                }} />
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'linear-gradient(145deg, #1A1510 0%, #0D0A07 60%, #15110A 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 800, color: '#C9A84C',
                  boxShadow: '0 0 28px rgba(201,168,76,0.38), 0 0 56px rgba(201,168,76,0.12)',
                  border: '1px solid rgba(201,168,76,0.22)',
                  letterSpacing: '-1px',
                  textShadow: '0 0 12px rgba(215,178,80,0.7)',
                  position: 'relative', zIndex: 1,
                }}>P</div>
              </div>
              <h1 className="gradient-heading" style={{
                display: 'block',
                fontSize: 20, fontWeight: 800,
                margin: 0, letterSpacing: '-0.5px',
              }}>
                Sign in to Pargo AI
              </h1>
            </div>

            {/* Error message */}
            {state?.error && (
              <div style={{
                color: '#F87171',
                background: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 10,
                padding: '9px 12px',
                fontSize: 13,
                marginBottom: 14,
              }}>
                {state.error}
              </div>
            )}

            <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {/* Email */}
              <div>
                <label style={{ color: '#B8AA82', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>
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
                <label style={{ color: '#B8AA82', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    style={{ ...inputStyle, padding: '10px 46px 10px 14px' }}
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
                className={pending ? '' : 'shimmer-btn'}
                style={{
                  marginTop: 4,
                  padding: '12px',
                  background: pending
                    ? 'rgba(201,168,76,0.06)'
                    : 'linear-gradient(135deg, #C9A84C, #F2EDD4, #E8C56A, #C9A84C)',
                  backgroundSize: '200% auto',
                  color: pending ? '#4A3A1A' : '#0D0B0A',
                  border: pending ? '1px solid rgba(201,168,76,0.15)' : 'none',
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: pending ? 'not-allowed' : 'pointer',
                  transition: 'opacity 0.2s, box-shadow 0.2s, transform 0.15s',
                  boxShadow: pending
                    ? 'none'
                    : '0 0 32px rgba(201,168,76,0.45), 0 0 64px rgba(201,168,76,0.15), 0 6px 20px rgba(0,0,0,0.5)',
                  letterSpacing: '0.5px',
                }}
                onMouseEnter={e => { if (!pending) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {pending ? 'Signing in…' : 'Sign in →'}
              </button>
            </form>

            {/* Footer */}
            <p style={{ marginTop: 12, textAlign: 'center', color: '#8A7A56', fontSize: 13 }}>
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
  padding: '10px 14px',
  borderRadius: 10,
  background: 'rgba(201,168,76,0.05)',
  border: '1px solid rgba(201,168,76,0.16)',
  color: '#F0E6C8',
  fontSize: 14,
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
