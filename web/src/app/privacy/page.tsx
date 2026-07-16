import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — ABUkonn',
};

const LAST_UPDATED = 'July 16, 2026';

export default function PrivacyPage() {
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
        {/* Title block */}
        <div className="mb-10 border-b border-gray-100 pb-8 dark:border-[#222]">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-[#16a34a]">
            Legal
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-[#f5f5f5] sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>
        </div>

        {/* Prose */}
        <div className="space-y-12 text-[15px] leading-7 text-gray-700 dark:text-[#a0a0a0]">
          <section>
            <p>
              ABUkonn is a campus social platform for students of{' '}
              <strong className="text-gray-900 dark:text-[#f5f5f5]">Ahmadu Bello University</strong>. This policy
              explains what information we collect, why we collect it, and the choices you have. We keep it plain
              because you should be able to understand it without a lawyer.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Who we are</h2>
            <p>
              ABUkonn (&quot;we&quot;, &quot;us&quot;, &quot;the app&quot;) is operated by Abukonnect. If you have
              questions about this policy or your data, contact us at{' '}
              <a href="mailto:abukonndev@gmail.com" className="text-[#16a34a] underline">abukonndev@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Information we collect</h2>
            <p className="mb-3">We only collect what the app needs to work. That falls into three groups:</p>

            <h3 className="mb-2 mt-4 font-semibold text-gray-900 dark:text-[#f5f5f5]">1. Information you give us</h3>
            <ul className="ml-5 list-disc space-y-1">
              <li><strong className="text-gray-900 dark:text-[#f5f5f5]">Account details:</strong> your full name, email address, department, and level.</li>
              <li><strong className="text-gray-900 dark:text-[#f5f5f5]">Password:</strong> stored only as a secure one-way hash — we never see or store your actual password.</li>
              <li><strong className="text-gray-900 dark:text-[#f5f5f5]">Profile content:</strong> your profile photo, bio, and (optionally) date of birth, if you add them.</li>
              <li><strong className="text-gray-900 dark:text-[#f5f5f5]">Things you create:</strong> posts, comments, stories, direct and group messages, group memberships, and support requests.</li>
            </ul>

            <h3 className="mb-2 mt-4 font-semibold text-gray-900 dark:text-[#f5f5f5]">2. Information collected automatically</h3>
            <ul className="ml-5 list-disc space-y-1">
              <li><strong className="text-gray-900 dark:text-[#f5f5f5]">Push notification token:</strong> a device identifier used only to deliver notifications you&apos;ve enabled.</li>
              <li><strong className="text-gray-900 dark:text-[#f5f5f5]">Basic technical data:</strong> error and crash information to help us fix problems and keep the app stable.</li>
            </ul>

            <h3 className="mb-2 mt-4 font-semibold text-gray-900 dark:text-[#f5f5f5]">3. Information from your device (only with permission)</h3>
            <ul className="ml-5 list-disc space-y-1">
              <li><strong className="text-gray-900 dark:text-[#f5f5f5]">Photos and camera:</strong> accessed only when you choose to add an image to a post, story, or your profile. We do not browse your library.</li>
              <li><strong className="text-gray-900 dark:text-[#f5f5f5]">Notifications:</strong> used only to send alerts about activity you&apos;ve opted into.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">How we use your information</h2>
            <ul className="ml-5 list-disc space-y-1">
              <li>To create and secure your account and sign you in.</li>
              <li>To show your posts, stories, and messages to the right people.</li>
              <li>To deliver notifications you&apos;ve turned on.</li>
              <li>To keep the platform safe — handling reports, blocks, and abuse.</li>
              <li>To fix bugs and improve the app.</li>
            </ul>
            <p className="mt-3">
              <strong className="text-gray-900 dark:text-[#f5f5f5]">We do not sell your data. We do not show third-party ads. We do not use your data for advertising.</strong>
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Who we share it with</h2>
            <p className="mb-3">
              We share data only with the service providers that make the app function, and only as needed:
            </p>
            <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-[#222]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-[#222]">
                    <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-[#f5f5f5]">Provider</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-900 dark:text-[#f5f5f5]">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#222]">
                  <tr><td className="px-4 py-2">Cloudinary</td><td className="px-4 py-2">Stores and serves images you upload.</td></tr>
                  <tr><td className="px-4 py-2">Resend</td><td className="px-4 py-2">Sends account-related emails.</td></tr>
                  <tr><td className="px-4 py-2">Expo / Firebase (FCM) &amp; Apple (APNs)</td><td className="px-4 py-2">Deliver push notifications.</td></tr>
                  <tr><td className="px-4 py-2">Sentry</td><td className="px-4 py-2">Reports crashes so we can fix them.</td></tr>
                  <tr><td className="px-4 py-2">Railway</td><td className="px-4 py-2">Hosts our servers and database.</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              We may also disclose information if required by law, or to protect the safety of our users or the
              public. Otherwise, your information stays within ABUkonn and these providers.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Your choices and rights</h2>
            <ul className="ml-5 list-disc space-y-1">
              <li><strong className="text-gray-900 dark:text-[#f5f5f5]">Edit your profile</strong> any time in Settings.</li>
              <li><strong className="text-gray-900 dark:text-[#f5f5f5]">Control your privacy:</strong> choose who can message you, who can connect, and who sees your posts and stories.</li>
              <li><strong className="text-gray-900 dark:text-[#f5f5f5]">Notifications:</strong> turn any type on or off in Settings or your device settings.</li>
              <li><strong className="text-gray-900 dark:text-[#f5f5f5]">Block users</strong> and manage your blocked list in Settings.</li>
              <li><strong className="text-gray-900 dark:text-[#f5f5f5]">Delete your account</strong> and associated data by contacting{' '}
                <a href="mailto:abukonndev@gmail.com" className="text-[#16a34a] underline">abukonndev@gmail.com</a>.
                We remove your personal data, except anything we&apos;re required to keep by law.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Data retention</h2>
            <p>
              We keep your information for as long as your account is active. If you delete your account, we remove
              your personal data within a reasonable period, except where we must retain records to comply with legal
              obligations or resolve disputes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Security</h2>
            <p>
              We protect your data with industry-standard measures: encrypted connections (HTTPS), hashed passwords,
              and access controls. No system is perfectly secure, but we work to keep your information safe and to
              respond quickly if something goes wrong.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Children</h2>
            <p>
              ABUkonn is intended for university students. It is not directed at children under 13, and we do not
              knowingly collect information from them. If you believe a child has provided us information, contact us
              and we will remove it.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Changes to this policy</h2>
            <p>
              We may update this policy as the app evolves. When we make material changes, we&apos;ll update the
              &quot;Last updated&quot; date above and, where appropriate, notify you in the app.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Contact</h2>
            <p>
              Questions or requests about your privacy? Email{' '}
              <a href="mailto:abukonndev@gmail.com" className="text-[#16a34a] underline">abukonndev@gmail.com</a>{' '}
              and we&apos;ll respond.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
