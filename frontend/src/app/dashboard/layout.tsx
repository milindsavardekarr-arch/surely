'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard, Users, Smartphone,
  Activity, MessageSquare, BarChart3, LogOut,
  ChevronDown, ChevronRight, Settings, Zap, Ticket,
  SlidersHorizontal, MessageCircle, MessagesSquare,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { setAuthToken } from '@/lib/api';

// ── Top-level nav items ───────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/dashboard',           label: 'Overview',         icon: LayoutDashboard, exact: true },
  { href: '/dashboard/sessions',  label: 'WhatsApp Sessions',icon: Smartphone },
  { href: '/dashboard/contacts',  label: 'CRM Contacts',     icon: Users },
  { href: '/dashboard/statuses',  label: 'Status Monitor',   icon: Activity,        badge: 'LIVE' },
  { href: '/dashboard/replies',   label: 'AI Replies',       icon: MessageSquare,   badge: 'INBOX' },
  { href: '/dashboard/conversations', label: 'Conversations',    icon: MessagesSquare,  badge: 'UNREAD' },
  { href: '/dashboard/analytics', label: 'Analytics',        icon: BarChart3 },
];

// ── Settings submenu items ────────────────────────────────────────────────────
const SETTINGS_CHILDREN = [
  { href: '/dashboard/whatsapp-settings', label: 'WhatsApp Setting', icon: MessageCircle },
  { href: '/dashboard/automation',        label: 'Automation Rules',  icon: Zap,           badge: 'NEW' },
  { href: '/dashboard/coupons',           label: 'Coupons',           icon: Ticket },
  { href: '/dashboard/settings',          label: 'General',           icon: SlidersHorizontal },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, currentBusinessAccount, logout, token } = useAuthStore();

  // ── Hydration guard ──────────────────────────────────────────────────────
  // Zustand persist rehydrates ASYNCHRONOUSLY on the client.
  // On the very first render isAuthenticated is false even for logged-in users.
  // We must wait one tick after mount before trusting the value — otherwise
  // every page refresh immediately redirects to /auth/login.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // After the first client render Zustand has rehydrated — mark ready
    setHydrated(true);

    // Re-sync the token into localStorage so Axios interceptor picks it up.
    // This is needed because setAuthToken() only runs during login(), not on hydration.
    if (token) {
      setAuthToken(token, currentBusinessAccount?.id);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep Settings submenu open when any child route is active
  const settingsActive = SETTINGS_CHILDREN.some(c => pathname.startsWith(c.href));
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);

  // Re-open if navigating to a settings child from elsewhere
  useEffect(() => {
    if (settingsActive) setSettingsOpen(true);
  }, [settingsActive]);

  useEffect(() => {
    // Only redirect AFTER hydration — never on the very first SSR render
    if (hydrated && !isAuthenticated) router.push('/auth/login');
  }, [hydrated, isAuthenticated, router]);

  // Show nothing until store is hydrated (avoids flash of login page)
  if (!hydrated) return null;
  if (!isAuthenticated) return null;

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#09090b' }}>

      {/* ── Fixed Sidebar ─────────────────────────────────────────────────── */}
      <aside style={{
        width: '248px',
        flexShrink: 0,
        backgroundColor: '#111113',
        borderRight: '1px solid #1f1f23',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 50,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>

        {/* Logo */}
        <div style={{
          padding: '1.125rem 1rem 1rem',
          borderBottom: '1px solid #1f1f23',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <div style={{ position: 'relative', width: '148px', height: '48px' }}>
            <Image src="/surely-logo.png" alt="Surely" fill style={{ objectFit: 'contain' }} priority />
          </div>
        </div>

        {/* Business Account Pill */}
        {currentBusinessAccount && (
          <div style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid #1f1f23', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.625rem', borderRadius: '0.5rem',
              backgroundColor: '#1a1a1f',
              border: '1px solid #27272a',
            }}>
              <div style={{
                width: '26px', height: '26px',
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                borderRadius: '6px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#fff' }}>
                  {currentBusinessAccount.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentBusinessAccount.name}
                </p>
                <p style={{ fontSize: '0.625rem', color: '#8b8b94', letterSpacing: '0.04em' }}>BUSINESS</p>
              </div>
              <ChevronDown size={11} color="#8b8b94" />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.625rem', display: 'flex', flexDirection: 'column', gap: '1px' }}>

          {/* Main nav items */}
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact, badge }) => {
            const active = isActive(href, exact);
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.5rem 0.625rem', borderRadius: '0.5rem',
                fontSize: '0.8125rem', fontWeight: active ? 600 : 400,
                textDecoration: 'none',
                color: active ? '#f4f4f5' : '#a1a1aa',
                backgroundColor: active ? '#1e1e24' : 'transparent',
                border: active ? '1px solid #2a2a35' : '1px solid transparent',
                transition: 'all 0.12s',
              }}>
                <Icon
                  size={15}
                  color={active ? '#25D366' : '#71717a'}
                  style={{ flexShrink: 0 }}
                />
                <span style={{ flex: 1 }}>{label}</span>
                {badge && (
                  <span style={{
                    backgroundColor: badge === 'LIVE' ? 'rgba(37,211,102,0.15)' : badge === 'INBOX' ? 'rgba(37,211,102,0.15)' : active ? '#25D366' : '#27272a',
                    color: badge === 'LIVE' ? '#4ade80' : badge === 'INBOX' ? '#4ade80' : active ? '#09090b' : '#a1a1aa',
                    border: badge === 'LIVE' || badge === 'INBOX' ? '1px solid rgba(37,211,102,0.3)' : 'none',
                    fontSize: '0.5625rem', fontWeight: 700,
                    padding: '1px 5px', borderRadius: '9999px',
                    letterSpacing: '0.04em',
                  }}>{badge}</span>
                )}
              </Link>
            );
          })}

          {/* ── Settings collapsible section ──────────────────────────── */}
          <div style={{ marginTop: '0.375rem' }}>
            {/* Settings header button */}
            <button
              onClick={() => setSettingsOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.5rem 0.625rem', borderRadius: '0.5rem',
                fontSize: '0.8125rem', fontWeight: settingsActive ? 600 : 400,
                color: settingsActive ? '#f4f4f5' : '#a1a1aa',
                backgroundColor: settingsActive && !settingsOpen ? '#1e1e24' : 'transparent',
                border: settingsActive && !settingsOpen ? '1px solid #2a2a35' : '1px solid transparent',
                width: '100%', cursor: 'pointer', transition: 'all 0.12s',
                background: 'none',
              }}
            >
              <Settings
                size={15}
                color={settingsActive ? '#25D366' : '#71717a'}
                style={{ flexShrink: 0 }}
              />
              <span style={{ flex: 1, textAlign: 'left' }}>Settings</span>
              <ChevronRight
                size={13}
                color="#8b8b94"
                style={{
                  transform: settingsOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.18s',
                  flexShrink: 0,
                }}
              />
            </button>

            {/* Submenu */}
            {settingsOpen && (
              <div style={{
                marginTop: '2px',
                marginLeft: '0.625rem',
                paddingLeft: '0.75rem',
                borderLeft: '1px solid #27272a',
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
              }}>
                {SETTINGS_CHILDREN.map(({ href, label, icon: Icon, badge }) => {
                  const active = isActive(href);
                  return (
                    <Link key={href} href={href} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.4375rem 0.5rem', borderRadius: '0.375rem',
                      fontSize: '0.8125rem', fontWeight: active ? 600 : 400,
                      textDecoration: 'none',
                      color: active ? '#f4f4f5' : '#a1a1aa',
                      backgroundColor: active ? '#1e1e24' : 'transparent',
                      border: active ? '1px solid #2a2a35' : '1px solid transparent',
                      transition: 'all 0.12s',
                    }}>
                      <Icon size={13} color={active ? '#25D366' : '#71717a'} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{label}</span>
                      {badge && (
                        <span style={{
                          backgroundColor: badge === 'LIVE' ? 'rgba(37,211,102,0.15)' : badge === 'INBOX' ? 'rgba(37,211,102,0.15)' : active ? '#25D366' : '#27272a',
                          color: badge === 'LIVE' ? '#4ade80' : badge === 'INBOX' ? '#4ade80' : active ? '#09090b' : '#a1a1aa',
                          border: badge === 'LIVE' || badge === 'INBOX' ? '1px solid rgba(37,211,102,0.3)' : 'none',
                          fontSize: '0.5625rem', fontWeight: 700,
                          padding: '1px 5px', borderRadius: '9999px',
                          letterSpacing: '0.04em',
                        }}>{badge}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Sign Out */}
        <div style={{ padding: '0.625rem', borderTop: '1px solid #1f1f23', flexShrink: 0 }}>
          <button
            onClick={() => { logout(); router.push('/auth/login'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.5rem 0.625rem', borderRadius: '0.5rem',
              fontSize: '0.8125rem', fontWeight: 500,
              color: '#f87171', backgroundColor: 'transparent',
              border: '1px solid transparent', width: '100%', cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
          >
            <LogOut size={15} color="#f87171" style={{ flexShrink: 0 }} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* User Info */}
        <div style={{ padding: '0.75rem', borderTop: '1px solid #1f1f23', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '30px', height: '30px', flexShrink: 0,
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#fff' }}>
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#d4d4d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </p>
              <p style={{ fontSize: '0.625rem', color: '#8b8b94', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content — offset by sidebar width */}
      <main style={{ flex: 1, marginLeft: '248px', overflowX: 'hidden', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
