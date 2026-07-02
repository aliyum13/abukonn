'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

const REASONS: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'misinformation', label: 'False information' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Other' },
];

interface ReportModalProps {
  target: { type: 'post' | 'user'; id: number; name: string };
  token: string | null;
  apiUrl: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function ReportModal({ target, token, apiUrl, onClose, onSuccess }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!reason) { setError('Please select a reason.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const endpoint = target.type === 'post'
        ? `${apiUrl}/api/moderation/report/post/${target.id}`
        : `${apiUrl}/api/moderation/report/user/${target.id}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });
      const data = await res.json() as { message: string };

      if (res.status === 409) { setError(data.message); setSubmitting(false); return; }
      if (!res.ok) throw new Error(data.message);

      onSuccess(data.message || 'Report submitted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl dark:bg-[#111] dark:border dark:border-[#222] sm:rounded-2xl sm:pb-0"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5 dark:border-[#222]">
          <h3 className="font-semibold text-ink">
            {target.type === 'post' ? 'Report post' : `Report ${target.name}`}
          </h3>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-ink-muted hover:bg-surface-muted" aria-label="Close">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Reason selection */}
        <div className="px-4 py-3">
          <p className="mb-3 text-body-sm text-ink-muted">Why are you reporting this?</p>
          <div className="space-y-1.5">
            {REASONS.map(r => (
              <button
                key={r.value}
                type="button"
                onClick={() => { setReason(r.value); setError(''); }}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-body-sm transition',
                  reason === r.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400 dark:border-brand-600'
                    : 'border-border text-ink hover:bg-surface-muted dark:border-[#333]'
                )}
              >
                {r.label}
                {reason === r.value && (
                  <svg className="h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Optional details */}
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder="Add more details (optional)"
            rows={2}
            maxLength={500}
            className="mt-3 w-full resize-none rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-body-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-[#333] dark:bg-[#1a1a1a]"
          />

          {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-border px-4 py-3 dark:border-[#222]">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSubmit} loading={submitting} disabled={!reason}>
            Submit report
          </Button>
        </div>
      </div>
    </div>
  );
}
