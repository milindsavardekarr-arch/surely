'use client';

import React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import {
  Smartphone, Plus, Trash2, QrCode, CheckCircle,
  AlertCircle, Radio, WifiOff, Loader2, X,
  PlusCircle, Zap,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Session {
  id: string; sessionId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'QR_PENDING' | 'CONNECTING' | 'FAILED';
  liveState?: string; phoneNumber?: string; profileName?: string;
  lastConnectedAt?: string; createdAt: string;
}

type ModalStatus = 'waiting_init' | 'qr_ready' | 'connected' | 'failed';

interface QRModal {
  open: boolean;
  status: ModalStatus;
  qrBase64: string | null;
  sessionDbId: string | null;
  phone: string | null;
  name: string | null;
  errorMsg: string;
}

const INIT: QRModal = { open: false, status: 'waiting_init', qrBase64: null, sessionDbId: null, phone: null, name: null, errorMsg: '' };

const STATUS_CFG = {
  CONNECTED:    { label: 'Connected',    color: '#4ade80', bg: 'rgba(37,211,102,0.12)', border: 'rgba(37,211,102,0.3)',  Icon: CheckCircle },
  DISCONNECTED: { label: 'Disconnected', color: '#a1a1aa', bg: 'rgba(113,113,122,0.08)', border: '#3f3f46',              Icon: WifiOff },
  QR_PENDING:   { label: 'Scan QR',      color: '#facc15', bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.3)',  Icon: QrCode },
  CONNECTING:   { label: 'Connecting…',  color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', Icon: Loader2 },
  FAILED:       { label: 'Failed',        color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)',  Icon: AlertCircle },
};

export default function SessionsPage() {
  const { currentBusinessAccount } = useAuthStore();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<QRModal>(INIT);
  const [connecting, setConnecting] = useState(false);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ['sessions', currentBusinessAccount?.id],
    queryFn: () => api.get('/sessions').then((r) => r.data.data),
    enabled: !!currentBusinessAccount,
    refetchInterval: 8000,
  });

  // ── Socket setup ───────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Session record created in DB — open modal with spinner
    socket.on('wa:session_created', ({ sessionDbId }: { sessionDbId: string }) => {
      setModal({ ...INIT, open: true, status: 'waiting_init', sessionDbId });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    });

    // QR arrived — show it (Baileys: 2-3 sec after clicking Add Session)
    socket.on('wa:qr', ({ qrBase64 }: { qrBase64: string }) => {
      setConnecting(false);
      setModal((m) => ({ ...m, status: 'qr_ready', qrBase64 }));
    });

    // Phone scanned — connected!
    socket.on('wa:connected', ({ phone, name }: { phone: string; name: string }) => {
      setConnecting(false);
      setModal((m) => ({ ...m, status: 'connected', phone, name, qrBase64: null }));
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success(`✅ WhatsApp connected!${name ? ` Hi, ${name}!` : ''}`);
      // Auto-close after 2.5s
      setTimeout(() => setModal(INIT), 2500);
    });

    // Error
    socket.on('wa:error', ({ message }: { message: string }) => {
      setConnecting(false);
      setModal((m) => ({ ...m, status: 'failed', errorMsg: message }));
      toast.error(message || 'Connection failed');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    });

    socket.on('wa:disconnected', () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    });

    return () => {
      socket.off('wa:session_created');
      socket.off('wa:qr');
      socket.off('wa:connected');
      socket.off('wa:error');
      socket.off('wa:disconnected');
    };
  }, [queryClient]);

  // ── Add Session ────────────────────────────────────────────────────────
  const handleConnect = useCallback(() => {
    if (!currentBusinessAccount || connecting) return;
    setConnecting(true);
    setModal({ ...INIT, open: true, status: 'waiting_init' });
    const socket = getSocket();
    socket.emit('wa:connect', { businessAccountId: currentBusinessAccount.id });
  }, [currentBusinessAccount, connecting]);

  const closeModal = () => { setModal(INIT); setConnecting(false); };

  const handleDisconnect = async (sessionId: string) => {
    if (!confirm('Disconnect and delete this session?')) return;
    try {
      await api.delete(`/sessions/${sessionId}`);
      toast.success('Session disconnected');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    } catch { toast.error('Failed to disconnect'); }
  };

  const handleScan = async () => {
    try {
      toast.loading('Scanning WhatsApp statuses…', { id: 'scan' });
      // Use direct scrape (works without Redis)
      const { data } = await api.post('/sessions/scrape-direct');
      toast.dismiss('scan');
      toast.success(data.message || `Found ${data.data?.newStatuses || 0} new statuses!`, { duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    } catch (e: unknown) {
      toast.dismiss('scan');
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'No connected sessions found';
      toast.error(msg);
    }
  };

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-header-title">WhatsApp <span className="text-gradient">Sessions</span></h1>
          <p className="page-header-sub">
            Connect WhatsApp to monitor customer statuses
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <button onClick={handleScan} className="btn-secondary"
            style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Radio size={14} color="#25D366" /> Scan Statuses
          </button>
          <button onClick={handleConnect} disabled={connecting} className="btn-primary" style={{ fontSize: '0.8125rem' }}>
            {connecting
              ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Connecting…</>
              : <><Plus size={14} /> Add Session</>}
          </button>
        </div>
      </div>

      {/* ── QR Modal ── */}
      {modal.open && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem',
        }}>
          <div className="card" style={{ padding: '2rem', maxWidth: '420px', width: '100%', textAlign: 'center', position: 'relative' }}>

            {/* Close */}
            <button onClick={closeModal} style={{
              position: 'absolute', top: '1rem', right: '1rem',
              background: 'none', border: 'none', cursor: 'pointer', color: '#a1a1aa', padding: '4px',
            }}><X size={18} /></button>

            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Smartphone size={22} color="#25D366" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f4f4f5' }}>Connect WhatsApp</h2>
            </div>

            {/* ── Spinner: Initializing ── */}
            {modal.status === 'waiting_init' && (
              <div style={{ padding: '2.5rem 1rem' }}>
                <div style={{
                  width: '56px', height: '56px', margin: '0 auto 1.25rem',
                  border: '3px solid #25D366', borderTopColor: 'transparent',
                  borderRadius: '50%', animation: 'spin 0.9s linear infinite',
                }} />
                <p style={{ color: '#e4e4e7', fontSize: '1rem', fontWeight: 600 }}>Starting WhatsApp…</p>
                <p style={{ color: '#a1a1aa', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                  QR code appears in <strong style={{ color: '#25D366' }}>2–5 seconds</strong>
                </p>
                <p style={{ color: '#8b8b94', fontSize: '0.75rem', marginTop: '0.375rem' }}>
                  No browser launch needed — it&apos;s instant
                </p>
              </div>
            )}

            {/* ── QR Code ── */}
            {modal.status === 'qr_ready' && modal.qrBase64 && (
              <>
                <p style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                  Open WhatsApp on your phone:<br />
                  <strong style={{ color: '#a1a1aa' }}>⋮ Menu → Linked Devices → Link a Device</strong>
                </p>

                {/* QR Image */}
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1.125rem' }}>
                  <div style={{
                    width: '240px', height: '240px', backgroundColor: '#fff',
                    borderRadius: '1rem', padding: '10px', margin: '0 auto',
                    overflow: 'hidden', position: 'relative',
                    boxShadow: '0 0 40px rgba(37,211,102,0.25)',
                  }}>
                    <img
                      src={`data:image/png;base64,${modal.qrBase64}`}
                      alt="WhatsApp QR"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                    <div className="qr-scanner-line" />
                  </div>
                  {/* Corner brackets */}
                  {(['tl','tr','bl','br'] as const).map((pos) => (
                    <div key={pos} style={{
                      position: 'absolute', width: '22px', height: '22px', borderColor: '#25D366', borderStyle: 'solid',
                      top: pos[0]==='t' ? '-3px' : undefined, bottom: pos[0]==='b' ? '-3px' : undefined,
                      left: pos[1]==='l' ? '-3px' : undefined, right: pos[1]==='r' ? '-3px' : undefined,
                      borderTopWidth: pos[0]==='t' ? '3px' : 0, borderBottomWidth: pos[0]==='b' ? '3px' : 0,
                      borderLeftWidth: pos[1]==='l' ? '3px' : 0, borderRightWidth: pos[1]==='r' ? '3px' : 0,
                      borderRadius: pos==='tl'?'4px 0 0 0':pos==='tr'?'0 4px 0 0':pos==='bl'?'0 0 0 4px':'0 0 4px 0',
                    }} />
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#facc15', animation: 'pulseDot 1.5s infinite' }} />
                  Waiting for you to scan…
                </div>
                <p style={{ fontSize: '0.75rem', color: '#8b8b94' }}>QR expires in 60 seconds — click below to refresh</p>
                <button onClick={handleConnect} className="btn-ghost" style={{ fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                  Refresh QR
                </button>
              </>
            )}

            {/* ── Connected ── */}
            {modal.status === 'connected' && (
              <div style={{ padding: '2rem 1rem' }}>
                <div style={{ width: '72px', height: '72px', margin: '0 auto 1rem', backgroundColor: 'rgba(37,211,102,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={36} color="#25D366" />
                </div>
                <p style={{ color: '#4ade80', fontSize: '1.25rem', fontWeight: 700 }}>Connected! 🎉</p>
                {modal.name && <p style={{ color: '#a1a1aa', marginTop: '0.375rem' }}>Welcome, {modal.name}!</p>}
                {modal.phone && <p style={{ color: '#8b8b94', fontSize: '0.875rem', marginTop: '0.25rem' }}>+{modal.phone}</p>}
              </div>
            )}

            {/* ── Failed ── */}
            {modal.status === 'failed' && (
              <div style={{ padding: '2rem 1rem' }}>
                <AlertCircle size={44} color="#f87171" style={{ margin: '0 auto 1rem', display: 'block' }} />
                <p style={{ color: '#f87171', fontWeight: 600, fontSize: '1rem' }}>Connection Failed</p>
                <p style={{ color: '#a1a1aa', fontSize: '0.8125rem', marginTop: '0.5rem' }}>{modal.errorMsg || 'Check backend logs and try again'}</p>
                <button onClick={handleConnect} className="btn-primary" style={{ marginTop: '1.25rem', width: '100%', justifyContent: 'center' }}>
                  Try Again
                </button>
              </div>
            )}

            {(modal.status === 'waiting_init' || modal.status === 'qr_ready') && (
              <button onClick={closeModal} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.875rem', marginTop: '0.625rem' }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Sessions Grid ── */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: '1rem' }}>
          {[1,2].map((i) => <div key={i} className="loading-skeleton" style={{ height: '190px', borderRadius: '1rem' }} />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
          <Smartphone size={52} color="#27272a" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.5rem' }}>No Sessions Yet</h3>
          <p style={{ fontSize: '0.875rem', color: '#8b8b94', marginBottom: '1.5rem' }}>
            Click "Add Session" — QR appears in 2-5 seconds
          </p>
          <button onClick={handleConnect} disabled={connecting} className="btn-primary">
            <Plus size={15} /> Connect WhatsApp
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: '1rem' }}>
          {sessions.map((session) => {
            const cfg = STATUS_CFG[session.status] || STATUS_CFG.DISCONNECTED;
            const { Icon } = cfg;
            return (
              <div key={session.id} className="card" style={{ padding: '1.25rem', border: `1px solid ${cfg.border}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color={cfg.color} style={{ animation: session.status === 'CONNECTING' ? 'spin 1s linear infinite' : 'none' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '9999px', fontWeight: 500, color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    {cfg.label}
                  </span>
                </div>
                <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#e4e4e7' }}>
                  {session.profileName || `Session ${session.sessionId.slice(0,8)}…`}
                </p>
                <p style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginTop: '0.25rem' }}>
                  {session.phoneNumber ? `+${session.phoneNumber}` : 'Not linked yet'}
                </p>
                {session.lastConnectedAt && (
                  <p style={{ fontSize: '0.75rem', color: '#8b8b94', marginTop: '0.25rem' }}>
                    Connected {formatDistanceToNow(new Date(session.lastConnectedAt), { addSuffix: true })}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  {session.status === 'CONNECTED' && (
                    <button onClick={handleScan} className="btn-secondary"
                      style={{ flex: 1, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                      <Radio size={13} color="#25D366" /> Scan Statuses
                    </button>
                  )}
                  <button onClick={() => handleDisconnect(session.id)} className="btn-ghost"
                    style={{ color: '#f87171', padding: '0.5rem 0.625rem' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Steps */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 className="section-title" style={{ marginBottom: '1rem' }}>How to Connect (2–5 seconds)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {([
            { Icon: PlusCircle,  title: 'Click Add Session',  desc: 'Press the green button above' },
            { Icon: Zap,         title: 'QR in 2–5 sec',     desc: 'No browser launch — instant QR code' },
            { Icon: QrCode,      title: 'Scan QR',            desc: 'WhatsApp → ⋮ → Linked Devices → Link a Device' },
            { Icon: CheckCircle, title: 'Auto-Connected',     desc: 'Modal shows "Connected" immediately' },
          ] as { Icon: React.ComponentType<{ size: number; color: string }>; title: string; desc: string }[]).map(({ Icon, title, desc }) => (
            <div key={title} style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ width: '32px', height: '32px', backgroundColor: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={15} color="#25D366" />
              </div>
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.25rem' }}>{title}</p>
                <p style={{ fontSize: '0.75rem', color: '#a1a1aa', lineHeight: 1.4 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
