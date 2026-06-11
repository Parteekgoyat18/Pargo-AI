'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { logoutAction } from '@/app/actions/auth';

/* ── Helpers ─────────────────────────────────────────── */
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
        background: hov ? (danger ? '#fff5f5' : 'rgba(0,0,0,0.05)') : 'none',
        cursor: 'pointer', borderRadius: 6, fontSize: 13,
        color: danger ? '#d33' : '#2d2d2d', textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ color: danger ? '#d33' : '#666', display: 'flex', alignItems: 'center' }}>{icon}</span>
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
        background: active ? 'rgba(0,0,0,0.07)' : (hov || menuOpen) ? 'rgba(0,0,0,0.04)' : 'transparent',
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
            flex: 1, fontSize: 13.5, color: '#0d0d0d',
            border: 'none', borderBottom: '1.5px solid #999',
            background: 'transparent', outline: 'none', padding: '0 2px',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <span style={{
          fontSize: 13.5, color: active ? '#0d0d0d' : '#2d2d2d', flex: 1,
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
              background: menuOpen ? 'rgba(0,0,0,0.08)' : 'none', border: 'none',
              cursor: 'pointer', padding: '3px 4px', color: '#777', flexShrink: 0,
              display: 'flex', alignItems: 'center', borderRadius: 5,
            }}
            onMouseEnter={e => { e.stopPropagation(); if (!menuOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.07)'; }}
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
                background: '#fff',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
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
              <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0' }} />
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
        color: '#555',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.09)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {children}
    </button>
  );
}

/* ── Logo button: shows "P" logo, swaps to sidebar icon on hover ── */
function LogoToggleBtn({ onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      title="Open sidebar"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'rgba(0,0,0,0.07)' : 'none',
        border: 'none', cursor: 'ew-resize',
        width: 36, height: 36, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#555',
      }}
    >
      {hov ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M9 3v18" />
        </svg>
      ) : (
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: '#000', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, letterSpacing: '-0.3px',
        }}>P</div>
      )}
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
              width: 34, height: 34, borderRadius: 8, color: '#555',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.07)'}
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
              fontSize: 15, fontWeight: 600, color: '#0d0d0d',
              flex: 1, paddingLeft: 4, whiteSpace: 'nowrap',
              textAlign: 'left', padding: '0 0 0 4px', borderRadius: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#555'}
            onMouseLeave={e => e.currentTarget.style.color = '#0d0d0d'}
          >
            Pargo AI
          </button>

          <button
            onClick={onNewChat}
            title="New chat"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              width: 34, height: 34, borderRadius: 8, color: '#555',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.07)'}
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
          <p style={{ fontSize: 13, color: '#bbb', textAlign: 'center', marginTop: 32, lineHeight: 1.5 }}>
            No conversations yet
          </p>
        )}

        {/* Pinned section */}
        {pinnedConvs.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <p style={{
              fontSize: 11, color: '#999', fontWeight: 600,
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
                fontSize: 11, color: '#999', fontWeight: 600,
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
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: '#555', color: '#fff', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700,
          }}>
            {(user.name || 'U').slice(0, 2).toUpperCase()}
          </div>
          <span style={{
            fontSize: 13.5, fontWeight: 500, color: '#0d0d0d', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user.name}
          </span>
          <form action={logoutAction}>
            <button type="submit" title="Sign out" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 4, color: '#888', display: 'flex', alignItems: 'center', borderRadius: 6,
            }}
              onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.color = '#333'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#8a7060'; }}
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
      background: '#000', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, flexShrink: 0,
    }}>P</div>
  );
}

