'use client';

import React from 'react';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import {
  Activity, Zap, Send, CheckCircle2, Clock, RefreshCw,
  ChevronLeft, ChevronRight, Edit3, X, Check, Radio,
  MessageCircle, Sparkles, Filter, Plus, AlertCircle,
  ScanLine, Brain, MousePointerClick,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AiReply {
  id: string;
  approvalStatus: string;
  generatedText: string;
  editedText?: string;
  sentAt?: string;
}

interface Status {
  id: string;
  contactName: string;
  contactMobile: string;
  statusText: string;
  statusType?: string;
  timestamp: string;
  detectedEvent?: string;
  keywords: string[];
  processed: boolean;
  contact?: { id: string; name: string; mobile: string; leadStage: string; notes?: string; tags: string[] };
  aiReplies: AiReply[];
}

// ─── Event config ─────────────────────────────────────────────────────────────
const EV: Record<string, { emoji: string; label: string; color: string; bg: string; border: string }> = {
  BIRTHDAY:    { emoji: '🎂', label: 'Birthday',    color: '#4ade80', bg: 'rgba(37,211,102,0.1)',  border: 'rgba(37,211,102,0.25)' },
  ANNIVERSARY: { emoji: '💍', label: 'Anniversary', color: '#60a5fa', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)' },
  ACHIEVEMENT: { emoji: '🏆', label: 'Achievement', color: '#facc15', bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.25)' },
  FESTIVAL:    { emoji: '🎊', label: 'Festival',    color: '#a78bfa', bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.25)' },
  SAD_EMOTION: { emoji: '💔', label: 'Sad',         color: '#f87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
  POSITIVE:    { emoji: '✨', label: 'Positive',    color: '#22d3ee', bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.25)' },
  OTHER:       { emoji: '📌', label: 'Other',       color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
};

const FILTERS = ['ALL', ...Object.keys(EV)];

// ─── Status type badge ────────────────────────────────────────────────────────
const TYPE_BADGE: Record<string, { emoji: string; label: string }> = {
  text:     { emoji: '💬', label: 'Text' },
  image:    { emoji: '🖼️', label: 'Image' },
  video:    { emoji: '🎬', label: 'Video' },
  audio:    { emoji: '🎤', label: 'Voice' },
  sticker:  { emoji: '🎭', label: 'Sticker' },
  document: { emoji: '📄', label: 'Document' },
};


// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ color = 'currentColor' }: { color?: string }) {
  return (
    <span style={{
      width: '13px', height: '13px', border: `2px solid ${color}`,
      borderTopColor: 'transparent', borderRadius: '50%',
      display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  );
}

// ─── Status Card ──────────────────────────────────────────────────────────────
function StatusCard({ status, onSend }: {
  status: Status;
  onSend: (statusId: string, text?: string) => Promise<void>;
}) {
  const existing = status.aiReplies[0];
  const alreadySent = existing?.approvalStatus === 'SENT';

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState<string | null>(
    existing && (existing.approvalStatus === 'PENDING' || existing.approvalStatus === 'APPROVED')
      ? (existing.editedText || existing.generatedText)
      : null
  );
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [done, setDone] = useState(alreadySent);
  const [sentText, setSentText] = useState<string | null>(
    alreadySent ? (existing.editedText || existing.generatedText) : null
  );
  const [intentInfo, setIntentInfo] = useState<{
    intent: string; targetName?: string; relation: string; reasoning: string;
  } | null>(null);

  const ev = status.detectedEvent ? EV[status.detectedEvent] : null;
  const name = status.contact?.name || status.contactName;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/statuses/${status.id}/generate-reply`);
      setReplyText(data.data.replyText);
      setEditValue(data.data.replyText);
      if (data.data.intent) setIntentInfo(data.data.intent);
    } catch {
      toast.error('Failed to generate reply. Check OpenAI API key.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async (text?: string) => {
    const finalText = text || replyText;
    if (!finalText) return;
    setSending(true);
    setEditing(false);
    try {
      await onSend(status.id, finalText);
      setDone(true);
      setSentText(finalText);
      setReplyText(null);
    } catch { /* error handled in parent */ }
    finally { setSending(false); }
  };

  return (
    <div style={{
      backgroundColor: '#18181b',
      border: `1px solid ${done ? 'rgba(37,211,102,0.2)' : ev ? ev.border : '#27272a'}`,
      borderRadius: '1rem', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.125rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{
          width: '40px', height: '40px', backgroundColor: '#075E54', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative',
        }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#25D366' }}>{name.charAt(0).toUpperCase()}</span>
          {ev && <span style={{ position: 'absolute', bottom: '-3px', right: '-3px', fontSize: '0.75rem' }}>{ev.emoji}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#f4f4f5' }}>{name}</span>
            {status.contact?.leadStage && (
              <span style={{ fontSize: '0.6875rem', padding: '1px 7px', borderRadius: '9999px', backgroundColor: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46' }}>
                {status.contact.leadStage}
              </span>
            )}
            {ev && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', padding: '1px 8px', borderRadius: '9999px', backgroundColor: ev.bg, color: ev.color, border: `1px solid ${ev.border}`, fontWeight: 500 }}>
                {ev.emoji} {ev.label}
              </span>
            )}
            {done && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6875rem', padding: '1px 8px', borderRadius: '9999px', backgroundColor: 'rgba(37,211,102,0.1)', color: '#4ade80', border: '1px solid rgba(37,211,102,0.2)', fontWeight: 500 }}>
                <CheckCircle2 size={10} /> Replied
              </span>
            )}
          </div>
          {status.contactMobile && <p style={{ fontSize: '0.75rem', color: '#8b8b94', marginBottom: '0.125rem' }}>{status.contactMobile}</p>}
          <p style={{ fontSize: '0.6875rem', color: '#8b8b94', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Clock size={10} /> {formatDistanceToNow(new Date(status.timestamp), { addSuffix: true })}
          </p>
        </div>
      </div>

      {/* Status text */}
      <div style={{ margin: '0 1.125rem', padding: '0.75rem 1rem', backgroundColor: '#27272a', borderRadius: '0.75rem', borderLeft: `3px solid ${ev?.color || '#3f3f46'}` }}>
        <p style={{ fontSize: '0.8125rem', color: '#d4d4d8', lineHeight: 1.6, fontStyle: 'italic' }}>&ldquo;{status.statusText}&rdquo;</p>
        {status.keywords.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {status.keywords.slice(0, 4).map((kw) => (
              <span key={kw} style={{ fontSize: '0.625rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#3f3f46', color: '#a1a1aa' }}>{kw}</span>
            ))}
          </div>
        )}
      </div>

      {/* Intent Banner */}
      {intentInfo && (
        <div style={{ margin: '0.5rem 1.125rem 0', padding: '0.625rem 0.875rem', borderRadius: '0.625rem', backgroundColor: intentInfo.intent === 'WISHING_SOMEONE' ? 'rgba(167,139,250,0.1)' : 'rgba(37,211,102,0.08)', border: `1px solid ${intentInfo.intent === 'WISHING_SOMEONE' ? 'rgba(167,139,250,0.25)' : 'rgba(37,211,102,0.15)'}`, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: intentInfo.intent === 'WISHING_SOMEONE' ? '#a78bfa' : '#25D366', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {intentInfo.intent === 'WISHING_SOMEONE' ? '🎯 Wishing Someone' : intentInfo.intent === 'SELF_EVENT' ? '🙋 Own Event' : intentInfo.intent === 'SELF_EMOTION' ? '💭 Personal Feeling' : '📌 General'}
          </span>
          {intentInfo.targetName && (
            <span style={{ fontSize: '0.75rem', color: '#d4d4d8' }}>→ <strong style={{ color: '#a78bfa' }}>{intentInfo.targetName}</strong></span>
          )}
          <span style={{ fontSize: '0.6875rem', color: '#a1a1aa', flex: 1 }}>{intentInfo.reasoning}</span>
        </div>
      )}

      {/* AI Reply Area */}
      <div style={{ padding: '0.875rem 1.125rem' }}>
        {/* Sent reply */}
        {done && sentText && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(7,94,84,0.2)', border: '1px solid rgba(37,211,102,0.15)', borderRadius: '0.75rem', borderTopLeftRadius: '0.25rem', marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '0.6875rem', color: '#25D366', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={11} /> Sent reply</p>
            <p style={{ fontSize: '0.8125rem', color: '#d4d4d8', lineHeight: 1.6 }}>{sentText}</p>
          </div>
        )}

        {/* Editing */}
        {!done && editing && (
          <div style={{ marginBottom: '0.625rem' }}>
            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="input"
              style={{ minHeight: '80px', resize: 'vertical', width: '100%', fontSize: '0.875rem', marginBottom: '0.5rem' }} autoFocus />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => handleSend(editValue)} disabled={sending || !editValue.trim()} className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem' }}>
                {sending ? <Spinner color="#09090b" /> : <><Send size={13} /> Send</>}
              </button>
              <button onClick={() => setEditing(false)} className="btn-ghost" style={{ padding: '0.5rem 0.75rem' }}><X size={14} /></button>
            </div>
          </div>
        )}

        {/* Generated preview */}
        {!done && !editing && replyText && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(7,94,84,0.15)', border: '1px solid rgba(37,211,102,0.12)', borderRadius: '0.75rem', borderTopLeftRadius: '0.25rem', marginBottom: '0.625rem' }}>
            <p style={{ fontSize: '0.6875rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
              <Zap size={11} color="#25D366" /> AI Generated
              {intentInfo?.intent === 'WISHING_SOMEONE' && intentInfo.targetName && (
                <span style={{ color: '#a78bfa', backgroundColor: 'rgba(167,139,250,0.12)', padding: '1px 6px', borderRadius: '4px', fontSize: '0.625rem' }}>
                  💌 reply about {intentInfo.targetName}
                </span>
              )}
            </p>
            <p style={{ fontSize: '0.875rem', color: '#e4e4e7', lineHeight: 1.65 }}>{replyText}</p>
          </div>
        )}

        {/* Action buttons */}
        {!done && !editing && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {!replyText ? (
              <button onClick={handleGenerate} disabled={generating} className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem' }}>
                {generating ? <><Spinner color="#09090b" /> Generating…</> : <><Sparkles size={13} /> Generate AI Reply</>}
              </button>
            ) : (
              <>
                <button onClick={() => handleSend()} disabled={sending} className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem' }}>
                  {sending ? <><Spinner color="#09090b" /> Sending…</> : <><Send size={13} /> Send Now</>}
                </button>
                <button onClick={() => { setEditing(true); setEditValue(replyText); }} className="btn-secondary" style={{ padding: '0.5rem 0.875rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Edit3 size={13} /> Edit
                </button>
                <button onClick={handleGenerate} disabled={generating} className="btn-ghost" style={{ padding: '0.5rem 0.625rem' }} title="Regenerate">
                  <RefreshCw size={13} style={{ animation: generating ? 'spin 0.8s linear infinite' : 'none' }} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StatusesPage() {
  const [eventFilter, setEventFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({ contactName: '', contactMobile: '', statusText: '' });
  const queryClient = useQueryClient();
  const { currentBusinessAccount } = useAuthStore();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['statuses', currentBusinessAccount?.id, eventFilter, page],
    queryFn: () => api.get('/statuses', {
      params: { eventType: eventFilter !== 'ALL' ? eventFilter : undefined, page, limit: 15 },
    }).then((r) => r.data),
    enabled: !!currentBusinessAccount,
    refetchInterval: 30000,
  });

  const sendMutation = useMutation({
    mutationFn: ({ statusId, replyText }: { statusId: string; replyText?: string }) =>
      api.post(`/statuses/${statusId}/quick-send`, { replyText }).then((r) => r.data),
    onSuccess: () => {
      toast.success('✅ Message sent via WhatsApp!');
      queryClient.invalidateQueries({ queryKey: ['statuses'] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Failed to send';
      toast.error(msg);
      throw e;
    },
  });

  // Intent insights computed from loaded statuses
  const intentInsights = (() => {
    const statuses: Status[] = data?.data?.statuses || [];
    let wishing = 0, selfEvent = 0, unknown = 0;
    for (const s of statuses) {
      const st = s.statusText || '';
      const wishMatch = st.match(/(?:happy birthday|hbd|wishing|congratulations?|congrats?)\s+([A-Za-z]{2,})/i);
      const targetName = wishMatch?.[1] && !['you','have','very','dear','the','and','my','a'].includes(wishMatch[1].toLowerCase());
      const isSelf = /(my birthday|it'?s my|i got|we got|i passed|i cleared|i graduated|our new)/i.test(st);
      if (isSelf) selfEvent++;
      else if (targetName) wishing++;
      else unknown++;
    }
    return { wishing, selfEvent, unknown, total: statuses.length };
  })();

  const scanMutation = useMutation({
    mutationFn: () => api.post('/sessions/scrape-direct'),
    onSuccess: (res) => {
      const d = (res as { data?: { data?: { newStatuses?: number }; message?: string } })?.data;
      const newCount = d?.data?.newStatuses || 0;
      toast.success(d?.message || (newCount > 0 ? `Found ${newCount} new statuses!` : 'Scan complete'), { duration: 5000 });
      setTimeout(() => refetch(), 1500);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'No connected sessions';
      toast.error(msg);
    },
  });

  const manualMutation = useMutation({
    mutationFn: () => api.post('/statuses/manual', manualForm),
    onSuccess: (res) => {
      toast.success((res as { data?: { message?: string } })?.data?.message || 'Status added!');
      queryClient.invalidateQueries({ queryKey: ['statuses'] });
      setShowManual(false);
      setManualForm({ contactName: '', contactMobile: '', statusText: '' });
    },
    onError: () => toast.error('Failed to add status'),
  });

  const handleSend = useCallback(async (statusId: string, text?: string): Promise<void> => {
    await sendMutation.mutateAsync({ statusId, replyText: text });
  }, [sendMutation]);

  const statuses: Status[] = data?.data || [];
  const pagination = data?.pagination;
  const pendingCount = statuses.filter((s) => !s.aiReplies[0] || s.aiReplies[0].approvalStatus === 'PENDING').length;

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 className="page-header-title" style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <Activity size={22} color="#25D366" /> Smart Status <span className="text-gradient">Monitor</span>
          </h1>
          <p className="page-header-sub">
            {pagination?.total || 0} statuses
            {pendingCount > 0 && <span style={{ marginLeft: '0.5rem', color: '#facc15', fontWeight: 500 }}>· {pendingCount} need reply</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => refetch()} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem' }}>
            <RefreshCw size={13} style={{ animation: isFetching ? 'spin 0.8s linear infinite' : 'none' }} /> Refresh
          </button>
          <button onClick={() => setShowManual(true)} className="btn-secondary" style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Plus size={13} /> Add Manual
          </button>
          <button onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending} className="btn-primary" style={{ fontSize: '0.8125rem' }}>
            {scanMutation.isPending ? <><Spinner color="#09090b" /> Scanning…</> : <><Radio size={13} /> Scan Statuses</>}
          </button>
        </div>
      </div>

      {/* Manual Add Modal */}
      {showManual && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card" style={{ padding: '1.5rem', maxWidth: '440px', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#f4f4f5' }}>Add Status Manually</h2>
              <button onClick={() => setShowManual(false)} className="btn-ghost" style={{ padding: '0.375rem' }}><X size={16} /></button>
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Did you see a customer's WhatsApp status but scraping didn't pick it up? Add it manually here.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Contact Name *</label>
                <input type="text" value={manualForm.contactName}
                  onChange={(e) => setManualForm((f) => ({ ...f, contactName: e.target.value }))}
                  className="input" style={{ fontSize: '0.875rem' }} placeholder="Rahul Sharma" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Mobile Number</label>
                <input type="text" value={manualForm.contactMobile}
                  onChange={(e) => setManualForm((f) => ({ ...f, contactMobile: e.target.value }))}
                  className="input" style={{ fontSize: '0.875rem' }} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Status Text *</label>
                <textarea value={manualForm.statusText}
                  onChange={(e) => setManualForm((f) => ({ ...f, statusText: e.target.value }))}
                  className="input" style={{ fontSize: '0.875rem', minHeight: '80px', resize: 'vertical' }}
                  placeholder="Happy Birthday to me! 🎂 Feeling blessed today..." />
              </div>
              <div style={{ display: 'flex', gap: '0.625rem', paddingTop: '0.25rem' }}>
                <button onClick={() => setShowManual(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button onClick={() => manualMutation.mutate()} disabled={manualMutation.isPending || !manualForm.contactName || !manualForm.statusText}
                  className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {manualMutation.isPending ? <Spinner color="#09090b" /> : <><Check size={14} /> Add Status</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* How it works — when empty */}
      {!isLoading && statuses.length === 0 && (
        <div style={{ backgroundColor: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.15)', borderRadius: '1rem', padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {([
            { Icon: ScanLine,          color: '#25D366', bg: 'rgba(37,211,102,0.12)',  title: 'Click Scan Statuses',  desc: 'Reads WhatsApp "About" text & live status updates from your contacts' },
            { Icon: Brain,             color: '#a78bfa', bg: 'rgba(139,92,246,0.12)',  title: 'AI Detects Intent',    desc: 'Birthdays, travel, marriages, shop openings — 20+ events detected. Also understands if someone is wishing a friend vs celebrating themselves.' },
            { Icon: MousePointerClick, color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', title: 'One-Click Send',       desc: 'Generate personalized AI reply & send instantly — no approval needed' },
          ] as { Icon: React.ComponentType<{size:number;color:string}>; color:string; bg:string; title:string; desc:string }[]).map(({ Icon, color, bg, title, desc }) => (
            <div key={title} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color={color} />
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e4e4e7' }}>{title}</p>
                <p style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginTop: '0.25rem', lineHeight: 1.4 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scan tip when empty */}
      {!isLoading && statuses.length === 0 && (
        <div style={{ backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <AlertCircle size={18} color="#facc15" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fde68a' }}>Why am I not seeing statuses?</p>
            <p style={{ fontSize: '0.8125rem', color: '#a16207', marginTop: '0.25rem', lineHeight: 1.5 }}>
              Baileys reads contact <strong style={{ color: '#fde68a' }}>"About"</strong> text & real-time status updates.
              Make sure WhatsApp is connected, then click <strong style={{ color: '#fde68a' }}>Scan Statuses</strong>.
              Live status stories appear automatically when contacts post them.
              If scanning returns 0, try <strong style={{ color: '#fde68a' }}>Add Manual</strong> to test the flow.
            </p>
          </div>
        </div>
      )}

      {/* Intent Insights Bar */}
      {statuses.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
          {([
            { label: 'Wishing Someone', value: intentInsights.wishing,   color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', Icon: MessageCircle, desc: 'Reply about the named person' },
            { label: 'Own Event',       value: intentInsights.selfEvent,  color: '#25D366', bg: 'rgba(37,211,102,0.08)',  border: 'rgba(37,211,102,0.2)',  Icon: Sparkles,       desc: "Poster's own celebration" },
            { label: 'General',         value: intentInsights.unknown,    color: '#71717a', bg: 'rgba(113,113,122,0.08)', border: 'rgba(113,113,122,0.2)', Icon: Activity,       desc: 'Warm generic reply sent' },
          ] as { label: string; value: number; color: string; bg: string; border: string; Icon: React.ComponentType<{size:number;color:string}>; desc: string }[]).map(({ label, value, color, bg, border, Icon, desc }) => (
            <div key={label} style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '0.875rem', padding: '1rem 1.125rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={17} color={color} />
              </div>
              <div>
                <p style={{ fontSize: '1.375rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#d4d4d8', marginTop: 2 }}>{label}</p>
                <p style={{ fontSize: '0.6875rem', color: '#71717a', marginTop: 1 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Filter size={14} color="#8b8b94" />
        {FILTERS.map((f) => {
          const ev = EV[f];
          const isActive = eventFilter === f;
          return (
            <button key={f} onClick={() => { setEventFilter(f); setPage(1); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', padding: '0.375rem 0.875rem', borderRadius: '0.5rem', border: `1px solid ${isActive ? 'transparent' : '#3f3f46'}`, backgroundColor: isActive ? '#25D366' : 'transparent', color: isActive ? '#09090b' : '#a1a1aa', fontWeight: isActive ? 600 : 400, cursor: 'pointer', transition: 'all 0.12s' }}>
              {ev && <span>{ev.emoji}</span>}
              {f === 'ALL' ? 'All' : ev?.label || f}
            </button>
          );
        })}
      </div>

      {/* Cards Grid */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="loading-skeleton" style={{ height: '200px', borderRadius: '1rem' }} />)}
        </div>
      ) : statuses.length === 0 ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
          <MessageCircle size={48} color="#27272a" style={{ margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#8b8b94', marginBottom: '0.5rem' }}>
            {eventFilter !== 'ALL' ? `No ${EV[eventFilter]?.label} statuses` : 'No statuses yet'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending} className="btn-primary" style={{ fontSize: '0.875rem' }}>
              {scanMutation.isPending ? <><Spinner color="#09090b" /> Scanning…</> : <><Radio size={14} /> Scan Now</>}
            </button>
            <button onClick={() => setShowManual(true)} className="btn-secondary" style={{ fontSize: '0.875rem' }}>
              <Plus size={14} /> Add Manually
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
          {statuses.map((status) => (
            <StatusCard key={status.id} status={status} onSend={handleSend} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>
            {((page - 1) * 15) + 1}–{Math.min(page * 15, pagination.total)} of {pagination.total}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary" style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}>
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ fontSize: '0.8125rem', color: '#a1a1aa', padding: '0 0.5rem' }}>{page}/{pagination.pages}</span>
            <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="btn-secondary" style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', paddingTop: '0.5rem' }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#25D366', animation: 'pulseDot 2s infinite' }} />
        <p style={{ fontSize: '0.75rem', color: '#8b8b94' }}>Auto-refreshes every 30 seconds</p>
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
