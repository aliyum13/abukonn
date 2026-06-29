'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const CATEGORIES = ['Bug Report', 'Feature Request', 'Account Issue', 'Content Report', 'Other'];

export default function SupportPage() {
  const { user, token } = useAuth();
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!category || !subject.trim() || !message.trim()) {
      setError('Please fill in all fields'); return;
    }
    setSubmitting(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/support`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subject, message, email: user?.email, full_name: user?.full_name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  const inputCls = 'w-full rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#111] dark:border-[#333]';

  if (submitted) return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mb-4 text-5xl">✅</div>
      <h1 className="text-display-sm font-bold text-ink mb-2">Ticket Submitted!</h1>
      <p className="text-body-sm text-ink-muted mb-6">We have received your message and will get back to you as soon as possible.</p>
      <Link href="/feed"><Button>Back to Feed</Button></Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <h1 className="text-display-sm font-bold text-ink">Support & Feedback</h1>
        <p className="mt-1 text-body-sm text-ink-muted">Having an issue or want to share feedback? We are here to help.</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-600">{error}</div>}

          <div>
            <label className="mb-1.5 block text-label font-semibold text-ink-secondary">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
              <option value="">Select a category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-label font-semibold text-ink-secondary">Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description of your issue" className={inputCls} />
          </div>

          <div>
            <label className="mb-1.5 block text-label font-semibold text-ink-secondary">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Please describe your issue or feedback in detail..."
              rows={5} className={`${inputCls} resize-none`} />
          </div>

          <div className="rounded-xl bg-surface-muted px-4 py-3">
            <p className="text-caption text-ink-muted">Submitting as: <span className="font-semibold text-ink">{user?.full_name} ({user?.email})</span></p>
          </div>

          <Button onClick={handleSubmit} loading={submitting} className="w-full">Submit Ticket</Button>
        </CardContent>
      </Card>
    </div>
  );
}
