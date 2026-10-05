'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { DepartmentOptions, LEVELS, DEPARTMENT_GROUPS } from '@/lib/departments';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Must match backend/src/middleware/uploadAny.js's MAX_FILE_SIZE exactly --
// otherwise this check either blocks files the server would accept, or lets
// through files the server rejects.
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const TYPES = ['past_question', 'lecture_note', 'textbook', 'other'];
const TYPE_LABELS: Record<string, string> = {
  past_question: 'Past Question', lecture_note: 'Lecture Note', textbook: 'Textbook', other: 'Other',
};

const inputCls = 'w-full rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#111] dark:border-[#333]';

// The one Library upload form. Used by the admin panel's Library page and by
// the Library Contributor modal on the public Library page, so both go through
// the same fields, limits and endpoint (POST /api/library/upload, which is
// gated on the server to full admins and Library Contributors).
export function LibraryUploadForm({ token, onUploaded }: { token: string | null; onUploaded?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('past_question');
  const [faculty, setFaculty] = useState('');
  const [dept, setDept] = useState('');
  const [level, setLevel] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleUpload = async () => {
    if (!title || !type || !file) { setMessage({ text: 'Title, type and file are required', error: true }); return; }
    if (file.size > MAX_FILE_SIZE) { setMessage({ text: `File exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`, error: true }); return; }
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title);
      fd.append('description', description);
      fd.append('type', type);
      fd.append('faculty', faculty);
      fd.append('department', dept);
      fd.append('level', level);
      fd.append('course_code', courseCode);
      fd.append('course_title', courseTitle);
      const res = await fetch(`${API_URL}/api/library/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      setMessage({ text: 'Material uploaded successfully', error: false });
      setTitle(''); setDescription(''); setType('past_question'); setFaculty(''); setDept(''); setLevel(''); setCourseCode(''); setCourseTitle(''); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      onUploaded?.();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Upload failed', error: true });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {message && (
        <div className={cn('rounded-xl border px-4 py-3 text-body-sm', message.error ? 'border-red-200 bg-red-50 text-red-600' : 'border-brand-200 bg-brand-50 text-brand-700')}>
          {message.text}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="mb-1.5 block text-label text-ink-secondary">Title *</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. CSC 301 Past Questions 2023" className={inputCls} /></div>
        <div><label className="mb-1.5 block text-label text-ink-secondary">Type *</label>
          <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
            {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div><label className="mb-1.5 block text-label text-ink-secondary">Department</label>
          <select
            value={dept}
            onChange={e => {
              const d = e.target.value;
              setDept(d);
              // Faculty is implied by the department -- derive it so materials
              // are actually filterable by faculty (it was previously saved blank).
              const g = DEPARTMENT_GROUPS.find(gr => gr.departments.includes(d));
              setFaculty(g ? g.faculty : '');
            }}
            className={inputCls}
          >
            <option value="">Select department</option>
            <DepartmentOptions />
          </select>
        </div>
        <div><label className="mb-1.5 block text-label text-ink-secondary">Level</label>
          <select value={level} onChange={e => setLevel(e.target.value)} className={inputCls}>
            <option value="">Select level</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div><label className="mb-1.5 block text-label text-ink-secondary">Course Code</label><input value={courseCode} onChange={e => setCourseCode(e.target.value)} placeholder="e.g. CSC 301" className={inputCls} /></div>
        <div><label className="mb-1.5 block text-label text-ink-secondary">Course Title</label><input value={courseTitle} onChange={e => setCourseTitle(e.target.value)} placeholder="e.g. Data Structures" className={inputCls} /></div>
        <div className="sm:col-span-2"><label className="mb-1.5 block text-label text-ink-secondary">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of the material..." rows={2} className={`${inputCls} resize-none`} /></div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-label text-ink-secondary">File * (max 25MB)</label>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
              <p className="flex-1 truncate text-body-sm font-medium text-brand-700">{file.name}</p>
              <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-brand-400 hover:text-brand-700">✕</button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-20 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-ink-muted hover:border-brand-400 hover:text-brand-600 transition">
              <p className="text-body-sm font-medium">Click to select file</p>
              <p className="text-caption mt-0.5">PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX</p>
            </button>
          )}
        </div>
      </div>
      <Button onClick={handleUpload} loading={uploading} disabled={!title || !type || !file}>Upload Material</Button>
    </div>
  );
}
