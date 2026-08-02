'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { logoutAction } from '@/app/actions/auth';

/* ── Helpers ─────────────────────────────────────────── */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
async function payWithRazorpay({ amount, currency, name, description, guest }) {
  const orderRes = await fetch('/api/payment/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency }),
  });
  if (!orderRes.ok) {
    const err = await orderRes.json().catch(() => ({}));
    throw new Error(err.error || 'Could not start payment');
  }
  const order = await orderRes.json();

  const loaded = await loadRazorpayScript();
  if (!loaded) throw new Error('Could not load payment gateway. Check your connection.');

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: order.key,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'Pargo AI',
      description,
      prefill: {
        name:    guest ? `${guest.firstName || ''} ${guest.lastName || ''}`.trim() : undefined,
        email:   guest?.email,
        contact: guest?.phone,
      },
      theme: { color: '#C9A84C' },
      handler: response => resolve(response),
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    });
    rzp.on('payment.failed', response => reject(new Error(response.error?.description || 'Payment failed')));
    rzp.open();
  });
}
function getTitle(msgs) {
  const first = msgs.find(m => m.role === 'user');
  if (!first) return 'New conversation';
  const t = first.content.trim();
  return t.length > 34 ? t.slice(0, 34) + '…' : t;
}
function groupByDate(list) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yday  = today - 86400000;
  const week  = today - 7 * 86400000;
  const g = { Today: [], Yesterday: [], 'Last 7 days': [], Older: [] };
  list.forEach(c => {
    const t = new Date(c.updatedAt);
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    if      (d >= today) g['Today'].push(c);
    else if (d >= yday)  g['Yesterday'].push(c);
    else if (d >= week)  g['Last 7 days'].push(c);
    else                 g['Older'].push(c);
  });
  return g;
}

/* ── Dropdown menu button inside ConvItem ────────────── */
function ConvMenuBtn({ icon, label, onClick, danger }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%',
        padding: '7px 10px', border: 'none',
        background: hov ? (danger ? 'rgba(180,40,40,0.12)' : 'rgba(255,255,255,0.05)') : 'none',
        cursor: 'pointer', borderRadius: 6, fontSize: 13,
        color: danger ? '#E05050' : '#A09070', textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ color: danger ? '#E05050' : '#706088', display: 'flex', alignItems: 'center' }}>{icon}</span>
      {label}
    </button>
  );
}

/* ── Conversation list item ──────────────────────────── */
function ConvItem({ conv, active, onOpen, onDelete, onRename, onPin, isMobile }) {
  const [hov, setHov] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(conv.title);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setEditVal(conv.title);
  }, [conv.title, editing]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    function onScroll() { setMenuOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function openMenu(e) {
    e.stopPropagation();
    const rect = btnRef.current.getBoundingClientRect();
    const menuW = 160;
    // Align right edge of menu with button's right edge, then clamp to viewport
    let left = rect.right - menuW;
    if (left < 6) left = 6;
    if (left + menuW > window.innerWidth - 6) left = window.innerWidth - menuW - 6;
    setMenuPos({ top: rect.bottom + 2, left });
    setMenuOpen(v => !v);
  }

  function startRename() {
    setMenuOpen(false);
    setEditVal(conv.title);
    setEditing(true);
  }

  function commitRename() {
    const v = editVal.trim();
    if (v && v !== conv.title) onRename(v);
    setEditing(false);
  }

  const showActions = (hov || isMobile || menuOpen) && !editing;

  return (
    <div
      onClick={editing ? undefined : onOpen}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { if (!menuOpen) setHov(false); }}
      style={{
        padding: '6px 10px', borderRadius: 8,
        cursor: editing ? 'default' : 'pointer', marginBottom: 1,
        background: active ? 'rgba(201,168,76,0.1)' : (hov || menuOpen) ? 'rgba(201,168,76,0.04)' : 'transparent',
        display: 'flex', alignItems: 'center', gap: 6,
        position: 'relative',
      }}
    >
      {conv.pinned && !editing && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="#aaa" style={{ flexShrink: 0 }}>
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
        </svg>
      )}
      {editing ? (
        <input
          ref={inputRef}
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
            if (e.key === 'Escape') setEditing(false);
          }}
          onClick={e => e.stopPropagation()}
          style={{
            flex: 1, fontSize: 13.5, color: '#F2EDD4',
            border: 'none', borderBottom: '1.5px solid #C9A84C',
            background: 'transparent', outline: 'none', padding: '0 2px',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <span style={{
          fontSize: 13.5, color: active ? '#F2EDD4' : '#A09070', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontWeight: active ? 500 : 400,
        }}>
          {conv.title}
        </span>
      )}
      {showActions && (
        <>
          <button
            ref={btnRef}
            onClick={openMenu}
            title="More options"
            style={{
              background: menuOpen ? 'rgba(180,148,60,0.2)' : 'none', border: 'none',
              cursor: 'pointer', padding: '3px 4px', color: '#9A8868', flexShrink: 0,
              display: 'flex', alignItems: 'center', borderRadius: 5,
            }}
            onMouseEnter={e => { e.stopPropagation(); if (!menuOpen) e.currentTarget.style.background = 'rgba(180,148,60,0.15)'; }}
            onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = 'none'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          {menuOpen && menuPos && (
            <div
              ref={menuRef}
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                zIndex: 9999,
                background: 'rgba(14,11,7,0.98)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(201,168,76,0.08)',
                borderRadius: 8,
                boxShadow: '0 24px 64px rgba(0,0,0,0.9), inset 0 1px 0 rgba(201,168,76,0.04)',
                minWidth: 152,
                padding: '4px',
              }}
            >
              <ConvMenuBtn
                label={conv.pinned ? 'Unpin' : 'Pin'}
                icon={conv.pinned
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/><line x1="4" y1="4" x2="20" y2="20" strokeLinecap="round"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                }
                onClick={e => { e.stopPropagation(); onPin(); setMenuOpen(false); setHov(false); }}
              />
              <ConvMenuBtn
                label="Rename"
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}
                onClick={e => { e.stopPropagation(); startRename(); }}
              />
              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />
              <ConvMenuBtn
                label="Delete"
                danger
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>}
                onClick={e => { e.stopPropagation(); setMenuOpen(false); setHov(false); onDelete(e); }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Small icon button (used in mini sidebar) ────────── */
function IconBtn({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        width: 36, height: 36, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#9A8868',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {children}
    </button>
  );
}

/* ── Logo button: auto-alternates between "P" logo and sidebar icon ── */
function LogoToggleBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  const [showP, setShowP] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setShowP(v => !v), 4000);
    return () => clearInterval(id);
  }, []);

  const displayP = !hov && showP;

  return (
    <button
      onClick={onClick}
      title="Open sidebar"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'rgba(255,255,255,0.09)' : 'none',
        border: 'none', cursor: 'ew-resize',
        width: 36, height: 36, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#9A8868', position: 'relative',
      }}
    >
      {/* P logo */}
      <div style={{
        position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: displayP ? 1 : 0, transition: 'opacity 0.8s ease',
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: 'linear-gradient(145deg, #1A1510 0%, #0D0A07 100%)', color: '#C9A84C',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, letterSpacing: '-0.3px',
          boxShadow: '0 0 12px rgba(201,168,76,0.45)',
          border: '1px solid rgba(201,168,76,0.28)',
        }}>P</div>
      </div>
      {/* Sidebar icon */}
      <div style={{
        position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: displayP ? 0 : 1, transition: 'opacity 0.4s ease',
        pointerEvents: 'none',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M9 3v18" />
        </svg>
      </div>
    </button>
  );
}

