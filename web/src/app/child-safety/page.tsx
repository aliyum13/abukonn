import Link from 'next/link';

export const metadata = {
  title: 'Child Safety Standards — ABUkonn',
};

const CONTACT_EMAIL = 'abukonn.ng@gmail.com';
const LAST_UPDATED = 'August 7, 2026';

export default function ChildSafetyPage() {
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
            Safety
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-[#f5f5f5] sm:text-4xl">
            Child Safety Standards
          </h1>
          <p className="mt-3 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-12 text-[15px] leading-7 text-gray-700 dark:text-[#a0a0a0]">
          <section>
            <p>
              ABUkonn (operated by Abukonnect) is committed to the safety of everyone who uses our
              platform, and has a zero-tolerance policy toward child sexual abuse and exploitation
              (CSAE) and child sexual abuse material (CSAM). This page describes the standards and
              practices we maintain to prevent, detect, and respond to child sexual abuse and
              exploitation on ABUkonn.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Our commitment</h2>
            <p>
              ABUkonn prohibits any content, conduct, or activity that sexualizes, exploits, or
              endangers children. This includes, without limitation, child sexual abuse material,
              grooming, sextortion, trafficking, and any other form of child sexual abuse or
              exploitation. Violations result in immediate removal of content, termination of the
              responsible account, and reporting to the appropriate authorities.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Prohibited content and conduct</h2>
            <p>The following are strictly prohibited on ABUkonn:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Child sexual abuse material (CSAM) in any form.</li>
              <li>Sexualization of minors, including sexually suggestive content involving anyone under 18.</li>
              <li>Grooming, solicitation, or any attempt to engage a minor for sexual purposes.</li>
              <li>Sextortion, trafficking, or facilitation of any of the above.</li>
              <li>Sharing, linking to, or promoting any of the above material or conduct.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Prevention and detection</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Our Community Guidelines and Terms of Service explicitly prohibit CSAE and CSAM.</li>
              <li>We provide in-app reporting tools so users can flag content, accounts, or messages that may involve child safety concerns.</li>
              <li>Reports are reviewed by our team, and content that violates these standards is removed promptly.</li>
              <li>Accounts responsible for CSAE/CSAM violations are permanently removed.</li>
              <li>ABUkonn is intended for university students; the app is not directed at children under 13.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Reporting concerns</h2>
            <p>
              Users can report child safety concerns directly within the app using the report option
              available on posts, profiles, and messages. You can also report a concern to us
              directly by emailing{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#16a34a] underline">{CONTACT_EMAIL}</a>.
              We review all reports and take action, including removing content and accounts and
              escalating to authorities where appropriate.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Reporting to authorities</h2>
            <p>
              When we become aware of apparent child sexual abuse material or exploitation, we act to
              remove it and report it to the relevant regional and national authorities, and to
              recognized bodies such as the National Center for Missing &amp; Exploited Children
              (NCMEC) where applicable, in compliance with the child safety laws that apply to us.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">Point of contact</h2>
            <p>
              For questions about our child safety standards or to report a concern, contact our
              designated point of contact at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#16a34a] underline">{CONTACT_EMAIL}</a>.
              You can also review our{' '}
              <Link href="/privacy" className="text-[#16a34a] underline">Privacy Policy</Link> and{' '}
              <Link href="/terms" className="text-[#16a34a] underline">Terms of Service</Link>.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-gray-100 pt-6 dark:border-[#222]">
          <p className="text-xs text-gray-400">© 2026 ABUkonn. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}
