'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Zap, Plus, Trash2, Edit3, Save, X, Info, ToggleLeft, ToggleRight,
} from 'lucide-react';

const EVENT_OPTIONS = [
  { value: 'BIRTHDAY', label: '🎂 Birthday' },
  { value: 'ANNIVERSARY', label: '💍 Anniversary' },
  { value: 'ACHIEVEMENT', label: '🏆 Achievement/Promotion' },
  { value: 'FESTIVAL', label: '🎊 Festival/Holiday' },
  { value: 'SAD_EMOTION', label: '💔 Sad/Emotional' },
  { value: 'POSITIVE', label: '✨ Positive Vibes' },
  { value: 'MARRIAGE', label: '👰 Marriage' },
  { value: 'ENGAGEMENT', label: '💒 Engagement' },
  { value: 'NEW_BUSINESS', label: '🏪 New Business/Shop' },
  { value: 'TRAVEL', label: '✈️ Vacation/Travel' },
  { value: 'NEW_CAR', label: '🚗 New Car Purchase' },
  { value: 'HOUSEWARMING', label: '🏠 Housewarming' },
  { value: 'BABY', label: '👶 Baby Announcement' },
  { value: 'GRADUATION', label: '🎓 Graduation' },
  { value: 'FITNESS', label: '💪 Fitness/Gym Milestone' },
];

const INDUSTRY_TEMPLATES: Record<string, { event: string; template: string }[]> = {
  Restaurant: [
    { event: 'BIRTHDAY', template: 'Happy Birthday {name}! 🎂 Celebrate with us — enjoy 20% OFF on your special day! Show this message at checkout. Valid today only. 🍕' },
    { event: 'ANNIVERSARY', template: 'Happy Anniversary {name}! 💑 Celebrate with a romantic dinner — complimentary dessert for couples. Book your table now! 🥂' },
  ],
  'Real Estate': [
    { event: 'NEW_BUSINESS', template: 'Congratulations on your new venture, {name}! 🏢 Looking for a commercial space? We have prime properties. Let\'s connect! 📞' },
    { event: 'HOUSEWARMING', template: 'Congratulations on your new home, {name}! 🏠 Need interior design help? We have trusted partners who can make it perfect.' },
  ],
  Automobile: [
    { event: 'NEW_CAR', template: 'Congratulations on your new car, {name}! 🚗 Protect it with our comprehensive insurance plans. Get a free quote today! 🛡️' },
    { event: 'BIRTHDAY', template: 'Happy Birthday {name}! 🎉 Special birthday discount on car servicing this month. Book now! 🔧' },
  ],
  Insurance: [
    { event: 'BIRTHDAY', template: 'Happy Birthday {name}! 🎂 A birthday is a great time to review your life insurance. Protect what matters most. Let\'s chat! 📋' },
    { event: 'NEW_BUSINESS', template: 'Congratulations on your new business, {name}! 🎊 Don\'t forget business insurance to protect your investment. We\'ve got you covered!' },
  ],
  Salon: [
    { event: 'BIRTHDAY', template: 'Happy Birthday {name}! 💇 Treat yourself to a glamour makeover — 25% OFF on your birthday! Book your slot today. 💅' },
    { event: 'ANNIVERSARY', template: 'Happy Anniversary {name}! 💕 Look stunning for your special occasion — book our anniversary package today!' },
  ],
  Gym: [
    { event: 'FITNESS', template: 'Amazing progress, {name}! 💪 You\'re crushing it! Unlock premium coaching with 30% OFF this month. Keep pushing! 🔥' },
    { event: 'BIRTHDAY', template: 'Happy Birthday {name}! 🎂 Free personal training session on us. Let\'s hit those goals! 💪' },
  ],
  Travel: [
    { event: 'TRAVEL', template: 'Saw your travel plans, {name}! ✈️ We have exclusive packages to make it unforgettable. Early bird discount available! 🌴' },
    { event: 'BIRTHDAY', template: 'Happy Birthday {name}! 🎉 Gift yourself travel — birthday special with FREE hotel upgrade! 🏨' },
  ],
};

interface Rule {
  id: string;
  name: string;
  eventType: string;
  template: string;
  isActive: boolean;
  couponCode?: string;
  discountPercent?: number;
  autoSend: boolean;
  delayMinutes: number;
  createdAt: string;
}

