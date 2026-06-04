'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Wifi, Send, Eye, EyeOff, CheckCircle2,
  XCircle, Save, RefreshCw, ShieldCheck, Info, Zap,
  AlertTriangle, FlaskConical, Lock, Rocket,
  ClipboardList, GitMerge, Building2, Webhook, Trash2, Plus,
  Users, Phone,
} from 'lucide-react';

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: 42, height: 24, backgroundColor: value ? '#25D366' : '#3f3f46', borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0 }}>
      <div style={{ width: 20, height: 20, backgroundColor: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: value ? 20 : 2, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
    </div>
  );
}

function TokenInput({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input className="input" type={show ? 'text' : 'password'} value={value}
          onChange={e => onChange(e.target.value)} placeholder={placeholder || ''}
          style={{ paddingRight: '2.5rem', fontFamily: value && !show ? 'monospace' : undefined }}
          autoComplete="off" spellCheck={false} />
        <button type="button" onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8b8b94', padding: 0 }}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {hint && <p style={{ fontSize: '0.6875rem', color: '#8b8b94', marginTop: '0.25rem' }}>{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: 'idle' | 'loading' | 'success' | 'error' }) {
  if (status === 'idle') return null;
  const map = {
    loading: { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', icon: <RefreshCw size={13} style={{ animation: 'spin 0.7s linear infinite' }} />, text: 'Testing...' },
    success: { color: '#25D366', bg: 'rgba(37,211,102,0.12)', icon: <CheckCircle2 size={13} />, text: 'Connected ✓' },
    error:   { color: '#f87171', bg: 'rgba(239,68,68,0.12)',  icon: <XCircle size={13} />, text: 'Failed' },
  };
  const m = map[status];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '9999px', backgroundColor: m.bg, color: m.color, fontSize: '0.75rem', fontWeight: 600 }}>
      {m.icon} {m.text}
    </div>
  );
}

// ── API Mode type ──────────────────────────────────────────────────────────────
type ApiMode = 'shared' | 'client';