/* ── Sidebar content (shared by mobile overlay + desktop) */
function SidebarContent({ onClose, onNewChat, convs, activeId, openConv, deleteConv, renameConv, pinConv, isMobile, user }) {
  const pinnedConvs  = convs.filter(c => c.pinned);
  const unpinnedConvs = convs.filter(c => !c.pinned);
  const groups = groupByDate(unpinnedConvs);

  return (
    <>
      {/* Top bar */}
      <div style={{ padding: '10px 10px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={onClose}
            title="Close sidebar"
            style={{
              background: 'none', border: 'none', cursor: 'ew-resize',
              width: 34, height: 34, borderRadius: 8, color: '#9A8868',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M9 3v18" />
            </svg>
          </button>

          <button
            onClick={onNewChat}
            title="New chat"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 15, fontWeight: 600, color: '#F2EDD4',
              flex: 1, paddingLeft: 4, whiteSpace: 'nowrap',
              textAlign: 'left', padding: '0 0 0 4px', borderRadius: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#9A8868'}
            onMouseLeave={e => e.currentTarget.style.color = '#F2EDD4'}
          >
            Pargo AI
          </button>

          <button
            onClick={onNewChat}
            title="New chat"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              width: 34, height: 34, borderRadius: 8, color: '#9A8868',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 8px' }}>
        {convs.length === 0 && (
          <p style={{ fontSize: 13, color: '#504840', textAlign: 'center', marginTop: 32, lineHeight: 1.5 }}>
            No conversations yet
          </p>
        )}

        {/* Pinned section */}
        {pinnedConvs.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <p style={{
              fontSize: 11, color: '#706050', fontWeight: 600,
              padding: '10px 10px 4px', margin: 0, letterSpacing: '0.3px',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
              </svg>
              Pinned
            </p>
            {pinnedConvs.map(c => (
              <ConvItem
                key={c.id}
                conv={c}
                active={c.id === activeId}
                onOpen={() => openConv(c.id)}
                onDelete={e => deleteConv(c.id, e)}
                onRename={newTitle => renameConv(c.id, newTitle)}
                onPin={() => pinConv(c.id)}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}

        {/* Date groups for unpinned */}
        {Object.entries(groups).map(([label, items]) =>
          items.length > 0 && (
            <div key={label} style={{ marginBottom: 8 }}>
              <p style={{
                fontSize: 11, color: '#706050', fontWeight: 600,
                padding: '10px 10px 4px', margin: 0, letterSpacing: '0.3px',
              }}>
                {label}
              </p>
              {items.map(c => (
                <ConvItem
                  key={c.id}
                  conv={c}
                  active={c.id === activeId}
                  onOpen={() => openConv(c.id)}
                  onDelete={e => deleteConv(c.id, e)}
                  onRename={newTitle => renameConv(c.id, newTitle)}
                  onPin={() => pinConv(c.id)}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* User section */}
      <div style={{ padding: '8px 10px 12px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 10, cursor: 'default',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(145deg, #15110A 0%, #0D0A07 100%)', color: '#C9A84C', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700,
            border: '1px solid rgba(201,168,76,0.2)',
          }}>
            {(user.name || 'U').slice(0, 2).toUpperCase()}
          </div>
          <span style={{
            fontSize: 13.5, fontWeight: 500, color: '#F2EDD4', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user.name}
          </span>
          <form action={logoutAction}>
            <button type="submit" title="Sign out" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, color: '#9A8868', display: 'flex', alignItems: 'center', borderRadius: 6,
            }}
              onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = '#F2EDD4'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9A8868'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

/* ── Avatar ──────────────────────────────────────────── */
function GPTAvatar() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%',
      background: 'linear-gradient(145deg, #181410 0%, #0D0A07 100%)', color: '#C9A84C',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, flexShrink: 0,
      boxShadow: '0 0 14px rgba(201,168,76,0.4), 0 0 28px rgba(201,168,76,0.1)',
      border: '1px solid rgba(201,168,76,0.28)',
      textShadow: '0 0 8px rgba(215,178,80,0.6)',
    }}>P</div>
  );
}

/* ── Send button ─────────────────────────────────────── */
function SendButton({ onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={disabled ? '' : 'send-active'}
      style={{
        width: 34, height: 32, borderRadius: '60%',
        background: disabled ? 'rgba(201,168,76,0.02)' : 'linear-gradient(145deg, #221809 0%, #15110A 100%)',
        color: disabled ? 'rgba(201,168,76,0.18)' : '#C9A84C',
        border: disabled ? '1px solid rgba(201,168,76,0.06)' : '1px solid rgba(201,168,76,0.3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'background 0.2s',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
      </svg>
    </button>
  );
}

/* ── Typing dots ─────────────────────────────────────── */
function Thinking({ isMobile }) {
  const px = isMobile ? 12 : 24;
  const g  = isMobile ? 10 : 16;
  return (
    <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap: g, alignItems: 'flex-start' }}>
      <GPTAvatar />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'rgba(20,14,8,0.9)',
        border: '1px solid rgba(201,168,76,0.1)',
        borderTop: '1px solid rgba(215,178,80,0.2)',
        borderRadius: '3px 14px 14px 14px', padding: '10px 18px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,168,76,0.05)',
      }}>
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  );
}

/* ── Service chip (empty-state CTA) ─────────────────── */
function ServiceChip({ label, sub, icon, onClick, isMobile }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: isMobile ? '14px 18px' : '14px 20px',
        borderRadius: 12, border: '1px solid',
        borderColor: hov ? 'rgba(180,140,60,0.3)' : 'rgba(255,255,255,0.07)',
        background: hov ? 'rgba(30,22,8,0.9)' : 'rgba(255,255,255,0.025)',
        color: hov ? '#E8D5A0' : '#887858',
        cursor: 'pointer', textAlign: 'left',
        boxShadow: hov ? '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(180,140,60,0.12)' : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'all 0.2s ease',
        width: isMobile ? '100%' : 'auto',
        minWidth: isMobile ? 0 : 180,
      }}
    >
      <span style={{ flexShrink: 0, opacity: hov ? 1 : 0.7 }}>{icon}</span>
      <span>
        <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{label}</span>
        <span style={{ display: 'block', fontSize: 12, opacity: 0.6, marginTop: 2 }}>{sub}</span>
      </span>
    </button>
  );
}

/* ── Service menu item (inside the Services dropdown) ── */
function ServiceMenuItem({ label, sub, icon, onClick, isLast }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', padding: '13px 18px',
        background: hov ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: 'none', borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: hov ? 'rgba(50,35,10,0.9)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hov ? 'rgba(180,140,60,0.35)' : 'rgba(255,255,255,0.06)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: hov ? '#E0C880' : '#606878',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F2EDD4' }}>{label}</div>
        <div style={{ fontSize: 12, color: '#706050', marginTop: 1 }}>{sub}</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={hov ? '#A08840' : 'rgba(255,255,255,0.15)'} strokeWidth={2.5}
        style={{ marginLeft: 'auto', flexShrink: 0, transition: 'stroke 0.15s' }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

/* ── Message row ─────────────────────────────────────── */
function Message({ role, content, isMobile, onGuestFormSubmit, guestFormDone, hotelGuestCount, onSearchFormSubmit, searchFormDone, onHotelSelect, hotelListDone, onPaymentComplete, paymentGateDone, guestRef, onFlightSearchSubmit, flightSearchDone, onFlightSelect, flightListDone, onFlightGuestSubmit, flightGuestDone, flightPassengerCount, onFlightPaymentComplete, flightPaymentDone, flightGuestRef, onTransferSearchSubmit, transferSearchFormDone, onTransferSelect, transferListDone, onTransferGuestSubmit, transferGuestDone, transferGuestCount, onTransferPaymentComplete, transferPaymentDone, transferGuestRef }) {
  const px = isMobile ? 12 : 24;
  const gap = isMobile ? 10 : 16;
  if (role === 'user') {
    // Strip rateKey / offerId / code from selection messages before displaying
    const hotelMatch    = content.match(/^I'd like to book (.+?) \(rateKey:/);
    const flightMatch   = content.match(/^I'd like to book (.+?) \(offerId:/);
    const transferMatch = content.match(/^I'd like to book (.+?) \(rateKey:/);
    const display = hotelMatch
      ? `I'd like to book ${hotelMatch[1]}`
      : flightMatch
        ? `I'd like to book ${flightMatch[1]}`
        : transferMatch
          ? `I'd like to book ${transferMatch[1]}`
          : content;
    return (
      <div className="msg-user" style={{ padding: `6px ${px}px`, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          position: 'relative',
          background: 'rgba(15,10,6,0.97)',
          border: '1px solid rgba(201,168,76,0.15)',
          borderRight: '2px solid rgba(215,178,80,0.4)',
          color: '#E8D5A8',
          borderRadius: '14px 3px 14px 14px',
          padding: '10px 16px', maxWidth: '78%', fontSize: 15,
          lineHeight: 1.72, whiteSpace: 'pre-wrap', letterSpacing: '0.025em',
          boxShadow: '0 0 18px rgba(201,168,76,0.07), 0 4px 24px rgba(0,0,0,0.65)',
          textShadow: '0 0 14px rgba(201,168,76,0.08)',
        }}>
          <div className="user-bubble-laser" style={{
            position: 'absolute', top: 6, bottom: 6, right: -2,
            width: 2, borderRadius: 2,
            background: 'linear-gradient(180deg, transparent, rgba(215,178,80,0.8), transparent)',
            pointerEvents: 'none',
          }} />
          {display}
        </div>
      </div>
    );
  }
  const hotelListData = parseHotelListToken(content);
  if (hotelListData) {
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <HotelList hotels={hotelListData.hotels || []} onSelect={onHotelSelect} done={hotelListDone} isMobile={isMobile} />
      </div>
    );
  }
  const sfMatch = content.match(SEARCH_FORM_RE);
  if (sfMatch) {
    let prefill = {};
    try { if (sfMatch[1]) prefill = JSON.parse(sfMatch[1]); } catch {}
    const textBefore = content.slice(0, sfMatch.index).trim();
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <div style={{ flex: 1 }}>
          {textBefore && <p style={{ margin: '0 0 12px', color: '#9A8868', fontSize: 14 }}>{textBefore}</p>}
          <SearchForm prefill={prefill} onSubmit={onSearchFormSubmit} done={searchFormDone} />
        </div>
      </div>
    );
  }
  const paymentGateData = parsePaymentGateToken(content);
  if (paymentGateData) {
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <PaymentGate data={paymentGateData} guestRef={guestRef} onComplete={onPaymentComplete} done={paymentGateDone} />
      </div>
    );
  }
  const bookingConfirmedData = parseBookingConfirmedToken(content);
  if (bookingConfirmedData) {
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <BookingConfirmed data={bookingConfirmedData} />
      </div>
    );
  }
  const guestFormTokenIdx = content.indexOf('[GUEST_DETAILS_FORM]');
  if (guestFormTokenIdx !== -1) {
    const textBefore = content.slice(0, guestFormTokenIdx).trim();
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <div style={{ flex: 1 }}>
          {textBefore && <p style={{ margin: '0 0 12px', color: '#9A8868', fontSize: 14 }}>{textBefore}</p>}
          <GuestDetailsForm onSubmit={onGuestFormSubmit} done={guestFormDone} guestCount={hotelGuestCount || 1} />
        </div>
      </div>
    );
  }
  // Flight tokens
  const flightSearchMatch = content.match(FLIGHT_SEARCH_FORM_RE);
  if (flightSearchMatch) {
    let prefill = {};
    try { if (flightSearchMatch[1]) prefill = JSON.parse(flightSearchMatch[1]); } catch {}
    const textBefore = content.slice(0, flightSearchMatch.index).trim();
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <div style={{ flex: 1 }}>
          {textBefore && <p style={{ margin: '0 0 12px', color: '#9A8868', fontSize: 14 }}>{textBefore}</p>}
          <FlightSearchForm prefill={prefill} onSubmit={onFlightSearchSubmit} done={flightSearchDone} />
        </div>
      </div>
    );
  }
  const flightListData = parseFlightListToken(content);
  if (flightListData) {
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <FlightList flights={flightListData.flights || []} onSelect={onFlightSelect} done={flightListDone} />
      </div>
    );
  }
  const flightGuestTokenIdx = content.indexOf('[FLIGHT_GUEST_FORM]');
  if (flightGuestTokenIdx !== -1) {
    const textBefore = content.slice(0, flightGuestTokenIdx).trim();
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <div style={{ flex: 1 }}>
          {textBefore && <p style={{ margin: '0 0 12px', color: '#9A8868', fontSize: 14 }}>{textBefore}</p>}
          <FlightPassengerForm onSubmit={onFlightGuestSubmit} done={flightGuestDone} passengerCount={flightPassengerCount || 1} />
        </div>
      </div>
    );
  }
  const flightPaymentData = parseFlightPaymentToken(content);
  if (flightPaymentData) {
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <FlightPaymentGate data={flightPaymentData} flightGuestRef={flightGuestRef} onComplete={onFlightPaymentComplete} done={flightPaymentDone} />
      </div>
    );
  }
  const flightBookingData = parseFlightBookingConfirmedToken(content);
  if (flightBookingData) {
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <FlightBookingConfirmed data={flightBookingData} />
      </div>
    );
  }
  // Transfer tokens
  const transferSearchMatch = content.match(TRANSFER_SEARCH_FORM_RE);
  if (transferSearchMatch) {
    let prefill = {};
    try { if (transferSearchMatch[1]) prefill = JSON.parse(transferSearchMatch[1]); } catch {}
    const textBefore = content.slice(0, transferSearchMatch.index).trim();
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <div style={{ flex: 1 }}>
          {textBefore && <p style={{ margin: '0 0 12px', color: '#9A8868', fontSize: 14 }}>{textBefore}</p>}
          <TransferSearchForm prefill={prefill} onSubmit={onTransferSearchSubmit} done={transferSearchFormDone} />
        </div>
      </div>
    );
  }
  const transferListData = parseTransferListToken(content);
  if (transferListData) {
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <TransferList
          transfers={transferListData.transfers || []}
          fromName={transferListData.fromName}
          toName={transferListData.toName}
          date={transferListData.date}
          time={transferListData.time}
          onSelect={onTransferSelect}
          done={transferListDone}
          isMobile={isMobile}
        />
      </div>
    );
  }
  const transferGuestTokenIdx = content.indexOf('[TRANSFER_GUEST_FORM]');
  if (transferGuestTokenIdx !== -1) {
    const textBefore = content.slice(0, transferGuestTokenIdx).trim();
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <div style={{ flex: 1 }}>
          {textBefore && <p style={{ margin: '0 0 12px', color: '#9A8868', fontSize: 14 }}>{textBefore}</p>}
          <GuestDetailsForm
            onSubmit={onTransferGuestSubmit}
            done={transferGuestDone}
            guestCount={transferGuestCount || 1}
            heading="Passenger Details"
            confirmLabel="Continue to Payment"
          />
        </div>
      </div>
    );
  }
  const transferPaymentData = parseTransferPaymentToken(content);
  if (transferPaymentData) {
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <TransferPaymentGate data={transferPaymentData} transferGuestRef={transferGuestRef} onComplete={onTransferPaymentComplete} done={transferPaymentDone} />
      </div>
    );
  }
  const transferBookingData = parseTransferBookingConfirmedToken(content);
  if (transferBookingData) {
    return (
      <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <TransferBookingConfirmed data={transferBookingData} />
      </div>
    );
  }
  return (
    <div className="msg-bot" style={{ padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
      <GPTAvatar />
      <div className="bot-scanlines" style={{
        flex: 1, minWidth: 0, position: 'relative',
        background: 'rgba(18,13,8,0.92)',
        borderRadius: '3px 14px 14px 14px',
        border: '1px solid rgba(201,168,76,0.08)',
        borderTop: '1px solid rgba(215,178,80,0.18)',
        boxShadow: '0 2px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,168,76,0.04)',
        padding: '12px 16px',
        overflow: 'hidden',
      }}>
        <div className="prose-msg" style={{ fontSize: 15, lineHeight: 1.78, minWidth: 0, position: 'relative', zIndex: 2 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

/* ── Hotel List ──────────────────────────────────────── */
function parseHotelListToken(content) {
  const t = content.trim();
  if (!t.startsWith('[HOTEL_LIST:')) return null;
  try { return JSON.parse(t.slice('[HOTEL_LIST:'.length, -1)); } catch { return null; }
}

/* ── Photo carousel ──────────────────────────────────── */
function PhotoCarousel({ urls, name }) {
  const [idx, setIdx]       = useState(0);
  const [errors, setErrors] = useState({});
  const touchStartX         = useRef(null);

  const valid      = urls.filter((_, i) => !errors[i]);
  const clampedIdx = Math.min(idx, Math.max(valid.length - 1, 0));

  function prev(e) { e.stopPropagation(); setIdx(i => (i - 1 + valid.length) % valid.length); }
  function next(e) { e.stopPropagation(); setIdx(i => (i + 1) % valid.length); }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? setIdx(i => (i + 1) % valid.length) : setIdx(i => (i - 1 + valid.length) % valid.length);
    touchStartX.current = null;
  }

  if (valid.length === 0) {
    return (
      <div style={{
        width: '100%', height: 110, background: 'rgba(255,255,255,0.03)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth={1.5}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
        </svg>
      </div>
    );
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position: 'relative', width: '100%', height: 160, background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}
    >
      <img
        key={valid[clampedIdx]}
        src={valid[clampedIdx]}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => {
          const realIdx = urls.indexOf(valid[clampedIdx]);
          setErrors(p => ({ ...p, [realIdx]: true }));
        }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />

      {valid.length > 1 && (
        <>
          {/* Left arrow — 44px touch target */}
          <button onClick={prev} style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 44,
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 6,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </button>

          {/* Right arrow */}
          <button onClick={next} style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 44,
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>

          {/* Dots */}
          <div style={{
            position: 'absolute', bottom: 7, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: 5, pointerEvents: 'none',
          }}>
            {valid.map((_, i) => (
              <div key={i} style={{
                width: i === clampedIdx ? 14 : 6, height: 6, borderRadius: 3,
                background: i === clampedIdx ? '#fff' : 'rgba(255,255,255,0.5)',
                transition: 'width 0.2s',
              }} />
            ))}
          </div>

          {/* Count badge */}
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.5)', borderRadius: 6,
            padding: '2px 7px', fontSize: 11, color: '#fff', pointerEvents: 'none',
          }}>
            {clampedIdx + 1}/{valid.length}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Hotel card ──────────────────────────────────────── */
function HotelCard({ hotel, imageUrls, onSelect, isMobile }) {
  const fmt = n => Number(n).toLocaleString('en-IN');
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(hotel)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(hotel); }}
      style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, marginBottom: 10,
        cursor: 'pointer', textAlign: 'left', width: '100%',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
        overflow: 'hidden', padding: 0,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={e => { if (!isMobile) { e.currentTarget.style.borderColor = 'rgba(180,140,60,0.25)'; e.currentTarget.style.boxShadow = '0 8px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}}
      onMouseLeave={e => { if (!isMobile) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}}
    >
      <PhotoCarousel urls={imageUrls} name={hotel.name} />

      <div style={{ padding: isMobile ? '10px 12px' : '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <div style={{ fontWeight: 600, fontSize: isMobile ? 13 : 14, color: '#F2EDD4', lineHeight: 1.3 }}>{hotel.name}</div>
            {hotel.categoryName && (
              <div style={{ fontSize: 11, color: '#9A8868', marginTop: 2 }}>{hotel.categoryName}</div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 14, color: '#F2EDD4' }}>
              {hotel.currency} {fmt(hotel.minRate)}
            </div>
            <div style={{ fontSize: 11, color: '#706050' }}>per night</div>
          </div>
        </div>

        {hotel.facilities?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {hotel.facilities.map((f, i) => (
              <span key={i} style={{
                fontSize: 11, color: '#907840', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, padding: '3px 7px',
              }}>{f}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HotelList({ hotels, onSelect, done, isMobile }) {
  const [imageMap, setImageMap] = useState({});

  // Use a stable string dependency so this only fires when hotel codes change,
  // not on every re-render (hotels is a new array reference each time).
  const codesStr = hotels.map(h => h.code).join(',');

  useEffect(() => {
    if (!codesStr) return;
    fetch(`/api/hotels/images?codes=${codesStr}`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(data => setImageMap(data))
      .catch(err => console.warn('[HotelList] image fetch failed:', err));
  }, [codesStr]);

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#4ADE80',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Hotel selected
      </div>
    );
  }

  const sorted = [...hotels].sort((a, b) => a.minRate - b.minRate);
  const mid = Math.ceil(sorted.length / 2);
  const affordable = sorted.slice(0, mid);
  const premium = sorted.slice(mid);
  const fmt = n => Number(n).toLocaleString('en-IN');
  const cur = sorted[0]?.currency || '';

  const SectionHeader = ({ label, low, high }) => (
    <div style={{
      fontSize: 11, fontWeight: 600, color: '#706050',
      textTransform: 'uppercase', letterSpacing: '0.5px',
      marginBottom: 8, marginTop: 4,
    }}>
      {label}
      <span style={{ fontWeight: 400, color: '#5A4A38', marginLeft: 6 }}>
        {cur} {fmt(low)} – {fmt(high)} / night
      </span>
    </div>
  );

  return (
    <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 520 }}>
      <p style={{ margin: '0 0 14px', fontSize: 15, color: '#E8D5A8' }}>
        Here are the available hotels. Tap one to select:
      </p>

      {affordable.length > 0 && (
        <div>
          <SectionHeader
            label="Affordable"
            low={affordable[0].minRate}
            high={affordable[affordable.length - 1].minRate}
          />
          {affordable.map(h => <HotelCard key={h.code} hotel={h} imageUrls={imageMap[String(h.code)] || []} onSelect={onSelect} isMobile={isMobile} />)}
        </div>
      )}

      {premium.length > 0 && (
        <div style={{ marginTop: affordable.length ? 8 : 0 }}>
          <SectionHeader
            label="Premium"
            low={premium[0].minRate}
            high={premium[premium.length - 1].minRate}
          />
          {premium.map(h => <HotelCard key={h.code} hotel={h} imageUrls={imageMap[String(h.code)] || []} onSelect={onSelect} isMobile={isMobile} />)}
        </div>
      )}
    </div>
  );
}

/* ── Payment token helpers ───────────────────────────── */
function parsePaymentGateToken(content) {
  const t = content.trim();
  if (!t.startsWith('[PAYMENT_GATE:')) return null;
  try { return JSON.parse(t.slice('[PAYMENT_GATE:'.length, -1)); } catch { return null; }
}

function parseBookingConfirmedToken(content) {
  const t = content.trim();
  if (!t.startsWith('[BOOKING_CONFIRMED:')) return null;
  try { return JSON.parse(t.slice('[BOOKING_CONFIRMED:'.length, -1)); } catch { return null; }
}

/* ── PaymentGate (Razorpay checkout) ─────────────────── */
function PaymentGate({ data, guestRef, onComplete, done }) {
  const [paying, setPaying] = useState(false);
  const [error,  setError]  = useState('');

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#4ADE80',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Payment complete
      </div>
    );
  }

  async function handlePay() {
    if (paying) return;
    setPaying(true);
    setError('');
    try {
      const guestList = Array.isArray(guestRef.current) ? guestRef.current : [guestRef.current];
      const rzpResponse = await payWithRazorpay({
        amount: data.amount,
        currency: data.currency || 'INR',
        description: data.hotelName,
        guest: guestList[0],
      });
      const res = await fetch('/api/payment/verify-and-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'hotel',
          razorpay_payment_id: rzpResponse.razorpay_payment_id,
          razorpay_order_id:   rzpResponse.razorpay_order_id,
          razorpay_signature:  rzpResponse.razorpay_signature,
          rateKey: data.rateKey,
          guests: guestList,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      onComplete(await res.json());
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
      setPaying(false);
    }
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: '20px', width: '100%', maxWidth: 340,
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 15, color: '#F2EDD4' }}>
        Payment
      </p>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#9A8868' }}>{data.hotelName}</p>

      <div style={{
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10, padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between', marginBottom: 16,
      }}>
        <span style={{ fontSize: 13, color: '#9A8868' }}>Total</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#F2EDD4' }}>
          {data.currency} {Number(data.amount).toLocaleString('en-IN')}
        </span>
      </div>

      {error && (
        <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{error}</p>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={paying}
        style={{
          width: '100%', padding: '11px', marginTop: 4,
          borderRadius: 10, border: 'none',
          background: paying ? 'rgba(255,255,255,0.04)' : 'linear-gradient(145deg, #3A2A10 0%, #251A08 100%)',
          color: paying ? '#4A3D28' : '#fff', fontSize: 14, fontWeight: 600,
          cursor: paying ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
          boxShadow: paying ? 'none' : '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        {paying ? 'Processing...' : `Pay ${data.currency} ${Number(data.amount).toLocaleString('en-IN')}`}
      </button>
    </div>
  );
}

/* ── BookingConfirmed ────────────────────────────────── */
function BookingConfirmed({ data }) {
  const row = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 13, color: '#9A8868' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#F2EDD4', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '20px', width: '100%', maxWidth: 380,
      boxShadow: '0 16px 56px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: 'rgba(74,222,128,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#4ADE80' }}>Booking Confirmed!</span>
      </div>

      {row('Reference',  data.reference  || '—')}
      {row('Hotel',      data.hotelName  || '—')}
      {row('Guest',      data.holder     || '—')}
      {row('Check-in',   data.checkIn    || '—')}
      {row('Check-out',  data.checkOut   || '—')}
      {row('Total paid', `${data.currency} ${Number(data.total).toLocaleString('en-IN')}`)}
    </div>
  );
}

/* ── Search Form ─────────────────────────────────────── */
// Matches the token whether it appears alone or after a short error message
const SEARCH_FORM_RE = /\[SEARCH_FORM(?::(\{[\s\S]*?\}))?\]/;

function SearchForm({ prefill = {}, onSubmit, done }) {
  const today = new Date().toISOString().split('T')[0];
  const [destination, setDestination] = useState(prefill.destination || '');
  const [checkin,     setCheckin]     = useState(prefill.checkin  || '');
  const [checkout,    setCheckout]    = useState(prefill.checkout || '');
  const [adultsStr, setAdultsStr] = useState(String(prefill.adults || 2));

  const adults = Math.max(1, parseInt(adultsStr, 10) || 1);
  const valid  = destination.trim() && checkin && checkout && checkin < checkout;

  function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    onSubmit(destination.trim(), checkin, checkout, adults);
  }

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#4ADE80',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Search submitted
      </div>
    );
  }

  const fieldStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)', fontSize: 14, outline: 'none',
    color: '#D8C8A0', background: 'rgba(255,255,255,0.04)', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  const labelStyle = { display: 'block', marginBottom: 12 };
  const labelTextStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: '#9A8868', marginBottom: 5 };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: '20px', width: '100%', maxWidth: 340,
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      <p style={{ margin: '0 0 16px', fontWeight: 600, fontSize: 15, color: '#F2EDD4' }}>
        Where do you want to stay?
      </p>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Destination</span>
        <input
          type="text" value={destination} required
          onChange={e => setDestination(e.target.value)}
          placeholder="e.g. Goa, Paris, Bali"
          style={fieldStyle}
          onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
        />
      </label>

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Check-in</span>
          <input
            type="date" value={checkin} required min={today}
            onChange={e => setCheckin(e.target.value)}
            style={fieldStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
          />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Check-out</span>
          <input
            type="date" value={checkout} required min={checkin || today}
            onChange={e => setCheckout(e.target.value)}
            style={fieldStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
          />
        </label>
      </div>

      <label style={{ ...labelStyle, marginBottom: 18 }}>
        <span style={labelTextStyle}>Adults</span>
        <input
          type="number"
          value={adultsStr}
          min={1}
          inputMode="numeric"
          required
          onChange={e => setAdultsStr(e.target.value)}
          onBlur={e => {
            const n = Math.max(1, parseInt(e.target.value, 10) || 1);
            setAdultsStr(String(n));
            e.target.style.borderColor = 'rgba(255,255,255,0.1)';
          }}
          style={fieldStyle}
          onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }}
        />
      </label>

      <button
        type="submit"
        disabled={!valid}
        style={{
          width: '100%', padding: '11px',
          borderRadius: 10, border: 'none',
          background: valid ? 'linear-gradient(145deg, #3A2A10 0%, #251A08 100%)' : 'rgba(255,255,255,0.04)',
          color: valid ? '#E0C878' : '#4A3D28', fontSize: 14, fontWeight: 600,
          cursor: valid ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s',
          boxShadow: valid ? '0 4px 20px rgba(0,0,0,0.5)' : 'none',
        }}
      >
        Search Hotels
      </button>
    </form>
  );
}

/* ── Guest Details Form ──────────────────────────────── */
function emptyGuest() {
  return { firstName: '', lastName: '', email: '', phone: '' };
}

function GuestSection({ index, total, data, onChange }) {
  const isLead = index === 0;
  const fieldStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)', fontSize: 14, outline: 'none',
    color: '#D8C8A0', background: 'rgba(255,255,255,0.04)', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  const labelStyle     = { display: 'block', marginBottom: 12 };
  const labelTextStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: '#9A8868', marginBottom: 5 };
  const set = (field, val) => onChange(index, field, val);

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px',
      background: 'rgba(255,255,255,0.02)',
      marginBottom: total > 1 ? 16 : 0,
    }}>
      {total > 1 && (
        <p style={{ margin: '0 0 14px', fontWeight: 600, fontSize: 13, color: '#A08840', letterSpacing: '0.2px' }}>
          {isLead ? 'Guest 1 (Lead)' : `Guest ${index + 1}`}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>First Name</span>
          <input
            type="text" value={data.firstName} required
            onChange={e => set('firstName', e.target.value)}
            placeholder="Rahul"
            style={fieldStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
          />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Last Name</span>
          <input
            type="text" value={data.lastName} required
            onChange={e => set('lastName', e.target.value)}
            placeholder="Sharma"
            style={fieldStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
          />
        </label>
      </div>

      {isLead && (
        <>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Email Address</span>
            <input
              type="email" value={data.email} required
              onChange={e => set('email', e.target.value)}
              placeholder="rahul@example.com"
              style={fieldStyle}
              onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
            />
          </label>

          <label style={{ ...labelStyle, marginBottom: 0 }}>
            <span style={labelTextStyle}>Phone Number</span>
            <input
              type="tel" value={data.phone} required
              onChange={e => set('phone', e.target.value)}
              placeholder="9834725737"
              style={fieldStyle}
              onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
            />
          </label>
        </>
      )}
    </div>
  );
}

function GuestDetailsForm({ onSubmit, done, guestCount = 1, heading = 'Enter your booking details', confirmLabel = 'Confirm Booking' }) {
  const [guests, setGuests] = useState(() => Array.from({ length: guestCount }, emptyGuest));

  const valid = guests.every((g, i) =>
    g.firstName.trim() && g.lastName.trim() && (i > 0 || (g.email.trim() && g.phone.trim()))
  );

  function handleChange(index, field, value) {
    setGuests(prev => prev.map((g, i) => i === index ? { ...g, [field]: value } : g));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    onSubmit(guests.map(g => ({ ...g, firstName: g.firstName.trim(), lastName: g.lastName.trim(), email: g.email.trim(), phone: g.phone.trim() })));
  }

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#4ADE80',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Details submitted
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: '20px', width: '100%', maxWidth: 340,
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      <p style={{ margin: '0 0 16px', fontWeight: 600, fontSize: 15, color: '#F2EDD4' }}>
        {heading}
      </p>

      {guests.map((g, i) => (
        <GuestSection key={i} index={i} total={guestCount} data={g} onChange={handleChange} />
      ))}

      <button
        type="submit"
        disabled={!valid}
        style={{
          width: '100%', marginTop: 16, padding: '11px',
          borderRadius: 10, border: 'none',
          background: valid ? 'linear-gradient(145deg, #3A2A10 0%, #251A08 100%)' : 'rgba(255,255,255,0.04)',
          color: valid ? '#E0C878' : '#4A3D28', fontSize: 14, fontWeight: 600,
          cursor: valid ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s',
          boxShadow: valid ? '0 4px 20px rgba(0,0,0,0.5)' : 'none',
        }}
      >
        {guestCount > 1 ? `Confirm ${guestCount} Guests` : confirmLabel}
      </button>
    </form>
  );
}


/* ── Flight Search Form ──────────────────────────────── */
const FLIGHT_SEARCH_FORM_RE = /\[FLIGHT_SEARCH_FORM(?::(\{[\s\S]*?\}))?\]/;

function FlightSearchForm({ prefill = {}, onSubmit, done }) {
  const today = new Date().toISOString().split('T')[0];
  const [from,       setFrom]       = useState(prefill.from       || '');
  const [to,         setTo]         = useState(prefill.to         || '');
  const [departure,  setDeparture]  = useState(prefill.departure  || '');
  const [returnDate, setReturn]     = useState(prefill.return     || '');
  const [tripType,   setTripType]   = useState(prefill.return ? 'round' : 'one');
  const [passengers, setPassengers] = useState(String(prefill.passengers || 1));
  const [cabin,      setCabin]      = useState(prefill.cabin || 'economy');

  const valid = from.trim() && to.trim() && departure;

  function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    const ret = tripType === 'round' ? returnDate : '';
    onSubmit(from.trim(), to.trim(), departure, ret, parseInt(passengers) || 1, cabin);
  }

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#4ADE80',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Flight search submitted
      </div>
    );
  }

  const fieldStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)', fontSize: 14, outline: 'none',
    color: '#D8C8A0', background: 'rgba(255,255,255,0.04)', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  const labelStyle     = { display: 'block', marginBottom: 12 };
  const labelTextStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: '#9A8868', marginBottom: 5 };

  return (
    <form onSubmit={handleSubmit} style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '20px', width: '100%', maxWidth: 380,
      boxShadow: '0 16px 56px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <p style={{ margin: '0 0 14px', fontWeight: 600, fontSize: 15, color: '#F2EDD4' }}>
        Search Flights
      </p>

      {/* Trip type toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['one', 'round'].map(t => (
          <button key={t} type="button" onClick={() => setTripType(t)} style={{
            flex: 1, padding: '7px', borderRadius: 8, border: '1px solid',
            borderColor: tripType === t ? 'transparent' : 'rgba(255,255,255,0.1)',
            background: tripType === t ? 'linear-gradient(145deg, #3A2A10 0%, #251A08 100%)' : 'rgba(255,255,255,0.04)',
            color: tripType === t ? '#E0C878' : '#6A5A38',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            {t === 'one' ? 'One-way' : 'Round-trip'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>From</span>
          <input type="text" value={from} required placeholder="Mumbai" onChange={e => setFrom(e.target.value)} style={fieldStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>To</span>
          <input type="text" value={to} required placeholder="Dubai" onChange={e => setTo(e.target.value)} style={fieldStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Departure</span>
          <input type="date" value={departure} required min={today} onChange={e => setDeparture(e.target.value)} style={fieldStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
        </label>
        {tripType === 'round' && (
          <label style={{ ...labelStyle, flex: 1 }}>
            <span style={labelTextStyle}>Return</span>
            <input type="date" value={returnDate} min={departure || today} onChange={e => setReturn(e.target.value)} style={fieldStyle}
              onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
          </label>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Passengers</span>
          <input type="number" value={passengers} min={1} max={9} required onChange={e => setPassengers(e.target.value)}
            onBlur={e => { const n = Math.min(9, Math.max(1, parseInt(e.target.value) || 1)); setPassengers(String(n)); e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
            style={fieldStyle} onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Cabin</span>
          <select value={cabin} onChange={e => setCabin(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
            <option value="economy" style={{ background: '#150F06', color: '#F2EDD4' }}>Economy</option>
            <option value="premium_economy" style={{ background: '#150F06', color: '#F2EDD4' }}>Premium Economy</option>
            <option value="business" style={{ background: '#150F06', color: '#F2EDD4' }}>Business</option>
            <option value="first" style={{ background: '#150F06', color: '#F2EDD4' }}>First</option>
          </select>
        </label>
      </div>

      <button type="submit" disabled={!valid} style={{
        width: '100%', padding: '11px', marginTop: 4, borderRadius: 10, border: 'none',
        background: valid ? 'linear-gradient(145deg, #3A2A10 0%, #251A08 100%)' : 'rgba(255,255,255,0.04)',
        color: valid ? '#E0C878' : '#4A3D28', fontSize: 14, fontWeight: 600,
        cursor: valid ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
        boxShadow: valid ? '0 4px 20px rgba(0,0,0,0.5)' : 'none',
      }}>
        Search Flights
      </button>
    </form>
  );
}

/* ── Flight List ─────────────────────────────────────── */
function parseFlightListToken(content) {
  const t = content.trim();
  if (!t.startsWith('[FLIGHT_LIST:')) return null;
  try { return JSON.parse(t.slice('[FLIGHT_LIST:'.length, -1)); } catch { return null; }
}

function FlightCard({ flight, onSelect, done }) {
  const [hov, setHov] = useState(false);
  const stops = flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`;
  const cabinLabel = { economy: 'Economy', premium_economy: 'Prem. Economy', business: 'Business', first: 'First' }[flight.cabinClass] || 'Economy';

  return (
    <div
      onClick={() => !done && onSelect(flight)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'rgba(255,255,255,0.03)', border: `1px solid ${hov && !done ? 'rgba(180,140,60,0.3)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 12, padding: '14px 16px', cursor: done ? 'default' : 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        boxShadow: hov && !done ? '0 8px 32px rgba(0,0,0,0.55)' : '0 8px 40px rgba(0,0,0,0.4)',
        transform: hov && !done ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      {/* Airline + cabin */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {flight.airlineCode && (
            <img
              src={`https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/${flight.airlineCode}.svg`}
              alt={flight.airline}
              style={{ height: 18, maxWidth: 60, objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none'; }}
            />
          )}
          <span style={{ fontSize: 13, fontWeight: 600, color: '#F2EDD4' }}>{flight.airline}</span>
        </div>
        <span style={{ fontSize: 11, color: '#907840', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '2px 8px' }}>
          {cabinLabel}
        </span>
      </div>

      {/* Route + times */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ textAlign: 'center', minWidth: 44 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#F2EDD4' }}>{flight.departure.time}</div>
          <div style={{ fontSize: 11, color: '#9A8868' }}>{flight.origin}</div>
          <div style={{ fontSize: 11, color: '#706050' }}>{flight.departure.date}</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ fontSize: 11, color: '#9A8868' }}>{flight.duration}</div>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(130,110,200,0.4)" strokeWidth={1.5}>
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 11, color: flight.stops === 0 ? '#16a34a' : '#d97706', fontWeight: 500 }}>{stops}</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 44 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#F2EDD4' }}>{flight.arrival.time}</div>
          <div style={{ fontSize: 11, color: '#9A8868' }}>{flight.destination}</div>
          <div style={{ fontSize: 11, color: '#706050' }}>{flight.arrival.date}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F2EDD4' }}>
            {Number(flight.amount).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 11, color: '#9A8868' }}>{flight.currency}</div>
        </div>
      </div>

      {!done && (
        <div style={{ fontSize: 12, color: hov ? '#A08840' : '#5A4A38', textAlign: 'right', marginTop: 4, fontWeight: hov ? 600 : 400 }}>
          {hov ? 'Click to select →' : 'Select'}
        </div>
      )}
    </div>
  );
}

function FlightList({ flights, onSelect, done }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 480 }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, color: '#9A8868' }}>
        {flights.length} flight{flights.length !== 1 ? 's' : ''} found — sorted by price
      </p>
      {flights.map((f, i) => (
        <FlightCard key={f.offerId || i} flight={f} onSelect={onSelect} done={done} />
      ))}
    </div>
  );
}

