import Link from 'next/link';

export const metadata = {
  title: 'Terms & Conditions — ABUkonn',
};

const LAST_UPDATED = 'June 17, 2026';

export default function TermsPage() {
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
        <div className="mb-10 border-b border-gray-100 pb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-[#16a34a]">
            Legal
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-[#f5f5f5] sm:text-4xl">
            Terms &amp; Conditions
          </h1>
          <p className="mt-3 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>
        </div>

        {/* Prose */}
        <div className="space-y-12 text-[15px] leading-7 text-gray-700">

          {/* 1 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">1. Introduction</h2>
            <p>
              Welcome to <strong className="text-gray-900">ABUkonn</strong>, the official digital campus network for
              students and staff of <strong className="text-gray-900">Ahmadu Bello University (ABU), Zaria</strong>.
              ABUkonn is a social platform built to help members of the ABU community connect, share information,
              stay updated on campus news, and communicate in real time.
            </p>
            <p className="mt-3">
              By creating an account or using any part of the ABUkonn platform — including the website, mobile
              application, or API — you agree to be bound by these Terms &amp; Conditions. Please read them carefully
              before registering. If you do not agree, you must not access or use the platform.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">2. Eligibility</h2>
            <p>ABUkonn is exclusively for:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>Current students of Ahmadu Bello University with a valid matric number.</li>
              <li>Alumni of Ahmadu Bello University.</li>
              <li>Current staff and faculty members of Ahmadu Bello University.</li>
            </ul>
            <p className="mt-3">
              You must be at least 16 years old to register. By creating an account you confirm that you meet
              these eligibility requirements. We reserve the right to verify your identity and suspend accounts
              found to be ineligible.
            </p>
            <p className="mt-3">
              Your matric number is used solely for identity verification and displayed on your public profile.
              It is not used as a login credential. Registration requires a valid email address and a password of
              at least 6 characters.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">3. User Responsibilities</h2>
            <p>
              You are solely responsible for all activity that occurs under your account. You agree to:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>Keep your login credentials secure and not share them with anyone.</li>
              <li>Treat all other users with respect and courtesy.</li>
              <li>Use the platform only for lawful purposes and in accordance with these terms.</li>
              <li>Report any content or behavior that violates these terms using available reporting tools.</li>
              <li>Not impersonate another person, student, staff member, or institution.</li>
              <li>Not attempt to access another user&apos;s account or private data without authorization.</li>
            </ul>
            <p className="mt-3">
              You must <strong className="text-gray-900">not</strong> engage in the following:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>Harassment, bullying, or targeted abuse of any user.</li>
              <li>Posting spam, unsolicited advertisements, or promotional content.</li>
              <li>Inciting hate speech based on ethnicity, religion, gender, disability, or any other protected attribute.</li>
              <li>Sharing misinformation, fake news, or deliberately deceptive content about ABU or its community.</li>
              <li>Any automated scraping, data harvesting, or bot activity without prior written consent.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">4. Content Policy</h2>
            <p>
              Users may post text, images, and other media on the platform. You retain ownership of the content
              you create, but by posting on ABUkonn you grant us a non-exclusive, royalty-free, worldwide licence
              to store, display, and distribute that content within the platform.
            </p>
            <p className="mt-3"><strong className="text-gray-900">Allowed content:</strong></p>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>Campus news, opinions, and academic discussions.</li>
              <li>Photos and media from campus events and activities.</li>
              <li>Questions, study materials, and educational resources.</li>
              <li>Announcements relevant to the ABU community.</li>
            </ul>
            <p className="mt-4"><strong className="text-gray-900">Prohibited content:</strong></p>
            <ul className="mt-2 list-disc space-y-1.5 pl-6">
              <li>Nudity, sexually explicit, or obscene material.</li>
              <li>Content that threatens or incites violence against any individual or group.</li>
              <li>Content that infringes third-party intellectual property or copyrights.</li>
              <li>Personal information (phone numbers, home addresses, financial details) of other users shared without their consent.</li>
              <li>Malware, phishing links, or other malicious content.</li>
            </ul>
            <p className="mt-3">
              ABUkonn administrators may remove any content that violates these guidelines at any time, with or
              without prior notice.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">5. Privacy</h2>
            <p>We collect and process the following data when you use ABUkonn:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li><strong className="text-gray-900">Account data:</strong> your email address, full name, matric number, department, level, and password (stored as a secure hash).</li>
              <li><strong className="text-gray-900">Profile data:</strong> optional bio and profile photo that you choose to upload.</li>
              <li><strong className="text-gray-900">Activity data:</strong> posts, comments, likes, follows, and messages you create on the platform.</li>
              <li><strong className="text-gray-900">Technical data:</strong> IP address, browser type, and device information collected automatically for security and performance purposes.</li>
            </ul>
            <p className="mt-3">
              Your data is used exclusively to operate and improve ABUkonn. We do not sell your personal data to
              third parties. Profile photos and media are stored securely via Cloudinary. We may share anonymised,
              aggregated statistics with the ABU administration for research purposes.
            </p>
            <p className="mt-3">
              You may request deletion of your account and associated data at any time by contacting us at the
              address below. Deleted accounts are permanently removed within 30 days.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">6. Account Termination</h2>
            <p>
              We reserve the right to suspend or permanently terminate any account, at our sole discretion, for
              violations of these Terms &amp; Conditions, including but not limited to:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-6">
              <li>Repeated or severe violations of the Content Policy.</li>
              <li>Harassment or abuse of other users.</li>
              <li>Providing false registration information.</li>
              <li>Any activity that is unlawful under Nigerian law or poses a risk to the platform or its users.</li>
            </ul>
            <p className="mt-3">
              Suspended users will be notified via their registered email address where practicable. Users may
              appeal a suspension by contacting us at the address below within 14 days of the decision. ABUkonn
              is not liable for any loss of data, connections, or access resulting from account termination.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#16a34a]">7. Contact</h2>
            <p>
              If you have questions about these Terms &amp; Conditions, wish to report a violation, or need to
              request account deletion, please reach out to the ABUkonn team:
            </p>
            <div className="mt-4 inline-block rounded-xl border border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#111] px-6 py-4">
              <p className="font-medium text-gray-900 dark:text-[#f5f5f5]">ABUkonn Support</p>
              <p className="mt-1 text-sm">
                <a
                  href="mailto:abukonn@abu.edu.ng"
                  className="font-medium text-[#16a34a] underline underline-offset-2 hover:text-[#15803d]"
                >
                  abukonn@abu.edu.ng
                </a>
              </p>
              <p className="mt-1 text-sm text-gray-500">Ahmadu Bello University, Zaria, Kaduna State, Nigeria</p>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              These terms may be updated from time to time. Continued use of ABUkonn after changes are published
              constitutes acceptance of the revised terms.
            </p>
          </section>
        </div>

        {/* Footer note */}
        <div className="mt-16 border-t border-gray-100 pt-8 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} ABUkonn · Ahmadu Bello University, Zaria
        </div>
      </main>
    </div>
  );
}
