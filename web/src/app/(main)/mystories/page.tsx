'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar, Button, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const BG_PRESETS = ['#16a34a', '#1d4ed8', '#7c3aed', '#dc2626', '#ea580c', '#0891b2', '#111827', '#be185d'];

interface MyStory {
  id: number;
  media_url: string | null;
  story_type: 'image' | 'video' | 'text';
  text_content: string | null;
  bg_color: string | null;
  caption: string | null;
  created_at: string;
  view_count: number;
}

export default function MyStoriesPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [stories, setStories] = useState<MyStory[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [storyTab, setStoryTab] = useState<'media' | 'text'>('media');
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyPreview, setStoryPreview] = useState<string | null>(null);
  const [storyText, setStoryText] = useState('');
  const [storyBgColor, setStoryBgColor] = useState('#16a34a');
  const [uploading, setUploading] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Per-row ⋯ menu
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const storyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/stories/mine`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setStories(d.stories || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close upload modal on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showUpload) closeUploadModal();
        else if (deleteConfirm !== null) setDeleteConfirm(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showUpload, deleteConfirm]);

  const closeUploadModal = () => {
    setShowUpload(false);
    setStoryFile(null);
    setStoryPreview(null);
    setStoryText('');
    setStoryBgColor('#16a34a');
    setStoryTab('media');
  };

  const handleStoryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStoryFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setStoryPreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUploadStory = async () => {
    if (!token) return;
    setUploading(true);
    try {
      let res: Response;
      if (storyTab === 'text') {
        res = await fetch(`${API_URL}/api/stories`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ story_type: 'text', text_content: storyText, bg_color: storyBgColor }),
        });
      } else {
        if (!storyFile) return;
        const formData = new FormData();
        formData.append('media', storyFile);
        res = await fetch(`${API_URL}/api/stories`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setStories(prev => [{ ...data.story, view_count: data.story.view_count ?? 0 }, ...prev]);
      closeUploadModal();
    } catch { /* silent */ }
    finally { setUploading(false); }
  };

  const handleDelete = async (storyId: number) => {
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/stories/${storyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStories(prev => prev.filter(s => s.id !== storyId));
        setDeleteConfirm(null);
      }
    } catch { /* silent */ }
    finally { setDeleting(false); }
  };

  const canShare = storyTab === 'text' ? storyText.trim().length > 0 : !!storyFile;
  const textLen = storyText.length;
  const textSize = textLen > 100 ? 'text-xl' : textLen > 50 ? 'text-2xl' : 'text-3xl';

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur dark:border-[#222]">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-surface-muted"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="flex-1 text-[17px] font-semibold text-ink">My Stories</h1>
      </div>

      <div className="mx-auto max-w-lg">
        {/* Add Story button */}
        <div className="border-b border-border px-4 py-4 dark:border-[#222]">
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-border p-4 transition hover:border-brand-400 hover:bg-brand-50 dark:border-[#333] dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-semibold text-ink">Add Story</p>
              <p className="text-[13px] text-ink-muted">Share a photo, video, or text</p>
            </div>
          </button>
        </div>

        {/* Story list */}
        {loading ? (
          <div className="divide-y divide-border dark:divide-[#222]">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className="flex flex-col items-center px-8 py-16 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-surface-subtle dark:bg-[#1a1a1a]">
              <svg className="h-10 w-10 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
            <h3 className="mb-1 text-[17px] font-semibold text-ink">No active stories</h3>
            <p className="mb-6 text-[14px] text-ink-muted">Your stories will appear here. They disappear after 24 hours.</p>
            <Button onClick={() => setShowUpload(true)} className="rounded-full px-6">
              Share your first story
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border dark:divide-[#222]">
            {stories.map(story => (
              <div key={story.id} className="flex items-center gap-4 px-4 py-3">
                {/* Thumbnail */}
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  {story.story_type === 'text' ? (
                    <div
                      className="flex h-full w-full items-center justify-center p-1"
                      style={{ backgroundColor: story.bg_color || '#16a34a' }}
                    >
                      <p className="line-clamp-2 text-center text-[9px] font-bold leading-tight text-white">
                        {story.text_content}
                      </p>
                    </div>
                  ) : story.story_type === 'video' ? (
                    <div className="relative h-full w-full bg-black">
                      <video
                        src={story.media_url || undefined}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black/50">
                          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={story.media_url || undefined}
                      alt="Story"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-ink-secondary">{timeAgo(story.created_at)}</p>
                  {story.caption && story.story_type !== 'text' && (
                    <p className="mt-0.5 truncate text-[13px] text-ink">{story.caption}</p>
                  )}
                  <div className="mt-0.5 flex items-center gap-1 text-[13px] text-ink-muted">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{story.view_count} {story.view_count === 1 ? 'view' : 'views'}</span>
                  </div>
                </div>

                {/* ⋯ menu */}
                <div className="relative shrink-0" ref={openMenu === story.id ? menuRef : undefined}>
                  <button
                    type="button"
                    onClick={() => setOpenMenu(openMenu === story.id ? null : story.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-ink"
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>
                  {openMenu === story.id && (
                    <div className="absolute right-0 top-9 z-20 w-36 overflow-hidden rounded-xl border border-border bg-white shadow-lg dark:border-[#222] dark:bg-[#111]">
                      <button
                        type="button"
                        onClick={() => { setDeleteConfirm(story.id); setOpenMenu(null); }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer note */}
        {stories.length > 0 && (
          <p className="px-4 py-4 text-center text-[12px] text-ink-muted">
            Stories disappear after 24 hours
          </p>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={e => { if (e.target === e.currentTarget) closeUploadModal(); }}
        >
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl dark:border dark:border-[#222] dark:bg-[#111]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 dark:border-[#222]">
              <h3 className="font-semibold text-ink">Add to Story</h3>
              <button
                type="button"
                onClick={closeUploadModal}
                className="rounded-lg p-1 text-ink-secondary hover:bg-surface-muted"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex border-b border-border dark:border-[#222]">
              <button
                type="button"
                onClick={() => setStoryTab('media')}
                className={cn(
                  'flex-1 py-2.5 text-sm font-medium transition-colors',
                  storyTab === 'media' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-ink-muted hover:text-ink'
                )}
              >
                Photo / Video
              </button>
              <button
                type="button"
                onClick={() => setStoryTab('text')}
                className={cn(
                  'flex-1 py-2.5 text-sm font-medium transition-colors',
                  storyTab === 'text' ? 'border-b-2 border-brand-600 text-brand-600' : 'text-ink-muted hover:text-ink'
                )}
              >
                Text
              </button>
            </div>

            <div className="p-5">
              {storyTab === 'media' ? (
                <>
                  {storyPreview ? (
                    <div className="relative mb-4">
                      {storyFile?.type.startsWith('video') ? (
                        <video src={storyPreview} className="max-h-64 w-full rounded-xl object-cover" controls />
                      ) : (
                        <img src={storyPreview} alt="Preview" className="max-h-64 w-full rounded-xl object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => { setStoryFile(null); setStoryPreview(null); }}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => storyInputRef.current?.click()}
                      className="mb-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-10 text-ink-muted transition hover:border-brand-400 hover:text-brand-600"
                    >
                      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <p className="text-sm font-medium">Tap to add photo or video</p>
                      <p className="text-xs">Story disappears after 24 hours</p>
                    </button>
                  )}
                  <input
                    ref={storyInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleStoryFileSelect}
                    className="hidden"
                  />
                </>
              ) : (
                <>
                  <div
                    className="mb-4 flex h-44 w-full items-center justify-center rounded-xl px-4"
                    style={{ backgroundColor: storyBgColor }}
                  >
                    <p className={cn('text-center font-bold leading-tight text-white break-words w-full', textSize)}>
                      {storyText || <span className="opacity-40">Your text here…</span>}
                    </p>
                  </div>
                  <textarea
                    value={storyText}
                    onChange={e => setStoryText(e.target.value)}
                    maxLength={280}
                    rows={3}
                    placeholder="Write something…"
                    className="mb-3 w-full resize-none rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-[#333] dark:bg-[#1a1a1a]"
                  />
                  <div className="mb-4 flex gap-2">
                    {BG_PRESETS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setStoryBgColor(c)}
                        className={cn(
                          'h-7 w-7 flex-shrink-0 rounded-full transition-transform hover:scale-110',
                          storyBgColor === c ? 'scale-110 ring-2 ring-brand-500 ring-offset-2' : ''
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={c}
                      />
                    ))}
                  </div>
                </>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={closeUploadModal}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!canShare || uploading}
                  loading={uploading}
                  onClick={handleUploadStory}
                >
                  Share Story
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm !== null && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
          onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}
        >
          <div className="w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl dark:border dark:border-[#222] dark:bg-[#111]">
            <div className="px-6 py-5">
              <h3 className="mb-1 text-[16px] font-semibold text-ink">Delete story?</h3>
              <p className="text-[14px] text-ink-muted">This story will be permanently deleted.</p>
            </div>
            <div className="flex border-t border-border dark:border-[#222]">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 text-[15px] font-medium text-ink-secondary transition hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 border-l border-border py-3 text-[15px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-[#222] dark:hover:bg-red-950/30"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
