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
      background: '#0D0B0A',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      padding: '24px 16px',
      position: 'relative',
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

      {/* Card with gold gradient border */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 400,
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
              Sign in to Pargo AI
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
                style={{
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
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(201,168,76,0.6)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.1), 0 0 20px rgba(201,168,76,0.08)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(201,168,76,0.18)';
                  e.target.style.boxShadow = 'none';
                }}
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
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                style={{
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
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(201,168,76,0.6)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(201,168,76,0.1), 0 0 20px rgba(201,168,76,0.08)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(201,168,76,0.18)';
                  e.target.style.boxShadow = 'none';
                }}
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
              {pending ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          {/* Footer */}
          <div style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: '1px solid rgba(201,168,76,0.08)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#2A1F0E', fontSize: 12, margin: 0, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              Hotels · Flights · Ground Transfers · Worldwide
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
