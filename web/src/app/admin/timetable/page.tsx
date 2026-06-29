'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const DEPARTMENTS = [
  'Computer Science','Software Engineering','Information Technology',
  'Electrical Engineering','Civil Engineering','Mechanical Engineering',
  'Medicine & Surgery','Law','Economics','Accounting',
  'Mass Communication','Political Science','Sociology',
  'Mathematics','Physics','Chemistry','Biochemistry',
  'Microbiology','Pharmacy','Nursing Science',
];
const LEVELS = ['100 Level','200 Level','300 Level','400 Level','500 Level','Spill Over','Postgraduate'];

interface Upload {
  id: number; department: string; level: string; file_name: string | null;
  row_count: number; created_at: string; uploader_name: string | null;
}

interface PreviewRow {
  day?: string; start_time?: string; end_time?: string;
  course_code?: string; course_title?: string; venue?: string; lecturer?: string;
  [key: string]: string | undefined;
}

const CSV_TEMPLATE = `day,start_time,end_time,course_code,course_title,venue,lecturer
Monday,08:00,10:00,CSC 301,Data Structures,LLR 1,Dr. Abubakar
Monday,10:00,12:00,CSC 303,Computer Networks,LLR 2,Dr. Musa
Tuesday,08:00,10:00,CSC 305,Operating Systems,LLR 3,Dr. Ibrahim
`;

export default function AdminTimetablePage() {
  const { token } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);

  // Upload form
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingKey, setDeletingKey] = useState('');

  const showToast = (msg: string, err = false) => {
    setToast(msg); setToastError(err);
    setTimeout(() => setToast(''), 4000);
  };

  const fetchUploads = async () => {
    if (!token) return;
    setLoadingUploads(true);
    try {
      const res = await fetch(`${API_URL}/api/timetable/admin/uploads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUploads(data.uploads || []);
    } finally { setLoadingUploads(false); }
  };

  useEffect(() => { fetchUploads(); }, [token]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview([]);
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append('csv', file);
      const res = await fetch(`${API_URL}/api/timetable/admin/preview`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json() as { preview?: PreviewRow[]; total?: number };
      setPreview(data.preview || []);
      setPreviewTotal(data.total || 0);
    } finally { setPreviewing(false); e.target.value = ''; }
  };

  const handleUpload = async () => {
    if (!selectedFile || !department || !level) {
      showToast('Select department, level and CSV file first', true); return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('csv', selectedFile);
      const res = await fetch(`${API_URL}/api/timetable/admin/upload?department=${encodeURIComponent(department)}&level=${encodeURIComponent(level)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      showToast(data.message || 'Uploaded successfully');
      setSelectedFile(null); setPreview([]); setPreviewTotal(0);
      fetchUploads();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', true);
    } finally { setUploading(false); }
  };

  const handleDelete = async (dept: string, lvl: string) => {
    const key = `${dept}||${lvl}`;
    if (!confirm(`Delete timetable for ${dept} ${lvl}?`)) return;
    setDeletingKey(key);
    try {
      await fetch(`${API_URL}/api/timetable/admin/${encodeURIComponent(dept)}/${encodeURIComponent(lvl)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      showToast('Timetable deleted');
      fetchUploads();
    } finally { setDeletingKey(''); }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'timetable_template.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const PREVIEW_HEADERS = ['day','start_time','end_time','course_code','course_title','venue','lecturer'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-ink">Timetable Management</h1>
          <p className="mt-1 text-body-sm text-ink-secondary">Upload class schedules by department and level</p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download Template
        </Button>
      </div>

      {toast && (
        <div className={cn('rounded-xl border px-4 py-3 text-body-sm', toastError ? 'border-red-200 bg-red-50 text-red-600' : 'border-brand-200 bg-brand-50 text-brand-700')}>
          {toast}
        </div>
      )}

      {/* Upload form */}
      <Card>
        <CardHeader className="p-6 pb-0"><CardTitle>Upload Timetable</CardTitle></CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-label text-ink-secondary">Department</label>
              <select value={department} onChange={e => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#0a0a0a] dark:border-[#333]">
                <option value="">Select department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-label text-ink-secondary">Level</label>
              <select value={level} onChange={e => setLevel(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#0a0a0a] dark:border-[#333]">
                <option value="">Select level</option>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-label text-ink-secondary">CSV File</label>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileSelect} className="hidden" />
            {selectedFile ? (
              <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                <svg className="h-5 w-5 text-brand-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium text-brand-700">{selectedFile.name}</p>
                  {previewTotal > 0 && <p className="text-caption text-brand-500">{previewTotal} rows detected</p>}
                </div>
                <button type="button" onClick={() => { setSelectedFile(null); setPreview([]); setPreviewTotal(0); }}
                  className="shrink-0 text-brand-400 hover:text-brand-700">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex h-28 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-ink-muted transition hover:border-brand-400 hover:text-brand-600">
                <svg className="mb-1.5 h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-body-sm font-medium">Click to select CSV</p>
              </button>
            )}
          </div>

          {/* Preview */}
          {previewing && <div className="py-4 text-center text-body-sm text-ink-muted">Parsing CSV…</div>}
          {preview.length > 0 && (
            <div>
              <p className="mb-2 text-caption font-semibold text-ink-secondary">Preview (first {preview.length} of {previewTotal} rows)</p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-caption">
                  <thead className="border-b border-border bg-surface-muted">
                    <tr>{PREVIEW_HEADERS.map(h => <th key={h} className="px-3 py-2 font-semibold text-ink capitalize">{h.replace('_', ' ')}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {PREVIEW_HEADERS.map(h => <td key={h} className="px-3 py-2 text-ink-secondary">{row[h] || '—'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button onClick={handleUpload} loading={uploading} disabled={!selectedFile || !department || !level}>
            Upload Timetable
          </Button>
        </CardContent>
      </Card>

      {/* Uploaded timetables */}
      <Card>
        <CardHeader className="p-6 pb-0"><CardTitle>Uploaded Timetables</CardTitle></CardHeader>
        <CardContent className="p-0 pt-4">
          {loadingUploads ? (
            <div className="px-6 py-2 space-y-3">
              {[1,2,3].map(i => <div key={i} className="flex gap-4"><Skeleton className="h-4 w-48"/><Skeleton className="h-4 w-24"/><Skeleton className="h-4 w-16"/></div>)}
            </div>
          ) : uploads.length === 0 ? (
            <p className="px-6 py-8 text-center text-body-sm text-ink-muted">No timetables uploaded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {uploads.map(u => {
                const key = `${u.department}||${u.level}`;
                return (
                  <div key={u.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{u.department}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{u.level}</span>
                        <span className="text-caption text-ink-muted">{u.row_count} classes</span>
                        {u.uploader_name && <span className="text-caption text-ink-muted">by {u.uploader_name}</span>}
                        <span className="text-caption text-ink-muted">{new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm"
                      disabled={deletingKey === key}
                      loading={deletingKey === key}
                      onClick={() => handleDelete(u.department, u.level)}
                      className="border-red-200 text-red-600 hover:bg-red-50">
                      Delete
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
