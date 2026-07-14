# ABUkonn Mobile

React Native (Expo SDK 54) app for ABUkonn. Talks to the same live backend as
the web app.

## Run

```
cd mobile
npm install
npx expo start
```

Scan the QR with **Expo Go**. Phone and laptop must be on the **same Wi-Fi**.

If it says "Using development build", press **s** to switch back to Expo Go.

## Structure

- `app/` — screens (expo-router: file = route)
  - `(auth)/login.tsx`
  - `(tabs)/feed.tsx` — feed, stories, like, comment, post
  - `(tabs)/messages.tsx`, `chat/[id].tsx`
  - `(tabs)/profile.tsx`
- `src/lib/api.ts` — API client (backend URL lives in `app.json` → `extra.apiUrl`)
- `src/lib/storage.ts` — token in the device keychain
- `src/lib/push.ts` — push notification registration
- `src/components/Stories.tsx` — story bar, full-screen viewer, composer

## Notes

- Push notifications work on a **real device**, not a simulator.
- Chat currently **polls** every 5s rather than using sockets. Works fine at this
  scale; worth moving to sockets later.
