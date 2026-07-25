# ABUkonn — Roadmap & Backlog

Running list of what's shipped, what's in flight, and what's queued. Kept in the
repo so it survives across work sessions.

---

## 🔴 Launch blocker (do first)

- **iOS TestFlight launch crash.** Engine-level Hermes PAC crash is fixed
  (`RCT_BUILD_HERMES_FROM_SOURCE=1`). Remaining crash is a native Expo module
  throwing at startup (SIGABRT on `expo.modules.AsyncFunctionQueue`). Latest fix:
  deferred `SecureStore.getItemAsync` + push registration off the first-render
  pass, guarded `setNotificationHandler`, added an on-screen error boundary.
  **Next:** build 11, test on device. If it still crashes, get the
  **symbolicated** crash from App Store Connect → TestFlight → Crashes (names the
  exact module) instead of guessing.

---

## ✅ Recently shipped

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

### Class reps in Discover
- Add a "Class reps from your department" section. Reps live in the
  `class_representatives` table (dept+level), not a user flag, so this needs a
  join — a bit more than the reorder already done.

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
- After launch: ship to a student cohort, measure return/retention.
