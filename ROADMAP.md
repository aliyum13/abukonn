# ABUkonn — Roadmap & Backlog

Running list of what's shipped, what's in flight, and what's queued. Kept in the
repo so it survives across work sessions.

---

## ✅ Launch blocker — RESOLVED

- **iOS + Android builds now launch cleanly.** iOS build 17 works on device;
  Android works too. Journey: Hermes engine PAC crash fixed
  (RCT_BUILD_HERMES_FROM_SOURCE=1), New Architecture disabled, native startup
  calls (SecureStore + push registration) deferred off the first-render pass,
  setNotificationHandler guarded, on-screen ErrorBoundary added, .easignore
  fixed so uploads are small. Both platforms are past the launch-crash blocker.
  Next: finish store submissions (TestFlight → App Store review for iOS; Play
  Internal testing → production for Android).

## ✅ Recently shipped

- **Switch to one-way follow (Instagram-style):** everyone now follows instead of
  mutual connect. usesFollowSystem() returns true for all; existing connections +
  pending requests migrated to follows in production (27 new rows, non-destructive).
- **Dark mode "System" fix:** app.json userInterfaceStyle "light" -> "automatic"
  (was overriding device appearance). [commit 67f1658, done outside main chat]
- **Feed infinite scroll (mobile, For You):** load() resets pagination, loadMore()
  appends next page with ID dedup, concurrent-call guard, hasMore stop, tap-to-retry
  footer, refresh-mid-flight race guard. [67f1658]
- **Class reps in Discover:** new section after Content creators, reuses
  discoverSection(), no new table. [67f1658]
- **iOS crash hardening:** earlyErrorHandler, lazy expo-secure-store, expo-font
  pin, reworked push/_layout/index. [e95a1fe, 720c8ad, b407998 — outside main chat]

- **iOS TestFlight launch crash — fully resolved (build 17).** Chain of five
  separate bugs, each one revealed only after fixing the last: (1) Hermes PAC
  crash, fixed with `RCT_BUILD_HERMES_FROM_SOURCE=1`; (2) stale lockfile still
  shipping `expo-dev-client` despite it being dropped from `package.json`; (3)
  `expo-notifications`/`expo-secure-store` throwing `requireNativeModule` at
  module scope on the launch path — now lazy-required; (4) `ThemeProvider`
  blocking the root navigator's first render; (5) `expo-font` resolving to a
  rogue, SDK-incompatible `57.0.1` via `@expo/vector-icons`'s open-ended
  peerDependency range instead of the correct `~14.0.12` — now pinned directly.
  Also added: a global error handler + on-screen fallback screen (`index.js`,
  `earlyErrorHandler.tsx`, `ErrorBoundary.tsx`) so any future startup crash
  shows a readable message instead of a silent SIGABRT — this is what actually
  let us diagnose bugs (2)–(5) instead of guessing from crash-log noise.

- **Timetable:** fixed class ordering (12-hour times were sorting as 24-hour) +
  added ENDED / NOW status on the Today view. Migration script for existing rows:
  `backend/scripts/normalize-timetable-times.js --apply`.
- **Web session logout fix:** client was force-logging users out after 24h
  inactivity while the server token lasted 7d. Aligned both to 30d; startup
  check now only logs out on a real 401/403.
- **Profile links:** shareable `abukonn.com/u/<username>` (works logged-out, case-
  insensitive, `@` tolerated) + "Share profile" buttons on profile headers.
- **Discover ordering:** notable accounts first (Verified → Admins → Content
  creators → your department → faculty → others).
- **Tap-to-refresh:** re-tapping the active tab scrolls to top + refreshes. Now
  on all five tabs (Profile was the one missing it).
- **Feed pagination (scaling):** the two feed queries had no LIMIT and ran ~9
  subqueries per row — cost grew with posts×users. Now LIMIT/OFFSET with
  `?page`/`?limit`, default 50, returning `hasMore`. This raised the practical
  ceiling from a few hundred to a few thousand concurrent (see follow-up).
