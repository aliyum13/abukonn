'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { DepartmentOptions, LEVELS } from '@/lib/departments';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TYPES = ['past_question','lecture_note','textbook','other'];
const TYPE_LABELS: Record<string,string> = { past_question:'Past Question', lecture_note:'Lecture Note', textbook:'Textbook', other:'Other' };
const TYPE_COLORS: Record<string,string> = { past_question:'bg-red-100 text-red-700', lecture_note:'bg-blue-100 text-blue-700', textbook:'bg-purple-100 text-purple-700', other:'bg-gray-100 text-gray-700' };

interface Material { id:number; title:string; type:string; department:string|null; level:string|null; course_code:string|null; file_name:string|null; file_size:number|null; download_count:number; created_at:string; }

function formatSize(b:number|null){if(!b)return'';if(b<1024*1024)return`${(b/1024).toFixed(0)} KB`;return`${(b/(1024*1024)).toFixed(1)} MB`;}

export default function AdminLibraryPage() {
  const { token } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number|null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('past_question');
  const [faculty, setFaculty] = useState('');
  const [dept, setDept] = useState('');
  const [level, setLevel] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [file, setFile] = useState<File|null>(null);

  const showToast = (msg:string,err=false)=>{ setToast(msg); setToastError(err); setTimeout(()=>setToast(''),4000); };

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/library/admin/all`,{headers:{Authorization:`Bearer ${token}`}});
      const data = await res.json();
      setMaterials(data.materials||[]);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ if(token) fetchMaterials(); },[token]);

  const handleUpload = async () => {
    if(!title||!type||!file){ showToast('Title, type and file are required',true); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file',file);
      fd.append('title',title);
      fd.append('description',description);
      fd.append('type',type);
      fd.append('faculty',faculty);
      fd.append('department',dept);
      fd.append('level',level);
      fd.append('course_code',courseCode);
      fd.append('course_title',courseTitle);
      const res = await fetch(`${API_URL}/api/library/admin/upload`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd});
      const data = await res.json();
      if(!res.ok) throw new Error(data.message||'Upload failed');
      showToast('Material uploaded successfully');
      setTitle(''); setDescription(''); setType('past_question'); setFaculty(''); setDept(''); setLevel(''); setCourseCode(''); setCourseTitle(''); setFile(null);
      if(fileRef.current) fileRef.current.value='';
      fetchMaterials();
    } catch(err){ showToast(err instanceof Error?err.message:'Upload failed',true); }
    finally { setUploading(false); }
  };

  const handleDelete = async (id:number) => {
    if(!confirm('Delete this material?')) return;
    setDeletingId(id);
    try {
      await fetch(`${API_URL}/api/library/admin/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
      showToast('Deleted');
      fetchMaterials();
    } finally { setDeletingId(null); }
  };

  const inputCls = 'w-full rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#111] dark:border-[#333]';

  return (
    <div className="space-y-6">
      <div><h1 className="text-display-sm text-ink">Library Management</h1><p className="mt-1 text-body-sm text-ink-secondary">Upload study materials for ABU students</p></div>
      {toast && <div className={cn('rounded-xl border px-4 py-3 text-body-sm',toastError?'border-red-200 bg-red-50 text-red-600':'border-brand-200 bg-brand-50 text-brand-700')}>{toast}</div>}

      <Card>
        <CardHeader className="p-6 pb-0"><CardTitle>Upload Material</CardTitle></CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="mb-1.5 block text-label text-ink-secondary">Title *</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. CSC 301 Past Questions 2023" className={inputCls}/></div>
            <div><label className="mb-1.5 block text-label text-ink-secondary">Type *</label>
              <select value={type} onChange={e=>setType(e.target.value)} className={inputCls}>
                {TYPES.map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div><label className="mb-1.5 block text-label text-ink-secondary">Department</label>
              <select value={dept} onChange={e=>setDept(e.target.value)} className={inputCls}>
                <option value="">Select department</option>
                <DepartmentOptions />
              </select>
            </div>
            <div><label className="mb-1.5 block text-label text-ink-secondary">Level</label>
              <select value={level} onChange={e=>setLevel(e.target.value)} className={inputCls}>
                <option value="">Select level</option>
                {LEVELS.map(l=><option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div><label className="mb-1.5 block text-label text-ink-secondary">Course Code</label><input value={courseCode} onChange={e=>setCourseCode(e.target.value)} placeholder="e.g. CSC 301" className={inputCls}/></div>
            <div><label className="mb-1.5 block text-label text-ink-secondary">Course Title</label><input value={courseTitle} onChange={e=>setCourseTitle(e.target.value)} placeholder="e.g. Data Structures" className={inputCls}/></div>
            <div className="sm:col-span-2"><label className="mb-1.5 block text-label text-ink-secondary">Description</label><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Brief description of the material..." rows={2} className={`${inputCls} resize-none`}/></div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-label text-ink-secondary">PDF File * (max 20MB)</label>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={e=>setFile(e.target.files?.[0]||null)} className="hidden"/>
              {file ? (
                <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                  <p className="flex-1 truncate text-body-sm font-medium text-brand-700">{file.name}</p>
                  <button onClick={()=>{setFile(null);if(fileRef.current)fileRef.current.value='';}} className="text-brand-400 hover:text-brand-700">✕</button>
                </div>
              ) : (
                <button onClick={()=>fileRef.current?.click()} className="flex h-20 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border text-ink-muted hover:border-brand-400 hover:text-brand-600 transition">
                  <p className="text-body-sm font-medium">Click to select file</p>
                  <p className="text-caption mt-0.5">PDF, DOC, DOCX, PPT, PPTX</p>
                </button>
              )}
            </div>
          </div>
          <Button onClick={handleUpload} loading={uploading} disabled={!title||!type||!file}>Upload Material</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-6 pb-0"><CardTitle>Uploaded Materials ({materials.length})</CardTitle></CardHeader>
        <CardContent className="p-0 pt-4">
          {loading ? (
            <div className="px-6 space-y-3 py-2">{[1,2,3].map(i=><Skeleton key={i} className="h-12 w-full"/>)}</div>
          ) : materials.length===0 ? (
            <p className="px-6 py-8 text-center text-body-sm text-ink-muted">No materials uploaded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {materials.map(m=>(
                <div key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink truncate">{m.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold',TYPE_COLORS[m.type]||TYPE_COLORS.other)}>{TYPE_LABELS[m.type]||m.type}</span>
                      {m.department&&<span className="text-caption text-ink-muted">{m.department}</span>}
                      {m.level&&<span className="text-caption text-ink-muted">{m.level}</span>}
                      {m.course_code&&<span className="text-caption text-ink-muted">{m.course_code}</span>}
                      <span className="text-caption text-ink-muted">{formatSize(m.file_size)}</span>
                      <span className="text-caption text-ink-muted">⬇ {m.download_count}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" disabled={deletingId===m.id} loading={deletingId===m.id} onClick={()=>handleDelete(m.id)} className="border-red-200 text-red-600 hover:bg-red-50">Delete</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
