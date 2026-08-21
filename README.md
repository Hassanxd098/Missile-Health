# Missile Health — Role-Based Healthcare Platform

**Stack:** React + Vite (frontend) · Node.js + Express + MongoDB/Mongoose (backend) · JWT auth with three roles (Patient / Doctor / Admin) · Google Gemini for AI support.

## What changed in this pass

You'd started migrating from an earlier in-memory/lowdb prototype to a real
MongoDB + JWT + role-dashboard architecture. This pass fixed what was
broken and finished the Gemini wiring:

1. **Frontend crash (`destroy is not a function`)** — in
   `frontend/src/pages/Dashboard.jsx`, both the `Patient` and `Doctor`
   components did `useEffect(load, [])` where `load` returns a Promise
   (from a `.then().catch()` chain). React treats whatever a `useEffect`
   callback returns as a cleanup function — handing it a Promise instead
   of a function crashes on unmount. Fixed by wrapping the call:
   `useEffect(() => { load(); }, [])`.

2. **Backend crash (`Missing required environment variables: mongoUri, jwtSecret`)**
   — this was `backend/src/config.js` calling `requireConfig("mongoUri", "jwtSecret")`
   at startup. That's correct behavior — those two are genuinely required —
   the crash meant `.env` wasn't in place or wasn't being loaded. Confirmed
   `backend/.env` now has both.

3. **Gemini wasn't actually wired in** — `config.js` and `routes/ai.js` were
   still reading `OPENAI_API_KEY` / using the OpenAI SDK, but your `.env`
   had the key under `Gemini_API_Key` (and no `OPENAI_API_KEY` at all), so
   `/api/ai/support` was silently returning 503. Fixed:
   - `config.js` now reads `GEMINI_API_KEY` / `GEMINI_MODEL` (defaults to
     `gemini-2.0-flash`)
   - `.env` keys normalized to `GEMINI_API_KEY` / `GEMINI_MODEL`
   - `routes/ai.js` rewritten to use `@google/generative-ai` instead of
     the `openai` package (now removed from `package.json`)

4. **Dead code from the earlier prototype** — the original 8-module
   lowdb-based routes/services (`onboarding.js`, `symptoms.js`,
   `appointments.js`, `visits.js`, `referrals.js`, `orders.js`, `chat.js`,
   `wellness.js`, `aiEngine.js`, `abhaService.js`, `notificationService.js`,
   the old `middleware/auth.js`, `models/db.js`) and their matching frontend
   pages were still sitting in the repo but **nothing imports them anymore**
   — `server.js` only mounts `auth.js`, `dashboard.js`, `ai.js`. I moved
   them into `_legacy_unused/` on both sides (not deleted) so they don't
   cause confusion, but they're preserved in case you want to port any of
   that business logic (e.g. the capacity-based appointment auto-confirm
   rules) into the new Mongo models later.

## Current architecture

```
missile-health/
├── backend/src/
│   ├── config.js              env vars incl. Gemini key/model — never crashes on
│   │                          missing values except the two hard requirements
│   │                          (mongoUri, jwtSecret), which now throw a clear error
│   ├── server.js               connects Mongo, seeds one admin from env, mounts routes
│   ├── models/                 User (patient/doctor/admin), Appointment, ClinicalNote
│   ├── middleware/authJwt.js    requireAuth (JWT) + allowRoles(...roles)
│   └── routes/
│       ├── auth.js              register (patient only) · login · /me · /staff (admin-created doctor/admin accounts)
│       ├── dashboard.js         role-scoped: /patient, /doctor, /admin
│       └── ai.js                /support — Gemini-backed chat, requires auth
├── frontend/src/
│   ├── pages/Login.jsx          sign in / patient sign-up
│   ├── pages/Dashboard.jsx      renders Patient / Doctor / Admin view based on user.role
│   └── context/PatientContext.jsx  stores { token, user } from login/register
└── README.md
```

## 1. Setup — in order

### 1.1 Backend

```bash
cd backend
npm install
```

Make sure `backend/.env` has real values for:
```
MONGODB_URI=       # your Atlas or local connection string
JWT_SECRET=        # any long random string
GEMINI_API_KEY=    # from https://aistudio.google.com/apikey
GEMINI_MODEL=gemini-2.0-flash   # optional, this is the default
CLIENT_ORIGIN=http://localhost:5173
ADMIN_EMAIL=
ADMIN_PASSWORD=    # 8+ characters — creates the first admin account on boot
ADMIN_NAME=
```
Then:
```bash
npm run dev          # http://localhost:4000
```
`GET /api/health` should return `{"status":"ok","database":"connected"}`.

### 1.2 Frontend

```bash
cd frontend
npm install
npm run dev           # http://localhost:5173
```

### 1.3 First run

1. Go to `/login` -> "Patient sign up" -> creates a `role: "patient"` account,
   logs you in, redirects to `/dashboard`, which renders the `Patient` view.
2. To see the **Doctor** or **Admin** view, you need staff accounts — these
   are *not* self-registerable (by design: only an existing admin can
   create doctor/admin accounts via `POST /api/auth/staff`). Log in as the
   admin seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD`, then create a doctor
   account, e.g.:
   ```bash
   curl -X POST http://localhost:4000/api/auth/staff \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <admin-token-from-login-response>" \
     -d '{"name":"Dr. Ananya Rao","email":"ananya@missilehealth.test","password":"Passw0rd!","role":"doctor","profile":{"specialty":"General Physician"}}'
   ```
3. Log in with that doctor account to see the **Doctor** dashboard (appointment
   queue, confirm/decline). Log in as a patient to request an appointment
   with that doctor, and as admin to see the aggregate counts.
4. The "AI support" panel on the patient dashboard calls Gemini — try it
   once `GEMINI_API_KEY` is set.

## 2. A note on testing done here

This environment's network is locked down to package registries (npm,
PyPI, GitHub) — it can't reach MongoDB Atlas or the Gemini API. So what
was verified here:
- **Frontend**: fresh `npm install` + `npm run build` — compiles clean,
  confirms the `useEffect` fix and no other syntax/import errors.
- **Backend**: `node --check` on every modified file (syntax-valid), plus
  a full read-through of `config.js` -> `server.js` -> `routes/*` ->
  `middleware/authJwt.js` -> `models/*` for logical consistency (token
  shapes, role checks, field names all match end to end).
- **Not verified here**: an actual live Mongo connection or a real Gemini
  API call — you'll want to confirm those on your machine where the
  network isn't restricted. If `/api/health` doesn't show `"connected"`,
  double-check `MONGODB_URI` (Atlas IP allowlist is a common culprit) before
  anything else.

## 3. Security note on the admin seed

`ADMIN_PASSWORD` in `.env` is only used once, on first boot, to create the
initial admin (`seedAdmin()` in `server.js` skips itself if an admin already
exists). Rotate it or remove it from `.env` after that first login if you're
deploying this anywhere beyond your own machine.
