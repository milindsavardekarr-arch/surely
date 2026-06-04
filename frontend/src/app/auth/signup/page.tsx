'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Mail, Phone, User, Building2, ChevronDown, Send, CheckCircle } from 'lucide-react';

const defaultForm = { name: '', email: '', phone: '', companyName: '', industry: '' };

// ⚠️  Apna PHP site ka URL yahan daalo
const PHP_ENDPOINT = process.env.NEXT_PUBLIC_PHP_SITE_URL
  ? `${process.env.NEXT_PUBLIC_PHP_SITE_URL}/submit_signup_request.php`
  : 'http://localhost:8080/submit_signup_request.php';

export default function SignupPage() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone.trim()) { toast.error('Mobile number required hai'); return; }
    setLoading(true);
    try {
      const res = await fetch(PHP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        toast.error(data.message || 'Request failed. Please try again.');
      }
    } catch {
      toast.error('Server se connect nahi hua. Please try again.');
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
        {/* Logo */}
        <div style={{
          padding: '1.25rem 1rem',
          borderBottom: '1px solid #27272a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ position: 'relative', width: '160px', height: '52px' }}>
            <Image src="/surely-logo.png" alt="Surely" fill style={{ objectFit: 'contain' }} priority />
          </div>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          {submitted ? (
            /* ── Success State ── */
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <CheckCircle size={48} color="#25D366" style={{ margin: '0 auto 1rem' }} />
              <h2 style={{ color: '#f4f4f5', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Request Submit Ho Gayi!
              </h2>
              <p style={{ color: '#a1a1aa', fontSize: '0.875rem', lineHeight: 1.6 }}>
                Humari team 24 ghante mein aapki request review karegi aur access de degi.
              </p>
              <p style={{ color: '#52525b', fontSize: '0.8rem', marginTop: '1rem' }}>
                Confirmation <strong style={{ color: '#a1a1aa' }}>{form.email}</strong> pe bheja jayega.
              </p>
            </div>
          ) : (
            /* ── Request Form ── */
            <>
              <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ color: '#f4f4f5', fontSize: '1rem', fontWeight: 700 }}>Access Request Karein</h2>
                <p style={{ color: '#71717a', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Form bhar ke submit karein — hum 24 ghante mein approve karenge.
                </p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Name + Phone */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>
                      Aapka Naam *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User size={14} color="#8b8b94" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)}
                        className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Rahul Sharma" required />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>
                      Mobile Number *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={14} color="#8b8b94" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)}
                        className="input" style={{ paddingLeft: '2.5rem' }} placeholder="+91 98765 43210" required />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>
                    Work Email *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} color="#8b8b94" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
                      className="input" style={{ paddingLeft: '2.5rem' }} placeholder="rahul@company.com" required />
                  </div>
                </div>

                {/* Company + Industry */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>
                      Company Name *
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Building2 size={14} color="#8b8b94" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      <input type="text" value={form.companyName} onChange={(e) => update('companyName', e.target.value)}
                        className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Sharma Textiles" required />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>
                      Industry
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Building2 size={14} color="#8b8b94" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }} />
                      <select value={form.industry} onChange={(e) => update('industry', e.target.value)}
                        className="input"
                        style={{ paddingLeft: '2.5rem', paddingRight: '2rem', appearance: 'none', cursor: 'pointer', color: form.industry ? '#f4f4f5' : '#8b8b94' }}
                      >
                        <option value="" disabled>Select</option>
                        <optgroup label="Retail & Commerce">
                          <option value="Retail">Retail</option>
                          <option value="E-Commerce">E-Commerce</option>
                          <option value="Fashion & Apparel">Fashion &amp; Apparel</option>
                          <option value="Jewellery">Jewellery</option>
                          <option value="Pharmacy / Medical Store">Pharmacy / Medical Store</option>
                        </optgroup>
                        <optgroup label="Food & Hospitality">
                          <option value="Restaurant / Cafe">Restaurant / Cafe</option>
                          <option value="Cloud Kitchen">Cloud Kitchen</option>
                          <option value="Hotel / Resort">Hotel / Resort</option>
                          <option value="Travel & Tourism">Travel &amp; Tourism</option>
                        </optgroup>
                        <optgroup label="Services">
                          <option value="Real Estate">Real Estate</option>
                          <option value="Healthcare / Clinic">Healthcare / Clinic</option>
                          <option value="Coaching / Tutoring">Coaching / Tutoring</option>
                          <option value="Consulting">Consulting</option>
                          <option value="Marketing Agency">Marketing Agency</option>
                          <option value="Logistics / Delivery">Logistics / Delivery</option>
                        </optgroup>
                        <optgroup label="Technology">
                          <option value="Software / IT Services">Software / IT Services</option>
                          <option value="SaaS">SaaS</option>
                          <option value="Digital Marketing">Digital Marketing</option>
                        </optgroup>
                        <optgroup label="Manufacturing & Trade">
                          <option value="Manufacturing">Manufacturing</option>
                          <option value="Wholesale / Distribution">Wholesale / Distribution</option>
                          <option value="Automobile">Automobile</option>
                        </optgroup>
                        <option value="Other">Other</option>
                      </select>
                      <ChevronDown size={13} color="#8b8b94" style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', marginTop: '0.25rem' }}>
                  {loading
                    ? <div style={{ width: '16px', height: '16px', border: '2px solid #09090b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    : <><Send size={15} /> Request Access</>
                  }
                </button>
              </form>
            </>
          )}

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
