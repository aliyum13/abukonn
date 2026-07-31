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

## 🟢 Platform parity (web ↔ mobile)

Full audit done — every route/screen compared, verified in code not just
file lists. Ticking off one at a time before more feature work.

- [x] **Feed infinite scroll on web** — web's main feed was still capped at
      the first 50 posts (page=1 forever, no load-more). Ported the same
      pattern already proven on mobile. [149559a]
- [x] **Mobile deep links** — `abukonn.com/u/<name>` and group invite links
      now open the app instead of the browser. New screens `app/u/[username].tsx`
      and `app/join/[inviteCode].tsx` reuse web's existing backend endpoints
      exactly. [e0f80e3] Real Android SHA256 fingerprint filled in. [411f50f]
      **Two manual steps remain before it's actually live:**
      (1) deploy web so the `.well-known` files are reachable at abukonn.com —
      Apple/Google's verification crawlers need to fetch them from the live
      domain; (2) a fresh EAS build for both platforms — `associatedDomains`
      and `intentFilters` are native config, only take effect in a new binary.
- [ ] **Admin panel on mobile — needs a decision, not a build.** Web has full
      admin (users, whitelist, reports, news, highlights, library, timetable,
      calendar); mobile has none. Large enough to be its own feature if
      actually needed — decide whether admins need to moderate from their
      phones before building anything.
- [ ] **My Stories management screen (mobile)** — web has a dedicated page
      listing all your active stories with view counts. Mobile only shows
      view count / delete inline while watching your own story in the
      viewer, no list. Smallest item, lowest priority.

Checked and confirmed already at parity (no action needed): notification
preferences, blocked users management, profile editing, followers/following
list, individual news articles, terms/privacy links — all present on both
platforms, sometimes via a different (appropriate) UI pattern per platform.



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
- **Mobile connect-UI cleanup:** removed /connect menu entry; legacy
  connect_request notifications open the actor profile. Follow switch fully done.
- **Real active-user metric:** users.last_active stamped from auth middleware
  (throttled 5min, fire-and-forget); admin shows real DAU/MAU/online + posters.
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

## 🔍 Reported from device testing (iPhone via Expo Go)

10 of 12 fixed so far, rest still queued.

- [x] **Feed post images and story images load noticeably slowly** (mobile).
  Root cause: mobile was loading full-resolution Cloudinary originals
  everywhere (a phone photo can be several MB), while web already had a
  Cloudinary URL-transform helper (f_auto/q_auto/width-cap/dpr_auto) mobile
  never got. Ported the same helper and applied it to feed post images,
  the full-screen story viewer image, and every avatar in both screens.
  [2bbe804]
- [x] **Story reply loses the story reference** — replied to a story with
  "Enjoyment," the recipient got the message but no reference to which
  story / the story's image, unlike a normal quote-reply. Backend already
  sent the story's media_url/story_type/text_content/bg_color; mobile's
  MessageBody.tsx was discarding all of it and showing bare text. Ported
  web's existing StoryReplyCard treatment. [031455d]
- [x] **DM bubble contrast bug** — in a chat thread, messages you send render
  fine, but messages received from the other person are all white (unreadable
  against the background, at least in dark mode). Root cause: a hardcoded
  bubble background color that never changed with theme, paired with
  theme-reactive text that turns near-white in dark mode. Switched to a
  proper theme token. Web was already correct, mobile-only bug. [031455d]
- [x] **Opening a DM feels slow** (mobile). Root cause was backend, not
  client: Message.getMessages() had no LIMIT, so opening a thread fetched
  its entire message history every time. Now returns the most recent 50
  with a `before` cursor; both clients got a "Load earlier messages"
  control plus an auto-scroll guard so prepending history doesn't yank the
  view back to the bottom. [6c0e145]
- [x] **Share button + view count on feed posts** — present on web, missing on
  mobile. Turned out to be half true: the share button already existed and
  already worked correctly on mobile (paper-plane icon -> ShareSheet, mirrors
  web's flow exactly) -- just not visually recognized as "the share button"
  since the icon differs. View count was the genuine gap: no field, no
  tracking, no display. Added all three, using FlatList's viewability API as
  the RN equivalent of web's IntersectionObserver-based tracker. [31b26c0]
- [x] **Tapping a post image doesn't open a clear/full view on mobile** — works
  on web (tap opens the image clearly), mobile has no equivalent. Ported
  web's lightbox exactly: full-screen overlay showing the raw (not
  thumbnail-optimized) image, tap anywhere or the close button to dismiss.
  [5c27e06]
