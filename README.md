# Smart Parking System

A web app to find, book and pay for parking slots in Belagavi. Bookings are checked in and out with a QR code and an exit OTP.
Built with **Next.js (App Router)** and **PostgreSQL** (Vercel Postgres / Neon).

## Features
- Register, login and logout (bcrypt passwords, signed session cookie)
- Map of parking locations with live free/total slot counts
- Book a slot for a time range, with double-booking prevented
- Mock payment that unlocks a QR code
- Admin: scan the QR for entry, generate an exit OTP, manage slots, view the dashboard
- Admin: add new parking locations (click on a map to set the position) with auto-created slots

## Deploy on Vercel
1. On vercel.com choose **Add New → Project** and **import this GitHub repo**. The framework is detected as Next.js.
2. Open the project's **Storage** tab, **add Postgres (Neon)**, and **connect it to this project**. This sets `DATABASE_URL` / `POSTGRES_URL` automatically.
3. Under **Settings → Environment Variables**, add `SESSION_SECRET` with any long random string.
4. Go to **Deployments** and **Redeploy**.
5. That's it. **Tables are created automatically on the first request** and demo data is added once.

Demo logins: `admin@parking.com / admin123`, `rahul@example.com / user123`.

## Run locally
```bash
npm install
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/smart_parking
export SESSION_SECRET=dev-secret
npm run dev
```

## Project structure
- `app/`: pages (home map, login, register, my-bookings, admin) and `app/api/*` routes
- `lib/`: database pool, auto setup, session and helpers
- `components/`: navigation and the map/booking UI
- `sql/`: schema, seed and reset scripts (for reference or manual use)
