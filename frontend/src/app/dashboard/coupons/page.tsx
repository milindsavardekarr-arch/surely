'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import { Ticket, Plus, Trash2, Copy, Edit3, Save, X, TrendingUp } from 'lucide-react';

interface Coupon {
  id: string;
  code: string;
  discountType: 'percent' | 'flat';
  discountValue: number;
  eventType: string;
  description: string;
  maxUses: number;
  usedCount: number;
  validDays: number;
  isActive: boolean;
  createdAt: string;
}

const EVENT_OPTIONS = [
  { value: 'ALL', label: '🎯 All Events' },
  { value: 'BIRTHDAY', label: '🎂 Birthday' },
  { value: 'ANNIVERSARY', label: '💍 Anniversary' },
  { value: 'ACHIEVEMENT', label: '🏆 Achievement' },
  { value: 'FESTIVAL', label: '🎊 Festival' },
  { value: 'NEW_BUSINESS', label: '🏪 New Business' },
  { value: 'TRAVEL', label: '✈️ Travel' },
  { value: 'NEW_CAR', label: '🚗 New Car' },
  { value: 'GRADUATION', label: '🎓 Graduation' },
  { value: 'FITNESS', label: '💪 Fitness' },
];

const defaultForm: Omit<Coupon, 'id' | 'createdAt' | 'usedCount'> = {
  code: '', discountType: 'percent', discountValue: 10,
  eventType: 'BIRTHDAY', description: '', maxUses: 100, validDays: 30, isActive: true,
};

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function CouponsPage() {
  const { currentBusinessAccount } = useAuthStore();
  const storageKey = `surely_coupons_${currentBusinessAccount?.id}`;

  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });
  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [form, setForm] = useState({ ...defaultForm });

  const saveCoupons = (next: Coupon[]) => {
    setCoupons(next);
    if (typeof window !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const handleSave = () => {
    if (!form.code) { toast.error('Coupon code is required'); return; }
    if (form.discountValue <= 0) { toast.error('Discount must be > 0'); return; }
    if (editingCoupon) {
      saveCoupons(coupons.map(c => c.id === editingCoupon.id ? { ...c, ...form } : c));
      toast.success('Coupon updated!');
    } else {
      if (coupons.find(c => c.code === form.code.toUpperCase())) { toast.error('Code already exists'); return; }
      saveCoupons([...coupons, { ...form, code: form.code.toUpperCase(), id: Date.now().toString(), createdAt: new Date().toISOString(), usedCount: 0 }]);
      toast.success('Coupon created! 🎟');
    }
    setShowForm(false); setEditingCoupon(null); setForm({ ...defaultForm });
  };

  const totalSavings = coupons.reduce((acc, c) => acc + c.usedCount * (c.discountType === 'percent' ? c.discountValue : 0), 0);
  const totalRedemptions = coupons.reduce((acc, c) => acc + c.usedCount, 0);

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-header-title">Coupon <span className="text-gradient">Manager</span></h1>
          <p className="page-header-sub">Create and track event-based discount codes</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingCoupon(null); setForm({ ...defaultForm, code: generateCode() }); }} className="btn-primary"><Plus size={14} /> New Coupon</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[
          { label: 'Total Coupons', value: coupons.length, color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' },
          { label: 'Total Redemptions', value: totalRedemptions, color: '#25D366', bg: 'rgba(37,211,102,0.12)' },
          { label: 'Active Coupons', value: coupons.filter(c => c.isActive).length, color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ backgroundColor: s.bg, border: `1px solid ${s.color}22`, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <Ticket size={18} color={s.color} />
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f4f4f5', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(37,211,102,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <p style={{ fontWeight: 600, color: '#f4f4f5' }}>{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</p>
            <button onClick={() => { setShowForm(false); setEditingCoupon(null); }} className="btn-ghost" style={{ padding: '0.25rem' }}><X size={14} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Coupon Code *</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="input" placeholder="BDAY20" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }} />
                <button onClick={() => setForm(f => ({ ...f, code: generateCode() }))} className="btn-secondary" style={{ padding: '0 0.75rem', flexShrink: 0, fontSize: '0.75rem' }}>🎲</button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Linked Event</label>
              <select className="input" value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}>
                {EVENT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Discount Type</label>
              <select className="input" value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value as 'percent' | 'flat' }))}>
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>
                {form.discountType === 'percent' ? 'Discount %' : 'Flat Discount (₹)'}
              </label>
              <input className="input" type="number" min="1" max={form.discountType === 'percent' ? 100 : undefined} value={form.discountValue} onChange={e => setForm(f => ({ ...f, discountValue: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Max Uses</label>
              <input className="input" type="number" min="1" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: Number(e.target.value) }))} />
            </div>
            <div>
              <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Valid for (days)</label>
              <input className="input" type="number" min="1" value={form.validDays} onChange={e => setForm(f => ({ ...f, validDays: Number(e.target.value) }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.8125rem', color: '#a1a1aa', marginBottom: '0.375rem', display: 'block' }}>Description / Fine Print</label>
              <input className="input" placeholder="e.g. Valid on dine-in only. Not combinable with other offers." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowForm(false); setEditingCoupon(null); }} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary"><Save size={14} /> {editingCoupon ? 'Update Coupon' : 'Create Coupon'}</button>
          </div>
        </div>
      )}

      {coupons.length === 0 ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
          <Ticket size={48} color="#27272a" style={{ margin: '0 auto 1rem' }} />
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#8b8b94', marginBottom: '0.5rem' }}>No coupons yet</p>
          <p style={{ fontSize: '0.875rem', color: '#3f3f46', marginBottom: '1.5rem' }}>Create event-based coupons and include them in your automation templates</p>
          <button onClick={() => { setShowForm(true); setForm({ ...defaultForm, code: generateCode() }); }} className="btn-primary"><Plus size={14} /> Create First Coupon</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {coupons.map(coupon => {
            const event = EVENT_OPTIONS.find(e => e.value === coupon.eventType);
            const usagePercent = coupon.maxUses > 0 ? Math.min((coupon.usedCount / coupon.maxUses) * 100, 100) : 0;
            return (
              <div key={coupon.id} className="card" style={{ padding: '1.25rem', border: `1px solid ${coupon.isActive ? 'rgba(37,211,102,0.2)' : '#27272a'}`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '4px', backgroundColor: coupon.isActive ? '#25D366' : '#3f3f46' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <code style={{ fontSize: '1.125rem', fontWeight: 700, color: '#f4f4f5', letterSpacing: '0.08em', fontFamily: 'monospace' }}>{coupon.code}</code>
                      <button onClick={() => { navigator.clipboard.writeText(coupon.code); toast.success('Copied!'); }} className="btn-ghost" style={{ padding: '2px 4px' }}><Copy size={12} /></button>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{event?.label} · Valid {coupon.validDays}d</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#facc15' }}>
                      {coupon.discountType === 'percent' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}
                    </p>
                    <p style={{ fontSize: '0.6875rem', color: '#8b8b94' }}>{coupon.discountType === 'percent' ? 'OFF' : 'FLAT'}</p>
                  </div>
                </div>
                {coupon.description && <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.875rem', lineHeight: 1.4 }}>{coupon.description}</p>}
                <div style={{ marginBottom: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>Usage</span>
                    <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{coupon.usedCount} / {coupon.maxUses}</span>
                  </div>
                  <div style={{ height: '5px', backgroundColor: '#27272a', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${usagePercent}%`, backgroundColor: usagePercent > 80 ? '#ef4444' : '#25D366', borderRadius: '9999px', transition: 'width 0.3s' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => { saveCoupons(coupons.map(c => c.id === coupon.id ? { ...c, isActive: !c.isActive } : c)); }} className="btn-secondary" style={{ flex: 1, fontSize: '0.75rem', padding: '0.375rem' }}>{coupon.isActive ? 'Deactivate' : 'Activate'}</button>
                  <button onClick={() => { setEditingCoupon(coupon); setForm({ code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue, eventType: coupon.eventType, description: coupon.description, maxUses: coupon.maxUses, validDays: coupon.validDays, isActive: coupon.isActive }); setShowForm(true); }} className="btn-ghost" style={{ padding: '0.375rem 0.625rem' }}><Edit3 size={13} /></button>
                  <button onClick={() => { saveCoupons(coupons.filter(c => c.id !== coupon.id)); toast.success('Deleted'); }} className="btn-ghost" style={{ padding: '0.375rem 0.625rem', color: '#f87171' }}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