/* ── Flight Guest Form ───────────────────────────────── */
function PassengerSection({ index, total, data, onChange }) {
  const fieldStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)', fontSize: 14, outline: 'none',
    color: '#D8C8A0', background: 'rgba(255,255,255,0.04)', boxSizing: 'border-box', transition: 'border-color 0.15s',
  };
  const labelStyle     = { display: 'block', marginBottom: 12 };
  const labelTextStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: '#9A8868', marginBottom: 5 };
  const set = (field, val) => onChange(index, field, val);

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px',
      background: 'rgba(255,255,255,0.02)',
      marginBottom: total > 1 ? 16 : 0,
    }}>
      {total > 1 && (
        <p style={{ margin: '0 0 14px', fontWeight: 600, fontSize: 13, color: '#A08840', letterSpacing: '0.2px' }}>
          Passenger {index + 1}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, width: 90 }}>
          <span style={labelTextStyle}>Title</span>
          <select value={data.title} onChange={e => { set('title', e.target.value); set('gender', ['ms', 'mrs', 'miss'].includes(e.target.value) ? 'f' : 'm'); }}
            style={{ ...fieldStyle, cursor: 'pointer', padding: '9px 8px' }}>
            <option value="mr" style={{ background: '#150F06', color: '#F2EDD4' }}>Mr</option>
            <option value="mrs" style={{ background: '#150F06', color: '#F2EDD4' }}>Mrs</option>
            <option value="ms" style={{ background: '#150F06', color: '#F2EDD4' }}>Ms</option>
            <option value="miss" style={{ background: '#150F06', color: '#F2EDD4' }}>Miss</option>
          </select>
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>First Name</span>
          <input type="text" value={data.firstName} required placeholder="Rahul" onChange={e => set('firstName', e.target.value)} style={fieldStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Last Name</span>
          <input type="text" value={data.lastName} required placeholder="Sharma" onChange={e => set('lastName', e.target.value)} style={fieldStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Date of Birth</span>
          <input type="date" value={data.dob} required max={new Date().toISOString().split('T')[0]} onChange={e => set('dob', e.target.value)} style={fieldStyle}
            onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
        </label>
        <label style={{ ...labelStyle, width: 110 }}>
          <span style={labelTextStyle}>Gender</span>
          <select value={data.gender} onChange={e => set('gender', e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
            <option value="m" style={{ background: '#150F06', color: '#F2EDD4' }}>Male</option>
            <option value="f" style={{ background: '#150F06', color: '#F2EDD4' }}>Female</option>
          </select>
        </label>
      </div>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Email Address</span>
        <input type="email" value={data.email} required placeholder="rahul@example.com" onChange={e => set('email', e.target.value)} style={fieldStyle}
          onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
      </label>

      <label style={{ ...labelStyle, marginBottom: 0 }}>
        <span style={labelTextStyle}>Phone Number (with country code)</span>
        <input type="tel" value={data.phone} required placeholder="+919834725737" onChange={e => set('phone', e.target.value)} style={fieldStyle}
          onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
      </label>
    </div>
  );
}

function emptyPassenger() {
  return { title: 'mr', firstName: '', lastName: '', dob: '', gender: 'm', email: '', phone: '' };
}

function FlightPassengerForm({ onSubmit, done, passengerCount = 1 }) {
  const [passengers, setPassengers] = useState(() =>
    Array.from({ length: passengerCount }, emptyPassenger)
  );

  const valid = passengers.every(p => p.firstName.trim() && p.lastName.trim() && p.dob && p.email.trim() && p.phone.trim());

  function handleChange(index, field, value) {
    setPassengers(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    onSubmit(passengers.map(p => ({ ...p, firstName: p.firstName.trim(), lastName: p.lastName.trim(), email: p.email.trim(), phone: p.phone.trim() })));
  }

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#4ADE80',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Passenger details submitted
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: '20px', width: '100%', maxWidth: 400,
      boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)',
    }}>
      <p style={{ margin: '0 0 16px', fontWeight: 600, fontSize: 15, color: '#F2EDD4' }}>
        Passenger Details
      </p>

      {passengers.map((p, i) => (
        <PassengerSection key={i} index={i} total={passengerCount} data={p} onChange={handleChange} />
      ))}

      <button type="submit" disabled={!valid} style={{
        width: '100%', marginTop: 16, padding: '11px', borderRadius: 10, border: 'none',
        background: valid ? 'linear-gradient(145deg, #3A2A10 0%, #251A08 100%)' : 'rgba(255,255,255,0.04)',
        color: valid ? '#E0C878' : '#4A3D28', fontSize: 14, fontWeight: 600,
        cursor: valid ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
        boxShadow: valid ? '0 4px 20px rgba(0,0,0,0.5)' : 'none',
      }}>
        {passengerCount > 1 ? `Confirm ${passengerCount} Passengers` : 'Confirm Passenger'}
      </button>
    </form>
  );
}

