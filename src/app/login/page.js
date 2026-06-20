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
      background: '#020408',
      fontFamily: 'inherit',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Aurora blobs */}
      <div style={{
        position: 'absolute', top: '-15%', left: '10%',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(139,92,246,0.25) 0%, rgba(99,60,180,0.1) 40%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'auroraA 10s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '5%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(6,182,212,0.22) 0%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'auroraB 13s ease-in-out infinite reverse',
      }} />
      <div style={{
        position: 'absolute', top: '40%', right: '25%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(236,72,153,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Gradient border card using layered divs */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 400,
        zIndex: 1,
        borderRadius: 24,
        padding: 1,
        background: 'linear-gradient(135deg, rgba(139,92,246,0.6) 0%, rgba(6,182,212,0.3) 50%, rgba(139,92,246,0.4) 100%)',
        boxShadow: '0 0 80px rgba(139,92,246,0.25), 0 40px 80px rgba(0,0,0,0.7)',
      }}>
        <div style={{
          background: 'rgba(5,8,20,0.96)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRadius: 23,
          padding: '44px 36px',
        }}>

          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            {/* Animated logo */}
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #4F46E5 50%, #06B6D4 100%)',
              color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800,
              animation: 'pulseGlow 3s ease-in-out infinite',
              letterSpacing: '-0.5px',
            }}>P</div>

            <div style={{
              width: 40, height: 1, margin: '16px auto 0',
              background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.6), rgba(6,182,212,0.6), transparent)',
            }} />

            <h1 style={{
              fontSize: 24, fontWeight: 800,
              margin: '16px 0 6px', letterSpacing: '-0.5px',
              background: 'linear-gradient(135deg, #C4B5FD 0%, #F0F4FF 40%, #67E8F9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Sign in to Pargo AI
            </h1>
            <p style={{ color: '#4A5568', fontSize: 13, margin: 0, letterSpacing: '0.2px' }}>
              Your intelligent travel companion
            </p>
          </div>

          {state?.error && (
            <div style={{
              color: '#F87171',
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.25)',
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
            <div>
              <label style={{
                color: '#6B7A99', fontSize: 11, fontWeight: 600, display: 'block',
                marginBottom: 8, letterSpacing: '0.8px', textTransform: 'uppercase',
              }}>
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'rgba(139,92,246,0.06)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  color: '#F0F4FF',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(139,92,246,0.8)';
                  e.target.style.boxShadow = '0 0 0 4px rgba(139,92,246,0.15), 0 0 20px rgba(139,92,246,0.1)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(139,92,246,0.25)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <div>
              <label style={{
                color: '#6B7A99', fontSize: 11, fontWeight: 600, display: 'block',
                marginBottom: 8, letterSpacing: '0.8px', textTransform: 'uppercase',
              }}>
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'rgba(139,92,246,0.06)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  color: '#F0F4FF',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(139,92,246,0.8)';
                  e.target.style.boxShadow = '0 0 0 4px rgba(139,92,246,0.15), 0 0 20px rgba(139,92,246,0.1)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(139,92,246,0.25)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              style={{
                marginTop: 6,
                padding: '13px',
                background: pending
                  ? 'rgba(139,92,246,0.1)'
                  : 'linear-gradient(135deg, #8B5CF6 0%, #4F46E5 50%, #06B6D4 100%)',
                backgroundSize: pending ? 'auto' : '200% auto',
                color: pending ? '#4A5568' : '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: pending ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s, box-shadow 0.2s, transform 0.15s',
                boxShadow: pending
                  ? 'none'
                  : '0 0 40px rgba(139,92,246,0.55), 0 0 80px rgba(139,92,246,0.2), 0 6px 20px rgba(0,0,0,0.5)',
                letterSpacing: '0.3px',
                animation: pending ? 'none' : 'shimmerSweep 3s linear infinite',
              }}
            >
              {pending ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <div style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: '1px solid rgba(139,92,246,0.12)',
            textAlign: 'center',
          }}>
            <p style={{ color: '#2D3748', fontSize: 12, margin: 0 }}>
              Pargo AI · Intelligent Hotel & Travel Booking
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
