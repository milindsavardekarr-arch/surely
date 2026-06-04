'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Mail, Lock, User, Building2, Zap, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const defaultForm = { name: '', email: '', password: '', businessName: '', industry: '' };

export default function SignupPage() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/signup', form);
      setAuth(data.data.token, data.data.user, [data.data.businessAccount]);
      toast.success('Account created! Welcome aboard 🎉');
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'Signup failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wa-pattern" style={{
      minHeight: '100vh', backgroundColor: '#09090b',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Logo Section with Image */}
        <div style={{
                  padding: '1.25rem 1rem',
                  borderBottom: '1px solid #27272a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    position: 'relative',
                    width: '160px',
                    height: '52px',
                  }}>
                    <Image
                      src="/surely-logo.png"
                      alt="Surely"
                      fill
                      style={{ objectFit: 'contain' }}
                      priority
                    />
                  </div>
                </div>

        <div className="card" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Your Name *</label>
                <div style={{ position: 'relative' }}>
                  <User size={14} color="#8b8b94" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)}
                    className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Rahul" required />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Industry</label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={14} color="#8b8b94" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }} />
                  <select
                    value={form.industry}
                    onChange={(e) => update('industry', e.target.value)}
                    className="input"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2rem', appearance: 'none', cursor: 'pointer', color: form.industry ? '#f4f4f5' : '#8b8b94' }}
                  >
                    <option value="" disabled>Select your industry</option>
                    <optgroup label="Retail & Commerce">
                      <option value="Retail">Retail</option>
                      <option value="E-Commerce">E-Commerce</option>
                      <option value="Grocery / Supermarket">Grocery / Supermarket</option>
                      <option value="Fashion & Apparel">Fashion &amp; Apparel</option>
                      <option value="Jewellery">Jewellery</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Furniture & Home Decor">Furniture &amp; Home Decor</option>
                      <option value="Pharmacy / Medical Store">Pharmacy / Medical Store</option>
                    </optgroup>
                    <optgroup label="Food & Hospitality">
                      <option value="Restaurant / Cafe">Restaurant / Cafe</option>
                      <option value="Cloud Kitchen">Cloud Kitchen</option>
                      <option value="Catering">Catering</option>
                      <option value="Bakery">Bakery</option>
                      <option value="Hotel / Resort">Hotel / Resort</option>
                      <option value="Travel & Tourism">Travel &amp; Tourism</option>
                      <option value="Event Management">Event Management</option>
                    </optgroup>
                    <optgroup label="Services">
                      <option value="Real Estate">Real Estate</option>
                      <option value="Salon & Beauty">Salon &amp; Beauty</option>
                      <option value="Fitness / Gym">Fitness / Gym</option>
                      <option value="Coaching / Tutoring">Coaching / Tutoring</option>
                      <option value="Healthcare / Clinic">Healthcare / Clinic</option>
                      <option value="Legal Services">Legal Services</option>
                      <option value="Accounting / Finance">Accounting / Finance</option>
                      <option value="Insurance">Insurance</option>
                      <option value="Consulting">Consulting</option>
                      <option value="Marketing Agency">Marketing Agency</option>
                      <option value="Logistics / Delivery">Logistics / Delivery</option>
                    </optgroup>
                    <optgroup label="Technology">
                      <option value="Software / IT Services">Software / IT Services</option>
                      <option value="SaaS">SaaS</option>
                      <option value="Digital Marketing">Digital Marketing</option>
                      <option value="Web / App Development">Web / App Development</option>
                      <option value="Cybersecurity">Cybersecurity</option>
                    </optgroup>
                    <optgroup label="Manufacturing & Trade">
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Wholesale / Distribution">Wholesale / Distribution</option>
                      <option value="Import / Export">Import / Export</option>
                      <option value="Construction">Construction</option>
                      <option value="Agriculture">Agriculture</option>
                      <option value="Automobile">Automobile</option>
                    </optgroup>
                    <optgroup label="Education & Media">
                      <option value="School / College">School / College</option>
                      <option value="EdTech">EdTech</option>
                      <option value="Media & Publishing">Media &amp; Publishing</option>
                      <option value="Photography / Videography">Photography / Videography</option>
                      <option value="Entertainment">Entertainment</option>
                    </optgroup>
                    <optgroup label="Non-Profit & Government">
                      <option value="NGO / Non-Profit">NGO / Non-Profit</option>
                      <option value="Government / Public Sector">Government / Public Sector</option>
                      <option value="Religious / Community">Religious / Community</option>
                    </optgroup>
                    <option value="Other">Other</option>
                  </select>
                  <ChevronDown size={13} color="#8b8b94" style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Business Name *</label>
              <div style={{ position: 'relative' }}>
                <Building2 size={14} color="#8b8b94" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="text" value={form.businessName} onChange={(e) => update('businessName', e.target.value)}
                  className="input" style={{ paddingLeft: '2.5rem' }} placeholder="My Real Estate Co." required />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Work Email *</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} color="#8b8b94" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
                  className="input" style={{ paddingLeft: '2.5rem' }} placeholder="you@business.com" required />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Password *</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} color="#8b8b94" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)}
                  className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Min. 8 characters" required minLength={8} />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '0.25rem' }}>
              {loading
                ? <div style={{ width: '16px', height: '16px', border: '2px solid #09090b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                : <><Zap size={15} /> Create Account</>
              }
            </button>
          </form>

          <div className="divider" style={{ margin: '1.25rem 0' }} />
          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#a1a1aa' }}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color: '#25D366', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}