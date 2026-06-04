'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import { BarChart3, Users, TrendingUp, Award } from 'lucide-react';

const COLORS = ['#25D366', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const STAGE_COLOR: Record<string, string> = {
  VIP: '#8b5cf6', CUSTOMER: '#25D366', QUALIFIED: '#f59e0b',
  PROSPECT: '#3b82f6', LEAD: '#a1a1aa', CHURNED: '#ef4444',
};

const tooltipStyle = {
  contentStyle: { background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', fontSize: '12px' },
  labelStyle: { color: '#a1a1aa' },
  itemStyle: { color: '#25D366' },
};

export default function AnalyticsPage() {
  const { currentBusinessAccount } = useAuthStore();

  const { data: dash, isLoading } = useQuery({
    queryKey: ['analytics-dash', currentBusinessAccount?.id],
    queryFn: () => api.get('/analytics/dashboard').then((r) => r.data.data),
    enabled: !!currentBusinessAccount,
  });

  const { data: topContacts } = useQuery({
    queryKey: ['analytics-engagement', currentBusinessAccount?.id],
    queryFn: () => api.get('/analytics/contacts/engagement').then((r) => r.data.data),
    enabled: !!currentBusinessAccount,
  });

  const trend = dash?.engagementTrend || [];
  const events = (dash?.eventBreakdown || []).filter((e: { event: string }) => e.event);
  const replyBreakdown = dash?.replyStatusBreakdown || [];

  const metrics = [
    { label: 'Statuses Detected', value: dash?.overview?.statusesDetected || 0, sub: 'Last 30 days', icon: TrendingUp, color: '#a78bfa', bg: 'rgba(139,92,246,0.15)' },
    { label: 'AI Replies Generated', value: dash?.overview?.aiRepliesGenerated || 0, sub: 'Last 30 days', icon: BarChart3, color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
    { label: 'Messages Sent', value: dash?.overview?.repliesSent || 0, sub: 'Delivered', icon: Award, color: '#25D366', bg: 'rgba(37,211,102,0.15)' },
    { label: 'Total Contacts', value: dash?.overview?.totalContacts || 0, sub: 'In CRM', icon: Users, color: '#facc15', bg: 'rgba(234,179,8,0.15)' },
  ];

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div>
        <h1 className="page-header-title">Business <span className="text-gradient">Analytics</span></h1>
        <p className="page-header-sub">Engagement insights and performance metrics</p>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="loading-skeleton" style={{ height: '100px', borderRadius: '1rem' }} />
          ))
        ) : (
          metrics.map(({ label, value, sub, icon: Icon, color, bg }) => (
            <div key={label} className="stat-card">
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={color} />
              </div>
              <div>
                <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f4f4f5', lineHeight: 1 }}>{value.toLocaleString()}</p>
                <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '0.25rem' }}>{label}</p>
                <p style={{ fontSize: '0.6875rem', color: '#8b8b94' }}>{sub}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem' }}>
        {/* Trend Line */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p className="section-title" style={{ marginBottom: '0.25rem' }}>Engagement Over Time</p>
          <p className="section-subtitle" style={{ marginBottom: '1.25rem' }}>Last 7 days</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: '#8b8b94', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b8b94', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="count" stroke="#25D366" strokeWidth={2.5}
                dot={{ fill: '#25D366', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Reply Outcome Pie */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <p className="section-title" style={{ marginBottom: '0.25rem' }}>Reply Outcomes</p>
          <p className="section-subtitle" style={{ marginBottom: '1rem' }}>Approval workflow results</p>
          {replyBreakdown.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={replyBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                    dataKey="_count" paddingAngle={3}>
                    {replyBreakdown.map((_: unknown, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {replyBreakdown.map((item: { status: string; _count: number }, i: number) => (
                  <div key={item.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length] }} />
                      <span style={{ fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'capitalize' }}>{item.status?.toLowerCase()}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e4e4e7' }}>{item._count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#8b8b94', textAlign: 'center', padding: '2rem 0' }}>No data yet</p>
          )}
        </div>
      </div>

      {/* Events Bar Chart */}
      {events.length > 0 && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <p className="section-title" style={{ marginBottom: '0.25rem' }}>Events Detected by Type</p>
          <p className="section-subtitle" style={{ marginBottom: '1.25rem' }}>Distribution of customer life events</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={events} layout="vertical">
              <XAxis type="number" tick={{ fill: '#8b8b94', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="event" tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} width={130} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {events.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Contacts */}
      <div className="card">
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #27272a' }}>
          <p className="section-title">Most Engaged Contacts</p>
          <p className="section-subtitle">Ranked by total interactions</p>
        </div>
        <div>
          {!topContacts || topContacts.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: '#8b8b94' }}>No engagement data yet</p>
            </div>
          ) : (
            topContacts.slice(0, 10).map((c: {
              id: string; name: string; mobile: string; leadStage: string;
              _count: { statuses: number; aiReplies: number; engagementLogs: number };
            }, i: number) => {
              const stageColor = STAGE_COLOR[c.leadStage] || '#a1a1aa';
              return (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '0.875rem 1.25rem', borderBottom: '1px solid #1f1f23',
                  transition: 'background-color 0.1s',
                }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#8b8b94', width: '20px', textAlign: 'center' }}>{i + 1}</span>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: stageColor + '22' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: stageColor }}>{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e4e4e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                    <p style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{c.mobile}</p>
                  </div>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '9999px', fontWeight: 500, color: stageColor, backgroundColor: stageColor + '22', border: `1px solid ${stageColor}33`, whiteSpace: 'nowrap' }}>
                    {c.leadStage}
                  </span>
                  <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.75rem', color: '#a1a1aa', textAlign: 'right' }}>
                    <span>{c._count.statuses} <span style={{ color: '#8b8b94' }}>statuses</span></span>
                    <span>{c._count.aiReplies} <span style={{ color: '#8b8b94' }}>replies</span></span>
                    <span style={{ fontWeight: 600, color: '#e4e4e7' }}>{c._count.engagementLogs} <span style={{ color: '#8b8b94', fontWeight: 400 }}>total</span></span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