/* ── Send button ─────────────────────────────────────── */
function SendButton({ onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 34, height: 32, borderRadius: '60%',
        background: disabled ? '#d9d9d9' : '#000',
        color: '#fff', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, transition: 'background 0.15s',
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
  return (
    <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: `12px ${isMobile ? 12 : 24}px`, display: 'flex', gap: isMobile ? 10 : 16, alignItems: 'flex-start' }}>
      <GPTAvatar />
      <div style={{ paddingTop: 3, display: 'flex', gap: 4 }}>
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
        borderRadius: 14, border: '1px solid',
        borderColor: hov ? '#000' : '#e5e5e5',
        background: hov ? '#000' : '#fff',
        color: hov ? '#fff' : '#0d0d0d',
        cursor: 'pointer', textAlign: 'left',
        boxShadow: hov ? '0 4px 14px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.05)',
        transition: 'all 0.15s ease',
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

/* ── Message row ─────────────────────────────────────── */
function Message({ role, content, isMobile, onGuestFormSubmit, guestFormDone, onSearchFormSubmit, searchFormDone, onHotelSelect, hotelListDone, onPaymentComplete, paymentGateDone, guestRef, onFlightSearchSubmit, flightSearchDone, onFlightSelect, flightListDone, onFlightGuestSubmit, flightGuestDone, onFlightPaymentComplete, flightPaymentDone, flightGuestRef }) {
  const px = isMobile ? 12 : 24;
  const gap = isMobile ? 10 : 16;
  if (role === 'user') {
    // Strip rateKey / offerId from selection messages before displaying
    const hotelMatch  = content.match(/^I'd like to book (.+?) \(rateKey:/);
    const flightMatch = content.match(/^I'd like to book (.+?) \(offerId:/);
    const display = hotelMatch
      ? `I'd like to book ${hotelMatch[1]}`
      : flightMatch
        ? `I'd like to book ${flightMatch[1]}`
        : content;
    return (
      <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: `6px ${px}px`, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          background: '#f4f4f4', color: '#0d0d0d', borderRadius: 18,
          padding: '10px 16px', maxWidth: '85%', fontSize: 15,
          lineHeight: 1.65, whiteSpace: 'pre-wrap',
        }}>
          {display}
        </div>
      </div>
    );
  }
  const hotelListData = parseHotelListToken(content);
  if (hotelListData) {
    return (
      <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <HotelList hotels={hotelListData.hotels || []} onSelect={onHotelSelect} done={hotelListDone} isMobile={isMobile} />
      </div>
    );
  }
  const sfMatch = content.trim().match(SEARCH_FORM_RE);
  if (sfMatch) {
    let prefill = {};
    try { if (sfMatch[1]) prefill = JSON.parse(sfMatch[1]); } catch {}
    return (
      <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <SearchForm prefill={prefill} onSubmit={onSearchFormSubmit} done={searchFormDone} />
      </div>
    );
  }
  const paymentGateData = parsePaymentGateToken(content);
  if (paymentGateData) {
    return (
      <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <PaymentGate data={paymentGateData} guestRef={guestRef} onComplete={onPaymentComplete} done={paymentGateDone} />
      </div>
    );
  }
  const bookingConfirmedData = parseBookingConfirmedToken(content);
  if (bookingConfirmedData) {
    return (
      <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <BookingConfirmed data={bookingConfirmedData} />
      </div>
    );
  }
  if (content.trim() === '[GUEST_DETAILS_FORM]') {
    return (
      <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <GuestDetailsForm onSubmit={onGuestFormSubmit} done={guestFormDone} />
      </div>
    );
  }
  // Flight tokens
  const flightSearchMatch = content.trim().match(FLIGHT_SEARCH_FORM_RE);
  if (flightSearchMatch) {
    let prefill = {};
    try { if (flightSearchMatch[1]) prefill = JSON.parse(flightSearchMatch[1]); } catch {}
    return (
      <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <FlightSearchForm prefill={prefill} onSubmit={onFlightSearchSubmit} done={flightSearchDone} />
      </div>
    );
  }
  const flightListData = parseFlightListToken(content);
  if (flightListData) {
    return (
      <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <FlightList flights={flightListData.flights || []} onSelect={onFlightSelect} done={flightListDone} />
      </div>
    );
  }
  if (content.trim() === '[FLIGHT_GUEST_FORM]') {
    return (
      <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <FlightPassengerForm onSubmit={onFlightGuestSubmit} done={flightGuestDone} />
      </div>
    );
  }
  const flightPaymentData = parseFlightPaymentToken(content);
  if (flightPaymentData) {
    return (
      <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <FlightPaymentGate data={flightPaymentData} flightGuestRef={flightGuestRef} onComplete={onFlightPaymentComplete} done={flightPaymentDone} />
      </div>
    );
  }
  const flightBookingData = parseFlightBookingConfirmedToken(content);
  if (flightBookingData) {
    return (
      <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
        <GPTAvatar />
        <FlightBookingConfirmed data={flightBookingData} />
      </div>
    );
  }
  return (
    <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: `12px ${px}px`, display: 'flex', gap, alignItems: 'flex-start' }}>
      <GPTAvatar />
      <div className="prose-msg" style={{ fontSize: 15, lineHeight: 1.75, color: '#0d0d0d', paddingTop: 3, flex: 1, minWidth: 0 }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
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
        width: '100%', height: 110, background: '#f4f4f4',
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
      style={{ position: 'relative', width: '100%', height: 160, background: '#f0f0f0', overflow: 'hidden' }}
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
    <button
      onClick={() => onSelect(hotel)}
      style={{
        background: '#fff', border: '1px solid #e5e5e5',
        borderRadius: 14, marginBottom: 10,
        cursor: 'pointer', textAlign: 'left', width: '100%',
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        overflow: 'hidden', padding: 0,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={e => { if (!isMobile) { e.currentTarget.style.borderColor = '#aaa'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.11)'; }}}
      onMouseLeave={e => { if (!isMobile) { e.currentTarget.style.borderColor = '#e5e5e5'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.06)'; }}}
    >
      <PhotoCarousel urls={imageUrls} name={hotel.name} />

      <div style={{ padding: isMobile ? '10px 12px' : '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <div style={{ fontWeight: 600, fontSize: isMobile ? 13 : 14, color: '#0d0d0d', lineHeight: 1.3 }}>{hotel.name}</div>
            {hotel.categoryName && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{hotel.categoryName}</div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 14, color: '#0d0d0d' }}>
              {hotel.currency} {fmt(hotel.minRate)}
            </div>
            <div style={{ fontSize: 11, color: '#999' }}>per night</div>
          </div>
        </div>

        {hotel.facilities?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {hotel.facilities.map((f, i) => (
              <span key={i} style={{
                fontSize: 11, color: '#555', background: '#f4f4f4',
                borderRadius: 6, padding: '3px 7px',
              }}>{f}</span>
            ))}
          </div>
        )}
      </div>
    </button>
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
        background: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#166534',
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
      fontSize: 11, fontWeight: 600, color: '#888',
      textTransform: 'uppercase', letterSpacing: '0.5px',
      marginBottom: 8, marginTop: 4,
    }}>
      {label}
      <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6 }}>
        {cur} {fmt(low)} – {fmt(high)} / night
      </span>
    </div>
  );

  return (
    <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 520 }}>
      <p style={{ margin: '0 0 14px', fontSize: 15, color: '#0d0d0d' }}>
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

/* ── PaymentGate (dummy card form) ───────────────────── */
function PaymentGate({ data, guestRef, onComplete, done }) {
  const [cardNum, setCardNum] = useState('');
  const [expiry,  setExpiry]  = useState('');
  const [cvv,     setCvv]     = useState('');
  const [paying,  setPaying]  = useState(false);
  const [error,   setError]   = useState('');

  const cardClean = cardNum.replace(/\s/g, '');
  const valid = cardClean.length === 16 && expiry.length === 5 && cvv.length >= 3;

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#166534',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Payment complete
      </div>
    );
  }

  function fmtCard(val) {
    return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  }
  function fmtExpiry(val) {
    const d = val.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
  }

  async function handlePay(e) {
    e.preventDefault();
    if (!valid || paying) return;
    setPaying(true);
    setError('');
    try {
      const res = await fetch('/api/payment/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rateKey: data.rateKey, guest: guestRef.current }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error); }
      onComplete(await res.json());
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
      setPaying(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid #e0e0e0', fontSize: 14, outline: 'none',
    color: '#0d0d0d', background: '#fafafa', boxSizing: 'border-box',
    letterSpacing: '0.05em', transition: 'border-color 0.15s',
  };
  const labelStyle     = { display: 'block', marginBottom: 12 };
  const labelTextStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 5 };

  return (
    <form
      onSubmit={handlePay}
      style={{
        background: '#fff', border: '1px solid #e5e5e5',
        borderRadius: 16, padding: '20px', width: '100%', maxWidth: 340,
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      }}
    >
      <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 15, color: '#0d0d0d' }}>
        Payment Details
      </p>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: '#666' }}>{data.hotelName}</p>

      <div style={{
        background: '#f9f9f9', borderRadius: 10, padding: '10px 14px',
        display: 'flex', justifyContent: 'space-between', marginBottom: 16,
      }}>
        <span style={{ fontSize: 13, color: '#666' }}>Total</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#0d0d0d' }}>
          {data.currency} {Number(data.amount).toLocaleString('en-IN')}
        </span>
      </div>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Card Number</span>
        <input
          type="text" value={cardNum} placeholder="1234 5678 9012 3456"
          onChange={e => setCardNum(fmtCard(e.target.value))}
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#999'}
          onBlur={e => e.target.style.borderColor = '#e0e0e0'}
        />
      </label>

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Expiry</span>
          <input
            type="text" value={expiry} placeholder="MM/YY"
            onChange={e => setExpiry(fmtExpiry(e.target.value))}
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = '#999'}
            onBlur={e => e.target.style.borderColor = '#e0e0e0'}
          />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>CVV</span>
          <input
            type="text" value={cvv} placeholder="123" maxLength={4}
            onChange={e => setCvv(e.target.value.replace(/\D/g, ''))}
            style={{ ...inputStyle, letterSpacing: '0.2em' }}
            onFocus={e => e.target.style.borderColor = '#999'}
            onBlur={e => e.target.style.borderColor = '#e0e0e0'}
          />
        </label>
      </div>

      {error && (
        <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={!valid || paying}
        style={{
          width: '100%', padding: '11px', marginTop: 4,
          borderRadius: 10, border: 'none',
          background: (!valid || paying) ? '#d9d9d9' : '#000',
          color: '#fff', fontSize: 14, fontWeight: 600,
          cursor: (!valid || paying) ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {paying ? 'Confirming...' : `Pay ${data.currency} ${Number(data.amount).toLocaleString('en-IN')}`}
      </button>
    </form>
  );
}

/* ── BookingConfirmed ────────────────────────────────── */
function BookingConfirmed({ data }) {
  const row = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e5e5' }}>
      <span style={{ fontSize: 13, color: '#666' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#0d0d0d', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e5e5',
      borderRadius: 16, padding: '20px', width: '100%', maxWidth: 380,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: '#dcfce7',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#166534' }}>Booking Confirmed!</span>
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
const SEARCH_FORM_RE = /^\[SEARCH_FORM(?::(\{[\s\S]*\}))?\]$/;

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
        background: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#166534',
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
    border: '1px solid #e0e0e0', fontSize: 14, outline: 'none',
    color: '#0d0d0d', background: '#fafafa', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  const labelStyle = { display: 'block', marginBottom: 12 };
  const labelTextStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 5 };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: '#fff', border: '1px solid #e5e5e5',
        borderRadius: 16, padding: '20px', width: '100%', maxWidth: 340,
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      }}
    >
      <p style={{ margin: '0 0 16px', fontWeight: 600, fontSize: 15, color: '#0d0d0d' }}>
        Where do you want to stay?
      </p>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Destination</span>
        <input
          type="text" value={destination} required
          onChange={e => setDestination(e.target.value)}
          placeholder="e.g. Goa, Paris, Bali"
          style={fieldStyle}
          onFocus={e => e.target.style.borderColor = '#999'}
          onBlur={e => e.target.style.borderColor = '#e0e0e0'}
        />
      </label>

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Check-in</span>
          <input
            type="date" value={checkin} required min={today}
            onChange={e => setCheckin(e.target.value)}
            style={fieldStyle}
            onFocus={e => e.target.style.borderColor = '#999'}
            onBlur={e => e.target.style.borderColor = '#e0e0e0'}
          />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Check-out</span>
          <input
            type="date" value={checkout} required min={checkin || today}
            onChange={e => setCheckout(e.target.value)}
            style={fieldStyle}
            onFocus={e => e.target.style.borderColor = '#999'}
            onBlur={e => e.target.style.borderColor = '#e0e0e0'}
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
            e.target.style.borderColor = '#e0e0e0';
          }}
          style={fieldStyle}
          onFocus={e => e.target.style.borderColor = '#999'}
        />
      </label>

      <button
        type="submit"
        disabled={!valid}
        style={{
          width: '100%', padding: '11px',
          borderRadius: 10, border: 'none',
          background: valid ? '#000' : '#d9d9d9',
          color: '#fff', fontSize: 14, fontWeight: 600,
          cursor: valid ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s',
        }}
      >
        Search Hotels
      </button>
    </form>
  );
}

