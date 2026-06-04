'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import {
  MessageSquare, Check, X, RefreshCw, Edit3, Send,
  Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
  Zap, AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AiReply {
  id: string;
  generatedText: string;
  editedText?: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SENT' | 'FAILED';
  createdAt: string;
  sentAt?: string;
  tokensUsed?: number;
  status: { id: string; contactName: string; statusText: string; detectedEvent?: string; timestamp: string };
  contact?: { id: string; name: string; mobile: string; leadStage: string };
}

const EVENT_EMOJI: Record<string, string> = {
  BIRTHDAY: '🎂', ANNIVERSARY: '💍', ACHIEVEMENT: '🏆',
  FESTIVAL: '🎊', SAD_EMOTION: '💔', POSITIVE: '✨',
};

const FILTERS = ['ALL', 'PENDING', 'APPROVED', 'SENT', 'REJECTED'];

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
    PENDING: { color: '#facc15', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.2)', icon: <Clock size={11} /> },
    APPROVED: { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.2)', icon: <CheckCircle2 size={11} /> },
    SENT: { color: '#4ade80', bg: 'rgba(37,211,102,0.12)', border: 'rgba(37,211,102,0.2)', icon: <Send size={11} /> },
    REJECTED: { color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.2)', icon: <XCircle size={11} /> },
    FAILED: { color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.2)', icon: <AlertCircle size={11} /> },
  };
  const c = configs[status] || configs.PENDING;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '0.75rem', padding: '3px 10px', borderRadius: '9999px',
      color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}`, fontWeight: 500,
    }}>
      {c.icon} {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export default function RepliesPage() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const queryClient = useQueryClient();
  const { currentBusinessAccount } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['replies', currentBusinessAccount?.id, statusFilter, page],
    queryFn: () => api.get('/replies', {
      params: { status: statusFilter !== 'ALL' ? statusFilter : undefined, page, limit: 8 },
    }).then((r) => r.data),
    enabled: !!currentBusinessAccount,
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, editedText }: { id: string; editedText?: string }) =>
      api.post(`/replies/${id}/approve`, { editedText }),
    onSuccess: (res: { data?: { templateFallback?: boolean } }) => {
      if (res?.data?.templateFallback) {
        toast.success('✅ Sent via template (24h window was closed)');
      } else {
        toast.success('✅ Message sent via WhatsApp!');
      }
      queryClient.invalidateQueries({ queryKey: ['replies'] });
      setEditingId(null);
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/replies/${id}/reject`),
    onSuccess: () => { toast.success('Reply rejected'); queryClient.invalidateQueries({ queryKey: ['replies'] }); },
    onError: () => toast.error('Failed to reject'),
  });

  const regenMutation = useMutation({
    mutationFn: (id: string) => api.post(`/replies/${id}/regenerate`),
    onSuccess: () => { toast.success('Regenerating... 🧠'); queryClient.invalidateQueries({ queryKey: ['replies'] }); },
    onError: () => toast.error('Failed to regenerate'),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => api.post(`/replies/${id}/retry`),
    onSuccess: () => { toast.success('✅ Retry successful — message sent!'); queryClient.invalidateQueries({ queryKey: ['replies'] }); },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Retry failed'),
  });

  const replies: AiReply[] = data?.data || [];
  const pagination = data?.pagination;
  const pendingCount = statusFilter === 'ALL' ? replies.filter((r) => r.approvalStatus === 'PENDING').length : 0;

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <h1 className="page-header-title">AI Reply <span className="text-gradient">Inbox</span></h1>
          {pendingCount > 0 && (
            <span style={{
              backgroundColor: '#f97316', color: '#fff', fontSize: '0.75rem',
              fontWeight: 700, padding: '2px 8px', borderRadius: '9999px',
            }}>
              {pendingCount} pending
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>
          Review, edit, and approve AI-generated messages before sending
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f} onClick={() => { setStatusFilter(f); setPage(1); }}
            style={{
              fontSize: '0.8125rem', padding: '0.375rem 0.875rem', borderRadius: '0.5rem',
              border: `1px solid ${statusFilter === f ? 'transparent' : '#3f3f46'}`,
              backgroundColor: statusFilter === f ? '#25D366' : 'transparent',
              color: statusFilter === f ? '#09090b' : '#a1a1aa',
              fontWeight: statusFilter === f ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
            {f === 'ALL' ? 'All Replies' : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Reply Cards */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="loading-skeleton" style={{ height: '200px', borderRadius: '1rem' }} />
          ))}
        </div>
      ) : replies.length === 0 ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
          <MessageSquare size={48} color="#27272a" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.5rem' }}>No Replies Yet</h3>
          <p style={{ fontSize: '0.875rem', color: '#8b8b94' }}>
            AI replies appear here when customers post special statuses
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {replies.map((reply) => {
            const isPending = reply.approvalStatus === 'PENDING';
            const isFailed  = reply.approvalStatus === 'FAILED';
            const isEditing = editingId === reply.id;
            const displayText = reply.editedText || reply.generatedText;
            const name = reply.contact?.name || reply.status.contactName;

            return (
              <div key={reply.id} className="card" style={{
                overflow: 'hidden',
                ...(isPending ? { borderColor: 'rgba(249,115,22,0.3)', boxShadow: '0 0 12px rgba(249,115,22,0.06)' } : {}),
                ...(isFailed  ? { borderColor: 'rgba(239,68,68,0.35)',  boxShadow: '0 0 12px rgba(239,68,68,0.08)' }  : {}),
              }}>
                {/* Card Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.875rem 1.25rem', borderBottom: '1px solid #27272a',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '36px', height: '36px', backgroundColor: '#075E54',
                      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#25D366' }}>
                        {name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e4e4e7' }}>{name}</span>
                        {reply.contact?.leadStage && (
                          <span className="badge badge-zinc" style={{ fontSize: '0.6875rem' }}>{reply.contact.leadStage}</span>
                        )}
                        {reply.status.detectedEvent && (
                          <span style={{ fontSize: '1rem' }}>{EVENT_EMOJI[reply.status.detectedEvent]}</span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.6875rem', color: '#a1a1aa' }}>
                        {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                        {reply.contact?.mobile && ` · ${reply.contact.mobile}`}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={reply.approvalStatus} />
                </div>

                <div style={{ padding: '1.125rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {/* Their Status */}
                  <div style={{ backgroundColor: '#27272a', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8b8b94', display: 'inline-block' }} />
                      Customer&apos;s Status
                    </p>
                    <p style={{ fontSize: '0.875rem', color: '#d4d4d8', fontStyle: 'italic' }}>
                      &ldquo;{reply.status.statusText}&rdquo;
                    </p>
                  </div>

                  {/* Intent Context */}
                  {(() => {
                    const st = reply.status.statusText || '';
                    const wishMatch = st.match(/(?:happy birthday|hbd|wishing|congratulations?|congrats?)\s+([A-Za-z]{2,})/i);
                    const targetName = wishMatch?.[1] && !['you','have','very','dear','the','and','my','a'].includes(wishMatch[1].toLowerCase()) ? wishMatch[1] : null;
                    const isSelf = /\b(my birthday|it'?s my|i got|we got|i passed|i cleared|i graduated|our new)\b/i.test(st);
                    if (targetName && !isSelf) {
                      return (
                        <div style={{ padding: '0.5rem 0.875rem', borderRadius: '0.625rem', backgroundColor: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <span style={{ fontSize: '0.8125rem' }}>🎯</span>
                          <div>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wishing Someone Else</span>
                            <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '1px' }}>
                              Poster is wishing <strong style={{ color: '#c4b5fd' }}>{targetName}</strong> — relation unknown (could be friend, sibling, colleague). Reply is addressed to poster, mentions {targetName}.
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* AI Reply */}
                  <div>
                    <p style={{ fontSize: '0.6875rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Zap size={12} color="#25D366" /> AI Generated Reply
                      {reply.tokensUsed && <span style={{ color: '#3f3f46', marginLeft: '0.25rem' }}>{reply.tokensUsed} tokens</span>}
                    </p>
                    {isEditing ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="input"
                        style={{ minHeight: '96px', resize: 'vertical', width: '100%' }}
                        autoFocus
                      />
                    ) : (
                      <div className="wa-bubble">
                        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{displayText}</p>
                        {reply.editedText && (
                          <p style={{ fontSize: '0.6875rem', color: '#8b8b94', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Edit3 size={11} /> Manually edited
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {isFailed && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => retryMutation.mutate(reply.id)}
                        disabled={retryMutation.isPending}
                        className="btn-primary"
                        style={{ flex: 1, justifyContent: 'center', backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                      >
                        {retryMutation.isPending
                          ? <div style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                          : <><Send size={13} /> Retry Send</>
                        }
                      </button>
                      <button onClick={() => regenMutation.mutate(reply.id)} disabled={regenMutation.isPending} className="btn-secondary" style={{ padding: '0.625rem 0.875rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <RefreshCw size={13} style={{ animation: regenMutation.isPending ? 'spin 0.7s linear infinite' : 'none' }} /> Regenerate
                      </button>
                    </div>
                  )}

                  {isPending && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => approveMutation.mutate({ id: reply.id, editedText: editText })}
                            disabled={approveMutation.isPending}
                            className="btn-primary"
                            style={{ flex: 1, justifyContent: 'center' }}
                          >
                            {approveMutation.isPending
                              ? <div style={{ width: '14px', height: '14px', border: '2px solid #09090b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                              : <><Send size={13} /> Save & Send</>
                            }
                          </button>
                          <button onClick={() => setEditingId(null)} className="btn-secondary" style={{ padding: '0.625rem 1rem' }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => approveMutation.mutate({ id: reply.id })}
                            disabled={approveMutation.isPending}
                            className="btn-primary"
                            style={{ flex: 1, justifyContent: 'center' }}
                          >
                            {approveMutation.isPending
                              ? <div style={{ width: '14px', height: '14px', border: '2px solid #09090b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                              : <><Check size={13} /> Approve & Send</>
                            }
                          </button>
                          <button onClick={() => { setEditingId(reply.id); setEditText(reply.editedText || reply.generatedText); }}
                            className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.625rem 0.875rem' }}>
                            <Edit3 size={13} /> Edit
                          </button>
                          <button onClick={() => regenMutation.mutate(reply.id)} disabled={regenMutation.isPending}
                            className="btn-secondary" style={{ padding: '0.625rem 0.75rem' }} title="Regenerate">
                            <RefreshCw size={13} style={{ animation: regenMutation.isPending ? 'spin 0.7s linear infinite' : 'none' }} />
                          </button>
                          <button onClick={() => rejectMutation.mutate(reply.id)} disabled={rejectMutation.isPending}
                            className="btn-ghost" style={{ color: '#f87171', padding: '0.625rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <X size={13} /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {reply.approvalStatus === 'SENT' && reply.sentAt && (
                    <p style={{ fontSize: '0.75rem', color: '#25D366', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <CheckCircle2 size={13} />
                      Sent {formatDistanceToNow(new Date(reply.sentAt), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{pagination.total} total replies</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="btn-secondary" style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}>
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>{page} / {pagination.pages}</span>
            <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
              className="btn-secondary" style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
