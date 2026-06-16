'use client';

import { useEffect, useState, useRef, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Select, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const CATEGORIES = ['academic', 'sports', 'events', 'general'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_VARIANT: Record<Category, 'brand' | 'warning' | 'success' | 'outline'> = {
  academic: 'brand',
  sports: 'warning',
  events: 'success',
  general: 'outline',
};

interface NewsArticle {
  id: number;
  title: string;
  content: string;
  category: Category;
  image_url: string | null;
  author_name: string | null;
  created_at: string;
}

interface FormState {
  title: string;
  content: string;
  category: Category | '';
}

const EMPTY_FORM: FormState = { title: '', content: '', category: '' };

function ArticleSkeleton() {
  return (
    <div className="flex items-start gap-4 border-b border-border py-4 last:border-0">
      <Skeleton className="h-16 w-24 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}

export default function AdminNewsPage() {
  const { token } = useAuth();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchArticles = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/news`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setArticles(data.news || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchArticles(); }, [token]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (article: NewsArticle) => {
    setEditingId(article.id);
    setForm({ title: article.title, content: article.content, category: article.category });
    setImageFile(null);
    setImagePreview(article.image_url);
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setImagePreview(null);
    setFormError('');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!form.title.trim() || !form.content.trim() || !form.category) {
      setFormError('Title, content, and category are required');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const fd = new FormData();
      fd.append('title', form.title.trim());
      fd.append('content', form.content.trim());
      fd.append('category', form.category);
      if (imageFile) fd.append('image', imageFile);

      const url = editingId
        ? `${API_URL}/api/admin/news/${editingId}`
        : `${API_URL}/api/admin/news`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');

      showToast(editingId ? 'Article updated' : 'Article published');
      closeForm();
      fetchArticles();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!token || !confirm(`Delete "${title}"?`)) return;
    setActionId(id);
    try {
      const res = await fetch(`${API_URL}/api/admin/news/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      showToast(data.message);
      fetchArticles();
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-ink">News Management</h1>
          <p className="mt-1 text-body-sm text-ink-secondary">
            {articles.length} article{articles.length !== 1 ? 's' : ''} published
          </p>
        </div>
        <Button onClick={openCreate}>
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Article
        </Button>
      </div>

      {toast && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-body-sm text-brand-700">
          {toast}
        </div>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <Card className="border-brand-200 shadow-brand/10">
          <CardHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle>{editingId ? 'Edit Article' : 'Create New Article'}</CardTitle>
              <button type="button" onClick={closeForm} className="rounded-lg p-1 text-ink-muted hover:text-ink">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-600">
                  {formError}
                </div>
              )}

              <Input
                label="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Article headline..."
                required
              />

              <Select
                label="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Category | '' })}
                required
              >
                <option value="">Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </Select>

              <div>
                <label className="mb-1.5 block text-label text-ink-secondary">Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Write your article..."
                  rows={8}
                  required
                  className={cn(
                    'w-full resize-none rounded-xl border border-border bg-white px-4 py-3',
                    'text-body-sm text-ink placeholder:text-ink-muted',
                    'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'
                  )}
                />
              </div>

              {/* Image upload */}
              <div>
                <label className="mb-1.5 block text-label text-ink-secondary">Cover Image (optional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-40 w-full rounded-xl object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'flex h-28 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border',
                      'text-ink-muted transition hover:border-brand-400 hover:text-brand-600'
                    )}
                  >
                    <svg className="mb-1.5 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                    <span className="text-body-sm">Click to upload image</span>
                  </button>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={submitting}>
                  {editingId ? 'Save Changes' : 'Publish Article'}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Articles list */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 py-2">
              {Array.from({ length: 4 }).map((_, i) => <ArticleSkeleton key={i} />)}
            </div>
          ) : articles.length === 0 ? (
            <EmptyState
              title="No articles yet"
              description="Create your first campus news article."
              action={<Button onClick={openCreate}>Create Article</Button>}
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {articles.map((article) => (
                <div key={article.id} className="flex items-start gap-4 px-5 py-4">
                  {article.image_url ? (
                    <img
                      src={article.image_url}
                      alt={article.title}
                      className="h-16 w-24 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600/30">
                      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink line-clamp-1">{article.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant={CATEGORY_VARIANT[article.category]} className="capitalize">
                        {article.category}
                      </Badge>
                      <span className="text-caption text-ink-muted">
                        {formatDate(article.created_at)}
                      </span>
                      {article.author_name && (
                        <span className="text-caption text-ink-muted">· {article.author_name}</span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-1 text-caption text-ink-muted">{article.content}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(article)}
                      disabled={actionId === article.id}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionId === article.id}
                      onClick={() => handleDelete(article.id, article.title)}
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
