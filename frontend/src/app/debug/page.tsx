'use client';
import { useState, useEffect } from 'react';

export default function DebugPage() {
  const [results, setResults] = useState<Record<string, string>>({});

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

    // Test health
    fetch(`${apiUrl}/health`)
      .then(r => r.json())
      .then(d => setResults(prev => ({ ...prev, health: JSON.stringify(d, null, 2) })))
      .catch(e => setResults(prev => ({ ...prev, health: '❌ ' + e.message })));

    // Test CORS
    fetch(`${apiUrl}/health`, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
      .then(() => setResults(prev => ({ ...prev, cors: '✅ CORS OK' })))
      .catch(e => setResults(prev => ({ ...prev, cors: '❌ CORS BLOCKED: ' + e.message })));
  }, []);

  const box = (label: string, val: string) => (
    <div key={label} style={{ marginBottom: '1rem' }}>
      <p style={{ color: '#a1a1aa', fontSize: '0.75rem', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      <pre style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '0.75rem', padding: '0.875rem', color: '#d4d4d8', fontSize: '0.8125rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {val || 'Checking…'}
      </pre>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#09090b', padding: '2rem', fontFamily: 'system-ui', color: '#f4f4f5' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#25D366', marginBottom: '0.375rem' }}>🔧 Debug Panel</h1>
      <p style={{ color: '#a1a1aa', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        API: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'} ·
        Frontend: {typeof window !== 'undefined' ? window.location.origin : ''}
      </p>

      {box('Backend Health', results.health)}
      {box('CORS Check', results.cors)}

      <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
        <p style={{ color: '#a1a1aa', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Fix Steps</p>
        <ol style={{ color: '#a1a1aa', fontSize: '0.8125rem', paddingLeft: '1.25rem', lineHeight: 2.2 }}>
          <li>Run: <code style={{ color: '#25D366', background: '#27272a', padding: '1px 6px', borderRadius: '4px' }}>taskkill /F /IM node.exe</code> in cmd, then restart backend</li>
          <li>Backend: <code style={{ color: '#25D366', background: '#27272a', padding: '1px 6px', borderRadius: '4px' }}>cd backend && npx prisma migrate dev --name init && npm run dev</code></li>
          <li>Check <code style={{ color: '#25D366', background: '#27272a', padding: '1px 6px', borderRadius: '4px' }}>backend\.env</code> → DATABASE_URL correct?</li>
          <li>PostgreSQL running? Open Services → check postgresql-x64-17</li>
          <li>Frontend .env.local has <code style={{ color: '#25D366', background: '#27272a', padding: '1px 6px', borderRadius: '4px' }}>NEXT_PUBLIC_API_URL=http://localhost:4000</code></li>
        </ol>
      </div>

      <a href="/auth/login" style={{ color: '#25D366', fontSize: '0.875rem', textDecoration: 'none' }}>← Back to Login</a>
    </div>
  );
}
