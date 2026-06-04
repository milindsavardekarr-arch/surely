'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Mail, Lock, Eye, EyeOff, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.data.token, data.data.user, data.data.businessAccounts);
      toast.success(`Welcome back, ${data.data.user.name}! 👋`);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message || 'Login failed. Check credentials.';
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
      <div style={{ width: '100%', maxWidth: '420px' }}>
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

        {/* Card */}
        <div className="card" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="#8b8b94" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input" style={{ paddingLeft: '2.5rem' }}
                  placeholder="you@business.com" required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="#8b8b94" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input" style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  placeholder="••••••••" required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                  position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#8b8b94', padding: 0,
                }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '0.25rem', width: '100%' }}>
              {loading ? (
                <div style={{ width: '16px', height: '16px', border: '2px solid #09090b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              ) : (
                <><Zap size={15} /> Sign In</>
              )}
            </button>
          </form>

          <div className="divider" style={{ margin: '1.5rem 0' }} />

          <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#a1a1aa' }}>
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" style={{ color: '#25D366', textDecoration: 'none', fontWeight: 500 }}>
              Create account
            </Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#3f3f46', marginTop: '1.5rem' }}>
          Powered by Groq · llama-3.3-70b-versatile
        </p>
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}