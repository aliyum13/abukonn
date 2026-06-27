'use client';

import { Card, CardContent } from '@/components/ui';

export default function AdminWhitelistPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm text-ink">Student Verification</h1>
        <p className="mt-1 text-body-sm text-ink-secondary">
          Registration access control
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
            <svg className="h-8 w-8 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-ink">Open Registration</h3>
          <p className="mt-2 max-w-sm text-body-sm text-ink-muted">
            Student verification via matric whitelist is currently disabled.
            All students can register freely.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