/* ── Flight Payment Gate ─────────────────────────────── */
function parseFlightPaymentToken(content) {
  const t = content.trim();
  if (!t.startsWith('[FLIGHT_PAYMENT_GATE:')) return null;
  try { return JSON.parse(t.slice('[FLIGHT_PAYMENT_GATE:'.length, -1)); } catch { return null; }
}

function parseFlightBookingConfirmedToken(content) {
  const t = content.trim();
  if (!t.startsWith('[FLIGHT_BOOKING_CONFIRMED:')) return null;
  try { return JSON.parse(t.slice('[FLIGHT_BOOKING_CONFIRMED:'.length, -1)); } catch { return null; }
}

function FlightPaymentGate({ data, flightGuestRef, onComplete, done }) {
  const [paying, setPaying] = useState(false);
  const [error,  setError]  = useState('');

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#4ADE80',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Payment complete
      </div>
    );
  }

  async function handlePay() {
    if (paying) return;
    setPaying(true);
    setError('');
    try {
      const guestList = Array.isArray(flightGuestRef.current)
        ? flightGuestRef.current
        : [flightGuestRef.current];
      const rzpResponse = await payWithRazorpay({
        amount: data.amount,
        currency: data.currency || 'INR',
        description: `${data.airline} · ${data.route}`,
        guest: guestList[0],
      });
      const res = await fetch('/api/payment/verify-and-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'flight',
          razorpay_payment_id: rzpResponse.razorpay_payment_id,
          razorpay_order_id:   rzpResponse.razorpay_order_id,
          razorpay_signature:  rzpResponse.razorpay_signature,
          offerId:      data.offerId,
          passengerIds: data.passengerIds,
          guests:       guestList,
          flightMeta: {
            route:         data.route,
            departureDate: data.departureDate,
            airline:       data.airline,
            cabinClass:    data.cabinClass || 'economy',
          },
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Booking failed'); }
      onComplete(await res.json());
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
      setPaying(false);
    }
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: '20px', width: '100%', maxWidth: 340,
      boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)',
    }}>
      <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 15, color: '#F2EDD4' }}>Payment</p>
      <p style={{ margin: '0 0 4px', fontSize: 13, color: '#9A8868' }}>{data.airline} · {data.route}</p>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#706050' }}>{data.departureDate}</p>

      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#9A8868' }}>Total</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#F2EDD4' }}>
          {data.currency} {Number(data.amount).toLocaleString('en-IN')}
        </span>
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

      <button type="button" onClick={handlePay} disabled={paying} style={{
        width: '100%', padding: '11px', marginTop: 4, borderRadius: 10, border: 'none',
        background: paying ? 'rgba(255,255,255,0.04)' : 'linear-gradient(145deg, #3A2A10 0%, #251A08 100%)',
        color: paying ? '#4A3D28' : '#fff', fontSize: 14, fontWeight: 600,
        cursor: paying ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
        boxShadow: paying ? 'none' : '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        {paying ? 'Processing...' : `Pay ${data.currency} ${Number(data.amount).toLocaleString('en-IN')}`}
      </button>
    </div>
  );
}

