# ABUkonn

Campus social platform for Ahmadu Bello University.

| Folder | What | Runs on |
|---|---|---|
| `backend/` | Node/Express API, PostgreSQL, Socket.io | Railway |
| `web/` | Next.js app | Vercel |
| `mobile/` | Expo / React Native app | App stores via EAS |

## Run it locally against a dev database

You need Node 20+ and a PostgreSQL you can throw away. **Never put the production database URL in a local `.env`.**

### 1. Database

```bash
createdb abukonn_dev
# or, with Docker:
docker run --name abukonn-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
```

An empty database is enough: the backend creates the `abukonn` schema and every table when it starts.

### 2. Backend (http://localhost:3000)

```bash
cd backend
cp .env.example .env     # then edit DATABASE_URL and JWT_SECRET
npm install
npm run dev
```

`.env.example` lists every variable and marks what is required. For a local database you only need `DATABASE_URL` and `JWT_SECRET`; the example already sets `DEV_SKIP_EXTERNAL_SERVICES=true`, which lets the backend boot without a Resend key and prints emails (including password-reset codes) to the console instead of sending them. Cloudinary, Paystack and Sentry are optional: without Cloudinary every upload returns an error and the rest works. Production ignores the skip flag.

Wait for `ABUkonn server running on port 3000`, then fill the database with fake data:

```bash
node scripts/seed-dev.js            # dry run: shows what it would create
node scripts/seed-dev.js --apply    # writes it
```

This creates an admin, an editor, a Library Contributor, four students, posts, news, two groups and library entries with placeholder file URLs. Every account is `<name>@dev.abukonn.local` with password `DevPass123!`, for example `dev.admin@dev.abukonn.local`. It refuses to run against any non-local database (or `NODE_ENV=production`), and is safe to re-run.

Tests (no database needed; they use an in-process Postgres):

```bash
npm test
```

### 3. Web (http://localhost:3001)

```bash
cd web
npm install
npm run dev
```

The web app talks to `http://localhost:3000` by default. To point it elsewhere, set `NEXT_PUBLIC_API_URL` in `web/.env.local`. `next build` needs internet access for Google Fonts.

### 4. Mobile

The app talks to production unless you override it. Create `mobile/.env.local` (git-ignored):

```bash
# Android emulator: the host machine is 10.0.2.2
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
# Physical phone: your computer's LAN address, on the same Wi-Fi
# EXPO_PUBLIC_API_URL=http://192.168.1.20:3000
# iOS simulator: http://localhost:3000
```

```bash
cd mobile
npm install
npx expo start        # then press a for Android / i for iOS
```

The login screen prints the API URL it is using, so you can confirm it is your local backend. Features that need native modules (push notifications, the date picker, the document picker) need a development build (`eas.json` has a `development` profile) rather than Expo Go. Do not set `EXPO_PUBLIC_API_URL` in `eas.json` or in EAS environment variables: builds for testers must keep using production.

## Deploys

A push to `main` deploys the web app (Vercel) and the backend (Railway). Mobile changes only reach testers through an EAS build and store submission.