export default function WhatsAppApiSettingsPage() {
  const [apiMode, setApiMode] = useState<ApiMode>('client');
  const [form, setForm] = useState({
    accessToken: '',
    phoneNumberId: '',
    wabaId: '',
    verifyToken: '',
    webhookCallbackUrl: '',
    isEnabled: false,
    isTestMode: false,
    allowedTestNumbers: [] as string[],
    defaultTemplateName: 'hello_world',
    defaultTemplateLanguage: 'en_US',
  });
  const [newAllowedNumber, setNewAllowedNumber] = useState('');
  const [testStatus, setTestStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [testDetail, setTestDetail] = useState<{ displayPhone?: string; qualityRating?: string; wabaName?: string; error?: string } | null>(null);
  const [testMsg, setTestMsg] = useState({ mobile: '', templateName: '', languageCode: 'en_US' });
  const [sendStatus, setSendStatus] = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [sendDetail, setSendDetail] = useState<{ messageId?: string; error?: string } | null>(null);

  const { data: contactsData } = useQuery({
    queryKey: ['contacts-for-allowlist'],
    queryFn: () => api.get('/contacts?limit=500').then(r => r.data),
    enabled: form.isTestMode,
  });
  const crmContacts: { name: string; mobile: string }[] = contactsData?.data?.contacts ?? [];

  const { data: existingData, isLoading } = useQuery({
    queryKey: ['whatsapp-settings'],
    queryFn: () => api.get('/whatsapp-settings').then(r => r.data),
  });

  useEffect(() => {
    if (existingData?.data) {
      const d = existingData.data;
      setForm(f => ({
        ...f,
        phoneNumberId:           d.phoneNumberId           || '',
        wabaId:                  d.wabaId                  || '',
        verifyToken:             '',
        webhookCallbackUrl:      d.webhookCallbackUrl      || '',
        isEnabled:               d.isEnabled               ?? false,
        isTestMode:              d.isTestMode              ?? false,
        allowedTestNumbers:      d.allowedTestNumbers      ?? [],
        defaultTemplateName:     d.defaultTemplateName     || 'hello_world',
        defaultTemplateLanguage: d.defaultTemplateLanguage || 'en_US',
      }));
    }
  }, [existingData]);

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => api.put('/whatsapp-settings', data),
    onSuccess: () => toast.success('✅ WhatsApp API settings saved!'),
    onError: () => toast.error('Failed to save settings'),
  });

  // For shared mode — use platform credentials (stored in env on server)
  const enableSharedMode = useMutation({
    mutationFn: () => api.put('/whatsapp-settings', {
      ...form,
      isEnabled: true,
      isTestMode: false,
      // accessToken left blank so server uses env vars (Surely's production number)
      accessToken: '',
    }),
    onSuccess: () => toast.success('✅ Shared WhatsApp API enabled! Using Surely production number.'),
    onError: () => toast.error('Failed to enable'),
  });

  const handleTest = async () => {
    setTestStatus('loading');
    setTestDetail(null);
    try {
      const r = await api.post('/whatsapp-settings/test');
      if (r.data.success) {
        setTestStatus('success');
        setTestDetail(r.data.data);
        toast.success('✅ Connected! ' + (r.data.data.displayPhone || ''));
      } else {
        setTestStatus('error');
        setTestDetail(r.data.data);
        toast.error(r.data.data?.error || 'Connection test failed');
      }
    } catch (e: unknown) {
      setTestStatus('error');
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      setTestDetail({ error: err?.response?.data?.error?.message || 'Test failed' });
    }
  };

  const handleSendTest = async () => {
    if (!testMsg.mobile) { toast.error('Enter recipient mobile number'); return; }
    setSendStatus('loading');
    setSendDetail(null);
    try {
      const r = await api.post('/whatsapp-settings/send-test', {
        mobile: testMsg.mobile,
        templateName: testMsg.templateName.trim() || 'hello_world',
        languageCode: testMsg.languageCode.trim() || 'en_US',
      });
      if (r.data.success) {
        setSendStatus('success');
        setSendDetail(r.data.data);
        toast.success('✅ Test message sent!');
      } else {
        setSendStatus('error');
        setSendDetail(r.data.data);
        toast.error(r.data.data?.error || 'Send failed');
      }
    } catch (e: unknown) {
      setSendStatus('error');
      const err = e as { response?: { data?: { data?: { error?: string } } } };
      setSendDetail({ error: err?.response?.data?.data?.error || 'Send failed' });
    }
  };

  const configured = existingData?.configured;
  const tokenMask  = existingData?.data?.accessTokenMask;

  if (isLoading) return <div style={{ padding: '2rem', color: '#71717a', textAlign: 'center' }}>Loading…</div>;

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-header-title">WhatsApp <span className="text-gradient">Setting</span></h1>
          <p className="page-header-sub">Meta WhatsApp Cloud API — official business messaging</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {configured && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#25D366' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#25D366', boxShadow: '0 0 6px #25D366' }} />
              Configured
            </div>
          )}
          {apiMode === 'client' && (
            <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="btn-primary">
              {saveMutation.isPending
                ? <><RefreshCw size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving...</>
                : <><Save size={13} /> Save Settings</>}
            </button>
          )}
        </div>
      </div>

      {/* ── API Mode Selector ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

        {/* Shared Mode Card */}
        <div
          onClick={() => setApiMode('shared')}
          style={{
            backgroundColor: apiMode === 'shared' ? 'rgba(37,211,102,0.07)' : '#18181b',
            border: apiMode === 'shared' ? '2px solid #25D366' : '2px solid #27272a',
            borderRadius: '1rem', padding: '1.25rem', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} color="#25D366" />
            </div>
            <div>
              <p style={{ fontWeight: 700, color: '#f4f4f5', fontSize: '0.9375rem' }}>Shared Surely Number</p>
              <p style={{ fontSize: '0.75rem', color: '#25D366', fontWeight: 500 }}>Platform number</p>
            </div>
            {apiMode === 'shared' && <CheckCircle2 size={18} color="#25D366" style={{ marginLeft: 'auto' }} />}
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#71717a', lineHeight: 1.5 }}>
            Use Surely's production WhatsApp number. Quick setup — no credentials needed.
            Messages appear from <strong style={{ color: '#a1a1aa' }}>Surely (Platform number)</strong>.
          </p>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 99, backgroundColor: 'rgba(37,211,102,0.1)', color: '#4ade80', border: '1px solid rgba(37,211,102,0.2)' }}>
              No setup needed
            </span>
            <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 99, backgroundColor: 'rgba(37,211,102,0.1)', color: '#4ade80', border: '1px solid rgba(37,211,102,0.2)' }}>
              Production ready
            </span>
          </div>
        </div>

        {/* Client Own Number Card */}
        <div
          onClick={() => setApiMode('client')}
          style={{
            backgroundColor: apiMode === 'client' ? 'rgba(96,165,250,0.07)' : '#18181b',
            border: apiMode === 'client' ? '2px solid #60a5fa' : '2px solid #27272a',
            borderRadius: '1rem', padding: '1.25rem', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(96,165,250,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Phone size={18} color="#60a5fa" />
            </div>
            <div>
              <p style={{ fontWeight: 700, color: '#f4f4f5', fontSize: '0.9375rem' }}>Your Own Number</p>
              <p style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 500 }}>Bring Your Own WhatsApp</p>
            </div>
            {apiMode === 'client' && <CheckCircle2 size={18} color="#60a5fa" style={{ marginLeft: 'auto' }} />}
          </div>
          <p style={{ fontSize: '0.8125rem', color: '#71717a', lineHeight: 1.5 }}>
            Connect your own Meta WhatsApp Business number. Messages appear from your brand's number.
            Requires your own Meta API credentials.
          </p>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 99, backgroundColor: 'rgba(96,165,250,0.1)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.2)' }}>
              Your branding
            </span>
            <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 99, backgroundColor: 'rgba(96,165,250,0.1)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.2)' }}>
              Full control
            </span>
          </div>
        </div>
      </div>

      {/* ── SHARED MODE ── */}
      {apiMode === 'shared' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
            <Rocket size={16} color="#25D366" />
            <p style={{ fontWeight: 600, color: '#f4f4f5' }}>Shared Surely Number Setup</p>
          </div>

          <div style={{ backgroundColor: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.18)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.625rem' }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: '#075E54', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#25D366' }}>S</span>
              </div>
              <div>
                <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#f4f4f5' }}>Surely</p>
                <p style={{ fontSize: '0.8125rem', color: '#25D366', fontWeight: 600 }}>Platform number</p>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 99, backgroundColor: 'rgba(37,211,102,0.15)', color: '#4ade80', border: '1px solid rgba(37,211,102,0.3)', fontWeight: 600 }}>
                  PRODUCTION
                </span>
                <span style={{ fontSize: '0.6875rem', color: '#8b8b94' }}>WABA: configured</span>
                <span style={{ fontSize: '0.6875rem', color: '#8b8b94' }}>Phone ID: configured</span>
              </div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#a1a1aa', lineHeight: 1.5 }}>
              This is Surely's registered production number. When enabled, all your clients' customers will receive messages from this number. No #131030 error, no allowlist needed — any number worldwide.
            </p>
          </div>

          <div style={{ backgroundColor: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '0.75rem', padding: '0.875rem 1rem', marginBottom: '1.25rem', display: 'flex', gap: '0.625rem' }}>
            <AlertTriangle size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fbbf24', marginBottom: '0.25rem' }}>Important for SaaS use</p>
              <p style={{ fontSize: '0.6875rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                Customers will see <strong style={{ color: '#d4d4d8' }}>Surely (Platform number)</strong> as sender.
                For clients who want their own branded number, switch to <strong style={{ color: '#d4d4d8' }}>Your Own Number</strong> mode.
                Billing: WhatsApp charges per conversation — check Meta pricing.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1rem', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <p style={{ fontWeight: 600, color: '#f4f4f5', fontSize: '0.875rem' }}>Enable Shared Number</p>
              <p style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.125rem' }}>Allow sending via Surely's production WhatsApp number</p>
            </div>
            <Toggle value={form.isEnabled} onChange={v => setForm(f => ({ ...f, isEnabled: v }))} />
          </div>

          <button
            onClick={() => enableSharedMode.mutate()}
            disabled={enableSharedMode.isPending}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {enableSharedMode.isPending
              ? <><RefreshCw size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> Enabling...</>
              : <><Rocket size={13} /> Enable Shared Number</>}
          </button>
        </div>
      )}

      {/* ── CLIENT OWN NUMBER MODE ── */}
      {apiMode === 'client' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

          {/* Credentials */}
          <div className="card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <ShieldCheck size={16} color="#25D366" />
                <p style={{ fontWeight: 600, color: '#f4f4f5' }}>Your API Credentials</p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>Enable</span>
                <Toggle value={form.isEnabled} onChange={v => setForm(f => ({ ...f, isEnabled: v }))} />
              </label>
            </div>

            <div style={{ backgroundColor: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.15)', borderRadius: '0.75rem', padding: '0.875rem 1rem', marginBottom: '1.25rem' }}>
              <p style={{ fontSize: '0.8125rem', color: '#4ade80', fontWeight: 600, marginBottom: '0.25rem' }}>Where to find these?</p>
              <p style={{ fontSize: '0.75rem', color: '#a1a1aa', lineHeight: 1.6 }}>
                <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>developers.facebook.com</a>
                {' '}→ Your App → <strong style={{ color: '#d4d4d8' }}>WhatsApp → API Setup</strong><br />
                Generate a <strong style={{ color: '#d4d4d8' }}>Permanent Token</strong>: business.facebook.com → System Users → Generate Token
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <TokenInput
                  label="WhatsApp Access Token *"
                  value={form.accessToken}
                  onChange={v => setForm(f => ({ ...f, accessToken: v }))}
                  placeholder={tokenMask ? 'Current: ' + tokenMask : 'EAAR2n1FQ02AB...'}
                  hint={tokenMask ? 'Current: ' + tokenMask + ' — leave blank to keep' : 'Paste your Meta access token. AES-256 encrypted before storage.'}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Phone Number ID *</label>
                <input className="input" value={form.phoneNumberId} onChange={e => setForm(f => ({ ...f, phoneNumberId: e.target.value }))} placeholder="e.g. 1106935729175574" />
                <p style={{ fontSize: '0.6875rem', color: '#8b8b94', marginTop: '0.25rem' }}>Meta Developer Console → WhatsApp → API Setup</p>
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>WABA ID</label>
                <input className="input" value={form.wabaId} onChange={e => setForm(f => ({ ...f, wabaId: e.target.value }))} placeholder="e.g. 1544033387077834" />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>
                  Default Template Name
                  <span style={{ marginLeft: '0.375rem', fontSize: '0.6875rem', color: '#a78bfa', fontWeight: 500 }}>used in test mode & automation</span>
                </label>
                <input className="input" value={form.defaultTemplateName} onChange={e => setForm(f => ({ ...f, defaultTemplateName: e.target.value }))} placeholder="hello_world" />
                <p style={{ fontSize: '0.6875rem', color: '#8b8b94', marginTop: '0.25rem' }}>
                  Template must be <strong style={{ color: '#4ade80' }}>Active</strong> in Meta → WhatsApp Manager → Message Templates
                </p>
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Template Language</label>
                <input className="input" value={form.defaultTemplateLanguage} onChange={e => setForm(f => ({ ...f, defaultTemplateLanguage: e.target.value }))} placeholder="en_US" />
                <p style={{ fontSize: '0.6875rem', color: '#8b8b94', marginTop: '0.25rem' }}>
                  e.g. <strong style={{color:'#f59e0b'}}>en_US</strong> (English US), <strong style={{color:'#f59e0b'}}>en</strong> (English), hi, mr — must match exactly what WhatsApp Manager shows for your template. If your template shows "English" use <strong>en</strong>, if it shows "English (US)" use <strong>en_US</strong>.
                </p>
                <p style={{ fontSize: '0.6875rem', color: '#f87171', marginTop: '0.375rem', background: 'rgba(239,68,68,0.08)', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                  ⚠️ <strong>Marketing templates</strong> (like <code>surely_test</code>) may not deliver if the receiver hasn't opted-in to marketing. For guaranteed delivery, create a <strong>Utility</strong> category template in WhatsApp Manager with a <code>{'{{1}}'}</code> body parameter and use that name here.
                </p>
              </div>
              <div>
                <TokenInput label="Webhook Verify Token" value={form.verifyToken}
                  onChange={v => setForm(f => ({ ...f, verifyToken: v }))} placeholder="Your custom verify token"
                  hint="Used to verify incoming webhook requests from Meta" />
              </div>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Webhook Callback URL</label>
                <input className="input" value={form.webhookCallbackUrl} onChange={e => setForm(f => ({ ...f, webhookCallbackUrl: e.target.value }))} placeholder="https://your-domain.com/api/webhooks/whatsapp" />
              </div>
            </div>

            {/* Test Connection */}
            <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
              <button onClick={handleTest} disabled={testStatus === 'loading'} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                {testStatus === 'loading' ? <><RefreshCw size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> Testing...</> : <><Wifi size={13} /> Test Connection</>}
              </button>
              <StatusBadge status={testStatus} />
              {testDetail && testStatus === 'success' && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {testDetail.displayPhone && <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>📱 {testDetail.displayPhone}</span>}
                  {testDetail.qualityRating && <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Quality: <strong style={{ color: testDetail.qualityRating === 'GREEN' ? '#25D366' : '#facc15' }}>{testDetail.qualityRating}</strong></span>}
                  {testDetail.wabaName && <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Business: <strong style={{ color: '#d4d4d8' }}>{testDetail.wabaName}</strong></span>}
                </div>
              )}
              {testDetail?.error && testStatus === 'error' && <p style={{ fontSize: '0.75rem', color: '#f87171' }}>{testDetail.error}</p>}
            </div>
          </div>

          {/* Test / Live Mode */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <FlaskConical size={16} color="#a78bfa" />
                <p style={{ fontWeight: 600, color: '#f4f4f5' }}>Meta API Mode</p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>{form.isTestMode ? 'Test / Sandbox' : 'Live / Production'}</span>
                <Toggle value={form.isTestMode} onChange={v => setForm(f => ({ ...f, isTestMode: v }))} />
              </label>
            </div>

            {form.isTestMode ? (
              <div>
                <div style={{ backgroundColor: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem', display: 'flex', gap: '0.625rem' }}>
                  <AlertTriangle size={14} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fbbf24', marginBottom: '0.25rem' }}>Error #131030 Fix</p>
                    <p style={{ fontSize: '0.6875rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                      In test mode, add recipients in <strong style={{ color: '#d4d4d8' }}>Meta Developer Console → WhatsApp → API Setup → "To" field</strong> first.
                    </p>
                  </div>
                </div>
                <div style={{ marginBottom: '0.875rem' }}>
                  <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#25D366' }} />
                    CRM Contacts — <span style={{ color: '#25D366', fontWeight: 600 }}>auto-included</span>
                  </label>
                  {crmContacts.length === 0
                    ? <p style={{ fontSize: '0.75rem', color: '#8b8b94', paddingLeft: '1rem' }}>No CRM contacts yet</p>
                    : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', paddingLeft: '1rem' }}>
                        {crmContacts.slice(0, 8).map((c, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: 'rgba(37,211,102,0.07)', border: '1px solid rgba(37,211,102,0.2)', padding: '2px 8px', borderRadius: '9999px' }}>
                            <span style={{ fontSize: '0.6875rem', color: '#4ade80', fontWeight: 500 }}>{c.name}</span>
                            <span style={{ fontSize: '0.6875rem', color: '#8b8b94', fontFamily: 'monospace' }}>+{c.mobile.replace(/\D/g,'')}</span>
                          </div>
                        ))}
                        {crmContacts.length > 8 && <span style={{ fontSize: '0.6875rem', color: '#8b8b94', padding: '2px 8px' }}>+{crmContacts.length - 8} more</span>}
                      </div>
                  }
                </div>
                <div style={{ borderTop: '1px solid #27272a', paddingTop: '0.875rem' }}>
                  <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Additional Test Numbers</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.625rem' }}>
                    {form.allowedTestNumbers.length === 0 && <p style={{ fontSize: '0.75rem', color: '#8b8b94', fontStyle: 'italic' }}>None added</p>}
                    {form.allowedTestNumbers.map((num, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#18181b', padding: '0.375rem 0.625rem', borderRadius: '0.375rem', border: '1px solid #27272a', width: 'fit-content' }}>
                        <span style={{ fontSize: '0.8125rem', color: '#d4d4d8', fontFamily: 'monospace' }}>+{num}</span>
                        <button onClick={() => setForm(f => ({ ...f, allowedTestNumbers: f.allowedTestNumbers.filter((_, idx) => idx !== i) }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
                          <Trash2 size={13} color="#71717a" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className="input" value={newAllowedNumber} onChange={e => setNewAllowedNumber(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { const n = newAllowedNumber.replace(/\D/g,''); if (n.length >= 10) { setForm(f => ({ ...f, allowedTestNumbers: [...f.allowedTestNumbers, n] })); setNewAllowedNumber(''); } } }}
                      placeholder="919876543210" style={{ flex: 1, maxWidth: 200 }} />
                    <button className="btn-secondary"
                      onClick={() => { const n = newAllowedNumber.replace(/\D/g,''); if (n.length >= 10) { setForm(f => ({ ...f, allowedTestNumbers: [...f.allowedTestNumbers, n] })); setNewAllowedNumber(''); } }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', whiteSpace: 'nowrap' }}>
                      <Plus size={13} /> Add
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.8125rem', color: '#8b8b94', lineHeight: 1.5 }}>
                Live / Production mode — free-form text to any number. No allowlist needed.
              </p>
            )}
          </div>

          {/* Send Test Message */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
              <Send size={16} color="#60a5fa" />
              <p style={{ fontWeight: 600, color: '#f4f4f5' }}>Send Test Message</p>
            </div>
            <div style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '0.5rem', padding: '0.625rem 0.75rem', marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.6875rem', color: '#a1a1aa', lineHeight: 1.5 }}>
                Uses <code style={{ backgroundColor: '#27272a', padding: '0 4px', borderRadius: 3, color: '#a78bfa' }}>hello_world</code> template by default.
                For live mode: send a message to your number first to open the 24h service window, then free-form text works too.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Recipient Mobile</label>
                <input className="input" value={testMsg.mobile} onChange={e => setTestMsg(m => ({ ...m, mobile: e.target.value }))} placeholder="919876543210" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Template Name</label>
                  <input className="input" value={testMsg.templateName} onChange={e => setTestMsg(m => ({ ...m, templateName: e.target.value }))} placeholder="hello_world" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Language</label>
                  <input className="input" value={testMsg.languageCode} onChange={e => setTestMsg(m => ({ ...m, languageCode: e.target.value }))} placeholder="en_US" />
                </div>
              </div>
              <button onClick={handleSendTest} disabled={sendStatus === 'loading'} className="btn-primary" style={{ justifyContent: 'center' }}>
                {sendStatus === 'loading' ? <><RefreshCw size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> Sending...</> : <><Send size={13} /> Send Test</>}
              </button>
              {sendStatus === 'success' && sendDetail?.messageId && (
                <div style={{ backgroundColor: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: '0.625rem', padding: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>Message sent!</p>
                  <p style={{ fontSize: '0.6875rem', color: '#a1a1aa', marginTop: '0.25rem', fontFamily: 'monospace' }}>ID: {sendDetail.messageId}</p>
                </div>
              )}
              {sendStatus === 'error' && (
                <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.625rem', padding: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 600 }}>Send failed</p>
                  <p style={{ fontSize: '0.6875rem', color: '#a1a1aa', marginTop: '0.25rem' }}>{sendDetail?.error}</p>
                </div>
              )}
            </div>
          </div>

          {/* Env vars reference */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
              <Zap size={16} color="#a78bfa" />
              <p style={{ fontWeight: 600, color: '#f4f4f5' }}>Environment Variables</p>
            </div>
            <div style={{ backgroundColor: '#0d0d0f', borderRadius: '0.625rem', padding: '1rem', fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.8 }}>
              {[
                ['WHATSAPP_ACCESS_TOKEN',    'your_permanent_token_here'],
                ['WHATSAPP_PHONE_NUMBER_ID', 'your_phone_number_id'],
                ['WHATSAPP_WABA_ID',         'your_waba_id'],
                ['WHATSAPP_VERIFY_TOKEN',    'your_verify_token'],
                ['SETTINGS_ENCRYPTION_KEY',  'your-32-char-key!!'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ color: '#a78bfa' }}>{k}</span>
                  <span style={{ color: '#8b8b94' }}>=</span>
                  <span style={{ color: '#4ade80' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Security */}
          <div className="card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
              <ShieldCheck size={16} color="#60a5fa" />
              <p style={{ fontWeight: 600, color: '#f4f4f5', fontSize: '0.9375rem' }}>Security & Architecture</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
              {([
                { Icon: Lock,          color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  title: 'AES-256-GCM Encryption',  desc: 'Access tokens encrypted with GCM authentication tag before DB storage. Key from SETTINGS_ENCRYPTION_KEY env var.' },
                { Icon: EyeOff,        color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', title: 'Token Masking',            desc: 'API responses only return masked tokens (EAAR2n••••••3a5f). Raw values never leave the server.' },
                { Icon: ClipboardList, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  title: 'Audit Logging',            desc: 'All settings changes and test calls are logged in EngagementLog with user ID and timestamp.' },
                { Icon: GitMerge,      color: '#34d399', bg: 'rgba(52,211,153,0.1)',  title: 'Fallback Architecture',    desc: 'Meta API → Baileys session → fail. If Meta API is disabled or fails, Baileys session is used automatically.' },
                { Icon: Building2,     color: '#22d3ee', bg: 'rgba(6,182,212,0.1)',   title: 'Multi-Account Ready',      desc: 'Each BusinessAccount has independent WhatsApp API settings — ready for white-label / agency use.' },
                { Icon: Webhook,       color: '#f472b6', bg: 'rgba(244,114,182,0.1)', title: 'Webhook Ready',            desc: 'Verify token field and callback URL support incoming message webhooks from Meta. Full webhook handler in /api/webhooks.' },
              ] as { Icon: React.ComponentType<{size:number;color:string}>; color: string; bg: string; title: string; desc: string }[]).map(({ Icon, color, bg, title, desc }) => (
                <div key={title} style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '0.75rem', padding: '1rem' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.625rem' }}>
                    <Icon size={16} color={color} />
                  </div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.25rem' }}>{title}</p>
                  <p style={{ fontSize: '0.75rem', color: '#71717a', lineHeight: 1.5 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
