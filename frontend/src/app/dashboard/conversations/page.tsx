'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getSocket } from '@/lib/socket';
import { format, isToday, isYesterday } from 'date-fns';
import {
  Search, Send, User, Phone, MessageCircle,
  CheckCheck, Clock, Wifi, WifiOff, RefreshCw, MessagesSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Conversation {
  fromMobile:    string;
  fromName:      string;
  contactId:     string | null;
  leadStage:     string | null;
  lastMessage:   string;
  lastTime:      string;
  unreadCount:   number;
  totalMessages: number;
}

interface ChatMessage {
  id:         string;
  type:       'incoming' | 'sent';
  text:       string;
  msgType:    string;
  time:       string;
  isRead:     boolean;
  source:     string;
  fromMobile?: string;
  fromName?:  string;
}

interface Thread {
  contact:  { id: string; name: string; mobile: string; leadStage: string } | null;
  mobile:   string;
  thread:   ChatMessage[];
  hasMore:  boolean;
}

const LEAD_COLOR: Record<string, string> = {
  LEAD: '#6b7280', PROSPECT: '#3b82f6', QUALIFIED: '#8b5cf6',
  CUSTOMER: '#22c55e', CHURNED: '#ef4444',
};

function timeLabel(t: string) {
  const d = new Date(t);
  if (isToday(d))     return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd MMM');
}

function avatar(name: string) {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ConversationsPage() {
  const { currentBusinessAccount } = useAuthStore();
  const businessAccountId = currentBusinessAccount?.id ?? null;
  const qc = useQueryClient();

  const [selected,   setSelected]   = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [replyText,  setReplyText]  = useState('');
  const [sending,    setSending]    = useState(false);
  const [connected,  setConnected]  = useState(false);
  const [localMsgs,  setLocalMsgs]  = useState<Record<string, ChatMessage[]>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // ── Socket real-time ────────────────────────────────────────────────────
  useEffect(() => {
    if (!businessAccountId) return;
    const socket = getSocket();

    const onMsg = (data: { type: string; message: ChatMessage }) => {
      if (data.type !== 'new_message') return;
      const mobile = data.message.fromMobile || '';

      setLocalMsgs(prev => ({
        ...prev,
        [mobile]: [...(prev[mobile] || []), data.message],
      }));

      qc.invalidateQueries({ queryKey: ['conversations', businessAccountId] });

      if (selected !== mobile) {
        toast(`💬 ${data.message.fromName || mobile}: ${data.message.text.substring(0, 40)}`, { duration: 3000 });
      }
    };

    socket.on(`conversation:${businessAccountId}`, onMsg);
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    setConnected(socket.connected);

    return () => { socket.off(`conversation:${businessAccountId}`, onMsg); };
  }, [businessAccountId, selected, qc]);

  // ── Fetch conversation list ─────────────────────────────────────────────
  const { data: convData, isLoading: listLoading } = useQuery({
    queryKey:        ['conversations', businessAccountId],
    queryFn:         () => api.get('/conversations').then(r => r.data),
    refetchInterval: 30000,
    enabled:         !!businessAccountId,
  });
  const conversations: Conversation[] = convData?.data || [];

  // ── Fetch thread ────────────────────────────────────────────────────────
  const { data: threadData, isLoading: threadLoading, refetch: refetchThread } = useQuery({
    queryKey: ['thread', businessAccountId, selected],
    queryFn:  () => api.get(`/conversations/${selected}`).then(r => r.data),
    enabled:  !!selected && !!businessAccountId,
  });
  const threadInfo: Thread | null = threadData?.data || null;

  // Merge server + real-time
  const fullThread: ChatMessage[] = selected
    ? [
        ...(threadInfo?.thread || []),
        ...(localMsgs[selected] || []).filter(
          lm => !(threadInfo?.thread || []).some(tm => tm.id === lm.id)
        ),
      ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [fullThread.length, selected]);

  // ── Send ────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!replyText.trim() || !selected || sending) return;
    const text = replyText.trim();
    setReplyText('');
    setSending(true);

    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`, type: 'sent', text, msgType: 'text',
      time: new Date().toISOString(), isRead: true, source: 'manual',
    };
    setLocalMsgs(prev => ({ ...prev, [selected]: [...(prev[selected] || []), optimistic] }));

    try {
      await api.post(`/conversations/${selected}/send`, { text });
      refetchThread();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'Send failed';
      toast.error(msg);
      setLocalMsgs(prev => ({ ...prev, [selected]: (prev[selected] || []).filter(m => m.id !== optimistic.id) }));
      setReplyText(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [replyText, selected, sending, refetchThread]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const filtered = conversations.filter(c =>
    !search ||
    c.fromName.toLowerCase().includes(search.toLowerCase()) ||
    c.fromMobile.includes(search)
  );

  const selectedConv = conversations.find(c => c.fromMobile === selected);

  return (
    <div style={{ height: 'calc(100vh - 2rem)', display: 'flex', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>

      {/* ── Left: contact list ──────────────────────────────────────────── */}
      <div style={{ width: '320px', flexShrink: 0, background: '#111318', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '1rem 1rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f4f4f5' }}>Conversations</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: connected ? '#25D366' : '#8b8b94' }}>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {connected ? 'Live' : 'Offline'}
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} color="#8b8b94" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem 0.5rem 2.2rem', fontSize: '0.8rem', color: '#f4f4f5', outline: 'none' }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {listLoading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#8b8b94', fontSize: '0.8rem' }}>Loading…</div>
          )}

          {!listLoading && filtered.length === 0 && (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#8b8b94' }}>
              <MessagesSquare size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f4f4f5', marginBottom: '0.25rem' }}>No conversations yet</p>
              <p style={{ fontSize: '0.75rem' }}>Contacts appear here when they reply to you</p>
            </div>
          )}

          {filtered.map(conv => {
            const isActive   = selected === conv.fromMobile;
            const rtUnread   = (localMsgs[conv.fromMobile] || []).filter(m => m.type === 'incoming' && !m.isRead).length;
            const totalUnread = conv.unreadCount + (isActive ? 0 : rtUnread);

            return (
              <div
                key={conv.fromMobile}
                onClick={() => {
                  setSelected(conv.fromMobile);
                  setLocalMsgs(prev => ({
                    ...prev,
                    [conv.fromMobile]: (prev[conv.fromMobile] || []).map(m => ({ ...m, isRead: true })),
                  }));
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem', cursor: 'pointer',
                  background: isActive ? 'rgba(37,211,102,0.08)' : 'transparent',
                  borderLeft: isActive ? '2px solid #25D366' : '2px solid transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: isActive ? 'rgba(37,211,102,0.2)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: isActive ? '#25D366' : '#a1a1aa', flexShrink: 0 }}>
                  {avatar(conv.fromName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: totalUnread > 0 ? 700 : 500, color: '#f4f4f5', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                      {conv.fromName}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#8b8b94', flexShrink: 0 }}>
                      {timeLabel(conv.lastTime)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#8b8b94', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                      {conv.lastMessage}
                    </span>
                    {totalUnread > 0 && (
                      <span style={{ background: '#25D366', color: '#000', fontSize: '0.65rem', fontWeight: 700, borderRadius: '9999px', padding: '1px 6px', flexShrink: 0 }}>
                        {totalUnread}
                      </span>
                    )}
                  </div>
                  {conv.leadStage && (
                    <div style={{ marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 600, color: LEAD_COLOR[conv.leadStage] || '#8b8b94', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        {conv.leadStage}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: chat panel ───────────────────────────────────────────── */}
      {!selected ? (
        <div style={{ flex: 1, background: '#0d1117', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#8b8b94' }}>
          <MessageCircle size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#f4f4f5', marginBottom: '0.35rem' }}>Select a conversation</p>
          <p style={{ fontSize: '0.8rem' }}>Choose a contact from the list to start chatting</p>
        </div>
      ) : (
        <div style={{ flex: 1, background: '#0d1117', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Chat header */}
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#111318', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(37,211,102,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#25D366' }}>
              {avatar(selectedConv?.fromName || selected)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f4f4f5' }}>{selectedConv?.fromName || selected}</div>
              <div style={{ fontSize: '0.72rem', color: '#8b8b94' }}>{selected}</div>
            </div>
            <button onClick={() => refetchThread()} style={{ background: 'none', border: 'none', color: '#8b8b94', cursor: 'pointer', padding: '0.25rem' }}>
              <RefreshCw size={14} />
            </button>
            <a href={`/dashboard/contacts?search=${encodeURIComponent(selected)}`}
               style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#8b8b94', textDecoration: 'none', padding: '0.4rem 0.75rem', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem' }}>
              <User size={12} /> CRM
            </a>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {threadLoading && <div style={{ textAlign: 'center', padding: '2rem', color: '#8b8b94', fontSize: '0.8rem' }}>Loading…</div>}

            {!threadLoading && fullThread.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#8b8b94' }}>
                <p style={{ fontSize: '0.85rem' }}>No messages yet. Send the first one!</p>
              </div>
            )}

            {fullThread.map((msg, i) => {
              const isIncoming = msg.type === 'incoming';
              const showDate   = i === 0 || format(new Date(msg.time), 'dd MMM') !== format(new Date(fullThread[i - 1].time), 'dd MMM');

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>
                      <span style={{ fontSize: '0.7rem', color: '#8b8b94', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.75rem', borderRadius: '9999px' }}>
                        {isToday(new Date(msg.time)) ? 'Today' : isYesterday(new Date(msg.time)) ? 'Yesterday' : format(new Date(msg.time), 'dd MMMM yyyy')}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: isIncoming ? 'flex-start' : 'flex-end' }}>
                    <div style={{
                      maxWidth: '70%', padding: '0.55rem 0.85rem',
                      borderRadius: isIncoming ? '0.25rem 1rem 1rem 1rem' : '1rem 0.25rem 1rem 1rem',
                      background: isIncoming ? '#1e2328' : 'rgba(37,211,102,0.18)',
                      border: `1px solid ${isIncoming ? 'rgba(255,255,255,0.06)' : 'rgba(37,211,102,0.25)'}`,
                    }}>
                      {msg.msgType !== 'text' && (
                        <div style={{ fontSize: '0.65rem', color: '#8b8b94', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Phone size={10} /> {msg.msgType}
                        </div>
                      )}
                      <p style={{ fontSize: '0.875rem', color: '#f4f4f5', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.text}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.3rem', marginTop: '0.3rem' }}>
                        <span style={{ fontSize: '0.65rem', color: '#8b8b94' }}>{format(new Date(msg.time), 'HH:mm')}</span>
                        {!isIncoming && (
                          msg.source === 'manual'
                            ? <Clock size={10} color="#8b8b94" />
                            : <CheckCheck size={10} color="#25D366" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Reply input */}
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#111318', display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              rows={1}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '0.65rem 0.9rem', fontSize: '0.875rem', color: '#f4f4f5', outline: 'none', resize: 'none', fontFamily: 'inherit', maxHeight: '120px', overflowY: 'auto', lineHeight: 1.5 }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={handleSend}
              disabled={!replyText.trim() || sending}
              style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: replyText.trim() ? 'pointer' : 'not-allowed', background: replyText.trim() ? '#25D366' : 'rgba(255,255,255,0.08)', color: replyText.trim() ? '#000' : '#8b8b94', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}
            >
              {sending ? <Clock size={16} /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