/* ── Flight Booking Confirmed ────────────────────────── */
function FlightBookingConfirmed({ data }) {
  const row = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 13, color: '#9A8868' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#F2EDD4', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '20px', width: '100%', maxWidth: 380,
      boxShadow: '0 16px 56px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: 'rgba(74,222,128,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#4ADE80' }}>Flight Booked!</span>
      </div>
      {row('Reference',    data.reference    || '—')}
      {row('Airline',      data.airline      || '—')}
      {row('Route',        `${data.origin} → ${data.destination}` || '—')}
      {row('Passenger',    data.passengerName || '—')}
      {row('Departure',    data.departureAt   || '—')}
      {row('Arrival',      data.arrivalAt     || '—')}
      {row('Total paid',   `${data.currency} ${Number(data.total).toLocaleString('en-IN')}`)}
    </div>
  );
}

/* ── Transfers ───────────────────────────────────────── */
const TRANSFER_SEARCH_FORM_RE = /\[TRANSFER_SEARCH_FORM(?::(\{[\s\S]*?\}))?\]/;

function parseTransferListToken(content) {
  const t = content.trim();
  if (!t.startsWith('[TRANSFER_LIST:')) return null;
  try { return JSON.parse(t.slice('[TRANSFER_LIST:'.length, -1)); } catch { return null; }
}
function parseTransferPaymentToken(content) {
  const t = content.trim();
  if (!t.startsWith('[TRANSFER_PAYMENT_GATE:')) return null;
  try { return JSON.parse(t.slice('[TRANSFER_PAYMENT_GATE:'.length, -1)); } catch { return null; }
}
function parseTransferBookingConfirmedToken(content) {
  const t = content.trim();
  if (!t.startsWith('[TRANSFER_BOOKING_CONFIRMED:')) return null;
  try { return JSON.parse(t.slice('[TRANSFER_BOOKING_CONFIRMED:'.length, -1)); } catch { return null; }
}

const LOCATION_TYPES = [
  { value: 'IATA',    label: 'Airport',  placeholder: 'e.g. Delhi Airport, BOM' },
  { value: 'ATLAS',   label: 'Hotel / City', placeholder: 'e.g. Connaught Place, Delhi' },
  { value: 'PORT',    label: 'Cruise Port',  placeholder: 'e.g. Barcelona Cruise Port' },
  { value: 'STATION', label: 'Station',      placeholder: 'e.g. Roma Termini, Mumbai CSMT' },
];

