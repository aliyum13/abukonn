'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, CardContent, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const TYPES = [
  { value: 'all', label: 'All Materials' },
  { value: 'past_question', label: 'Past Questions' },
  { value: 'lecture_note', label: 'Lecture Notes' },
  { value: 'textbook', label: 'Textbooks' },
  { value: 'other', label: 'Other' },
];

const DEPARTMENTS = [
  'Computer Science','Software Engineering','Information Technology',
  'Electrical Engineering','Civil Engineering','Mechanical Engineering',
  'Medicine & Surgery','Law','Economics','Accounting',
  'Mass Communication','Political Science','Sociology',
  'Mathematics','Physics','Chemistry','Biochemistry',
  'Microbiology','Pharmacy','Nursing Science',
];
const LEVELS = ['100 Level','200 Level','300 Level','400 Level','500 Level','Postgraduate'];

const TYPE_COLORS: Record<string, string> = {
  past_question: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  lecture_note: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  textbook: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const TYPE_LABELS: Record<string, string> = {
  past_question: 'Past Question',
  lecture_note: 'Lecture Note',
  textbook: 'Textbook',
  other: 'Other',
};

interface Material {
  id: number; title: string; description: string | null; type: string;
  faculty: string | null; department: string | null; level: string | null;
  course_code: string | null; course_title: string | null;
  file_url: string; file_name: string | null; file_size: number | null;
  download_count: number; created_at: string; uploader_name: string | null;
}

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LibraryPage() {
  const { token } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [typeFilter, setTypeFilter] = useState('all');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchMaterials = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (department && department !== '') params.set('department', department);
      if (level && level !== '') params.set('level', level);
      console.log('[Library] fetching with params:', params.toString());
      if (search) params.set('search', search);
      params.set('page', page.toString());

      const res = await fetch(`${API_URL}/api/library?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMaterials(data.materials || []);
      setTotal(data.total || 0);
    } finally { setLoading(false); }
  }, [token, typeFilter, department, level, search, page]);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const handleDownload = async (material: Material) => {
    await fetch(`${API_URL}/api/library/${material.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    window.open(material.file_url, '_blank');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const selectCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#111] dark:border-[#333]';

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-display-sm font-bold text-ink">ABU Library 📚</h1>
        <p className="mt-1 text-body-sm text-ink-muted">Past questions, lecture notes and study materials</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-5 flex gap-2">
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by title, course code or description..."
          className="flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#111] dark:border-[#333]" />
        <Button type="submit">Search</Button>
        {search && <Button variant="ghost" type="button" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}>Clear</Button>}
      </form>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        {TYPES.map(t => (
          <button key={t.value} onClick={() => { setTypeFilter(t.value); setPage(1); }}
            className={cn('rounded-full px-4 py-1.5 text-[13px] font-semibold transition',
              typeFilter === t.value ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted hover:text-ink')}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <select value={department} onChange={e => { setDepartment(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All Levels</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* Results count */}
      {!loading && <p className="mb-4 text-caption text-ink-muted">{total} material{total !== 1 ? 's' : ''} found</p>}

      {/* Materials grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
        </div>
      ) : materials.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-4xl mb-3">📂</p>
          <p className="text-body-sm font-semibold text-ink">No materials found</p>
          <p className="text-caption text-ink-muted mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {materials.map(m => (
            <Card key={m.id} className="hover:shadow-md transition">
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/40">
                    <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z"/>
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink leading-snug line-clamp-2">{m.title}</p>
                    {m.course_code && <p className="text-caption text-ink-muted mt-0.5">{m.course_code}{m.course_title ? ` — ${m.course_title}` : ''}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', TYPE_COLORS[m.type] || TYPE_COLORS.other)}>
                    {TYPE_LABELS[m.type] || m.type}
                  </span>
                  {m.department && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-ink-muted">{m.department}</span>}
                  {m.level && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-ink-muted">{m.level}</span>}
                </div>

                {m.description && <p className="text-caption text-ink-muted line-clamp-2">{m.description}</p>}

                <div className="flex items-center justify-between mt-auto pt-1 border-t border-border">
                  <div className="flex items-center gap-3 text-[11px] text-ink-muted">
                    {m.file_size && <span>{formatSize(m.file_size)}</span>}
                    <span>⬇ {m.download_count}</span>
                    <span>{new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <Button size="sm" onClick={() => handleDownload(m)}>Download</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-body-sm text-ink-muted">Page {page} of {Math.ceil(total / 20)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