- [x] **News images should open for clear viewing** — news posts have attached
  images; tapping should open a clear/full view, on both web and mobile.
  Turned out web didn't have this either — genuinely new on both, not a
  port. Even the "full article" view was constrained (web: fixed 224px crop,
  mobile: fixed 260px box). Extracted mobile's lightbox (from item 6) into a
  shared component since news needed it a second time; added the same
  lightbox markup to web's news detail page. [baea08e]
- [x] **Match News section design between web and mobile** — currently they
  look different; make them consistent. Web's card was a rich social-post
  style (author avatar+name, expandable content, colored category pill,
  like/comment/share row); mobile had none of that — plain uppercase
  category text, hard-truncated preview, no actions. Rebuilt mobile's list
  card to match, keeping mobile's own card-boxing convention (boxed vs
  web's flat divider list — a reasonable platform difference, not something
  to force-match). [5f7ee8b]
- [ ] **Profile layout alignment + missing Status section on mobile** — mobile's
  profile is centered, web's is left-aligned; make both centered. Also web
  has a "Status" section on profile that mobile doesn't have — add it.
- [ ] **Library wording consistency** — Library itself is fine, but match the
  copy/labels ("all materials," "notes," and other option names) between web
  and mobile so they read the same.
- [x] **Dropdown navbar emoji icons** — a dropdown menu (both web and mobile)
  currently uses emoji as its icons; should switch to proper icons matching
  the rest of the navbar's icon style. Web's logo-menu dropdown and mobile's
  equivalent MenuSheet both had this. Web: lucide-react (already a
  dependency, already used once elsewhere) instead of adding anything new.
  Mobile: Ionicons, matching the exact icon names library.tsx already uses
  for Timetable/Academic Calendar rather than picking arbitrary ones.
  [134b7c8]
- [x] **Push notification shows raw JSON instead of readable text** — a
  message-reply push notification displayed as `Ahman Umar:
  {"type":"message_reply","quoted_sender":"ali muhammad","quoted_text":"Go...`
  on the lock screen, instead of a normal sentence. Root cause confirmed:
  messageController.js used the raw message content directly as the push
  preview, with no awareness that replies/shared-posts are stored as JSON
  envelopes rather than plain text. Ported the same friendly-preview logic
  both clients already use for the conversation list to the backend.
  Checked group messages for the same bug — found no push sent for those at
  all currently, a separate gap not touched here. [cb519e1]

- [x] **Deleted messages showed a blank bubble instead of a placeholder**
  (item 13, found during Android device testing, not part of the original
  12). Root cause: mobile never handled deleted messages at all —
  backend soft-deletes by clearing content to an empty string, so the
  bubble rendered nothing. Confirmed via user report to also affect iOS —
  expected, since this is shared React Native code with no Android-specific
  branching (the "(Android)" in the fix commit's title just reflects where
  it was first spotted, not where the bug actually lived). The fix already
  pushed [f3a58fb] covers both platforms with the same commit; no separate
  iOS fix needed. Also fixed in the same pass: group chat had a third,
  different (worse) treatment — silently hiding deleted messages entirely —
  and its own unfixed copy of the item-3 dark-mode bubble-contrast bug.

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

### Feed ranking (personalized)
- Move feed off pure chronological to a light mix of recency + engagement +
  interest match. **Hold until post-launch** — engagement ranking on a sparse new
  feed buries new posts and suppresses the posting behaviour needed early.
  When done: weight recency heavily. Infer interest from department/level +
  engagement rather than a sign-up interest step (don't add onboarding friction).

### Mobile deep links
- Make `abukonn.com/u/<name>` open the app (universal links / app association),
  not just the browser. Was blocked behind the iOS build — that's resolved now
  (build 17 launches clean), so this is unblocked.

### Academic Calendar Integration
- Admin creates university-wide events (Mid-Semester Break, Public Holidays,
  Exams, Semester Breaks). Any class falling within those dates should
  automatically show the right status (e.g. Cancelled / No Classes) without
  the admin having to edit every class individually.

### Bulk Timetable Status Update
- Admin can update the status of multiple classes at once instead of editing
  each individually. E.g. for a mid-semester break, public holiday, strike, or
  any event affecting the whole university or a faculty, admin selects a date
  range (or a full week) and marks all scheduled classes as Cancelled in one
  action.

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

- **Untracked file sitting in the mobile working tree:** `mobile/app/my-stories.tsx`
  (found while working on device-testing item 6). Not in git history, not
  written by this session. Looks like a real, substantial My Stories
  management screen implementation (the parity backlog item) — worth
  reviewing and either finishing/committing it or discarding it deliberately,
  rather than leaving it to sit uncommitted.

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


