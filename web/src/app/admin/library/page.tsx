'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { LibraryUploadForm } from '@/components/library/LibraryUploadForm';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const TYPE_LABELS: Record<string,string> = { past_question:'Past Question', lecture_note:'Lecture Note', textbook:'Textbook', other:'Other' };
const TYPE_COLORS: Record<string,string> = { past_question:'bg-red-100 text-red-700', lecture_note:'bg-blue-100 text-blue-700', textbook:'bg-purple-100 text-purple-700', other:'bg-gray-100 text-gray-700' };

interface Material { id:number; title:string; type:string; department:string|null; level:string|null; course_code:string|null; file_name:string|null; file_size:number|null; download_count:number; created_at:string; }

function formatSize(b:number|null){if(!b)return'';if(b<1024*1024)return`${(b/1024).toFixed(0)} KB`;return`${(b/(1024*1024)).toFixed(1)} MB`;}

export default function AdminLibraryPage() {
  const { token } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  const [deletingId, setDeletingId] = useState<number|null>(null);

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

  const handleDelete = async (id:number) => {
    if(!confirm('Delete this material?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_URL}/api/library/admin/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}});
      const data = await res.json().catch(()=>({}));
      if(!res.ok){ showToast(data.message||'Delete failed',true); return; }
      showToast('Deleted');
      fetchMaterials();
    } finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-display-sm text-ink">Library Management</h1><p className="mt-1 text-body-sm text-ink-secondary">Upload study materials for ABU students</p></div>
      {toast && <div className={cn('rounded-xl border px-4 py-3 text-body-sm',toastError?'border-red-200 bg-red-50 text-red-600':'border-brand-200 bg-brand-50 text-brand-700')}>{toast}</div>}

      <Card>
        <CardHeader className="p-6 pb-0"><CardTitle>Upload Material</CardTitle></CardHeader>
        <CardContent className="p-6">
          <LibraryUploadForm token={token} onUploaded={fetchMaterials} />
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