/* ── Guest Details Form ──────────────────────────────── */
function GuestDetailsForm({ onSubmit, done }) {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [phone,     setPhone]     = useState('');

  const valid = firstName.trim() && lastName.trim() && email.trim() && phone.trim();

  function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    onSubmit(firstName.trim(), lastName.trim(), email.trim(), phone.trim());
  }

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#166534',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Details submitted
      </div>
    );
  }

  const fieldStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid #e0e0e0', fontSize: 14, outline: 'none',
    color: '#0d0d0d', background: '#fafafa', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  const labelStyle = {
    display: 'block', marginBottom: 12,
  };
  const labelTextStyle = {
    display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 5,
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: '#fff', border: '1px solid #e5e5e5',
        borderRadius: 16, padding: '20px', width: '100%', maxWidth: 340,
        boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
      }}
    >
      <p style={{ margin: '0 0 16px', fontWeight: 600, fontSize: 15, color: '#0d0d0d' }}>
        Enter your booking details
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 0 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>First Name</span>
          <input
            type="text" value={firstName} required
            onChange={e => setFirstName(e.target.value)}
            placeholder="Rahul"
            style={fieldStyle}
            onFocus={e => e.target.style.borderColor = '#999'}
            onBlur={e => e.target.style.borderColor = '#e0e0e0'}
          />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Last Name</span>
          <input
            type="text" value={lastName} required
            onChange={e => setLastName(e.target.value)}
            placeholder="Sharma"
            style={fieldStyle}
            onFocus={e => e.target.style.borderColor = '#999'}
            onBlur={e => e.target.style.borderColor = '#e0e0e0'}
          />
        </label>
      </div>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Email Address</span>
        <input
          type="email" value={email} required
          onChange={e => setEmail(e.target.value)}
          placeholder="rahul@example.com"
          style={fieldStyle}
          onFocus={e => e.target.style.borderColor = '#999'}
          onBlur={e => e.target.style.borderColor = '#e0e0e0'}
        />
      </label>

      <label style={{ ...labelStyle, marginBottom: 18 }}>
        <span style={labelTextStyle}>Phone Number</span>
        <input
          type="tel" value={phone} required
          onChange={e => setPhone(e.target.value)}
          placeholder="9834725737"
          style={fieldStyle}
          onFocus={e => e.target.style.borderColor = '#999'}
          onBlur={e => e.target.style.borderColor = '#e0e0e0'}
        />
      </label>

      <button
        type="submit"
        disabled={!valid}
        style={{
          width: '100%', padding: '11px',
          borderRadius: 10, border: 'none',
          background: valid ? '#000' : '#d9d9d9',
          color: '#fff', fontSize: 14, fontWeight: 600,
          cursor: valid ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s',
        }}
      >
        Confirm Booking
      </button>
    </form>
  );
}


