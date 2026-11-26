# Smart Parking System

A web app to find, book and pay for parking slots in Belagavi. Each lot has five floors and separate bike and car bays. Gate entry and exit use a QR pass and an exit OTP.
Built with **Next.js 14 (App Router)** and **PostgreSQL**.

## Features
- **Two roles.** Customers find, book and pay for parking. The admin only manages the system (dashboard, locations, slots, scan, reports): admins never see the booking pages, and the booking APIs answer `403` for them.
- **Login required everywhere.** Guests only see the login and register pages, and every API returns `401` without a session. This is enforced in `middleware.js`, with a signed, expiring session cookie and bcrypt passwords.
- **Floors and slot labels.** Every lot has floors **LG, G, F1, F2, F3**. Bays are **B** (bike) or **C** (car), so a slot reads like `F1-C04` or `LG-B02`. Floor, type and number are stored in separate columns, and the label is a generated column.
- **Find parking:** a map of lots, bike and car cards, floor tabs, a per-floor availability table, a visual bay picker, and booking for a time range (double booking is blocked).
- **My bookings:** a live countdown ring, mock payment that unlocks the QR pass, ticket details and history.
- **Admin dashboard:** occupancy by floor, recent bookings and revenue.
- **Admin tools:** scan the QR for entry, generate an exit OTP, add, bulk-add, edit or deactivate slots, and add new lots on a map (each new lot gets slots on all five floors automatically).
- **Admin reports:** pick a date range and download a **PDF** or **CSV**. Reports cover the summary, occupancy by floor and type, revenue by location, bookings and users. The PDF is generated server-side with jsPDF and an embedded Noto Sans font, so `₹` renders correctly.
- **Design:** yellow and black, with the Lexend font, a light/dark toggle, no default browser scrollbars (thin themed ones on inner panels), a desktop sidebar beside a full map, and a mobile bottom sheet with a tab bar.

## Deploy on Vercel
1. Import this GitHub repo into Vercel. The framework is detected as Next.js.
2. Connect a Postgres database and make sure `DATABASE_URL` (or `POSTGRES_URL`) is set.
3. Add `SESSION_SECRET` with a long random string (at least 32 characters, e.g. `openssl rand -base64 48`). The app refuses to log anyone in without it. Changing it logs everyone out and makes all QR passes invalid.
4. Deploy.

### Database setup and upgrades (automatic)
On the first request, the app checks `app_meta.schema_version`. If the database isn't at version 2, it does the following in one transaction, holding a Postgres advisory lock so concurrent cold starts can't clash:
1. Creates any missing tables (`sql/schema.sql`).
2. Upgrades an older single-floor database (`sql/migrate_v2_floors.sql`):
   - copies the old `slots` and `bookings` into `slots_v1_backup` and `bookings_v1_backup`;
   - moves the existing slots to floor **G** as B/C bays, keeping every booking;
   - copies the same layout to LG, F1, F2 and F3.
3. Adds the base demo data (`sql/seed.sql`), but only when there are no users yet.
4. Adds the v3 demo customers and bookings once (`sql/seed_demo_v3.sql`).
5. Adds the performance indexes (`sql/perf_indexes.sql`) and the security tables and columns (`sql/security_v1.sql`).

The migration is idempotent and safe to run more than once.

### Manual migration (optional)
If you prefer to migrate by hand before deploying:
```bash
pg_dump "$DATABASE_URL" -t slots -t bookings > backup_before_v2.sql   # backup
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/schema.sql -f sql/migrate_v2_floors.sql -f sql/seed_demo_v3.sql
```
After editing any file in `sql/`, run `node scripts/build-setup-sql.mjs` to regenerate `lib/setup-sql.js`, which embeds the SQL for serverless use.

### Demo data and accounts
A new database gets one admin account (`admin@parking.com`), 15 customer accounts and about 110 bookings: history over the last ~45 days (completed and cancelled), a few active right now with the entry scanned, and paid and unpaid bookings for the next few days, across every lot, floor and B/C type. Existing databases get the same data once (`sql/seed_demo_v3.sql`, guarded by `app_meta.demo_seed_version`), without duplicating or deleting anything. The passwords are not published; they are kept in the project's private notes. To change the demo data, edit and run `node scripts/gen-demo-seed.mjs`, then `node scripts/build-setup-sql.mjs`.

## Run locally
```bash
npm install
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/smart_parking
export SESSION_SECRET="$(openssl rand -base64 48)"
npm run dev
```

## Security
- **Logins:** 5 wrong passwords for one email (or 50 from one IP) in 15 minutes returns 429 for a while. The same message and roughly the same response time whether the email exists or not; registering an existing email answers the same as a new one.
- **Passwords:** at least 8 characters with a letter and a number (bcrypt).
- **Sessions:** HMAC-signed HttpOnly, SameSite=Lax, Secure cookie, valid 24 hours. Every API re-checks the user in the database, so logout (which bumps `users.token_version`) kills the session everywhere and role changes apply at once.
- **CSRF:** APIs only accept JSON, and the middleware blocks write requests whose `Origin` is another site.
- **QR passes** are `SP1.<booking>.<expiry>.<HMAC>`: they can't be guessed, edited or pointed at another booking, and they expire a day after the booking ends. Entry works once.
- **Exit OTP:** 5 wrong tries cancel it.
- **Input validation** with zod (names, emails, phone, vehicle numbers, location names and addresses: no HTML). The price is always calculated on the server; bookings are limited to 24 hours and 30 days ahead.
- **Headers:** Content-Security-Policy, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy (set in `next.config.mjs`).
- **Privacy:** the report preview masks emails and phone numbers; full details are only in the CSV/PDF downloads, which are logged. CSV cells starting with `=`, `+`, `-` or `@` are neutralised (no Excel formula injection).
- **Activity log** (Admin → Activity log, table `audit_log`): logins, failed and blocked logins, admin changes, QR scans and report exports.

## Project structure
- `middleware.js`: the login wall for pages and APIs.
- `app/(auth)/`: the login and register pages.
- `app/(app)/`: the signed-in pages (find parking, my bookings, and the admin dashboard, locations, slots, scan and reports).
- `app/api/*`: JSON routes. `app/api/admin/report` serves `?format=json|csv|pdf`.
- `components/`: the app shell, theme toggle, icons, map and booking UI, and the scanner.
- `lib/`: the database pool, auto setup, session, security helpers (`security.js`: rate limits, audit log, input rules, signed QR passes), floor helpers, and report builders (CSV and PDF).
- `sql/`: the schema, the v2 migration, the seed and the reset scripts.
- `public/assets/`: fonts and images.

## Credits and licences
- UI based on the **"Parking App Design UI"** kit by **[@muhamamd](https://www.figma.com/@muhamamd)** on Figma Community, used under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The design was adapted and modified for this project.
- [Lexend](https://fonts.google.com/specimen/Lexend) and [Noto Sans](https://fonts.google.com/noto/specimen/Noto+Sans) fonts, under the SIL Open Font License 1.1 (see `public/assets/fonts/OFL.txt` and `lib/fonts/OFL-NotoSans.txt`).
- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, rendered with [Leaflet](https://leafletjs.com/).
- PDF reports use [jsPDF](https://github.com/parallax/jsPDF) and [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable).
