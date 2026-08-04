import Link from 'next/link';

export const metadata = {
  title: 'Delete Your Account — ABUkonn',
};

const CONTACT_EMAIL = 'abukonn.ng@gmail.com';

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-gray-100 dark:border-[#222] bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-[#16a34a]">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to home
          </Link>
          <Link href="/feed" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#16a34a] text-[10px] font-bold text-white">
              AB
            </div>
            <span className="hidden text-sm font-bold text-gray-900 dark:text-[#f5f5f5] sm:block">ABUkonn</span>
          </Link>
        </div>
      </header>

      {/* Document */}
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="mb-10 border-b border-gray-100 pb-8 dark:border-[#222]">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-[#16a34a]">
            Account
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-[#f5f5f5] sm:text-4xl">
            Delete your account
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            How to permanently delete your ABUkonn account and what happens to your data.
          </p>
        </div>

        <div className="space-y-12 text-[15px] leading-7 text-gray-700 dark:text-[#a0a0a0]">
          <section>
            <p>
              This page explains how to request that your{' '}
              <strong className="text-gray-900 dark:text-[#f5f5f5]">ABUkonn</strong> account and its
              associated data are deleted. ABUkonn is operated by Abukonnect.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Delete your account from within the app</h2>
            <p>The quickest way to delete your account is directly in the app:</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Open ABUkonn and sign in to the account you want to delete.</li>
              <li>Go to <strong className="text-gray-900 dark:text-[#f5f5f5]">Settings</strong> from your profile.</li>
              <li>Select <strong className="text-gray-900 dark:text-[#f5f5f5]">Delete account</strong>.</li>
              <li>Confirm by typing <strong className="text-gray-900 dark:text-[#f5f5f5]">DELETE</strong> when prompted.</li>
            </ol>
            <p className="mt-3">
              Your account is then permanently deleted. This action cannot be undone.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Request deletion by email</h2>
            <p>
              If you can&apos;t access the app, you can request deletion by emailing us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#16a34a] underline">{CONTACT_EMAIL}</a>{' '}
              from the email address on your account, with the subject &quot;Delete my account&quot;. We
              will verify your identity and delete your account within 30 days.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">What data is deleted</h2>
            <p>When your account is deleted, we permanently remove:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Your account and profile information (name, email, username, department, level, bio, profile photo, date of birth).</li>
              <li>Your posts, comments, replies, polls, questions, events, and discussions.</li>
              <li>Your stories and any photos or videos you uploaded.</li>
              <li>Your direct messages and group chat messages.</li>
              <li>Your follows, likes, and other activity associated with your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">What data may be kept</h2>
            <p>
              We may retain a limited amount of information where we are required to by law, or to
              prevent fraud and abuse. Any such data is kept only for as long as necessary and is not
              used to identify you within the app. Content you shared that has been saved or reposted
              by other users may continue to appear where those users control it.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Questions</h2>
            <p>
              If you have any questions about deleting your account or your data, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#16a34a] underline">{CONTACT_EMAIL}</a>.
              You can also read our{' '}
              <Link href="/privacy" className="text-[#16a34a] underline">Privacy Policy</Link>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
