'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Input } from '@/components/ui';
import { DepartmentOptions } from '@/lib/departments';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const LEVELS = ['100 Level','200 Level','300 Level','400 Level','500 Level','Spill Over','Postgraduate'];
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

interface Upload {
  id: number; department: string; level: string; file_name: string | null;
  row_count: number; created_at: string; uploader_name: string | null;
}

interface TimetableClass {
  id: number; day: string; start_time: string; end_time: string;
  course_code: string | null; course_title: string; venue: string | null; lecturer: string | null;
  status: 'holding' | 'cancelled';
}

interface PreviewRow {
  day?: string; start_time?: string; end_time?: string;
  course_code?: string; course_title?: string; venue?: string; lecturer?: string;
  [key: string]: string | undefined;
}

const emptyClass = (): Omit<TimetableClass, 'id'> => ({
  day: 'Monday', start_time: '', end_time: '',
  course_code: '', course_title: '', venue: '', lecturer: '', status: 'holding',
});

const CSV_TEMPLATE = `day,start_time,end_time,course_code,course_title,venue,lecturer,status\nMonday,08:00,10:00,CSC 301,Data Structures,LLR 1,Dr. Abubakar,holding\n`;

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

  // Inline editor
  const [editingUpload, setEditingUpload] = useState<Upload | null>(null);
  const [classes, setClasses] = useState<TimetableClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [editingClass, setEditingClass] = useState<TimetableClass | null>(null);
  const [addingClass, setAddingClass] = useState(false);
  const [newClass, setNewClass] = useState(emptyClass());
  const [savingClass, setSavingClass] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<number | null>(null);

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

  const fetchClasses = async (dept: string, lvl: string) => {
    setLoadingClasses(true);
    try {
      const res = await fetch(
        `${API_URL}/api/timetable/${encodeURIComponent(dept)}/${encodeURIComponent(lvl)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setClasses(data.classes || []);
    } finally { setLoadingClasses(false); }
  };

  const handleOpenEditor = (u: Upload) => {
    setEditingUpload(u);
    setEditingClass(null);
    setAddingClass(false);
    fetchClasses(u.department, u.level);
  };

  const handleSaveEdit = async () => {
    if (!editingClass || !editingUpload) return;
    setSavingClass(true);
    try {
      const res = await fetch(
        `${API_URL}/api/timetable/admin/class/${editingClass.id}`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(editingClass),
        }
      );
      if (!res.ok) throw new Error('Failed to save');
      showToast('Class updated');
      setEditingClass(null);
      fetchClasses(editingUpload.department, editingUpload.level);
    } catch { showToast('Failed to save', true); }
    finally { setSavingClass(false); }
  };

  const handleAddClass = async () => {
    if (!editingUpload || !newClass.course_title || !newClass.start_time) {
      showToast('Course title and start time are required', true); return;
    }
    setSavingClass(true);
    try {
      const res = await fetch(`${API_URL}/api/timetable/admin/class`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newClass,
          department: editingUpload.department,
          level: editingUpload.level,
        }),
      });
      if (!res.ok) throw new Error('Failed to add');
      showToast('Class added');
      setNewClass(emptyClass());
      setAddingClass(false);
      fetchClasses(editingUpload.department, editingUpload.level);
      fetchUploads();
    } catch { showToast('Failed to add class', true); }
    finally { setSavingClass(false); }
  };

  const handleDeleteClass = async (id: number) => {
    if (!editingUpload) return;
    if (!confirm('Delete this class?')) return;
    setDeletingClassId(id);
    try {
      await fetch(`${API_URL}/api/timetable/admin/class/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      showToast('Class deleted');
      fetchClasses(editingUpload.department, editingUpload.level);
      fetchUploads();
    } finally { setDeletingClassId(null); }
  };

  const handleToggleStatus = async (cls: TimetableClass) => {
    if (!editingUpload) return;
    const nextStatus = cls.status === 'cancelled' ? 'holding' : 'cancelled';
    setDeletingClassId(cls.id);
    try {
      const res = await fetch(`${API_URL}/api/timetable/admin/class/${cls.id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      showToast(nextStatus === 'cancelled' ? 'Class marked cancelled' : 'Class marked holding');
      fetchClasses(editingUpload.department, editingUpload.level);
    } catch { showToast('Failed to update status', true); }
    finally { setDeletingClassId(null); }
  };

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
      const res = await fetch(
        `${API_URL}/api/timetable/admin/upload?department=${encodeURIComponent(department)}&level=${encodeURIComponent(level)}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd }
      );
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
    if (!confirm(`Delete entire timetable for ${dept} ${lvl}?`)) return;
    setDeletingKey(key);
    try {
      await fetch(`${API_URL}/api/timetable/admin/${encodeURIComponent(dept)}/${encodeURIComponent(lvl)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      showToast('Timetable deleted');
      if (editingUpload?.department === dept && editingUpload?.level === lvl) setEditingUpload(null);
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

  const dayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  // Parse "H:MM" or "HH:MM" into minutes so 8:00 sorts before 10:00 (string
  // comparison would wrongly put "10:00" before "8:00").
  const toMinutes = (t: string) => {
    const [h, m] = (t || '').split(':').map(n => parseInt(n, 10));
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };
  const sortedClasses = [...classes].sort((a, b) => {
    const di = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    return di !== 0 ? di : toMinutes(a.start_time) - toMinutes(b.start_time);
  });

  const inputCls = 'w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-[13px] text-ink focus:border-brand-500 focus:outline-none dark:bg-[#0a0a0a] dark:border-[#333]';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-ink">Timetable Management</h1>
          <p className="mt-1 text-body-sm text-ink-secondary">Upload or edit class schedules by department and level</p>
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

      {/* Inline Editor */}
      {editingUpload && (
        <Card>
          <CardHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Editing: {editingUpload.department} — {editingUpload.level}</CardTitle>
                <p className="mt-0.5 text-body-sm text-ink-muted">{classes.length} classes</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { setAddingClass(true); setEditingClass(null); }}>+ Add Class</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingUpload(null)}>✕ Close</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Add new class form */}
            {addingClass && (
              <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 dark:bg-brand-950/20 space-y-3">
                <p className="text-label font-semibold text-brand-700 dark:text-brand-300">New Class</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Day</label>
                    <select value={newClass.day} onChange={e => setNewClass(p => ({...p, day: e.target.value}))} className={inputCls}>
                      {DAYS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Start</label>
                    <input type="time" value={newClass.start_time} onChange={e => setNewClass(p => ({...p, start_time: e.target.value}))} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-ink-muted">End</label>
                    <input type="time" value={newClass.end_time} onChange={e => setNewClass(p => ({...p, end_time: e.target.value}))} className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Course Code</label>
                    <input value={newClass.course_code || ''} onChange={e => setNewClass(p => ({...p, course_code: e.target.value}))} placeholder="e.g. CSC 301" className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Course Title *</label>
                    <input value={newClass.course_title} onChange={e => setNewClass(p => ({...p, course_title: e.target.value}))} placeholder="e.g. Data Structures" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Venue</label>
                    <input value={newClass.venue || ''} onChange={e => setNewClass(p => ({...p, venue: e.target.value}))} placeholder="e.g. LLR 1" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Lecturer</label>
                    <input value={newClass.lecturer || ''} onChange={e => setNewClass(p => ({...p, lecturer: e.target.value}))} placeholder="e.g. Dr. Musa" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-ink-muted">Status</label>
                    <select value={newClass.status} onChange={e => setNewClass(p => ({...p, status: e.target.value as TimetableClass['status']}))} className={inputCls}>
                      <option value="holding">Holding</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddClass} loading={savingClass}>Save Class</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingClass(false); setNewClass(emptyClass()); }}>Cancel</Button>
                </div>
              </div>
            )}

            {loadingClasses ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : sortedClasses.length === 0 ? (
              <p className="py-6 text-center text-body-sm text-ink-muted">No classes yet. Click &quot;Add Class&quot; to get started.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b border-border bg-surface-muted">
                    <tr>
                      {['Day','Time','Code','Title','Venue','Lecturer','Status',''].map(h => (
                        <th key={h} className="px-3 py-2.5 font-semibold text-ink-secondary whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sortedClasses.map(cls => (
                      <tr key={cls.id} className={cn('transition', editingClass?.id === cls.id ? 'bg-brand-50 dark:bg-brand-950/20' : 'hover:bg-surface-muted')}>
                        {editingClass?.id === cls.id ? (
                          <>
                            <td className="px-2 py-2">
                              <select value={editingClass.day} onChange={e => setEditingClass(p => p ? {...p, day: e.target.value} : p)} className={inputCls}>
                                {DAYS.map(d => <option key={d}>{d}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex gap-1">
                                <input type="time" value={editingClass.start_time} onChange={e => setEditingClass(p => p ? {...p, start_time: e.target.value} : p)} className={cn(inputCls, 'w-24')} />
                                <input type="time" value={editingClass.end_time} onChange={e => setEditingClass(p => p ? {...p, end_time: e.target.value} : p)} className={cn(inputCls, 'w-24')} />
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <input value={editingClass.course_code || ''} onChange={e => setEditingClass(p => p ? {...p, course_code: e.target.value} : p)} className={cn(inputCls, 'w-24')} />
                            </td>
                            <td className="px-2 py-2">
                              <input value={editingClass.course_title} onChange={e => setEditingClass(p => p ? {...p, course_title: e.target.value} : p)} className={cn(inputCls, 'w-40')} />
                            </td>
                            <td className="px-2 py-2">
                              <input value={editingClass.venue || ''} onChange={e => setEditingClass(p => p ? {...p, venue: e.target.value} : p)} className={cn(inputCls, 'w-24')} />
                            </td>
                            <td className="px-2 py-2">
                              <input value={editingClass.lecturer || ''} onChange={e => setEditingClass(p => p ? {...p, lecturer: e.target.value} : p)} className={cn(inputCls, 'w-32')} />
                            </td>
                            <td className="px-2 py-2">
                              <select value={editingClass.status} onChange={e => setEditingClass(p => p ? {...p, status: e.target.value as TimetableClass['status']} : p)} className={cn(inputCls, 'w-28')}>
                                <option value="holding">Holding</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex gap-1">
                                <Button size="sm" onClick={handleSaveEdit} loading={savingClass}>Save</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingClass(null)}>✕</Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2.5 font-medium text-ink whitespace-nowrap">{cls.day}</td>
                            <td className="px-3 py-2.5 text-ink-secondary whitespace-nowrap">{cls.start_time} – {cls.end_time}</td>
                            <td className="px-3 py-2.5 text-ink-muted">{cls.course_code || '—'}</td>
                            <td className="px-3 py-2.5 text-ink">{cls.course_title}</td>
                            <td className="px-3 py-2.5 text-ink-muted">{cls.venue || '—'}</td>
                            <td className="px-3 py-2.5 text-ink-muted">{cls.lecturer || '—'}</td>
                            <td className="px-3 py-2.5">
                              <button onClick={() => handleToggleStatus(cls)} disabled={deletingClassId === cls.id}
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[11px] font-semibold transition',
                                  cls.status === 'cancelled'
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
                                )}>
                                {cls.status === 'cancelled' ? 'Cancelled' : 'Holding'}
                              </button>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex gap-1">
                                <button onClick={() => { setEditingClass({...cls}); setAddingClass(false); }}
                                  className="rounded-lg px-2 py-1 text-[12px] font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30">
                                  Edit
                                </button>
                                <button onClick={() => handleDeleteClass(cls.id)}
                                  disabled={deletingClassId === cls.id}
                                  className="rounded-lg px-2 py-1 text-[12px] font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                                  {deletingClassId === cls.id ? '…' : 'Del'}
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload form */}
      <Card>
        <CardHeader className="p-6 pb-0"><CardTitle>Upload Timetable (CSV)</CardTitle></CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-label text-ink-secondary">Department</label>
              <select value={department} onChange={e => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#0a0a0a] dark:border-[#333]">
                <option value="">Select department</option>
                <DepartmentOptions />
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-medium text-brand-700">{selectedFile.name}</p>
                  {previewTotal > 0 && <p className="text-caption text-brand-500">{previewTotal} rows detected</p>}
                </div>
                <button type="button" onClick={() => { setSelectedFile(null); setPreview([]); setPreviewTotal(0); }}
                  className="shrink-0 text-brand-400 hover:text-brand-700">✕</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex h-24 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-ink-muted transition hover:border-brand-400 hover:text-brand-600">
                <p className="text-body-sm font-medium">Click to select CSV</p>
              </button>
            )}
          </div>

          {previewing && <div className="py-4 text-center text-body-sm text-ink-muted">Parsing CSV…</div>}
          {preview.length > 0 && (
            <div>
              <p className="mb-2 text-caption font-semibold text-ink-secondary">Preview ({preview.length} of {previewTotal} rows)</p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-caption">
                  <thead className="border-b border-border bg-surface-muted">
                    <tr>{['day','start_time','end_time','course_code','course_title','venue','lecturer','status'].map(h => <th key={h} className="px-3 py-2 font-semibold text-ink capitalize">{h.replace('_',' ')}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.map((row, i) => (
                      <tr key={i}>{['day','start_time','end_time','course_code','course_title','venue','lecturer','status'].map(h => <td key={h} className="px-3 py-2 text-ink-secondary">{row[h] || '—'}</td>)}</tr>
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

      {/* Uploaded timetables list */}
      <Card>
        <CardHeader className="p-6 pb-0"><CardTitle>Uploaded Timetables</CardTitle></CardHeader>
        <CardContent className="p-0 pt-4">
          {loadingUploads ? (
            <div className="px-6 py-2 space-y-3">
              {[1,2,3].map(i => <div key={i} className="flex gap-4"><Skeleton className="h-4 w-48"/><Skeleton className="h-4 w-24"/></div>)}
            </div>
          ) : uploads.length === 0 ? (
            <p className="px-6 py-8 text-center text-body-sm text-ink-muted">No timetables uploaded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {uploads.map(u => {
                const key = `${u.department}||${u.level}`;
                const isEditing = editingUpload?.department === u.department && editingUpload?.level === u.level;
                return (
                  <div key={u.id} className={cn('flex flex-wrap items-center gap-4 px-5 py-4 transition', isEditing && 'bg-brand-50 dark:bg-brand-950/20')}>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{u.department}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">{u.level}</span>
                        <span className="text-caption text-ink-muted">{u.row_count} classes</span>
                        {u.uploader_name && <span className="text-caption text-ink-muted">by {u.uploader_name}</span>}
                        <span className="text-caption text-ink-muted">{new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => isEditing ? setEditingUpload(null) : handleOpenEditor(u)}>
                        {isEditing ? 'Close Editor' : 'Edit Classes'}
                      </Button>
                      <Button variant="outline" size="sm"
                        disabled={deletingKey === key} loading={deletingKey === key}
                        onClick={() => handleDelete(u.department, u.level)}
                        className="border-red-200 text-red-600 hover:bg-red-50">
                        Delete
                      </Button>
                    </div>
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