- **Full web↔mobile parity pass** across all 19 feature areas.

---

## 🟡 Queued features (post-launch, roughly in priority order)

### Multi-media posts — 2–3 images/videos per post
- **Ask:** let users attach 2–3 pictures or videos to a single post (carousel/
  gallery), when the feature is live.
- **Scope note:** posts currently store a single `image_url` on the `posts` table.
  This needs a schema change — either a `post_media` table (post_id, url, type,
  position) or a JSON/array column — plus upload changes (multi-file picker,
  multiple Cloudinary uploads) and UI changes (a swipeable gallery on the card,
  web + mobile). Backend `image_url` reads appear in many queries, so migrate
  carefully with backward compatibility. Not a quick patch — a proper feature.

### Real active-user metric (analytics)
- **Problem:** the admin "active today" number counts users who POSTED in the last
  24h (`COUNT(DISTINCT user_id) FROM posts WHERE created_at > NOW()-24h`), NOT
  users who opened the app. On social apps ~90%+ of users only read/engage
  without posting, so this undercounts real activity by ~10x and will make
  traction look far worse than it is.
- **Fix:** add a server-side `last_active` (or `last_seen`) timestamp on `users`,
  stamped from the auth middleware (cheap, ~once per session; the middleware
  currently does no DB work). Then DAU = last_active within 24h, MAU = 30d, and
  "online now" can use live Socket.io connections. Update the admin dashboard
  query. Schema migration + middleware + admin query — a real change, not a patch.

### Feed ranking (personalized)
- Move feed off pure chronological to a light mix of recency + engagement +
  interest match. **Hold until post-launch** — engagement ranking on a sparse new
  feed buries new posts and suppresses the posting behaviour needed early.
  When done: weight recency heavily. Infer interest from department/level +
  engagement rather than a sign-up interest step (don't add onboarding friction).

### Mobile deep links
- Make `abukonn.com/u/<name>` open the app (universal links / app association),
  not just the browser. Blocked behind the iOS build anyway.

### CGPA calculator
- Wanted feature. Recommendation: keep it FREE — it's a growth/retention driver,
  low build cost, high word-of-mouth. (Was proposed as a Pro feature; better as a
  free hook.)

---

## 💰 Commercial (needs decisions, not just code)

### Pro plan (₦2,000/month proposed)
- **Feedback on pricing:** ₦2,000/mo is likely too high for the student market;
  consider ₦500–1,000/mo or a per-semester fee (students budget by term).
- **Do NOT sell the verification badge** — it signals authority (reps/admins/
  official accounts); making it purchasable breaks that trust (the X lesson).
- **Don't paywall the CGPA calculator** (see above — free growth hook).
- **Good paid features:** profile views, post analytics (who viewed), increased
  upload limits (larger files / longer videos), ad-free, edit caption after
  publishing.
- Other proposed: unlimited story posts, mock-exam discount.

### Mock exams
- Likely the real revenue opportunity — students pay for exam prep more readily
  than for social features. Launch date TBD. Worth focusing commercial energy
  here over Pro social features.

---

## 🧹 Housekeeping / debt

- **Rotate the GitHub PAT** used for pushes — it's been live across many sessions.
  Urgent, unrelated to features.
- Consider a **staging branch** — `main` auto-deploys straight to production
  (Vercel + Railway).
- After launch: ship to a student cohort, measure return/retention.## ✅ RESOLVED: iOS + Android launch

- **iOS build 17 launches cleanly on device.** The long crash saga is over.
  Fixes that got it there, in order: New Architecture disabled
  (newArchEnabled:false); Hermes built from source
  (RCT_BUILD_HERMES_FROM_SOURCE=1) to beat the SDK 54 arm64 PAC crash; native
  startup calls (SecureStore + push registration) deferred off the first-render
  pass; setNotificationHandler guarded; on-screen ErrorBoundary added.
- **Android also builds and launches.** Same fixes apply; the Hermes PAC crash
  was iOS-only, so Android was smoother.
- NEXT for both: finish store listings and submit for review (see below).


