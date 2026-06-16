'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface WhitelistEntry {
  matric_number: string;
  added_at: string;
}

function parseCSVToMatrics(csvText: string): string[] {
  return csvText
    .split(/\r?\n/)
    .map((l) => l.split(',')[0].trim().toUpperCase())
    .filter((m) => m.length > 2 && m !== 'MATRIC_NUMBER' && m !== 'MATRIC' && m !== 'MATRIC NUMBER');
}

export default function AdminWhitelistPage() {
  const { token } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [preview, setPreview] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 4000);
  };

  const fetchWhitelist = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/whitelist?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCount(data.count ?? 0);
      setEntries(data.entries || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWhitelist(); }, [token]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setPreview(parseCSVToMatrics(text).slice(0, 20));
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !token) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('csv', selectedFile);
      const res = await fetch(`${API_URL}/api/admin/whitelist/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast(data.message, 'success');
      setSelectedFile(null);
      setPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchWhitelist();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    if (!token || !confirm(`Clear all ${count} whitelisted matric numbers? Students won't lose their accounts, but new registrations using those matrics won't be restricted.`)) return;
    setClearing(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/whitelist`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      showToast(data.message || 'Whitelist cleared', 'success');
      fetchWhitelist();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm text-ink">Matric Whitelist</h1>
        <p className="mt-1 text-body-sm text-ink-secondary">
          Upload valid ABU matric numbers to control who can register.
        </p>
      </div>

      {toast && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-body-sm',
            toastType === 'success'
              ? 'border-brand-200 bg-brand-50 text-brand-700'
              : 'border-red-200 bg-red-50 text-red-600'
          )}
        >
          {toast}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload panel */}
        <Card>
          <CardHeader className="p-6 pb-0">
            <CardTitle>Upload CSV</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-body-sm text-ink-secondary">
              Upload a CSV file with one matric number per row (or per first column).
              Duplicates are automatically skipped.
            </p>

            <div className="mt-4 rounded-xl border border-border bg-surface-muted p-4">
              <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-ink-muted">
                Expected format
              </p>
              <pre className="font-mono text-caption text-ink-secondary">
                {`MATRIC_NUMBER\nUG20/CS/1001\nUG21/EE/2034\nUG22/MB/5012`}
              </pre>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                  <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-brand-700">{selectedFile.name}</p>
                    <p className="text-caption text-brand-500">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); setPreview([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="shrink-0 text-brand-400 hover:text-brand-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {preview.length > 0 && (
                  <div>
                    <p className="mb-2 text-caption font-semibold text-ink-secondary">
                      Preview ({preview.length} matrics shown)
                    </p>
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-surface-muted p-3">
                      {preview.map((m) => (
                        <p key={m} className="font-mono text-caption text-ink-secondary">{m}</p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button onClick={handleUpload} loading={uploading}>
                    Upload & Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setSelectedFile(null); setPreview([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'mt-4 flex h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border',
                  'text-ink-muted transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600'
                )}
              >
                <svg className="mb-2 h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-body-sm font-medium">Click to select CSV file</p>
                <p className="mt-0.5 text-caption">Supports .csv files only</p>
              </button>
            )}
          </CardContent>
        </Card>

        {/* Stats + danger */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  {loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-3xl font-bold text-ink">{count?.toLocaleString() ?? '—'}</p>
                  )}
                  <p className="text-body-sm text-ink-secondary">Whitelisted matric numbers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-red-700">Danger Zone</h3>
              <p className="mt-1.5 text-body-sm text-ink-secondary">
                Clearing the whitelist removes all entries. Existing registered students are not affected.
              </p>
              <Button
                variant="danger"
                size="sm"
                className="mt-4"
                loading={clearing}
                disabled={!count}
                onClick={handleClear}
              >
                Clear all {count ? `(${count})` : ''} entries
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Current entries table */}
      {count !== null && count > 0 && (
        <Card>
          <CardHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle>Whitelisted Matrics</CardTitle>
              <Badge variant="brand">{count} total</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted">
                    <th className="px-5 py-3 font-semibold text-ink">#</th>
                    <th className="px-5 py-3 font-semibold text-ink">Matric Number</th>
                    <th className="px-5 py-3 font-semibold text-ink">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="px-5 py-3"><Skeleton className="h-4 w-8" /></td>
                          <td className="px-5 py-3"><Skeleton className="h-4 w-36" /></td>
                          <td className="px-5 py-3"><Skeleton className="h-4 w-24" /></td>
                        </tr>
                      ))
                    : entries.map((entry, idx) => (
                        <tr key={entry.matric_number} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                          <td className="px-5 py-3 text-ink-muted">{idx + 1}</td>
                          <td className="px-5 py-3 font-mono text-ink">{entry.matric_number}</td>
                          <td className="px-5 py-3 text-ink-secondary">{formatDate(entry.added_at)}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            {count > 100 && (
              <p className="border-t border-border px-5 py-3 text-caption text-ink-muted">
                Showing first 100 of {count} entries
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
