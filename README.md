# Smart Parking Management System (Python + Flask)

A web app for finding and booking parking slots in Belagavi. It has a live Leaflet map, booking with a double-booking check, mock payment, a QR pass for entry and exit, and an OTP check at exit.
Stack: Python (Flask + PyMySQL + bcrypt) with a MySQL database. The interface uses HTML/CSS/JavaScript, Leaflet.js on OpenStreetMap, qrcode.js and html5-qrcode.

## Setup
1. Install Python 3.
2. Start **MySQL** from the XAMPP Control Panel. You only need MySQL, not Apache.
3. Open http://localhost/phpmyadmin, go to **Import**, choose `sql/parking.sql` and click **Go**. This creates the `smart_parking` database with sample data. Re-importing it wipes everything and starts fresh. (If phpMyAdmin isn't available, start Apache too, since phpMyAdmin runs on it.)
4. Open a terminal in this folder and run:
   ```
   pip install -r requirements.txt
   python app.py
   ```
5. Open http://127.0.0.1:5000/.

The database login is in `db.py`, and it uses root with an empty password, which is XAMPP's default. The app runs on IST (Asia/Kolkata).

## Demo logins
| Role  | Email               | Password |
|-------|---------------------|----------|
| Admin | admin@parking.com   | admin123 |
| User  | rahul@example.com   | user123  |
| User  | sneha@example.com   | user123  |

## Demo flow
1. Log in as **rahul**. Click a marker on the map, pick a start and end time for **today**, choose a green slot, enter a vehicle number and book it.
2. On **My Bookings**, click **Pay now**. A QR pass appears.
3. Log out and log in as **admin**. Go to **Scan** and scan the QR with the camera, or paste the code. The first scan is the **entry**.
4. Scan the pass again to get the **exit OTP** shown on screen. Enter it and click **Confirm exit**, and the booking becomes completed.
5. The **Dashboard** shows the stats and recent bookings, and **Slots** lets you add, edit or delete slots.

Entry is only allowed from 15 minutes before the booking's start time until its end time, so always make a fresh booking on the demo day. You can also re-import the SQL just before the demo. The camera only works on `localhost`/`127.0.0.1` or https. Anywhere else, use the paste box.

## Files
- `app.py` has every page and API route, with a comment above each one.
- `db.py` has the MySQL connection and the `query()`/`execute()` helpers.
- `templates/` has the Jinja HTML pages (`base.html` holds the shared layout).
- `static/css`, `static/js` have the styling, map, booking and scan scripts.
- `sql/parking.sql` has the schema and seed data.

## Rules the app enforces
- A slot can't be booked twice for overlapping times (409). A booking can't end before it starts, and it can't be in the past.
- Only unpaid bookings can be cancelled, and only by their owner.
- Admin pages and APIs return 403 for normal users, and the APIs return 401 when you're not logged in.
- Passwords are stored as bcrypt hashes. All SQL uses `%s` placeholders, which prevents SQL injection.

## Deploy online (GitHub + Vercel + Aiven MySQL)
The code is already set up for Vercel through `vercel.json`. The only thing hosted separately is the database.

1. **GitHub:** create a new repository and upload the contents of `flask_app/`. `.gitignore` keeps junk files and `.env` out of it.
2. **Database (Aiven):** create a free MySQL service. Open its query console, or use `mysql -h <host> -P <port> -u avnadmin -p defaultdb < sql/parking_cloud.sql`, and import `sql/parking_cloud.sql`, **not** `parking.sql`. Copy the CA certificate text from the service page.
3. **Vercel:** sign in with GitHub, click **Add New → Project**, and pick the repository. Before deploying, add these environment variables:

| Variable | Value |
|---|---|
| `DB_HOST` | Aiven host |
| `DB_PORT` | Aiven port (not 3306) |
| `DB_USER` | `avnadmin` (or your user) |
| `DB_PASSWORD` | Aiven password |
| `DB_NAME` | `defaultdb` |
| `DB_SSL` | `1` |
| `DB_SSL_CA_CERT` | full CA certificate text from Aiven |
| `SECRET_KEY` | any long random text |

4. Deploy, then open the `https://...vercel.app` link and log in with the demo accounts above. Because the link is https, the camera QR scanner works on a phone too.

When the variables aren't set, the app falls back to XAMPP (`localhost`, `root`, no password), so `python app.py` still works locally. Never commit passwords to GitHub. They only go in Vercel's settings.
