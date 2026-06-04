'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import {
  Users, Plus, Search, Upload, Trash2, Edit3,
  ChevronLeft, ChevronRight, X, Check, FileText,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Contact {
  id: string; name: string; mobile: string; email?: string;
  tags: string[]; leadStage: string; city?: string; notes?: string;
  createdAt: string;
  _count?: { statuses: number; aiReplies: number };
}

const LEAD_STAGES = ['LEAD', 'PROSPECT', 'QUALIFIED', 'CUSTOMER', 'CHURNED', 'VIP'];

const STAGE_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  LEAD: { color: '#a1a1aa', bg: '#27272a', border: '#3f3f46' },
  PROSPECT: { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.2)' },
  QUALIFIED: { color: '#facc15', bg: 'rgba(234,179,8,0.12)', border: 'rgba(234,179,8,0.2)' },
  CUSTOMER: { color: '#4ade80', bg: 'rgba(37,211,102,0.12)', border: 'rgba(37,211,102,0.2)' },
  CHURNED: { color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.2)' },
  VIP: { color: '#a78bfa', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.2)' },
};

const defaultForm = { name: '', mobile: '', email: '', tags: '', leadStage: 'LEAD', city: '', notes: '' };

function StageBadge({ stage }: { stage: string }) {
  const c = STAGE_COLORS[stage] || STAGE_COLORS.LEAD;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 500,
      color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}`,
    }}>{stage}</span>
  );
}

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [showImport, setShowImport] = useState(false);
  const queryClient = useQueryClient();
  const { currentBusinessAccount } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', currentBusinessAccount?.id, search, stageFilter, page],
    queryFn: () => api.get('/contacts', {
      params: { search: search || undefined, leadStage: stageFilter || undefined, page, limit: 15 },
    }).then((r) => r.data),
    enabled: !!currentBusinessAccount,
  });

  const createMutation = useMutation({
    mutationFn: (d: typeof defaultForm) => api.post('/contacts', {
      ...d, tags: d.tags ? d.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    }),
    onSuccess: () => {
      toast.success('Contact added!');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setShowModal(false); setForm(defaultForm);
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Failed to add contact'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: typeof defaultForm }) =>
      api.put(`/contacts/${id}`, { ...d, tags: d.tags ? d.tags.split(',').map((t) => t.trim()).filter(Boolean) : [] }),
    onSuccess: () => {
      toast.success('Contact updated!');
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setShowModal(false); setEditContact(null);
    },
    onError: () => toast.error('Failed to update contact'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => { toast.success('Contact deleted'); queryClient.invalidateQueries({ queryKey: ['contacts'] }); },
    onError: () => toast.error('Failed to delete'),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append('file', file);
      return api.post('/contacts/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => {
      const { created, skipped } = res.data.data;
      toast.success(`Imported ${created} contacts (${skipped} skipped)`);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setShowImport(false);
    },
    onError: () => toast.error('Import failed'),
  });

  const onDrop = useCallback((files: File[]) => { if (files[0]) importMutation.mutate(files[0]); }, [importMutation]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] }, maxFiles: 1 });

  const openEdit = (c: Contact) => {
    setEditContact(c);
    setForm({ name: c.name, mobile: c.mobile, email: c.email || '', tags: c.tags.join(', '), leadStage: c.leadStage, city: c.city || '', notes: c.notes || '' });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editContact) updateMutation.mutate({ id: editContact.id, d: form });
    else createMutation.mutate(form);
  };

  const contacts: Contact[] = data?.data || [];
  const pagination = data?.pagination;
  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-header-title">CRM <span className="text-gradient">Contacts</span></h1>
          <p className="page-header-sub">
            {pagination?.total || 0} contacts in your database
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <button onClick={() => setShowImport(true)} className="btn-secondary" style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Upload size={14} /> Import CSV
          </button>
          <button onClick={() => { setEditContact(null); setForm(defaultForm); setShowModal(true); }} className="btn-primary" style={{ fontSize: '0.8125rem' }}>
            <Plus size={14} /> Add Contact
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '320px' }}>
          <Search size={14} color="#8b8b94" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input" style={{ paddingLeft: '2.5rem', fontSize: '0.875rem' }} placeholder="Search by name, mobile, city..." />
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {['', ...LEAD_STAGES].map((s) => (
            <button key={s || 'all'} onClick={() => { setStageFilter(s); setPage(1); }}
              style={{
                fontSize: '0.75rem', padding: '0.375rem 0.75rem', borderRadius: '0.5rem',
                border: `1px solid ${stageFilter === s ? 'transparent' : '#3f3f46'}`,
                backgroundColor: stageFilter === s ? '#25D366' : 'transparent',
                color: stageFilter === s ? '#09090b' : '#a1a1aa',
                fontWeight: stageFilter === s ? 600 : 400, cursor: 'pointer',
              }}>
              {s === '' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#18181b', borderBottom: '1px solid #27272a' }}>
                {['Contact', 'Stage', 'Tags', 'City', 'Activity', 'Added', ''].map((h) => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, color: '#a1a1aa', padding: '0.75rem 1.125rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} style={{ padding: '0.75rem 1.125rem' }}>
                    <div className="loading-skeleton" style={{ height: '32px', borderRadius: '0.5rem' }} />
                  </td></tr>
                ))
              ) : contacts.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '4rem', textAlign: 'center' }}>
                  <Users size={36} color="#27272a" style={{ margin: '0 auto 0.75rem' }} />
                  <p style={{ fontSize: '0.875rem', color: '#8b8b94' }}>No contacts found</p>
                </td></tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #1f1f23', transition: 'background-color 0.1s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1a1a1d')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <td style={{ padding: '0.75rem 1.125rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{ width: '32px', height: '32px', backgroundColor: '#075E54', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#25D366' }}>{c.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e4e4e7' }}>{c.name}</p>
                          <p style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{c.mobile}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}><StageBadge stage={c.leadStage} /></td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {c.tags.slice(0, 2).map((t) => (
                          <span key={t} style={{ fontSize: '0.6875rem', padding: '2px 6px', backgroundColor: '#27272a', color: '#a1a1aa', borderRadius: '4px' }}>{t}</span>
                        ))}
                        {c.tags.length > 2 && <span style={{ fontSize: '0.6875rem', color: '#8b8b94' }}>+{c.tags.length - 2}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>{c.city || '—'}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>{c._count?.statuses || 0} status · {c._count?.aiReplies || 0} replies</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#8b8b94' }}>
                        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button onClick={() => openEdit(c)} className="btn-ghost" style={{ padding: '0.375rem', color: '#a1a1aa' }}>
                          <Edit3 size={13} />
                        </button>
                        <button onClick={() => { if (confirm('Delete this contact?')) deleteMutation.mutate(c.id); }}
                          className="btn-ghost" style={{ padding: '0.375rem', color: '#a1a1aa' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.125rem', borderTop: '1px solid #27272a' }}>
            <p style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
              Showing {((page - 1) * 15) + 1}–{Math.min(page * 15, pagination.total)} of {pagination.total}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost" style={{ padding: '0.375rem' }}>
                <ChevronLeft size={15} />
              </button>
              <span style={{ fontSize: '0.8125rem', color: '#a1a1aa' }}>{page} / {pagination.pages}</span>
              <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="btn-ghost" style={{ padding: '0.375rem' }}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: '1.5rem', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#f4f4f5' }}>{editContact ? 'Edit Contact' : 'Add Contact'}</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost" style={{ padding: '0.375rem' }}><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Full Name *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="input" style={{ fontSize: '0.875rem' }} placeholder="Rahul Sharma" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Mobile *</label>
                  <input type="text" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                    className="input" style={{ fontSize: '0.875rem' }} placeholder="+91 98765 43210" required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="input" style={{ fontSize: '0.875rem' }} placeholder="rahul@email.com" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>City</label>
                  <input type="text" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="input" style={{ fontSize: '0.875rem' }} placeholder="Mumbai" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Lead Stage</label>
                  <select value={form.leadStage} onChange={(e) => setForm((f) => ({ ...f, leadStage: e.target.value }))}
                    className="input" style={{ fontSize: '0.875rem' }}>
                    {LEAD_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Tags (comma separated)</label>
                  <input type="text" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                    className="input" style={{ fontSize: '0.875rem' }} placeholder="buyer, premium" />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem' }}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="input" style={{ fontSize: '0.875rem', minHeight: '80px', resize: 'vertical' }}
                  placeholder="Looking for 3BHK in Andheri, budget 1.5Cr..." />
              </div>
              <div style={{ display: 'flex', gap: '0.625rem', paddingTop: '0.25rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" disabled={isBusy} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {isBusy
                    ? <div style={{ width: '14px', height: '14px', border: '2px solid #09090b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    : <><Check size={14} /> {editContact ? 'Save Changes' : 'Add Contact'}</>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div onClick={() => setShowImport(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ padding: '1.5rem', width: '100%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#f4f4f5' }}>Import CSV</h2>
              <button onClick={() => setShowImport(false)} className="btn-ghost" style={{ padding: '0.375rem' }}><X size={16} /></button>
            </div>
            <div {...getRootProps()} style={{
              border: `2px dashed ${isDragActive ? '#25D366' : '#3f3f46'}`,
              borderRadius: '0.875rem', padding: '2.5rem 1.5rem', textAlign: 'center', cursor: 'pointer',
              backgroundColor: isDragActive ? 'rgba(37,211,102,0.05)' : 'transparent',
              transition: 'all 0.15s',
            }}>
              <input {...getInputProps()} />
              {importMutation.isPending ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '28px', height: '28px', border: '2px solid #25D366', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <p style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>Importing contacts...</p>
                </div>
              ) : (
                <>
                  <Upload size={36} color="#3f3f46" style={{ margin: '0 auto 0.75rem' }} />
                  <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#d4d4d8' }}>
                    {isDragActive ? 'Drop your CSV here...' : 'Drag & drop or click to upload'}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#8b8b94', marginTop: '0.375rem' }}>CSV files only</p>
                </>
              )}
            </div>
            <div style={{ marginTop: '1rem', padding: '0.875rem', backgroundColor: '#27272a', borderRadius: '0.75rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 500, color: '#a1a1aa', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <FileText size={12} /> CSV Format
              </p>
              <code style={{ fontSize: '0.6875rem', color: '#a1a1aa', fontFamily: 'monospace', lineHeight: 1.6, display: 'block' }}>
                name,mobile,tags,leadStage,city<br />
                Rahul Sharma,+919876543210,"buyer,premium",CUSTOMER,Mumbai
              </code>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
