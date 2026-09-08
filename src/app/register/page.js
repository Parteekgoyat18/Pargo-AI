'use client'
import { useActionState, useState } from 'react'
import Link from 'next/link'
import { registerAction } from '@/app/actions/auth'

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerAction, undefined)
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
        background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.07) 0%, rgba(140,100,30,0.03) 40%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'auroraA 26s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-5%',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(160,80,20,0.055) 0%, rgba(100,50,10,0.02) 45%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'auroraB 32s ease-in-out infinite reverse',
      }} />
      <div style={{
        position: 'absolute', top: '55%', left: '60%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(201,168,76,0.03) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Scrollable layer — keeps the card fully reachable even when it's taller than the viewport */}
      <div style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        display: 'flex',
        padding: '24px 16px',
      }}>
      {/* Card with gold gradient border */}
      <div style={{
        width: '100%',
        maxWidth: 400,
        margin: 'auto',
        zIndex: 1,
        borderRadius: 24,
        padding: 1,
        background: 'linear-gradient(135deg, rgba(201,168,76,0.55) 0%, rgba(140,100,30,0.2) 50%, rgba(201,168,76,0.4) 100%)',
        boxShadow: '0 0 80px rgba(201,168,76,0.12), 0 40px 80px rgba(0,0,0,0.8)',
      }}>
        <div style={{
          background: 'rgba(13,11,8,0.97)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRadius: 23,
          padding: '44px 36px',
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            {/* Logo with orbit rings */}
            <div style={{ position: 'relative', width: 68, height: 68, margin: '0 auto 20px', display: 'inline-block' }}>
              {/* Orbit ring 1 */}
              <div style={{
                position: 'absolute', inset: -16, borderRadius: '50%',
                border: '1px solid rgba(201,168,76,0.18)',
                boxShadow: '0 0 8px rgba(201,168,76,0.06)',
                animation: 'quantumPulse 5s ease-in-out infinite',
              }} />
              {/* Orbit ring 2 */}
              <div style={{
                position: 'absolute', inset: -26, borderRadius: '50%',
                border: '1px solid rgba(201,168,76,0.08)',
              }} />
              {/* Core */}
              <div style={{
                width: 68, height: 68, borderRadius: '50%',
                background: 'linear-gradient(145deg, #1A1510 0%, #0D0A07 60%, #15110A 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 800, color: '#C9A84C',
                boxShadow: '0 0 28px rgba(201,168,76,0.38), 0 0 56px rgba(201,168,76,0.12)',
                border: '1px solid rgba(201,168,76,0.22)',
                letterSpacing: '-1px',
                textShadow: '0 0 12px rgba(215,178,80,0.7)',
                position: 'relative', zIndex: 1,
              }}>P</div>
            </div>

            <div style={{
              width: 40, height: 1, margin: '0 auto 18px',
              background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.5), rgba(215,178,80,0.5), transparent)',
            }} />

            <h1 className="gradient-heading" style={{
              fontSize: 24, fontWeight: 800,
              margin: '0 0 8px', letterSpacing: '-0.5px',
              display: 'block',
            }}>
              Create your account
            </h1>
            <p style={{ color: '#4A3A1A', fontSize: 13, margin: 0, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500 }}>
              Your intelligent travel companion
            </p>
          </div>

          {/* Error message */}
          {state?.error && (
            <div style={{
              color: '#F87171',
              background: 'rgba(248,113,113,0.06)',
              border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: 12,
              padding: '11px 14px',
              fontSize: 13,
              marginBottom: 20,
              textAlign: 'center',
            }}>
              {state.error}
            </div>
          )}

          <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Name */}
            <div>
              <label style={{
                color: '#7A6A4A', fontSize: 11, fontWeight: 600, display: 'block',
                marginBottom: 8, letterSpacing: '0.8px', textTransform: 'uppercase',
              }}>
                Name
              </label>
              <input
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Your full name"
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>

            {/* Email */}
            <div>
              <label style={{
                color: '#7A6A4A', fontSize: 11, fontWeight: 600, display: 'block',
                marginBottom: 8, letterSpacing: '0.8px', textTransform: 'uppercase',
              }}>
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
              <label style={{
                color: '#7A6A4A', fontSize: 11, fontWeight: 600, display: 'block',
                marginBottom: 8, letterSpacing: '0.8px', textTransform: 'uppercase',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  style={{ ...inputStyle, padding: '12px 44px 12px 16px' }}
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
                    color: '#7A6A4A',
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

            {/* Confirm Password */}
            <div>
              <label style={{
                color: '#7A6A4A', fontSize: 11, fontWeight: 600, display: 'block',
                marginBottom: 8, letterSpacing: '0.8px', textTransform: 'uppercase',
              }}>
                Confirm password
              </label>
              <input
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                style={inputStyle}
                onFocus={focusInput}
                onBlur={blurInput}
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={pending}
              className={pending ? '' : 'shimmer-btn'}
              style={{
                marginTop: 6,
                padding: '13px',
                background: pending
                  ? 'rgba(201,168,76,0.06)'
                  : 'linear-gradient(135deg, #C9A84C, #F2EDD4, #E8C56A, #C9A84C)',
                backgroundSize: '200% auto',
                color: pending ? '#4A3A1A' : '#0D0B0A',
                border: pending ? '1px solid rgba(201,168,76,0.15)' : 'none',
                borderRadius: 12,
                fontSize: 14,
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
              {pending ? 'Creating account…' : 'Create account →'}
            </button>
          </form>

          {/* Footer */}
          <div style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: '1px solid rgba(201,168,76,0.08)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#7A6A4A', fontSize: 13, margin: 0 }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: '#C9A84C', fontWeight: 600, textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 12,
  background: 'rgba(201,168,76,0.04)',
  border: '1px solid rgba(201,168,76,0.18)',
  color: '#D8C9A8',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

function focusInput(e) {
  e.target.style.borderColor = 'rgba(201,168,76,0.6)';
  e.target.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.1), 0 0 20px rgba(201,168,76,0.08)';
}

function blurInput(e) {
  e.target.style.borderColor = 'rgba(201,168,76,0.18)';
  e.target.style.boxShadow = 'none';
}
