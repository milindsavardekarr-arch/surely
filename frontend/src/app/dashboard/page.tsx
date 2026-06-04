'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Users, Smartphone, Activity, MessageSquare, Send, Clock,
  TrendingUp, Zap, AlertCircle, CheckCircle2, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

const EVENT_COLORS: Record<string, string> = {
  BIRTHDAY: '#25D366', ANNIVERSARY: '#3b82f6', ACHIEVEMENT: '#f59e0b',
  FESTIVAL: '#8b5cf6', SAD_EMOTION: '#ef4444', POSITIVE: '#06b6d4',
};

const EVENT_ICONS: Record<string, string> = {
  BIRTHDAY: '🎂', ANNIVERSARY: '💍', ACHIEVEMENT: '🏆',
  FESTIVAL: '🎊', SAD_EMOTION: '💔', POSITIVE: '✨',
};

function StatCard({ label, value, icon: Icon, iconColor, iconBg, sub, urgent }: {
  label: string; value: number; icon: React.ElementType;
  iconColor: string; iconBg: string; sub?: string; urgent?: boolean;
}) {
  return (
    <div className="stat-card" style={urgent ? { borderColor: 'rgba(249,115,22,0.4)', boxShadow: '0 0 10px rgba(249,115,22,0.1)' } : {}}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={iconColor} />
        </div>
        {urgent && <AlertCircle size={15} color="#fb923c" />}
      </div>
      <div>
        <p style={{ fontSize: '1.625rem', fontWeight: 700, color: '#f4f4f5', lineHeight: 1 }}>{value.toLocaleString()}</p>
        <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '0.25rem' }}>{label}</p>
        {sub && <p style={{ fontSize: '0.6875rem', color: '#8b8b94', marginTop: '0.125rem' }}>{sub}</p>}
      </div>
    </div>
  );
}