function TransferSearchForm({ prefill = {}, onSubmit, done }) {
  const today = new Date().toISOString().split('T')[0];
  const [from,      setFrom]      = useState(prefill.from  || '');
  const [fromType,  setFromType]  = useState(prefill.fromType || 'IATA');
  const [to,        setTo]        = useState(prefill.to    || '');
  const [toType,    setToType]    = useState(prefill.toType  || 'ATLAS');
  const [date,      setDate]      = useState(prefill.date  || '');
  const [adultsStr, setAdultsStr] = useState(String(prefill.adults || 2));

  // 12-hour time state — parse prefill.time (HH:MM) if provided
  const initTime = (() => {
    if (!prefill.time) return { hour: '12', minute: '00', period: 'PM' };
    const [h, m] = prefill.time.split(':').map(Number);
    return {
      hour:   h === 0 ? '12' : h > 12 ? String(h - 12) : String(h),
      minute: String(m || 0).padStart(2, '0'),
      period: h >= 12 ? 'PM' : 'AM',
    };
  })();
  const [hour,   setHour]   = useState(initTime.hour);
  const [minute, setMinute] = useState(initTime.minute);
  const [period, setPeriod] = useState(initTime.period);

  // Convert to HH:MM for the API
  const time24 = (() => {
    let h = parseInt(hour, 10) || 12;
    if (period === 'AM') { if (h === 12) h = 0; }
    else                 { if (h !== 12) h += 12; }
    return `${String(h).padStart(2, '0')}:${minute}`;
  })();

  const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];
  function incrHour()   { setHour(h => String(parseInt(h, 10) % 12 + 1)); }
  function decrHour()   { setHour(h => String((parseInt(h, 10) - 2 + 12) % 12 + 1)); }
  function incrMinute() { setMinute(m => MINUTES[(MINUTES.indexOf(m) + 1) % MINUTES.length]); }
  function decrMinute() { setMinute(m => MINUTES[(MINUTES.indexOf(m) - 1 + MINUTES.length) % MINUTES.length]); }

  const adults = Math.max(1, parseInt(adultsStr, 10) || 1);
  const valid  = from.trim() && to.trim() && date && hour && minute;

  function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    onSubmit(from.trim(), fromType, to.trim(), toType, date, time24, adults);
  }

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#4ADE80',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Search submitted
      </div>
    );
  }

  const fieldStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)', fontSize: 14, outline: 'none',
    color: '#D8C8A0', background: 'rgba(255,255,255,0.04)', boxSizing: 'border-box', transition: 'border-color 0.15s',
  };
  const labelStyle     = { display: 'block', marginBottom: 12 };
  const labelTextStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: '#9A8868', marginBottom: 5 };

  return (
    <form onSubmit={handleSubmit} style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: '20px', width: '100%', maxWidth: 340,
      boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)',
    }}>
      <p style={{ margin: '0 0 16px', fontWeight: 600, fontSize: 15, color: '#F2EDD4' }}>
        Book a Transfer
      </p>

      {/* FROM */}
      <div style={labelStyle}>
        <span style={labelTextStyle}>From</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
          {LOCATION_TYPES.map(lt => (
            <button key={lt.value} type="button" onClick={() => setFromType(lt.value)} style={{
              padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: fromType === lt.value ? '1.5px solid rgba(180,140,60,0.3)' : '1.5px solid rgba(255,255,255,0.07)',
              background: fromType === lt.value ? 'rgba(40,28,10,0.8)' : 'rgba(255,255,255,0.03)',
              color: fromType === lt.value ? '#E0C880' : '#6A5A38',
              transition: 'all 0.15s',
            }}>{lt.label}</button>
          ))}
        </div>
        <input type="text" value={from} required
          placeholder={(LOCATION_TYPES.find(l => l.value === fromType) || LOCATION_TYPES[0]).placeholder}
          onChange={e => setFrom(e.target.value)} style={fieldStyle}
          onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
      </div>

      {/* TO */}
      <div style={labelStyle}>
        <span style={labelTextStyle}>To</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
          {LOCATION_TYPES.map(lt => (
            <button key={lt.value} type="button" onClick={() => setToType(lt.value)} style={{
              padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: toType === lt.value ? '1.5px solid rgba(180,140,60,0.3)' : '1.5px solid rgba(255,255,255,0.07)',
              background: toType === lt.value ? 'rgba(40,28,10,0.8)' : 'rgba(255,255,255,0.03)',
              color: toType === lt.value ? '#E0C880' : '#6A5A38',
              transition: 'all 0.15s',
            }}>{lt.label}</button>
          ))}
        </div>
        <input type="text" value={to} required
          placeholder={(LOCATION_TYPES.find(l => l.value === toType) || LOCATION_TYPES[1]).placeholder}
          onChange={e => setTo(e.target.value)} style={fieldStyle}
          onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
      </div>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Date</span>
        <input type="date" value={date} required min={today}
          onChange={e => setDate(e.target.value)} style={fieldStyle}
          onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
      </label>

      <div style={{ marginBottom: 18 }}>
        <span style={labelTextStyle}>Pickup Time</span>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, padding: '6px 12px', gap: 4,
        }}>
          {(() => {
            const spinBtn = {
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.25)', padding: '2px 6px', borderRadius: 5, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s, background 0.15s',
            };
            const ChevUp = () => (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
              </svg>
            );
            const ChevDown = () => (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            );
            return (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <button type="button" onClick={incrHour} style={spinBtn}
                    onMouseEnter={e => { e.currentTarget.style.color = '#E0C880'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; e.currentTarget.style.background = 'none'; }}>
                    <ChevUp />
                  </button>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#F2EDD4', minWidth: 28, textAlign: 'center', lineHeight: 1.2, letterSpacing: '-0.3px' }}>
                    {String(hour).padStart(2, '0')}
                  </span>
                  <button type="button" onClick={decrHour} style={spinBtn}
                    onMouseEnter={e => { e.currentTarget.style.color = '#E0C880'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; e.currentTarget.style.background = 'none'; }}>
                    <ChevDown />
                  </button>
                </div>

                <span style={{ fontSize: 17, fontWeight: 300, color: 'rgba(255,255,255,0.2)', userSelect: 'none', marginBottom: 1 }}>:</span>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <button type="button" onClick={incrMinute} style={spinBtn}
                    onMouseEnter={e => { e.currentTarget.style.color = '#E0C880'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; e.currentTarget.style.background = 'none'; }}>
                    <ChevUp />
                  </button>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#F2EDD4', minWidth: 28, textAlign: 'center', lineHeight: 1.2, letterSpacing: '-0.3px' }}>
                    {minute}
                  </span>
                  <button type="button" onClick={decrMinute} style={spinBtn}
                    onMouseEnter={e => { e.currentTarget.style.color = '#E0C880'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; e.currentTarget.style.background = 'none'; }}>
                    <ChevDown />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 4, borderRadius: 7, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                  {['AM', 'PM'].map(p => (
                    <button key={p} type="button" onClick={() => setPeriod(p)} style={{
                      border: 'none', padding: '5px 9px',
                      background: period === p ? 'rgba(40,28,10,0.8)' : 'rgba(255,255,255,0.03)',
                      color: period === p ? '#E0C880' : '#706050',
                      fontSize: 10, fontWeight: 700, cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                      letterSpacing: '0.04em',
                      borderBottom: p === 'AM' ? '1px solid rgba(255,255,255,0.07)' : 'none',
                    }}>
                      {p}
                    </button>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      <label style={{ ...labelStyle, marginBottom: 18 }}>
        <span style={labelTextStyle}>Passengers</span>
        <input type="number" value={adultsStr} min={1} required
          onChange={e => setAdultsStr(e.target.value)}
          onBlur={e => { const n = Math.max(1, parseInt(e.target.value, 10) || 1); setAdultsStr(String(n)); e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
          style={fieldStyle} onFocus={e => { e.target.style.borderColor = 'rgba(180,140,60,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(160,120,50,0.14)'; }} />
      </label>

      <button type="submit" disabled={!valid} style={{
        width: '100%', padding: '11px', borderRadius: 10, border: 'none',
        background: valid ? 'linear-gradient(145deg, #3A2A10 0%, #251A08 100%)' : 'rgba(255,255,255,0.04)',
        color: valid ? '#E0C878' : '#4A3D28', fontSize: 14, fontWeight: 600,
        cursor: valid ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
        boxShadow: valid ? '0 4px 20px rgba(0,0,0,0.5)' : 'none',
      }}>
        Search Transfers
      </button>
    </form>
  );
}

function TransferCard({ transfer, onSelect, done, isMobile }) {
  const [hov, setHov] = useState(false);
  const fmt = n => Number(n).toLocaleString('en-IN');

  return (
    <div
      onClick={() => !done && onSelect(transfer)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'rgba(255,255,255,0.03)', border: `1px solid ${hov && !done ? 'rgba(180,140,60,0.3)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 14, cursor: done ? 'default' : 'pointer',
        overflow: 'hidden', marginBottom: 10,
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        boxShadow: hov && !done ? '0 8px 32px rgba(0,0,0,0.55)' : '0 8px 40px rgba(0,0,0,0.4)',
        transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
        WebkitTapHighlightColor: 'transparent',
        transform: hov && !done ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      {transfer.imageUrl && (
        <img src={transfer.imageUrl} alt={transfer.vehicle}
          style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }}
          onError={e => { e.target.style.display = 'none'; }} />
      )}
      <div style={{ padding: isMobile ? '10px 12px' : '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <div style={{ fontWeight: 600, fontSize: isMobile ? 13 : 14, color: '#F2EDD4', lineHeight: 1.3 }}>{transfer.type}</div>
            <div style={{ fontSize: 12, color: '#9A8868', marginTop: 2 }}>{transfer.vehicle}</div>
          </div>
          {transfer.price > 0 && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: isMobile ? 12 : 13, color: '#F2EDD4' }}>
                {transfer.currency} {fmt(transfer.price)}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {transfer.maxPax > 0 && (
            <span style={{ fontSize: 11, color: '#907840', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '3px 7px' }}>
              Up to {transfer.maxPax} pax
            </span>
          )}
          {transfer.duration && (
            <span style={{ fontSize: 11, color: '#907840', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '3px 7px' }}>
              {transfer.duration}
            </span>
          )}
        </div>
        {!done && (
          <div style={{ fontSize: 12, color: hov ? '#A08840' : '#5A4A38', textAlign: 'right', marginTop: 8, fontWeight: hov ? 600 : 400 }}>
            {hov ? 'Tap to select →' : 'Select'}
          </div>
        )}
      </div>
    </div>
  );
}

function TransferList({ transfers, fromName, toName, date, time, onSelect, done, isMobile }) {
  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#4ADE80',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Transfer selected
      </div>
    );
  }
  return (
    <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 520 }}>
      {(fromName || toName) && (
        <p style={{ margin: '0 0 4px', fontSize: 13, color: '#9A8868' }}>
          {fromName} → {toName}
        </p>
      )}
      {(date || time) && (
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#706050' }}>
          {date}{time ? ` at ${time}` : ''}
        </p>
      )}
      <p style={{ margin: '0 0 14px', fontSize: 15, color: '#E8D5A8' }}>
        Available transfers — tap one to select:
      </p>
      {transfers.map(t => (
        <TransferCard key={t.id} transfer={t} onSelect={onSelect} done={done} isMobile={isMobile} />
      ))}
    </div>
  );
}


function TransferPaymentGate({ data, transferGuestRef, onComplete, done }) {
  const [paying, setPaying] = useState(false);
  const [error,  setError]  = useState('');

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#4ADE80',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Payment complete
      </div>
    );
  }

  async function handlePay() {
    if (paying) return;
    setPaying(true);
    setError('');
    try {
      const guestList = Array.isArray(transferGuestRef.current) ? transferGuestRef.current : [transferGuestRef.current];
      const rzpResponse = await payWithRazorpay({
        amount: data.amount,
        currency: data.currency || 'INR',
        description: `${data.transferType} — ${data.vehicleType}`,
        guest: guestList[0],
      });
      const res = await fetch('/api/payment/verify-and-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'transfer',
          razorpay_payment_id: rzpResponse.razorpay_payment_id,
          razorpay_order_id:   rzpResponse.razorpay_order_id,
          razorpay_signature:  rzpResponse.razorpay_signature,
          rateKey:  data.rateKey,
          fromCode: data.fromCode,
          toCode:   data.toCode,
          date:     data.date,
          time:     data.time,
          adults:   data.adults || 1,
          guests:   guestList,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Booking failed'); }
      onComplete(await res.json());
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
      setPaying(false);
    }
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: '20px', width: '100%', maxWidth: 340,
      boxShadow: '0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.07)',
    }}>
      <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 15, color: '#F2EDD4' }}>Payment</p>
      <p style={{ margin: '0 0 4px', fontSize: 13, color: '#9A8868' }}>{data.transferType} — {data.vehicleType}</p>
      <p style={{ margin: '0 0 4px', fontSize: 12, color: '#706050' }}>{data.fromName || data.fromCode} → {data.toName || data.toCode}</p>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#706050' }}>{data.date}{data.time ? ` at ${data.time}` : ''}</p>

      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#9A8868' }}>Total</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#F2EDD4' }}>
          {data.currency} {Number(data.amount).toLocaleString('en-IN')}
        </span>
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

      <button type="button" onClick={handlePay} disabled={paying} style={{
        width: '100%', padding: '11px', marginTop: 4, borderRadius: 10, border: 'none',
        background: paying ? 'rgba(255,255,255,0.04)' : 'linear-gradient(145deg, #3A2A10 0%, #251A08 100%)',
        color: paying ? '#4A3D28' : '#fff', fontSize: 14, fontWeight: 600,
        cursor: paying ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
        boxShadow: paying ? 'none' : '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        {paying ? 'Processing...' : `Pay ${data.currency} ${Number(data.amount).toLocaleString('en-IN')}`}
      </button>
    </div>
  );
}

function TransferBookingConfirmed({ data }) {
  const row = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 13, color: '#9A8868' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#F2EDD4', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: '20px', width: '100%', maxWidth: 380,
      boxShadow: '0 16px 56px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: 'rgba(74,222,128,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#4ADE80' }}>Transfer Booked!</span>
      </div>
      {row('Reference',   data.reference    || '—')}
      {row('Transfer',    data.transferType  || '—')}
      {row('Vehicle',     data.vehicleType   || '—')}
      {row('Passenger',   data.holderName    || '—')}
      {row('Pickup Date', data.pickupDate    || '—')}
      {row('Pickup Time', data.pickupTime    || '—')}
      {row('Total paid',  `${data.currency} ${Number(data.total).toLocaleString('en-IN')}`)}
    </div>
  );
}

/* ══════════════════════════════════════════════════════ */
/*  Main ChatUI                                          */
/* ══════════════════════════════════════════════════════ */
export default function ChatUI({ user }) {
  const [convs,        setConvs]        = useState([]);
  const [activeId,     setActiveId]     = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [busy,         setBusy]         = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [isMobile,     setIsMobile]     = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const bottomRef       = useRef(null);
  const scrollRef       = useRef(null);
  const taRef           = useRef(null);
  const activeIdRef     = useRef(null);
  const pendingGuestRef          = useRef(null);
  const pendingFlightGuestRef    = useRef(null);
  const pendingTransferGuestRef  = useRef(null);
  const scrollInstant   = useRef(false);
  const loadingConv     = useRef(false); // true when opening a past chat — skip timestamp update

  const listKey = `pargoai_convs_${user.id}`;
  const msgKey  = useCallback(id => `pargoai_msgs_${user.id}_${id}`, [user.id]);

  /* ── Responsive: detect screen size ── */
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);


  /* ── Geolocation: detect user location on mount ── */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(`/api/location?lat=${coords.latitude}&lng=${coords.longitude}`);
          if (res.ok) setUserLocation(await res.json());
        } catch {}
      },
      () => {} // silently ignore denial
    );
  }, []);

  /* ── Load conversation list on mount ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(listKey);
      if (raw) setConvs(JSON.parse(raw));
    } catch {}
  }, [listKey]);

  /* ── Save messages whenever they change ── */
  useEffect(() => {
    const id = activeIdRef.current;
    if (!id || messages.length === 0) return;

    try { localStorage.setItem(msgKey(id), JSON.stringify(messages)); } catch {}

    // If we just loaded a past conversation, don't touch the timestamp —
    // updating it would re-sort the list and make it jump.
    if (loadingConv.current) {
      loadingConv.current = false;
      return;
    }

    const title = getTitle(messages);
    const now   = new Date().toISOString();
    setConvs(prev => {
      const exists = prev.find(c => c.id === id);
      const updated = exists
        ? prev.map(c => c.id === id ? { ...c, title, updatedAt: now } : c)
        : [{ id, title, updatedAt: now }, ...prev];
      updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      try { localStorage.setItem(listKey, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [messages, listKey, msgKey]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (scrollInstant.current) {
      // Jump straight to the bottom with no animation — must happen
      // before the browser paints so the user never sees the top.
      el.scrollTop = el.scrollHeight;
      scrollInstant.current = false;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, busy]);

  /* ── Actions ── */
  function openConv(id) {
    if (id === activeIdRef.current) return;
    scrollInstant.current = true;
    loadingConv.current = true;
    activeIdRef.current = id;
    setActiveId(id);
    try {
      const raw = localStorage.getItem(msgKey(id));
      setMessages(raw ? JSON.parse(raw) : []);
    } catch { setMessages([]); }
    if (isMobile) setSidebarOpen(false);
  }

  function newChat() {
    const id = genId();
    activeIdRef.current = id;
    setActiveId(id);
    setMessages([]);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
    if (isMobile) setSidebarOpen(false);
  }

  function deleteConv(id, e) {
    e.stopPropagation();
    try { localStorage.removeItem(msgKey(id)); } catch {}
    setConvs(prev => {
      const updated = prev.filter(c => c.id !== id);
      try { localStorage.setItem(listKey, JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (activeIdRef.current === id) {
      activeIdRef.current = null;
      setActiveId(null);
      setMessages([]);
    }
  }

  function renameConv(id, newTitle) {
    setConvs(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, title: newTitle } : c);
      try { localStorage.setItem(listKey, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }

  function pinConv(id) {
    setConvs(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c);
      try { localStorage.setItem(listKey, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }

  function resize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  async function send(text) {
    const msg = text.trim();
    if (!msg || busy) return;

    // If the hotel search form is active and this message isn't a form submission, remind politely
    if (lastSearchFormIdx !== -1 && !searchFormDone &&
        !/\bDestination:/i.test(msg) && !/\bCheck-in:/i.test(msg)) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: msg },
        { role: 'assistant', content: "I'd be happy to help you find a hotel! Before we continue, could you please fill in the search form above? Just enter your destination, check-in and check-out dates, and the number of guests, then click **Search Hotels** — I'll find the best options for you." },
      ]);
      setInput('');
      if (taRef.current) taRef.current.style.height = 'auto';
      return;
    }

    // If the flight search form is active and this message isn't a form submission, remind politely
    if (lastFlightSearchIdx !== -1 && !flightSearchDone &&
        !/\bFrom:/i.test(msg) && !/\bTo:/i.test(msg)) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: msg },
        { role: 'assistant', content: "I'd be happy to help you find a flight! Before we continue, could you please fill in the flight search form above? Just enter your departure city, destination, travel date, number of passengers, and preferred cabin class, then click **Search Flights** — I'll take care of the rest." },
      ]);
      setInput('');
      if (taRef.current) taRef.current.style.height = 'auto';
      return;
    }

    if (!activeIdRef.current) {
      const id = genId();
      activeIdRef.current = id;
      setActiveId(id);
    }

    const history = [...messages, { role: 'user', content: msg }];
    setMessages(history);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setBusy(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, userLocation: userLocation || null }),
      });
      if (!res.ok) throw new Error();
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let reply = '';
      setBusy(false);
      setMessages(p => [...p, { role: 'assistant', content: '' }]);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += dec.decode(value, { stream: true });
        setMessages(p => { const n = [...p]; n[n.length - 1] = { role: 'assistant', content: reply }; return n; });
      }
    } catch {
      setBusy(false);
      setMessages(p => [...p, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    }
  }

  /* ── Guest form: done when a user message exists after the last form marker ── */
  const lastFormIdx = messages.reduce((acc, m, i) =>
    m.role === 'assistant' && m.content.includes('[GUEST_DETAILS_FORM]') ? i : acc, -1);
  const guestFormDone = lastFormIdx !== -1 && messages.slice(lastFormIdx + 1).some(m => m.role === 'user');

  function handleGuestFormSubmit(guests) {
    pendingGuestRef.current = guests; // store full array
    const msg = guests.length === 1
      ? `First Name: ${guests[0].firstName}\nLast Name: ${guests[0].lastName}\nEmail: ${guests[0].email}\nPhone: ${guests[0].phone}`
      : guests.map((g, i) =>
          i === 0
            ? `Guest 1 (Lead):\nFirst Name: ${g.firstName}\nLast Name: ${g.lastName}\nEmail: ${g.email}\nPhone: ${g.phone}`
            : `Guest ${i + 1}:\nFirst Name: ${g.firstName}\nLast Name: ${g.lastName}`
        ).join('\n\n');
    send(msg);
  }

  /* ── Search form: done when a user message exists after the last search form marker ── */
  const lastSearchFormIdx = messages.reduce((acc, m, i) =>
    m.role === 'assistant' && SEARCH_FORM_RE.test(m.content) ? i : acc, -1);
  const searchFormDone = lastSearchFormIdx !== -1 && messages.slice(lastSearchFormIdx + 1).some(
    m => m.role === 'user' && /\bDestination:/i.test(m.content) && /\bCheck-in:/i.test(m.content)
  );

  function handleSearchFormSubmit(destination, checkin, checkout, adults) {
    const msg = `Destination: ${destination}\nCheck-in: ${checkin}\nCheck-out: ${checkout}\nAdults: ${adults}`;
    send(msg);
  }

  /* Extract guest count from the last hotel search submission */
  const hotelGuestCount = (() => {
    const lastSFIdx = messages.reduce((acc, m, i) =>
      m.role === 'assistant' && SEARCH_FORM_RE.test(m.content) ? i : acc, -1);
    if (lastSFIdx === -1) return 1;
    const sub = messages.slice(lastSFIdx + 1).find(m => m.role === 'user');
    if (!sub) return 1;
    const match = sub.content.match(/Adults:\s*(\d+)/i);
    return match ? Math.max(1, parseInt(match[1], 10)) : 1;
  })();

  /* ── Hotel list: done when a user message exists after the last hotel list ── */
  const lastHotelListIdx = messages.reduce((acc, m, i) =>
    m.role === 'assistant' && m.content.trim().startsWith('[HOTEL_LIST:') ? i : acc, -1);
  const hotelListDone = lastHotelListIdx !== -1 && messages.slice(lastHotelListIdx + 1).some(m => m.role === 'user');

  function handleHotelSelect(hotel) {
    send(`I'd like to book ${hotel.name} (rateKey: ${hotel.rateKey})`);
  }

  /* ── Payment gate: done when a BOOKING_CONFIRMED message exists after it ── */
  const lastPaymentGateIdx = messages.reduce((acc, m, i) =>
    m.role === 'assistant' && m.content.trim().startsWith('[PAYMENT_GATE:') ? i : acc, -1);
  const paymentGateDone = lastPaymentGateIdx !== -1 &&
    messages.slice(lastPaymentGateIdx + 1).some(m => m.content.trim().startsWith('[BOOKING_CONFIRMED:'));

  function handlePaymentComplete(booking) {
    const confirmed = JSON.stringify({
      reference: booking.bookingReference,
      hotelName: booking.hotelName,
      holder:    booking.holderName,
      checkIn:   booking.checkIn,
      checkOut:  booking.checkOut,
      total:     booking.totalNet,
      currency:  booking.currency,
    });
    setMessages(prev => [...prev, { role: 'assistant', content: `[BOOKING_CONFIRMED:${confirmed}]` }]);
  }

  /* ── Flight search form: done when a user message exists after the last form ── */
  const lastFlightSearchIdx = messages.reduce((acc, m, i) =>
    m.role === 'assistant' && FLIGHT_SEARCH_FORM_RE.test(m.content) ? i : acc, -1);
  const flightSearchDone = lastFlightSearchIdx !== -1 && messages.slice(lastFlightSearchIdx + 1).some(
    m => m.role === 'user' && /\bFrom:/i.test(m.content) && /\bTo:/i.test(m.content) && /\bDeparture:/i.test(m.content)
  );

  function handleFlightSearchSubmit(from, to, departure, returnDate, passengers, cabin) {
    const ret = returnDate ? `\nReturn: ${returnDate}` : '';
    send(`From: ${from}\nTo: ${to}\nDeparture: ${departure}${ret}\nPassengers: ${passengers}\nCabin: ${cabin}`);
  }

  /* ── Flight list: done when a user message exists after the last flight list ── */
  const lastFlightListIdx = messages.reduce((acc, m, i) =>
    m.role === 'assistant' && m.content.trim().startsWith('[FLIGHT_LIST:') ? i : acc, -1);
  const flightListDone = lastFlightListIdx !== -1 && messages.slice(lastFlightListIdx + 1).some(m => m.role === 'user');

  function handleFlightSelect(flight) {
    send(`I'd like to book ${flight.airline} ${flight.origin}-${flight.destination} (offerId: ${flight.offerId}, passengerIds: ${JSON.stringify(flight.passengerIds)})`);
  }

  /* ── Flight guest form: done when a user message exists after the last form ── */
  const lastFlightGuestIdx = messages.reduce((acc, m, i) =>
    m.role === 'assistant' && m.content.includes('[FLIGHT_GUEST_FORM]') ? i : acc, -1);
  const flightGuestDone = lastFlightGuestIdx !== -1 && messages.slice(lastFlightGuestIdx + 1).some(m => m.role === 'user');

  /* Extract passenger count from the last flight search submission */
  const flightPassengerCount = (() => {
    const lastFSIdx = messages.reduce((acc, m, i) =>
      m.role === 'assistant' && FLIGHT_SEARCH_FORM_RE.test(m.content) ? i : acc, -1);
    if (lastFSIdx === -1) return 1;
    const sub = messages.slice(lastFSIdx + 1).find(m => m.role === 'user');
    if (!sub) return 1;
    const match = sub.content.match(/Passengers:\s*(\d+)/i);
    return match ? Math.max(1, parseInt(match[1], 10)) : 1;
  })();

  function handleFlightGuestSubmit(passengers) {
    pendingFlightGuestRef.current = passengers; // store full array
    const msg = passengers.length === 1
      ? `Title: ${passengers[0].title}\nFirst Name: ${passengers[0].firstName}\nLast Name: ${passengers[0].lastName}\nDate of Birth: ${passengers[0].dob}\nGender: ${passengers[0].gender === 'f' ? 'female' : 'male'}\nEmail: ${passengers[0].email}\nPhone: ${passengers[0].phone}`
      : passengers.map((p, i) =>
          `Passenger ${i + 1}:\nTitle: ${p.title}\nFirst Name: ${p.firstName}\nLast Name: ${p.lastName}\nDate of Birth: ${p.dob}\nGender: ${p.gender === 'f' ? 'female' : 'male'}\nEmail: ${p.email}\nPhone: ${p.phone}`
        ).join('\n\n');
    send(msg);
  }

  /* ── Flight payment gate: done when a FLIGHT_BOOKING_CONFIRMED message exists after it ── */
  const lastFlightPaymentIdx = messages.reduce((acc, m, i) =>
    m.role === 'assistant' && m.content.trim().startsWith('[FLIGHT_PAYMENT_GATE:') ? i : acc, -1);
  const flightPaymentDone = lastFlightPaymentIdx !== -1 &&
    messages.slice(lastFlightPaymentIdx + 1).some(m => m.content.trim().startsWith('[FLIGHT_BOOKING_CONFIRMED:'));

  function handleFlightPaymentComplete(booking) {
    const confirmed = JSON.stringify({
      reference:     booking.bookingReference,
      airline:       booking.airline,
      origin:        booking.origin,
      destination:   booking.destination,
      passengerName: booking.passengerName,
      departureAt:   booking.departureAt,
      arrivalAt:     booking.arrivalAt,
      total:         booking.totalAmount,
      currency:      booking.currency,
    });
    setMessages(prev => [...prev, { role: 'assistant', content: `[FLIGHT_BOOKING_CONFIRMED:${confirmed}]` }]);
  }

  /* ── Transfer search form: done when a user message exists after the last form ── */
  const lastTransferSearchFormIdx = messages.reduce((acc, m, i) =>
    m.role === 'assistant' && TRANSFER_SEARCH_FORM_RE.test(m.content) ? i : acc, -1);
  const transferSearchFormDone = lastTransferSearchFormIdx !== -1 && messages.slice(lastTransferSearchFormIdx + 1).some(m => m.role === 'user');

  function handleTransferSearchSubmit(from, fromType, to, toType, date, time, adults) {
    send(`From Type: ${fromType}\nFrom: ${from}\nTo Type: ${toType}\nTo: ${to}\nDate: ${date}\nTime: ${time}\nAdults: ${adults}`);
  }

  /* Extract guest count from the last transfer search submission */
  const transferGuestCount = (() => {
    const lastTSIdx = messages.reduce((acc, m, i) =>
      m.role === 'assistant' && TRANSFER_SEARCH_FORM_RE.test(m.content) ? i : acc, -1);
    if (lastTSIdx === -1) return 1;
    const sub = messages.slice(lastTSIdx + 1).find(m => m.role === 'user');
    if (!sub) return 1;
    const match = sub.content.match(/Adults:\s*(\d+)/i);
    return match ? Math.max(1, parseInt(match[1], 10)) : 1;
  })();

  /* ── Transfer list: done when a user message exists after the last transfer list ── */
  const lastTransferListIdx = messages.reduce((acc, m, i) =>
    m.role === 'assistant' && m.content.trim().startsWith('[TRANSFER_LIST:') ? i : acc, -1);
  const transferListDone = lastTransferListIdx !== -1 && messages.slice(lastTransferListIdx + 1).some(m => m.role === 'user');

  function handleTransferSelect(transfer) {
    send(`I'd like to book ${transfer.type} - ${transfer.vehicle} (rateKey: ${transfer.rateKey})`);
  }

  /* ── Transfer guest form: done when a user message exists after the last form ── */
  const lastTransferGuestIdx = messages.reduce((acc, m, i) =>
    m.role === 'assistant' && m.content.includes('[TRANSFER_GUEST_FORM]') ? i : acc, -1);
  const transferGuestDone = lastTransferGuestIdx !== -1 && messages.slice(lastTransferGuestIdx + 1).some(m => m.role === 'user');

  function handleTransferGuestSubmit(guests) {
    pendingTransferGuestRef.current = guests; // store full array
    const msg = guests.length === 1
      ? `First Name: ${guests[0].firstName}\nLast Name: ${guests[0].lastName}\nEmail: ${guests[0].email}\nPhone: ${guests[0].phone}`
      : guests.map((g, i) =>
          i === 0
            ? `Guest 1 (Lead):\nFirst Name: ${g.firstName}\nLast Name: ${g.lastName}\nEmail: ${g.email}\nPhone: ${g.phone}`
            : `Guest ${i + 1}:\nFirst Name: ${g.firstName}\nLast Name: ${g.lastName}`
        ).join('\n\n');
    send(msg);
  }

  /* ── Transfer payment gate: done when TRANSFER_BOOKING_CONFIRMED exists after it ── */
  const lastTransferPaymentIdx = messages.reduce((acc, m, i) =>
    m.role === 'assistant' && m.content.trim().startsWith('[TRANSFER_PAYMENT_GATE:') ? i : acc, -1);
  const transferPaymentDone = lastTransferPaymentIdx !== -1 &&
    messages.slice(lastTransferPaymentIdx + 1).some(m => m.content.trim().startsWith('[TRANSFER_BOOKING_CONFIRMED:'));

  function handleTransferPaymentComplete(booking) {
    const confirmed = JSON.stringify({
      reference:    booking.bookingReference,
      transferType: booking.transferType,
      vehicleType:  booking.vehicleType,
      holderName:   booking.holderName,
      pickupDate:   booking.pickupDate,
      pickupTime:   booking.pickupTime,
      total:        booking.totalAmount,
      currency:     booking.currency,
    });
    setMessages(prev => [...prev, { role: 'assistant', content: `[TRANSFER_BOOKING_CONFIRMED:${confirmed}]` }]);
  }

  const empty  = messages.length === 0;

  /* ── Sidebar widths ── */
  const SIDEBAR_OPEN = 260;
  const SIDEBAR_MINI = 52; // collapsed icon strip (desktop only)

  return (
    <div className="app-shell">

      {/* ════════════════════════════════ SIDEBAR ═══ */}

      {/* Mobile: full overlay sidebar */}
      {isMobile && (
        <>
          {sidebarOpen && (
            <div onClick={() => setSidebarOpen(false)} style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 999,
            }} />
          )}
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 1000,
            width: SIDEBAR_OPEN, background: '#100E0A',
            borderRight: '1px solid rgba(201,168,76,0.06)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.22s ease',
            boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.18)' : 'none',
          }}>
            <SidebarContent
              sidebarOpen={true}
              onClose={() => setSidebarOpen(false)}
              onNewChat={newChat}
              convs={convs}
              activeId={activeId}
              openConv={openConv}
              deleteConv={deleteConv}
              renameConv={renameConv}
              pinConv={pinConv}
              isMobile={isMobile}
              user={user}
            />
          </div>
        </>
      )}

      {/* Desktop: floating sidebar overlay — no flex space taken */}
      {!isMobile && (
        <>
          {sidebarOpen && (
            <div onClick={() => setSidebarOpen(false)} style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 999,
              backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            }} />
          )}
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 1000,
            width: SIDEBAR_OPEN, background: '#100E0A',
            borderRight: '1px solid rgba(201,168,76,0.06)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: sidebarOpen ? '8px 0 60px rgba(0,0,0,0.8)' : 'none',
          }}>
            <SidebarContent
              sidebarOpen={true}
              onClose={() => setSidebarOpen(false)}
              onNewChat={newChat}
              convs={convs}
              activeId={activeId}
              openConv={openConv}
              deleteConv={deleteConv}
              renameConv={renameConv}
              pinConv={pinConv}
              isMobile={false}
              user={user}
            />
          </div>
        </>
      )}

      {/* ══════════════════════════ MAIN AREA ═══════ */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <div className="aurora-bg" />

        {/* Top bar — always visible, sidebar is now always an overlay */}
        <div style={{
          flexShrink: 0, height: 52,
          display: 'flex', alignItems: 'center',
          padding: '0 12px', gap: 8,
          background: 'rgba(13,11,8,0.92)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderBottom: 'none', position: 'relative',
        }}>
          <div className="topbar-accent" />
          {/* Sidebar toggle button */}
          <LogoToggleBtn onClick={() => setSidebarOpen(v => !v)} />

          {/* Brand */}
          <button
            onClick={newChat}
            title="New chat"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 15, fontWeight: 600, color: '#E8D5A8',
              padding: '0 4px', borderRadius: 6,
              transition: 'color 0.2s', letterSpacing: '0.2px',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#C9A84C'}
            onMouseLeave={e => e.currentTarget.style.color = '#E8D5A8'}
          >
            Pargo AI
          </button>
        </div>

        {empty ? (
          /* ── Empty state: hero centered, input anchored at bottom ── */
          <div style={{
            flex: 1,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '0 16px 20px',
              overflowY: 'auto',
            }}>
            <div className="hero-logo" style={{ position: 'relative', marginBottom: 20, width: 68, height: 68 }}>
              {/* Orbit ring 1 */}
              <div className="orbit-ring-1" style={{
                position: 'absolute', inset: -16, borderRadius: '50%',
                border: '1px solid rgba(201,168,76,0.18)',
                boxShadow: '0 0 8px rgba(201,168,76,0.06)',
              }}>
                <div style={{
                  position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)',
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#C9A84C',
                  boxShadow: '0 0 6px rgba(201,168,76,0.9)',
                }} />
              </div>
              {/* Orbit ring 2 */}
              <div className="orbit-ring-2" style={{
                position: 'absolute', inset: -26, borderRadius: '50%',
                border: '1px solid rgba(201,168,76,0.08)',
              }}>
                <div style={{
                  position: 'absolute', bottom: -2, right: '20%',
                  width: 3, height: 3, borderRadius: '50%',
                  background: 'rgba(201,168,76,0.7)',
                  boxShadow: '0 0 4px rgba(201,168,76,0.7)',
                }} />
              </div>
              <div style={{
                width: 68, height: 68, borderRadius: '50%',
                background: 'linear-gradient(145deg, #1A1510 0%, #0D0A07 60%, #15110A 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 800, color: '#C9A84C',
                boxShadow: '0 0 28px rgba(201,168,76,0.38), 0 0 56px rgba(201,168,76,0.12)',
                border: '1px solid rgba(201,168,76,0.22)',
                letterSpacing: '-1px',
                textShadow: '0 0 12px rgba(215,178,80,0.7)',
              }}>P</div>
            </div>
            <h1 className="gradient-heading hero-title" style={{
              fontSize: isMobile ? 26 : 38, fontWeight: 800, margin: 0, letterSpacing: '-1px',
              lineHeight: 1.15,
            }}>
              What would you like to book?
            </h1>
            <p className="hero-sub" style={{ color: '#4A3A1A', fontSize: 12, margin: '10px 0 0', letterSpacing: '1.2px', textTransform: 'uppercase', fontWeight: 500, textAlign: 'center', width: '100%' }}>
              Hotels · Flights · Ground Transfers · Worldwide
            </p>

            {/* Location indicator */}
            {userLocation?.displayName && (
              <div className="hero-loc" style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '8px 0 0', color: '#9A8868', fontSize: 13 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                {userLocation.displayName}
              </div>
            )}

            {/* Services modal overlay — fixed so it never pushes content */}
            {servicesOpen && (
              <>
                <div
                  onClick={() => setServicesOpen(false)}
                  style={{
                    position: 'fixed', inset: 0, zIndex: 200,
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  }}
                />
                <div style={{
                  position: 'fixed', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 201,
                  background: 'rgba(14,11,7,0.99)',
                  backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid rgba(201,168,76,0.08)',
                  borderRadius: 14,
                  boxShadow: '0 32px 80px rgba(0,0,0,0.92), inset 0 1px 0 rgba(201,168,76,0.05)',
                  width: 300, maxWidth: 'calc(100vw - 32px)',
                  overflow: 'hidden',
                }}>
                  {(() => {
                    const svc = userLocation?.services;
                    const allItems = [
                      {
                        svcKey: 'hotels',
                        label: 'Book a Hotel',
                        sub: 'Search & reserve rooms',
                        msg: 'I want to book a hotel',
                        icon: (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
                          </svg>
                        ),
                      },
                      {
                        svcKey: 'flights',
                        label: 'Book a Flight',
                        sub: 'Search & reserve seats',
                        msg: 'I want to book a flight',
                        icon: (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.1z" />
                          </svg>
                        ),
                      },
                      {
                        svcKey: 'transfers',
                        label: 'Book a Transfer',
                        sub: 'Airport taxis & shuttles',
                        msg: 'I want to book a transfer',
                        icon: (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3" />
                            <rect x="9" y="11" width="14" height="10" rx="2" />
                            <circle cx="12" cy="21" r="1" />
                            <circle cx="20" cy="21" r="1" />
                          </svg>
                        ),
                      },
                    ];
                    const visible = allItems.filter(item => !svc || svc[item.svcKey] !== false);
                    const unavailable = allItems.filter(item => svc && svc[item.svcKey] === false);
                    return [...visible, ...unavailable].map(({ svcKey, label, sub, msg, icon }, idx, arr) => {
                      const disabled = svc && svc[svcKey] === false;
                      return (
                        <div key={label} style={{ opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
                          <ServiceMenuItem
                            label={label}
                            sub={disabled ? 'Not available in your area' : sub}
                            icon={icon}
                            isLast={idx === arr.length - 1}
                            onClick={disabled ? undefined : () => { setServicesOpen(false); send(msg); }}
                          />
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}

            {/* Services button */}
            <div className="hero-svc" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28, marginTop: 14 }}>
              <button
                onClick={() => setServicesOpen(v => !v)}
                className="service-chip-shimmer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '11px 22px', borderRadius: 10,
                  border: '1px solid', borderColor: servicesOpen ? 'rgba(201,168,76,0.35)' : 'rgba(201,168,76,0.08)',
                  background: servicesOpen ? 'rgba(25,18,8,0.95)' : 'rgba(201,168,76,0.02)',
                  color: servicesOpen ? '#E0C060' : '#6A5030',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  boxShadow: servicesOpen ? '0 0 18px rgba(201,168,76,0.18)' : 'none',
                  letterSpacing: '0.5px',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { if (!servicesOpen) { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.2)'; e.currentTarget.style.color = '#8A7040'; }}}
                onMouseLeave={e => { if (!servicesOpen) { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.08)'; e.currentTarget.style.color = '#6A5030'; }}}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                Services
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                  style={{ transform: servicesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>

            </div>
            <div style={{
              flexShrink: 0,
              padding: isMobile ? '10px 16px max(14px, env(safe-area-inset-bottom))' : '14px 32px 22px',
              background: 'rgba(13,11,8,0.95)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              position: 'relative', zIndex: 2,
            }}>
              <div className="input-glow-line" />
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <textarea
                  ref={taRef}
                  rows={1}
                  value={input}
                  placeholder="Message Pargo AI"
                  onChange={e => { setInput(e.target.value); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  style={{
                    flex: 1, border: 'none', outline: 'none', resize: 'none',
                    background: 'transparent', color: '#F2EDD4',
                    fontSize: 16, lineHeight: 1.6,
                    minHeight: 26, maxHeight: 200, paddingTop: 3,
                    fontFamily: 'inherit',
                    caretColor: '#C9A84C',
                  }}
                />
                <SendButton onClick={() => send(input)} disabled={!input.trim() || busy} />
              </div>
            </div>
          </div>
        ) : (
          /* ── Chat state: messages + input at bottom ── */
          <>
            <div className="chat-grid-bg" />
            <div className="chat-scan-line" />
            <div ref={scrollRef} className="chat-scroll" style={{ flex: 1, position: 'relative', zIndex: 2 }}>
              <div style={{ paddingTop: 24, paddingBottom: 16 }}>
                {messages.map((m, i) => (
                  <React.Fragment key={i}>
                    <Message
                      role={m.role}
                      content={m.content}
                      isMobile={isMobile}
                      onGuestFormSubmit={handleGuestFormSubmit}
                      guestFormDone={guestFormDone}
                      hotelGuestCount={hotelGuestCount}
                      onSearchFormSubmit={handleSearchFormSubmit}
                      searchFormDone={searchFormDone}
                      onHotelSelect={handleHotelSelect}
                      hotelListDone={hotelListDone}
                      onPaymentComplete={handlePaymentComplete}
                      paymentGateDone={paymentGateDone}
                      guestRef={pendingGuestRef}
                      onFlightSearchSubmit={handleFlightSearchSubmit}
                      flightSearchDone={flightSearchDone}
                      onFlightSelect={handleFlightSelect}
                      flightListDone={flightListDone}
                      onFlightGuestSubmit={handleFlightGuestSubmit}
                      flightGuestDone={flightGuestDone}
                      flightPassengerCount={flightPassengerCount}
                      onFlightPaymentComplete={handleFlightPaymentComplete}
                      flightPaymentDone={flightPaymentDone}
                      flightGuestRef={pendingFlightGuestRef}
                      onTransferSearchSubmit={handleTransferSearchSubmit}
                      transferSearchFormDone={transferSearchFormDone}
                      onTransferSelect={handleTransferSelect}
                      transferListDone={transferListDone}
                      onTransferGuestSubmit={handleTransferGuestSubmit}
                      transferGuestDone={transferGuestDone}
                      transferGuestCount={transferGuestCount}
                      onTransferPaymentComplete={handleTransferPaymentComplete}
                      transferPaymentDone={transferPaymentDone}
                      transferGuestRef={pendingTransferGuestRef}
                    />
                  </React.Fragment>
                ))}
                {busy && <Thinking isMobile={isMobile} />}
                <div ref={bottomRef} />
              </div>
            </div>

            <div style={{
              flexShrink: 0,
              padding: isMobile ? '10px 16px max(14px, env(safe-area-inset-bottom))' : '14px 32px 10px',
              background: 'rgba(13,11,8,0.95)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              position: 'relative', zIndex: 2,
            }}>
              <div className="input-glow-line" />
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <textarea
                  ref={taRef}
                  rows={1}
                  value={input}
                  placeholder="Message Pargo AI…"
                  onChange={e => { setInput(e.target.value); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  style={{
                    flex: 1, border: 'none', outline: 'none', resize: 'none',
                    background: 'transparent', color: '#F2EDD4',
                    fontSize: 16, lineHeight: 1.6,
                    minHeight: 26, maxHeight: 200, paddingTop: 3,
                    fontFamily: 'inherit',
                    caretColor: '#C9A84C',
                  }}
                />
                <SendButton onClick={() => send(input)} disabled={!input.trim() || busy} />
              </div>
              <p style={{ textAlign: 'center', color: '#5A4A38', fontSize: 10, margin: '6px 0 0', letterSpacing: '0.2px' }}>
                Pargo AI can make mistakes. Check important info.
              </p>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

