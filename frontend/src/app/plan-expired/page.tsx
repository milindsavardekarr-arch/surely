'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Lock, PhoneCall, Mail, RefreshCw } from 'lucide-react';

export default function PlanExpiredPage() {
  const [email, setEmail] = useState('');

  useEffect(() => {
    try {
      // Try to get user email from localStorage for display
      const auth = localStorage.getItem('wrai-auth');
      if (auth) {
        const parsed = JSON.parse(auth);
        setEmail(parsed?.user?.email || '');
      }
    } catch { /* ignore */ }
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem('wrai_token');
      localStorage.removeItem('wrai_biz_id');
      localStorage.removeItem('wrai-auth');
    } catch { /* ignore */ }
    window.location.href = '/auth/login';
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#09090b',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>

        {/* Logo */}
        <div style={{
          display: 'flex', justifyContent: 'center', marginBottom: '2rem',
        }}>
          <div style={{ position: 'relative', width: '140px', height: '48px' }}>
            <Image src="/surely-logo.png" alt="Surely" fill style={{ objectFit: 'contain' }} priority />
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>

          {/* Lock icon */}
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}>
            <Lock size={32} color="#ef4444" />
          </div>

          <h1 style={{ color: '#f4f4f5', fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Your Account is Locked
          </h1>
          <p style={{ color: '#71717a', fontSize: '0.875rem', lineHeight: 1.7, marginBottom: '0.5rem' }}>
            Your trial or subscription period has expired.
            {email && <> Your account: <strong style={{ color: '#a1a1aa' }}>{email}</strong></>}
          </p>
          <p style={{ color: '#52525b', fontSize: '0.8rem', marginBottom: '2rem' }}>
            Please contact us to renew or upgrade your plan.
          </p>

          {/* Plans */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem',
            marginBottom: '2rem',
          }}>
            {[
              { name: 'Starter', price: 'Contact us', days: '30 days', color: '#3b82f6' },
              { name: 'Business', price: 'Contact us', days: '30 days', color: '#8b5cf6', popular: true },
              { name: 'Growth', price: 'Contact us', days: '30 days', color: '#25D366' },
            ].map((plan) => (
              <div key={plan.name} style={{
                background: plan.popular ? 'rgba(139,92,246,0.1)' : '#18181b',
                border: `1px solid ${plan.popular ? 'rgba(139,92,246,0.4)' : '#27272a'}`,
                borderRadius: '0.75rem', padding: '1rem 0.75rem',
                position: 'relative',
              }}>
                {plan.popular && (
                  <div style={{
                    position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
                    background: '#8b5cf6', color: 'white', fontSize: '0.6rem', fontWeight: 700,
                    padding: '0.15rem 0.5rem', borderRadius: '1rem', whiteSpace: 'nowrap',
                  }}>POPULAR</div>
                )}
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: plan.color, marginBottom: '0.25rem' }}>
                  {plan.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#71717a' }}>{plan.days}</div>
              </div>
            ))}
          </div>

          {/* Annual */}
          <div style={{
            background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.2)',
            borderRadius: '0.75rem', padding: '0.75rem 1rem', marginBottom: '2rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          }}>
            <RefreshCw size={14} color="#25D366" />
            <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>
              Annual Plan — <strong style={{ color: '#25D366' }}>365 days access</strong> at best rates
            </span>
          </div>

          {/* Contact options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <a
              href="https://wa.me/919999999999?text=Hi, my Surely account has expired. Please help me renew."
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}
            >
              <PhoneCall size={16} />
              Contact Us on WhatsApp
            </a>
            <a
              href="mailto:hello@surely.co.in?subject=Account Renewal&body=Hi, my account has expired. Please help me renew."
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.7rem', borderRadius: '0.6rem', fontSize: '0.875rem', fontWeight: 600,
                background: '#18181b', border: '1px solid #27272a', color: '#a1a1aa',
                textDecoration: 'none',
              }}
            >
              <Mail size={16} />
              Email Us
            </a>
          </div>

          <button
            onClick={handleLogout}
            style={{
              background: 'none', border: 'none', color: '#52525b',
              fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