/* ── Flight Search Form ──────────────────────────────── */
const FLIGHT_SEARCH_FORM_RE = /^\[FLIGHT_SEARCH_FORM(?::(\{[\s\S]*\}))?\]$/;

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
        background: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#166534',
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
    border: '1px solid #e0e0e0', fontSize: 14, outline: 'none',
    color: '#0d0d0d', background: '#fafafa', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  const labelStyle     = { display: 'block', marginBottom: 12 };
  const labelTextStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 5 };

  return (
    <form onSubmit={handleSubmit} style={{
      background: '#fff', border: '1px solid #e5e5e5',
      borderRadius: 16, padding: '20px', width: '100%', maxWidth: 380,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    }}>
      <p style={{ margin: '0 0 14px', fontWeight: 600, fontSize: 15, color: '#0d0d0d' }}>
        Search Flights
      </p>

      {/* Trip type toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['one', 'round'].map(t => (
          <button key={t} type="button" onClick={() => setTripType(t)} style={{
            flex: 1, padding: '7px', borderRadius: 8, border: '1px solid',
            borderColor: tripType === t ? '#000' : '#e0e0e0',
            background: tripType === t ? '#000' : '#fff',
            color: tripType === t ? '#fff' : '#666',
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
            onFocus={e => e.target.style.borderColor = '#999'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>To</span>
          <input type="text" value={to} required placeholder="Dubai" onChange={e => setTo(e.target.value)} style={fieldStyle}
            onFocus={e => e.target.style.borderColor = '#999'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Departure</span>
          <input type="date" value={departure} required min={today} onChange={e => setDeparture(e.target.value)} style={fieldStyle}
            onFocus={e => e.target.style.borderColor = '#999'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
        </label>
        {tripType === 'round' && (
          <label style={{ ...labelStyle, flex: 1 }}>
            <span style={labelTextStyle}>Return</span>
            <input type="date" value={returnDate} min={departure || today} onChange={e => setReturn(e.target.value)} style={fieldStyle}
              onFocus={e => e.target.style.borderColor = '#999'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
          </label>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Passengers</span>
          <input type="number" value={passengers} min={1} max={9} required onChange={e => setPassengers(e.target.value)}
            onBlur={e => { const n = Math.min(9, Math.max(1, parseInt(e.target.value) || 1)); setPassengers(String(n)); e.target.style.borderColor = '#e0e0e0'; }}
            style={fieldStyle} onFocus={e => e.target.style.borderColor = '#999'} />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Cabin</span>
          <select value={cabin} onChange={e => setCabin(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
            <option value="economy">Economy</option>
            <option value="premium_economy">Premium Economy</option>
            <option value="business">Business</option>
            <option value="first">First</option>
          </select>
        </label>
      </div>

      <button type="submit" disabled={!valid} style={{
        width: '100%', padding: '11px', marginTop: 4, borderRadius: 10, border: 'none',
        background: valid ? '#000' : '#d9d9d9', color: '#fff', fontSize: 14, fontWeight: 600,
        cursor: valid ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
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
        background: '#fff', border: `1px solid ${hov && !done ? '#000' : '#e5e5e5'}`,
        borderRadius: 12, padding: '14px 16px', cursor: done ? 'default' : 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hov && !done ? '0 2px 10px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.05)',
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
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0d0d0d' }}>{flight.airline}</span>
        </div>
        <span style={{ fontSize: 11, color: '#888', background: '#f4f4f4', borderRadius: 6, padding: '2px 8px' }}>
          {cabinLabel}
        </span>
      </div>

      {/* Route + times */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ textAlign: 'center', minWidth: 44 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0d0d0d' }}>{flight.departure.time}</div>
          <div style={{ fontSize: 11, color: '#888' }}>{flight.origin}</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>{flight.departure.date}</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ fontSize: 11, color: '#888' }}>{flight.duration}</div>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth={1.5}>
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 11, color: flight.stops === 0 ? '#16a34a' : '#d97706', fontWeight: 500 }}>{stops}</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 44 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0d0d0d' }}>{flight.arrival.time}</div>
          <div style={{ fontSize: 11, color: '#888' }}>{flight.destination}</div>
          <div style={{ fontSize: 11, color: '#aaa' }}>{flight.arrival.date}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', paddingLeft: 12, borderLeft: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0d0d0d' }}>
            {Number(flight.amount).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>{flight.currency}</div>
        </div>
      </div>

      {!done && (
        <div style={{ fontSize: 12, color: hov ? '#000' : '#888', textAlign: 'right', marginTop: 4, fontWeight: hov ? 600 : 400 }}>
          {hov ? 'Click to select →' : 'Select'}
        </div>
      )}
    </div>
  );
}

