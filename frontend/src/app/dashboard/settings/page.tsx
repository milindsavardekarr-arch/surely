'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import { Save, Shield, Zap, Bell, Clock } from 'lucide-react';

interface BusinessSettings {
  autoReplyEnabled: boolean;
  approvalRequired: boolean;
  sendDelayMinutes: number;
  workingHoursEnabled: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  maxRepliesPerDay: number;
  rateLimitEnabled: boolean;
  consentRequired: boolean;
  spamProtection: boolean;
  notifyOnDetection: boolean;
  notifyOnApproval: boolean;
}

const defaultSettings: BusinessSettings = {
  autoReplyEnabled: false,
  approvalRequired: true,
  sendDelayMinutes: 5,
  workingHoursEnabled: false,
  workingHoursStart: '09:00',
  workingHoursEnd: '21:00',
  maxRepliesPerDay: 50,
  rateLimitEnabled: true,
  consentRequired: false,
  spamProtection: true,
  notifyOnDetection: true,
  notifyOnApproval: true,
};

function Toggle({ value, onChange, size = 'md' }: { value: boolean; onChange: (v: boolean) => void; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 32 : 38;
  const h = size === 'sm' ? 18 : 22;
  const knob = size === 'sm' ? 14 : 18;
  return (
    <div onClick={() => onChange(!value)} style={{ width: w, height: h, backgroundColor: value ? '#25D366' : '#3f3f46', borderRadius: h / 2, position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0 }}>
      <div style={{ width: knob, height: knob, backgroundColor: '#fff', borderRadius: '50%', position: 'absolute', top: (h - knob) / 2, left: value ? w - knob - (h - knob) / 2 : (h - knob) / 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </div>
  );
}

function SettingRow({ label, description, value, onChange }: { label: string; description?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0', borderBottom: '1px solid #1f1f23' }}>
      <div style={{ flex: 1, marginRight: '1rem' }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e4e4e7' }}>{label}</p>
        {description && <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '0.25rem' }}>{description}</p>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

export default function SettingsPage() {
  const { currentBusinessAccount } = useAuthStore();
  const storageKey = `surely_settings_${currentBusinessAccount?.id}`;

  const [settings, setSettings] = useState<BusinessSettings>(() => {
    if (typeof window === 'undefined') return defaultSettings;
    try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch { return defaultSettings; }
  });
  const [saved, setSaved] = useState(false);

  // Try to load from API on mount
  useEffect(() => {
    api.get('/settings').then(r => {
      if (r.data?.data) setSettings(s => ({ ...s, ...r.data.data }));
    }).catch(() => {}); // silently fail — localStorage fallback already loaded
  }, []);

  const update = (key: keyof BusinessSettings, value: unknown) => setSettings(s => ({ ...s, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: (data: BusinessSettings) => api.put('/settings', data).then(r => r.data),
    onSuccess: () => {
      toast.success('Settings saved!');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Also save to localStorage as fallback
      if (typeof window !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(settings));
    },
    onError: () => {
      // Fallback: save locally
      if (typeof window !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(settings));
      toast.success('Settings saved locally!');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSave = () => saveMutation.mutate(settings);

  const mode = settings.autoReplyEnabled && !settings.approvalRequired ? 'AUTO' : settings.approvalRequired ? 'APPROVAL' : 'MANUAL';

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-header-title">Platform <span className="text-gradient">Settings</span></h1>
          <p className="page-header-sub">Control automation behavior, safety, and notification preferences</p>
        </div>
        <button onClick={handleSave} className="btn-primary"><Save size={14} /> {saved ? 'Saved ✓' : 'Save Settings'}</button>
      </div>

      {/* Mode Banner */}
      <div style={{ borderRadius: '1rem', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid', ...(mode === 'AUTO' ? { backgroundColor: 'rgba(37,211,102,0.08)', borderColor: 'rgba(37,211,102,0.3)' } : mode === 'APPROVAL' ? { backgroundColor: 'rgba(234,179,8,0.08)', borderColor: 'rgba(234,179,8,0.3)' } : { backgroundColor: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.3)' }) }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: mode === 'AUTO' ? 'rgba(37,211,102,0.15)' : mode === 'APPROVAL' ? 'rgba(234,179,8,0.15)' : 'rgba(59,130,246,0.15)' }}>
          {mode === 'AUTO' ? <Zap size={22} color="#25D366" /> : mode === 'APPROVAL' ? <Clock size={22} color="#facc15" /> : <Shield size={22} color="#60a5fa" />}
        </div>
        <div>
          <p style={{ fontWeight: 700, color: '#f4f4f5', fontSize: '1rem' }}>
            {mode === 'AUTO' ? '⚡ Fully Automatic Mode' : mode === 'APPROVAL' ? '✋ Approval Mode' : '⏸ Manual Mode'}
          </p>
          <p style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginTop: '0.25rem' }}>
            {mode === 'AUTO' ? 'Messages are sent automatically after event detection' : mode === 'APPROVAL' ? 'AI generates messages, you review and approve before sending' : 'Auto-reply is off. Events are detected but no messages are queued'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Automation */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <Zap size={16} color="#25D366" />
            <p style={{ fontWeight: 600, color: '#f4f4f5' }}>Automation</p>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>Control how AI responses are triggered and sent</p>
          <SettingRow label="Enable Auto Reply" description="Queue AI responses when events are detected" value={settings.autoReplyEnabled} onChange={v => update('autoReplyEnabled', v)} />
          <SettingRow label="Require Approval" description="Review messages before they are sent" value={settings.approvalRequired} onChange={v => update('approvalRequired', v)} />
          <div style={{ padding: '1rem 0', borderBottom: '1px solid #1f1f23' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e4e4e7', display: 'block', marginBottom: '0.5rem' }}>Send Delay (minutes)</label>
            <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.625rem' }}>Wait before sending after detection</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input type="range" min="0" max="60" value={settings.sendDelayMinutes} onChange={e => update('sendDelayMinutes', Number(e.target.value))} style={{ flex: 1, accentColor: '#25D366' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#25D366', minWidth: '40px' }}>{settings.sendDelayMinutes}m</span>
            </div>
          </div>
          <div style={{ padding: '1rem 0', borderBottom: '1px solid #1f1f23' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e4e4e7', display: 'block', marginBottom: '0.5rem' }}>Max Replies Per Day</label>
            <input className="input" type="number" min="1" max="500" value={settings.maxRepliesPerDay} onChange={e => update('maxRepliesPerDay', Number(e.target.value))} />
          </div>
        </div>

        {/* Safety */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <Shield size={16} color="#60a5fa" />
            <p style={{ fontWeight: 600, color: '#f4f4f5' }}>Privacy & Safety</p>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>Consent, rate limiting, and spam protection</p>
          <SettingRow label="Rate Limiting" description="Limit messages to one per contact per day" value={settings.rateLimitEnabled} onChange={v => update('rateLimitEnabled', v)} />
          <SettingRow label="Spam Protection" description="Prevent sending to same contact repeatedly" value={settings.spamProtection} onChange={v => update('spamProtection', v)} />
          <SettingRow label="Consent-Aware Mode" description="Only send to contacts who have opted in" value={settings.consentRequired} onChange={v => update('consentRequired', v)} />
          <SettingRow label="Working Hours Only" description="Only send during business hours" value={settings.workingHoursEnabled} onChange={v => update('workingHoursEnabled', v)} />
          {settings.workingHoursEnabled && (
            <div style={{ padding: '0.75rem 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Start Time</label>
                <input className="input" type="time" value={settings.workingHoursStart} onChange={e => update('workingHoursStart', e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>End Time</label>
                <input className="input" type="time" value={settings.workingHoursEnd} onChange={e => update('workingHoursEnd', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="card" style={{ padding: '1.5rem', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <Bell size={16} color="#a78bfa" />
            <p style={{ fontWeight: 600, color: '#f4f4f5' }}>Notifications</p>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>When to alert you about platform activity</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 2rem' }}>
            <SettingRow label="Notify on Event Detection" description="Get notified when a new status event is found" value={settings.notifyOnDetection} onChange={v => update('notifyOnDetection', v)} />
            <SettingRow label="Notify on Approval Needed" description="Alert when AI messages await your approval" value={settings.notifyOnApproval} onChange={v => update('notifyOnApproval', v)} />
          </div>
        </div>
      </div>

      {/* Privacy note */}
      <div style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem' }}>
        <Shield size={16} color="#60a5fa" style={{ flexShrink: 0, marginTop: '2px' }} />
        <p style={{ fontSize: '0.8125rem', color: '#a1a1aa', lineHeight: 1.6 }}>
          <strong style={{ color: '#93c5fd' }}>Privacy-first design:</strong> Surely is built for contextual, personalized engagement — not spam. All messages are event-triggered, rate-limited, and respect working hours. Your customers always have the ability to be removed from automations.
        </p>
      </div>
    </div>
  );
}