const defaultForm = {
  name: '', eventType: 'BIRTHDAY',
  template: 'Happy Birthday {name}! 🎂 Wishing you a wonderful day!',
  autoSend: false, delayMinutes: 5, couponCode: '', discountPercent: 0, isActive: true,
};

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: '38px', height: '22px', backgroundColor: value ? '#25D366' : '#3f3f46', borderRadius: '11px', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s', flexShrink: 0 }}>
      <div style={{ width: '18px', height: '18px', backgroundColor: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: value ? '18px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </div>
  );
}

export default function AutomationPage() {
  const { currentBusinessAccount } = useAuthStore();
  const storageKey = `surely_rules_${currentBusinessAccount?.id}`;

  const [rules, setRules] = useState<Rule[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState('Restaurant');
  const [syncing, setSyncing] = useState(false);

  // Sync to backend and localStorage
  const saveRules = useCallback(async (newRules: Rule[]) => {
    setRules(newRules);
    if (typeof window !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(newRules));
    // Sync to DB so backend workers can use them for auto-send
    try {
      await api.post('/automation/rules/sync', { rules: newRules });
    } catch {
      // Non-fatal — rules still work from localStorage for UI, but auto-send may not fire
      console.warn('[Automation] Backend sync failed — auto-send may not work until reconnected');
    }
  }, [storageKey]);

  // Load rules from backend on mount (takes priority over localStorage)
  useEffect(() => {
    if (!currentBusinessAccount?.id) return;
    setSyncing(true);
    api.get('/automation/rules')
      .then(res => {
        if (res.data?.data?.length > 0) {
          const backendRules: Rule[] = res.data.data.map((r: Rule & { updatedAt?: string }) => ({
            id: r.id,
            name: r.name,
            eventType: r.eventType,
            template: r.template,
            isActive: r.isActive,
            couponCode: r.couponCode || '',
            discountPercent: r.discountPercent || 0,
            autoSend: r.autoSend,
            delayMinutes: r.delayMinutes,
            createdAt: r.createdAt,
          }));
          setRules(backendRules);
          if (typeof window !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(backendRules));
        }
      })
      .catch(() => { /* Use localStorage fallback silently */ })
      .finally(() => setSyncing(false));
  }, [currentBusinessAccount?.id, storageKey]);

  const handleSave = () => {
    if (!form.name || !form.template) { toast.error('Name and template are required'); return; }
    let updatedRules: Rule[];
    if (editingRule) {
      updatedRules = rules.map(r => r.id === editingRule.id ? { ...r, ...form } : r);
      toast.success('Rule updated!');
    } else {
      updatedRules = [...rules, { ...form, id: Date.now().toString(), createdAt: new Date().toISOString() }];
      toast.success('Rule created! 🎉');
    }
    saveRules(updatedRules);
    setShowForm(false); setEditingRule(null); setForm({ ...defaultForm });
  };

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-header-title">Automation <span className="text-gradient">Rules</span></h1>
          <p className="page-header-sub">Event-based response rules — AI detects, rules respond</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {syncing && <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>⏳ syncing…</span>}
          <button onClick={() => setShowTemplates(!showTemplates)} className="btn-secondary" style={{ fontSize: '0.8125rem' }}>📋 Industry Templates</button>
          <button onClick={() => { setShowForm(true); setEditingRule(null); setForm({ ...defaultForm }); }} className="btn-primary"><Plus size={14} /> New Rule</button>
        </div>
      </div>

      <div style={{ backgroundColor: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem' }}>
        <Info size={16} color="#25D366" style={{ flexShrink: 0, marginTop: '2px' }} />
        <p style={{ fontSize: '0.8125rem', color: '#a1a1aa', lineHeight: 1.6 }}>
          When Surely AI detects an event in a contact's WhatsApp status, matching active rules fire automatically. Use <code style={{ backgroundColor: '#27272a', padding: '0 4px', borderRadius: '4px', color: '#a78bfa' }}>{'{name}'}</code> in templates for personalization. Auto Send rules bypass approval; others go to the Approval Queue.
        </p>
      </div>

      {showTemplates && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <p style={{ fontWeight: 600, color: '#f4f4f5' }}>Industry Templates</p>
            <button onClick={() => setShowTemplates(false)} className="btn-ghost" style={{ padding: '0.25rem' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {Object.keys(INDUSTRY_TEMPLATES).map(ind => (
              <button key={ind} onClick={() => setSelectedIndustry(ind)} className={selectedIndustry === ind ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}>{ind}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {INDUSTRY_TEMPLATES[selectedIndustry]?.map((t, i) => (
              <div key={i} style={{ backgroundColor: '#27272a', borderRadius: '0.75rem', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a78bfa', marginBottom: '0.375rem' }}>{EVENT_OPTIONS.find(e => e.value === t.event)?.label}</p>
                  <p style={{ fontSize: '0.8125rem', color: '#a1a1aa', lineHeight: 1.5 }}>{t.template}</p>
                </div>
                <button onClick={() => { setForm(f => ({ ...f, eventType: t.event, template: t.template })); setShowTemplates(false); setShowForm(true); toast.success('Template applied!'); }} className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', flexShrink: 0 }}>Use This</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(37,211,102,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <p style={{ fontWeight: 600, color: '#f4f4f5' }}>{editingRule ? 'Edit Rule' : 'Create New Rule'}</p>
            <button onClick={() => { setShowForm(false); setEditingRule(null); }} className="btn-ghost" style={{ padding: '0.25rem' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Rule Name *</label>
              <input className="input" placeholder="e.g. Birthday Greeting" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Trigger Event *</label>
              <select className="input" value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}>
                {EVENT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Message Template * <span style={{ color: '#a1a1aa', fontWeight: 400 }}>(use {'{name}'} for personalization)</span></label>
              <textarea className="input" rows={3} placeholder="Happy Birthday {name}! 🎂 Special offer just for you..." value={form.template} onChange={e => setForm(f => ({ ...f, template: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Coupon Code</label>
              <input className="input" placeholder="e.g. BDAY20" value={form.couponCode} onChange={e => setForm(f => ({ ...f, couponCode: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Discount % (0 = none)</label>
              <input className="input" type="number" min="0" max="100" value={form.discountPercent} onChange={e => setForm(f => ({ ...f, discountPercent: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Delay before sending (minutes)</label>
              <input className="input" type="number" min="0" max="1440" value={form.delayMinutes} onChange={e => setForm(f => ({ ...f, delayMinutes: Number(e.target.value) }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <Toggle value={form.autoSend} onChange={v => setForm(f => ({ ...f, autoSend: v }))} />
                <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>Auto Send (skip approval)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <Toggle value={form.isActive} onChange={v => setForm(f => ({ ...f, isActive: v }))} />
                <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>Rule Active</span>
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditingRule(null); }} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary"><Save size={14} /> {editingRule ? 'Update Rule' : 'Create Rule'}</button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
          <Zap size={48} color="#27272a" style={{ margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#8b8b94', marginBottom: '0.5rem' }}>No automation rules yet</p>
          <p style={{ fontSize: '0.875rem', color: '#3f3f46', marginBottom: '1.5rem' }}>Create rules to automatically respond to detected WhatsApp status events</p>
          <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={14} /> Create First Rule</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>{rules.filter(r => r.isActive).length} active · {rules.length} total rules</p>
          {rules.map(rule => {
            const event = EVENT_OPTIONS.find(e => e.value === rule.eventType);
            return (
              <div key={rule.id} className="card" style={{ padding: '1.25rem', border: `1px solid ${rule.isActive ? 'rgba(37,211,102,0.2)' : '#27272a'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1rem' }}>{event?.label.split(' ')[0]}</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f4f4f5' }}>{rule.name}</span>
                      <span className="badge badge-zinc" style={{ fontSize: '0.6875rem' }}>{event?.label.split(' ').slice(1).join(' ')}</span>
                      {rule.autoSend && <span className="badge badge-green" style={{ fontSize: '0.6875rem' }}>⚡ Auto Send</span>}
                      {rule.couponCode && <span className="badge badge-purple" style={{ fontSize: '0.6875rem' }}>🎟 {rule.couponCode}</span>}
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: '#a1a1aa', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{rule.template}</p>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.625rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#8b8b94' }}>⏱ {rule.delayMinutes}min delay</span>
                      {(rule.discountPercent || 0) > 0 && <span style={{ fontSize: '0.75rem', color: '#facc15' }}>💰 {rule.discountPercent}% OFF</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                    <button onClick={() => { saveRules(rules.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r)); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: rule.isActive ? '#25D366' : '#8b8b94' }}>
                      {rule.isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button onClick={() => { setEditingRule(rule); setForm({ name: rule.name, eventType: rule.eventType, template: rule.template, autoSend: rule.autoSend, delayMinutes: rule.delayMinutes, couponCode: rule.couponCode || '', discountPercent: rule.discountPercent || 0, isActive: rule.isActive }); setShowForm(true); }} className="btn-ghost" style={{ padding: '0.375rem' }}><Edit3 size={13} /></button>
                      <button onClick={() => { saveRules(rules.filter(r => r.id !== rule.id)); toast.success('Rule deleted'); }} className="btn-ghost" style={{ padding: '0.375rem', color: '#f87171' }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