function FlightList({ flights, onSelect, done }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 480 }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>
        {flights.length} flight{flights.length !== 1 ? 's' : ''} found — sorted by price
      </p>
      {flights.map((f, i) => (
        <FlightCard key={f.offerId || i} flight={f} onSelect={onSelect} done={done} />
      ))}
    </div>
  );
}

/* ── Flight Guest Form ───────────────────────────────── */
function FlightPassengerForm({ onSubmit, done }) {
  const [title,    setTitle]    = useState('mr');
  const [firstName, setFirst]  = useState('');
  const [lastName,  setLast]   = useState('');
  const [dob,       setDob]    = useState('');
  const [gender,    setGender] = useState('m');
  const [email,     setEmail]  = useState('');
  const [phone,     setPhone]  = useState('');

  const valid = firstName.trim() && lastName.trim() && dob && email.trim() && phone.trim();

  function handleSubmit(e) {
    e.preventDefault();
    if (!valid) return;
    onSubmit({ title, firstName: firstName.trim(), lastName: lastName.trim(), dob, gender, email: email.trim(), phone: phone.trim() });
  }

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#166534',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Passenger details submitted
      </div>
    );
  }

  const fieldStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid #e0e0e0', fontSize: 14, outline: 'none',
    color: '#0d0d0d', background: '#fafafa', boxSizing: 'border-box', transition: 'border-color 0.15s',
  };
  const labelStyle     = { display: 'block', marginBottom: 12 };
  const labelTextStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 5 };

  return (
    <form onSubmit={handleSubmit} style={{
      background: '#fff', border: '1px solid #e5e5e5',
      borderRadius: 16, padding: '20px', width: '100%', maxWidth: 360,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    }}>
      <p style={{ margin: '0 0 16px', fontWeight: 600, fontSize: 15, color: '#0d0d0d' }}>
        Passenger Details
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, width: 90 }}>
          <span style={labelTextStyle}>Title</span>
          <select value={title} onChange={e => { setTitle(e.target.value); setGender(['ms', 'mrs', 'miss'].includes(e.target.value) ? 'f' : 'm'); }}
            style={{ ...fieldStyle, cursor: 'pointer', padding: '9px 8px' }}>
            <option value="mr">Mr</option>
            <option value="mrs">Mrs</option>
            <option value="ms">Ms</option>
            <option value="miss">Miss</option>
          </select>
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>First Name</span>
          <input type="text" value={firstName} required placeholder="Rahul" onChange={e => setFirst(e.target.value)} style={fieldStyle}
            onFocus={e => e.target.style.borderColor = '#999'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Last Name</span>
          <input type="text" value={lastName} required placeholder="Sharma" onChange={e => setLast(e.target.value)} style={fieldStyle}
            onFocus={e => e.target.style.borderColor = '#999'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Date of Birth</span>
          <input type="date" value={dob} required max={new Date().toISOString().split('T')[0]} onChange={e => setDob(e.target.value)} style={fieldStyle}
            onFocus={e => e.target.style.borderColor = '#999'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
        </label>
        <label style={{ ...labelStyle, width: 110 }}>
          <span style={labelTextStyle}>Gender</span>
          <select value={gender} onChange={e => setGender(e.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
            <option value="m">Male</option>
            <option value="f">Female</option>
          </select>
        </label>
      </div>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Email Address</span>
        <input type="email" value={email} required placeholder="rahul@example.com" onChange={e => setEmail(e.target.value)} style={fieldStyle}
          onFocus={e => e.target.style.borderColor = '#999'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
      </label>

      <label style={{ ...labelStyle, marginBottom: 18 }}>
        <span style={labelTextStyle}>Phone Number (with country code)</span>
        <input type="tel" value={phone} required placeholder="+919834725737" onChange={e => setPhone(e.target.value)} style={fieldStyle}
          onFocus={e => e.target.style.borderColor = '#999'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
      </label>

      <button type="submit" disabled={!valid} style={{
        width: '100%', padding: '11px', borderRadius: 10, border: 'none',
        background: valid ? '#000' : '#d9d9d9', color: '#fff', fontSize: 14, fontWeight: 600,
        cursor: valid ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
      }}>
        Confirm Passenger
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
  const [cardNum, setCardNum] = useState('');
  const [expiry,  setExpiry]  = useState('');
  const [cvv,     setCvv]     = useState('');
  const [paying,  setPaying]  = useState(false);
  const [error,   setError]   = useState('');

  const cardClean = cardNum.replace(/\s/g, '');
  const valid = cardClean.length === 16 && expiry.length === 5 && cvv.length >= 3;

  if (done) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: 10, padding: '8px 14px', fontSize: 14, color: '#166534',
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Payment complete
      </div>
    );
  }

  function fmtCard(val)   { return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); }
  function fmtExpiry(val) { const d = val.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; }

  async function handlePay(e) {
    e.preventDefault();
    if (!valid || paying) return;
    setPaying(true);
    setError('');
    try {
      const res = await fetch('/api/flights/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId:      data.offerId,
          passengerIds: data.passengerIds,
          guest:        flightGuestRef.current,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Booking failed'); }
      onComplete(await res.json());
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
      setPaying(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid #e0e0e0', fontSize: 14, outline: 'none',
    color: '#0d0d0d', background: '#fafafa', boxSizing: 'border-box',
    letterSpacing: '0.05em', transition: 'border-color 0.15s',
  };
  const labelStyle     = { display: 'block', marginBottom: 12 };
  const labelTextStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: '#666', marginBottom: 5 };

  return (
    <form onSubmit={handlePay} style={{
      background: '#fff', border: '1px solid #e5e5e5',
      borderRadius: 16, padding: '20px', width: '100%', maxWidth: 340,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    }}>
      <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 15, color: '#0d0d0d' }}>Payment Details</p>
      <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>{data.airline} · {data.route}</p>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#aaa' }}>{data.departureDate}</p>

      <div style={{ background: '#f9f9f9', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#666' }}>Total</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#0d0d0d' }}>
          {data.currency} {Number(data.amount).toLocaleString('en-IN')}
        </span>
      </div>

      <label style={labelStyle}>
        <span style={labelTextStyle}>Card Number</span>
        <input type="text" value={cardNum} placeholder="1234 5678 9012 3456"
          onChange={e => setCardNum(fmtCard(e.target.value))} style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#999'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
      </label>

      <div style={{ display: 'flex', gap: 10 }}>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>Expiry</span>
          <input type="text" value={expiry} placeholder="MM/YY"
            onChange={e => setExpiry(fmtExpiry(e.target.value))} style={inputStyle}
            onFocus={e => e.target.style.borderColor = '#999'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          <span style={labelTextStyle}>CVV</span>
          <input type="text" value={cvv} placeholder="123" maxLength={4}
            onChange={e => setCvv(e.target.value.replace(/\D/g, ''))}
            style={{ ...inputStyle, letterSpacing: '0.2em' }}
            onFocus={e => e.target.style.borderColor = '#999'} onBlur={e => e.target.style.borderColor = '#e0e0e0'} />
        </label>
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

      <button type="submit" disabled={!valid || paying} style={{
        width: '100%', padding: '11px', marginTop: 4, borderRadius: 10, border: 'none',
        background: (!valid || paying) ? '#d9d9d9' : '#000', color: '#fff', fontSize: 14, fontWeight: 600,
        cursor: (!valid || paying) ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
      }}>
        {paying ? 'Confirming...' : `Pay ${data.currency} ${Number(data.amount).toLocaleString('en-IN')}`}
      </button>
    </form>
  );
}

/* ── Flight Booking Confirmed ────────────────────────── */
function FlightBookingConfirmed({ data }) {
  const row = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e5e5' }}>
      <span style={{ fontSize: 13, color: '#666' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#0d0d0d', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e5e5',
      borderRadius: 16, padding: '20px', width: '100%', maxWidth: 380,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: '#dcfce7',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#166534' }}>Flight Booked!</span>
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

/* ══════════════════════════════════════════════════════ */
/*  Main ChatUI                                          */
/* ══════════════════════════════════════════════════════ */
export default function ChatUI({ user }) {
  const [convs,       setConvs]       = useState([]);
  const [activeId,    setActiveId]    = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [busy,        setBusy]        = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile,    setIsMobile]    = useState(false);

  const bottomRef       = useRef(null);
  const scrollRef       = useRef(null);
  const taRef           = useRef(null);
  const activeIdRef     = useRef(null);
  const pendingGuestRef       = useRef(null);
  const pendingFlightGuestRef = useRef(null);
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
        body: JSON.stringify({ messages: history }),
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
    m.role === 'assistant' && m.content.trim() === '[GUEST_DETAILS_FORM]' ? i : acc, -1);
  const guestFormDone = lastFormIdx !== -1 && messages.slice(lastFormIdx + 1).some(m => m.role === 'user');

  function handleGuestFormSubmit(firstName, lastName, email, phone) {
    pendingGuestRef.current = { firstName, lastName, email, phone };
    const msg = `First Name: ${firstName}\nLast Name: ${lastName}\nEmail: ${email}\nPhone: ${phone}`;
    send(msg);
  }

  /* ── Search form: done when a user message exists after the last search form marker ── */
  const lastSearchFormIdx = messages.reduce((acc, m, i) =>
    m.role === 'assistant' && SEARCH_FORM_RE.test(m.content.trim()) ? i : acc, -1);
  const searchFormDone = lastSearchFormIdx !== -1 && messages.slice(lastSearchFormIdx + 1).some(m => m.role === 'user');

  function handleSearchFormSubmit(destination, checkin, checkout, adults) {
    const msg = `Destination: ${destination}\nCheck-in: ${checkin}\nCheck-out: ${checkout}\nAdults: ${adults}`;
    send(msg);
  }

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
    m.role === 'assistant' && FLIGHT_SEARCH_FORM_RE.test(m.content.trim()) ? i : acc, -1);
  const flightSearchDone = lastFlightSearchIdx !== -1 && messages.slice(lastFlightSearchIdx + 1).some(m => m.role === 'user');

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
    m.role === 'assistant' && m.content.trim() === '[FLIGHT_GUEST_FORM]' ? i : acc, -1);
  const flightGuestDone = lastFlightGuestIdx !== -1 && messages.slice(lastFlightGuestIdx + 1).some(m => m.role === 'user');

  function handleFlightGuestSubmit(guestInfo) {
    pendingFlightGuestRef.current = guestInfo;
    send(`Title: ${guestInfo.title}\nFirst Name: ${guestInfo.firstName}\nLast Name: ${guestInfo.lastName}\nDate of Birth: ${guestInfo.dob}\nGender: ${guestInfo.gender === 'f' ? 'female' : 'male'}\nEmail: ${guestInfo.email}\nPhone: ${guestInfo.phone}`);
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
            width: SIDEBAR_OPEN, background: '#f9f9f9',
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

      {/* Desktop: persistent sidebar — full or mini icon strip */}
      {!isMobile && (
        <div style={{
          width: sidebarOpen ? SIDEBAR_OPEN : SIDEBAR_MINI,
          flexShrink: 0, background: '#f9f9f9',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.22s ease',
        }}>
          {sidebarOpen ? (
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
          ) : (
            /* Mini icon strip */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 4, flex: 1 }}>
              <LogoToggleBtn onClick={() => setSidebarOpen(true)} />
              <IconBtn onClick={newChat} title="New chat">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </IconBtn>

              {/* User avatar pinned to bottom */}
              <div style={{ flex: 1 }} />
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: '#555', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, marginBottom: 12, flexShrink: 0,
                cursor: 'default',
              }}>
                {(user.name || 'U').slice(0, 2).toUpperCase()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════ MAIN AREA ═══════ */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {/* Top bar — shown when sidebar is closed (desktop mini strip) or on mobile */}
        {(!sidebarOpen || isMobile) && (
          <div style={{
            flexShrink: 0, height: 48,
            display: 'flex', alignItems: 'center',
            padding: '0 8px',
            gap: 4,
          }}>
            {/* On mobile: hamburger to open sidebar */}
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  background: 'none', border: 'none', borderRadius: 8,
                  padding: 6, cursor: 'pointer', color: '#777',
                  display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="M9 3v18" />
                </svg>
              </button>
            )}

            {/* Pargo AI brand */}
            {(isMobile || !sidebarOpen) && (
              <button
                onClick={newChat}
                title="New chat"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 600, color: '#0d0d0d',
                  paddingLeft: isMobile ? 2 : 4, borderRadius: 6, padding: isMobile ? '0 0 0 2px' : '0 0 0 4px',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#555'}
                onMouseLeave={e => e.currentTarget.style.color = '#0d0d0d'}
              >
                Pargo AI
              </button>
            )}
          </div>
        )}

        {empty ? (
          /* ── Empty state: centered hero + input ── */
          <div style={{
            flex: 1,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '0 16px 40px',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: '#000',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16, fontSize: 20, fontWeight: 700, color: '#fff',
            }}>P</div>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 600, color: '#0d0d0d', margin: 0, letterSpacing: '-0.3px' }}>
              What would you like to book?
            </h1>
            <p style={{ color: '#999', fontSize: 14, margin: '8px 0 24px' }}>
              Hotels and flights worldwide — pick a service or just type.
            </p>

            {/* Service selection chips */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: 12, marginBottom: 28,
              width: isMobile ? '100%' : 'auto',
              maxWidth: isMobile ? 360 : 'none',
            }}>
              {[
                {
                  label: 'Book a Hotel',
                  sub: 'Search & reserve rooms',
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
                    </svg>
                  ),
                  msg: 'I want to book a hotel',
                },
                {
                  label: 'Book a Flight',
                  sub: 'Search & reserve seats',
                  icon: (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.1z" />
                    </svg>
                  ),
                  msg: 'I want to book a flight',
                },
              ].map(({ label, sub, icon, msg }) => (
                <ServiceChip key={label} label={label} sub={sub} icon={icon} isMobile={isMobile} onClick={() => send(msg)} />
              ))}
            </div>

            <div style={{
              width: '100%', maxWidth: 640, background: '#fff',
              borderRadius: 24, padding: '10px 10px 10px 18px',
              display: 'flex', alignItems: 'flex-end', gap: 8,
              boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 4px 14px rgba(0,0,0,0.07)',
            }}>
              <textarea
                ref={taRef}
                rows={1}
                value={input}
                placeholder="Message Pargo AI"
                onChange={e => { setInput(e.target.value); resize(); }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                style={{
                  flex: 1, border: 'none', outline: 'none', resize: 'none',
                  background: 'transparent', color: '#0d0d0d',
                  fontSize: 15, lineHeight: 1.6,
                  minHeight: 24, maxHeight: 200, paddingTop: 2,
                }}
              />
              <SendButton onClick={() => send(input)} disabled={!input.trim() || busy} />
            </div>
          </div>
        ) : (
          /* ── Chat state: messages + input at bottom ── */
          <>
            <div ref={scrollRef} className="chat-scroll" style={{ flex: 1 }}>
              <div style={{ paddingTop: 24, paddingBottom: 16 }}>
                {messages.map((m, i) => (
                  <React.Fragment key={i}>
                    <Message
                      role={m.role}
                      content={m.content}
                      isMobile={isMobile}
                      onGuestFormSubmit={handleGuestFormSubmit}
                      guestFormDone={guestFormDone}
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
                      onFlightPaymentComplete={handleFlightPaymentComplete}
                      flightPaymentDone={flightPaymentDone}
                      flightGuestRef={pendingFlightGuestRef}
                    />
                  </React.Fragment>
                ))}
                {busy && <Thinking isMobile={isMobile} />}
                <div ref={bottomRef} />
              </div>
            </div>

            <div style={{
              flexShrink: 0,
              padding: `10px 12px ${isMobile ? 16 : 24}px`,
              paddingBottom: isMobile ? 'max(16px, env(safe-area-inset-bottom))' : 24,
              background: '#fff',
            }}>
              <div style={{
                maxWidth: 768, margin: '0 auto', background: '#fff',
                borderRadius: 24, padding: '10px 10px 10px 18px',
                display: 'flex', alignItems: 'flex-end', gap: 8,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.08), 0 4px 14px rgba(0,0,0,0.07)',
              }}>
                <textarea
                  ref={taRef}
                  rows={1}
                  value={input}
                  placeholder="Message Pargo AI"
                  onChange={e => { setInput(e.target.value); resize(); }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  style={{
                    flex: 1, border: 'none', outline: 'none', resize: 'none',
                    background: 'transparent', color: '#0d0d0d',
                    fontSize: 15, lineHeight: 1.6,
                    minHeight: 24, maxHeight: 200, paddingTop: 2,
                  }}
                />
                <SendButton onClick={() => send(input)} disabled={!input.trim() || busy} />
              </div>
              <p style={{ textAlign: 'center', color: '#b4b4b4', fontSize: 12, marginTop: 10 }}>
                Pargo AI can make mistakes. Check important info.
              </p>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
