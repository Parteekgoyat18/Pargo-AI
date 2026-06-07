'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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

/* ── Conversation list item ──────────────────────────── */
function ConvItem({ conv, active, onOpen, onDelete }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '7px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 1,
        background: active ? '#e9e9e9' : hov ? '#f0f0f0' : 'transparent',
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'background 0.1s',
      }}
    >
      <span style={{
        fontSize: 13, color: '#111', flex: 1,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {conv.title}
      </span>
      {(hov || active) && (
        <button
          onClick={onDelete}
          title="Delete"
          style={{
            flexShrink: 0, background: 'none', border: 'none',
            cursor: 'pointer', padding: 2, color: '#999',
            display: 'flex', alignItems: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
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
    }}>H</div>
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
function Thinking() {
  return (
    <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: '12px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <GPTAvatar />
      <div style={{ paddingTop: 3, display: 'flex', gap: 4 }}>
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  );
}

/* ── Message row ─────────────────────────────────────── */
function Message({ role, content }) {
  if (role === 'user') {
    return (
      <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: '6px 24px', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          background: '#f4f4f4', color: '#0d0d0d', borderRadius: 18,
          padding: '10px 16px', maxWidth: '75%', fontSize: 15,
          lineHeight: 1.65, whiteSpace: 'pre-wrap',
        }}>
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="msg-in" style={{ maxWidth: 768, margin: '0 auto', padding: '12px 24px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      <GPTAvatar />
      <div className="prose-msg" style={{ fontSize: 15, lineHeight: 1.75, color: '#0d0d0d', paddingTop: 3, flex: 1 }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

/* ── Suggestions ─────────────────────────────────────── */
const SUGGESTIONS = [
  { label: 'Luxury hotels in Paris', sub: 'for next weekend' },
  { label: 'Beachfront resorts in Bali', sub: 'under $200/night' },
  { label: 'Business hotels in New York', sub: 'near Times Square' },
  { label: 'Romantic stay in Santorini', sub: 'for 2 adults' },
];

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

  const bottomRef   = useRef(null);
  const taRef       = useRef(null);
  const activeIdRef = useRef(null); // always in sync with activeId

  const listKey = `hotelgpt_convs_${user.id}`;
  const msgKey  = useCallback(id => `hotelgpt_msgs_${user.id}_${id}`, [user.id]);

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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  /* ── Actions ── */
  function openConv(id) {
    if (id === activeIdRef.current) return;
    activeIdRef.current = id;
    setActiveId(id);
    try {
      const raw = localStorage.getItem(msgKey(id));
      setMessages(raw ? JSON.parse(raw) : []);
    } catch { setMessages([]); }
  }

  function newChat() {
    const id = genId();
    activeIdRef.current = id;
    setActiveId(id);
    setMessages([]);
    setInput('');
    if (taRef.current) taRef.current.style.height = 'auto';
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

  const empty  = messages.length === 0;
  const groups = groupByDate(convs);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#fff' }}>

      {/* ════════════════════════════════ SIDEBAR ═══ */}
      <div style={{
        width: sidebarOpen ? 260 : 0,
        flexShrink: 0,
        background: '#f9f9f9',
        borderRight: sidebarOpen ? '1px solid #e5e5e5' : 'none',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.22s ease',
      }}>
        {/* Logo + New Chat */}
        <div style={{ padding: '14px 10px 8px', flexShrink: 0, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: '#000', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>H</div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0d0d0d' }}>HotelGPT</span>

            {/* Close sidebar button — top right of sidebar */}
            <button
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                cursor: 'pointer', padding: 4, color: '#999', borderRadius: 4,
                display: 'flex', alignItems: 'center',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#e5e5e5'; e.currentTarget.style.color = '#333'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#999'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          <button
            onClick={newChat}
            style={{
              width: '100%', padding: '8px 10px',
              background: '#fff', border: '1px solid #e0e0e0',
              borderRadius: 8, fontSize: 13, fontWeight: 500,
              color: '#111', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#ebebeb'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
            New chat
          </button>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px' }}>
          {convs.length === 0 && (
            <p style={{ fontSize: 12, color: '#bbb', textAlign: 'center', marginTop: 24 }}>
              No conversations yet
            </p>
          )}

          {Object.entries(groups).map(([label, items]) =>
            items.length > 0 && (
              <div key={label} style={{ marginBottom: 4 }}>
                <p style={{
                  fontSize: 11, color: '#aaa', fontWeight: 600,
                  padding: '8px 10px 4px', margin: 0,
                  textTransform: 'uppercase', letterSpacing: '0.4px',
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
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* User + sign out */}
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid #e5e5e5',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexShrink: 0, gap: 8,
        }}>
          <span style={{
            fontSize: 13, fontWeight: 500, color: '#333',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user.name}
          </span>
          <form action={logoutAction}>
            <button type="submit" style={{
              fontSize: 12, color: '#666', background: 'none',
              border: '1px solid #ddd', borderRadius: 6,
              padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* ══════════════════════════ MAIN AREA ═══════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {/* Open sidebar button — shown only when sidebar is closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
            style={{
              position: 'absolute', top: 12, left: 12, zIndex: 10,
              background: '#fff', border: '1px solid #e5e5e5',
              borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              color: '#555', fontSize: 13,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Chat messages */}
        <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto' }}>
          {empty ? (
            <div style={{
              maxWidth: 700, margin: '0 auto', padding: '50px 24px 0',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%', background: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', fontSize: 22, fontWeight: 700, color: '#fff',
                }}>H</div>
                <h1 style={{ fontSize: 28, fontWeight: 600, color: '#0d0d0d', margin: 0, letterSpacing: '-0.3px' }}>
                  What can I help with?
                </h1>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s.label}
                    className="suggestion-card"
                    onClick={() => send(`${s.label} ${s.sub}`)}
                  >
                    <div style={{ fontWeight: 500 }}>{s.label}</div>
                    <div style={{ color: '#666', fontSize: 13, marginTop: 2 }}>{s.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ paddingTop: 24, paddingBottom: 16 }}>
              {messages.map((m, i) => <Message key={i} role={m.role} content={m.content} />)}
              {busy && <Thinking />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ flexShrink: 0, padding: '10px 16px 24px', background: '#fff' }}>
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
              placeholder="Message HotelGPT"
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
            HotelGPT can make mistakes. Check important info.
          </p>
        </div>

      </div>
    </div>
  );
}