function AutoModeWidget() {
  const storageKey_settings = 'surely_settings_';
  const [mode, setMode] = React.useState<'AUTO'|'APPROVAL'|'OFF'>('APPROVAL');

  React.useEffect(() => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('surely_settings_'));
      if (keys.length > 0) {
        const s = JSON.parse(localStorage.getItem(keys[0]) || '{}');
        if (s.autoReplyEnabled && !s.approvalRequired) setMode('AUTO');
        else if (s.approvalRequired) setMode('APPROVAL');
        else setMode('OFF');
      }
    } catch {}
  }, []);

  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '1rem', padding: '0.875rem 1.25rem' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: mode === 'AUTO' ? '#25D366' : mode === 'APPROVAL' ? '#facc15' : '#8b8b94', boxShadow: mode === 'AUTO' ? '0 0 6px #25D366' : undefined, animation: mode === 'AUTO' ? 'pulse 2s infinite' : undefined }} />
      <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>
        Mode: <strong style={{ color: mode === 'AUTO' ? '#4ade80' : mode === 'APPROVAL' ? '#facc15' : '#a1a1aa' }}>
          {mode === 'AUTO' ? '⚡ Fully Automatic' : mode === 'APPROVAL' ? '✋ Approval Required' : '⏸ Manual (Off)'}
        </strong>
      </span>
      <Link href="/dashboard/settings" style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#25D366', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        Change →
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { currentBusinessAccount } = useAuthStore();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', currentBusinessAccount?.id],
    queryFn: () => api.get('/analytics/dashboard').then((r) => r.data.data),
    enabled: !!currentBusinessAccount,
    refetchInterval: 60000,
  });

  const stats = data?.overview;

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-header-title">
            Dashboard <span className="text-gradient">Overview</span>
          </h1>
          <p className="page-header-sub">
            {currentBusinessAccount?.name} · Real-time customer relationship intelligence
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="loading-skeleton" style={{ height: '112px', borderRadius: '1rem' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <StatCard label="Total Contacts" value={stats?.totalContacts || 0} icon={Users} iconColor="#60a5fa" iconBg="rgba(59,130,246,0.15)" />
          <StatCard label="Connected Sessions" value={stats?.connectedSessions || 0} icon={Smartphone} iconColor="#25D366" iconBg="rgba(37,211,102,0.15)" />
          <StatCard label="Statuses Detected" value={stats?.statusesDetected || 0} icon={Activity} iconColor="#a78bfa" iconBg="rgba(139,92,246,0.15)" sub="Last 30 days" />
          <StatCard label="AI Replies Generated" value={stats?.aiRepliesGenerated || 0} icon={Zap} iconColor="#facc15" iconBg="rgba(234,179,8,0.15)" sub="Last 30 days" />
          <StatCard label="Replies Sent" value={stats?.repliesSent || 0} icon={Send} iconColor="#2dd4bf" iconBg="rgba(20,184,166,0.15)" />
          <StatCard label="Pending Approval" value={stats?.pendingApprovals || 0} icon={Clock} iconColor="#fb923c" iconBg="rgba(249,115,22,0.15)" urgent={(stats?.pendingApprovals || 0) > 0} />
        </div>
      )}

      {/* Pending Alert */}
      {!isLoading && (stats?.pendingApprovals || 0) > 0 && (
        <div style={{
          backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)',
          borderRadius: '1rem', padding: '1rem 1.25rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Clock size={18} color="#fb923c" />
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fed7aa' }}>
                {stats.pendingApprovals} AI {stats.pendingApprovals === 1 ? 'reply' : 'replies'} waiting for your approval
              </p>
              <p style={{ fontSize: '0.75rem', color: '#9a3412', marginTop: '0.125rem' }}>
                Review personalized messages before they go out
              </p>
            </div>
          </div>
          <Link href="/dashboard/replies" className="btn-secondary" style={{ borderColor: 'rgba(249,115,22,0.4)', color: '#fb923c', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
            Review Now →
          </Link>
        </div>
      )}

      {/* Automation Mode Quick Toggle */}
      <AutoModeWidget />

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
        {/* Engagement Trend */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <p className="section-title">Engagement Trend</p>
              <p className="section-subtitle">Last 7 days activity</p>
            </div>
            <TrendingUp size={18} color="#25D366" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.engagementTrend || []}>
              <XAxis dataKey="date" tick={{ fill: '#8b8b94', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b8b94', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', fontSize: '12px' }} labelStyle={{ color: '#a1a1aa' }} itemStyle={{ color: '#25D366' }} />
              <Bar dataKey="count" fill="#25D366" radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Event Breakdown */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p className="section-title" style={{ marginBottom: '0.25rem' }}>Events Detected</p>
          <p className="section-subtitle" style={{ marginBottom: '1.25rem' }}>By type</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {(data?.eventBreakdown || []).filter((e: { event: string }) => e.event).map((e: { event: string; count: number }) => {
              const maxCount = Math.max(...(data?.eventBreakdown || []).map((x: { count: number }) => x.count), 1);
              return (
                <div key={e.event} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span style={{ fontSize: '1.125rem' }}>{EVENT_ICONS[e.event] || '📌'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{e.event.replace('_', ' ')}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e4e4e7' }}>{e.count}</span>
                    </div>
                    <div style={{ height: '5px', backgroundColor: '#27272a', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '9999px', backgroundColor: EVENT_COLORS[e.event] || '#25D366', width: `${(e.count / maxCount) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
            {!data?.eventBreakdown?.filter((e: { event: string }) => e.event).length && (
              <p style={{ fontSize: '0.875rem', color: '#8b8b94', textAlign: 'center', padding: '1rem 0' }}>No events yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Statuses */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.125rem 1.25rem', borderBottom: '1px solid #27272a' }}>
          <div>
            <p className="section-title">Recent Status Updates</p>
            <p className="section-subtitle">Latest monitored customer statuses</p>
          </div>
          <Link href="/dashboard/statuses" className="btn-ghost" style={{ fontSize: '0.8125rem', color: '#25D366' }}>
            View All →
          </Link>
        </div>
        <div>
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #27272a' }}>
                <div className="loading-skeleton" style={{ height: '40px', borderRadius: '0.5rem' }} />
              </div>
            ))
          ) : (data?.recentStatuses || []).length === 0 ? (
            <div style={{ padding: '3.5rem', textAlign: 'center' }}>
              <Activity size={40} color="#27272a" style={{ margin: '0 auto 0.75rem' }} />
              <p style={{ fontSize: '0.875rem', color: '#8b8b94' }}>No statuses detected yet</p>
              <p style={{ fontSize: '0.75rem', color: '#3f3f46', marginTop: '0.375rem', marginBottom: '1rem' }}>
                Connect a WhatsApp session to start monitoring
              </p>
              <Link href="/dashboard/sessions" className="btn-primary" style={{ fontSize: '0.8125rem', display: 'inline-flex' }}>
                Connect WhatsApp
              </Link>
            </div>
          ) : (
            (data?.recentStatuses || []).map((status: {
              id: string; contactName: string; statusText: string;
              timestamp: string; detectedEvent?: string;
              contact?: { leadStage?: string };
              aiReplies?: Array<{ approvalStatus: string }>;
            }) => (
              <div key={status.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
                padding: '1rem 1.25rem', borderBottom: '1px solid #1f1f23',
                transition: 'background-color 0.15s',
              }}>
                <div style={{
                  width: '36px', height: '36px', backgroundColor: '#075E54', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#25D366' }}>
                    {status.contactName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e4e4e7' }}>{status.contactName}</span>
                    {status.detectedEvent && (
                      <span style={{ fontSize: '0.75rem', padding: '1px 8px', backgroundColor: '#27272a', color: '#a1a1aa', borderRadius: '9999px' }}>
                        {EVENT_ICONS[status.detectedEvent]} {status.detectedEvent.replace('_', ' ')}
                      </span>
                    )}
                    {status.contact?.leadStage && (
                      <span className="badge badge-zinc" style={{ fontSize: '0.6875rem' }}>{status.contact.leadStage}</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {status.statusText}
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: '#8b8b94', marginTop: '0.25rem' }}>
                    {formatDistanceToNow(new Date(status.timestamp), { addSuffix: true })}
                  </p>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {status.aiReplies?.[0] ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontSize: '0.75rem', padding: '3px 10px', borderRadius: '9999px',
                      backgroundColor: status.aiReplies[0].approvalStatus === 'SENT' ? 'rgba(37,211,102,0.12)' : 'rgba(234,179,8,0.12)',
                      color: status.aiReplies[0].approvalStatus === 'SENT' ? '#4ade80' : '#facc15',
                      border: `1px solid ${status.aiReplies[0].approvalStatus === 'SENT' ? 'rgba(37,211,102,0.2)' : 'rgba(234,179,8,0.2)'}`,
                    }}>
                      {status.aiReplies[0].approvalStatus === 'SENT'
                        ? <><CheckCircle2 size={11} />Sent</>
                        : <><Clock size={11} />Pending</>
                      }
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: '#3f3f46' }}>—</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
