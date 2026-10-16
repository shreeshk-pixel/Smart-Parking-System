# Smart Parking Management System - Flask backend
import os, time, math, secrets, random
from datetime import datetime, timedelta
from functools import wraps

os.environ["TZ"] = "Asia/Kolkata"  # keep Python on Indian time
if hasattr(time, "tzset"):
    time.tzset()

import bcrypt
from flask import Flask, request, session, jsonify, redirect, url_for, render_template, flash
import db

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change-this-secret-key")


# ---------- helpers ----------

def ok(data, code=200):
    return jsonify({"ok": True, "data": data}), code


def fail(message, code=400):
    return jsonify({"ok": False, "error": message}), code


def parse_time(text):
    """Accept 'YYYY-MM-DD HH:MM' or 'YYYY-MM-DDTHH:MM'. Return datetime or None."""
    text = str(text or "").strip().replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            pass
    return None


def body():
    """Read JSON body, or form data if not JSON."""
    return request.get_json(silent=True) or request.form


def api_login(f):
    """API route needs a logged-in user, else 401."""
    @wraps(f)
    def wrapper(*a, **kw):
        if "user" not in session:
            return fail("login required", 401)
        return f(*a, **kw)
    return wrapper


def api_admin(f):
    """API route needs an admin, else 401/403."""
    @wraps(f)
    def wrapper(*a, **kw):
        if "user" not in session:
            return fail("login required", 401)
        if session["user"]["role"] != "admin":
            return fail("admin only", 403)
        return f(*a, **kw)
    return wrapper


def page_login(f):
    """Page needs a logged-in user, else go to login."""
    @wraps(f)
    def wrapper(*a, **kw):
        if "user" not in session:
            return redirect(url_for("login"))
        return f(*a, **kw)
    return wrapper


def page_admin(f):
    """Page needs an admin."""
    @wraps(f)
    def wrapper(*a, **kw):
        if "user" not in session:
            return redirect(url_for("login"))
        if session["user"]["role"] != "admin":
            return "Admins only", 403
        return f(*a, **kw)
    return wrapper


@app.context_processor
def add_user():
    # Makes `user` available in every template
    return {"user": session.get("user")}


# ---------- login / register / logout ----------

# Login form: check email + password, store user in session
@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        row = db.query("SELECT * FROM users WHERE email = %s", (request.form.get("email", "").strip(),), one=True)
        password = request.form.get("password", "").encode()
        if row and bcrypt.checkpw(password, row["password_hash"].encode()):
            session.clear()
            session["user"] = {"id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"]}
            return redirect(url_for("dashboard_page") if row["role"] == "admin" else url_for("index"))
        error = "Wrong email or password."
    return render_template("login.html", error=error, registered=request.args.get("registered"))


# Register form: create a normal user with a bcrypt-hashed password
@app.route("/register", methods=["GET", "POST"])
def register():
    error = None
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip()
        phone = request.form.get("phone", "").strip()
        password = request.form.get("password", "")
        if not name or "@" not in email or len(password) < 6:
            error = "Enter a name, a valid email and a password of at least 6 characters."
        elif db.query("SELECT id FROM users WHERE email = %s", (email,), one=True):
            error = "That email is already registered."
        else:
            hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            db.execute("INSERT INTO users (name, email, phone, password_hash, role) VALUES (%s, %s, %s, %s, 'user')",
                       (name, email, phone, hashed))
            return redirect(url_for("login", registered=1))
    return render_template("register.html", error=error)


# Logout: clear the session
@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ---------- pages (templates by Frontend) ----------

# Map page
@app.route("/")
def index():
    return render_template("index.html")


# My Bookings page
@app.route("/my_bookings")
@page_login
def my_bookings_page():
    return render_template("my_bookings.html")


# Admin dashboard page
@app.route("/admin/dashboard")
@page_admin
def dashboard_page():
    return render_template("admin/dashboard.html")


# Admin QR scan / exit OTP page
@app.route("/admin/scan")
@page_admin
def scan_page():
    return render_template("admin/scan.html")


# Admin slot management: add, edit, delete (or deactivate if it has bookings)
@app.route("/admin/slots", methods=["GET", "POST"])
@page_admin
def slots_page():
    if request.method == "POST":
        f = request.form
        action = f.get("action")
        vtype = "bike" if f.get("vehicle_type") == "bike" else "car"
        try:
            if action == "add":
                db.execute("INSERT INTO slots (location_id, slot_number, vehicle_type, is_active) VALUES (%s, %s, %s, 1)",
                           (int(f["location_id"]), f["slot_number"].strip().upper(), vtype))
                flash("Slot added.", "success")
            elif action == "edit":
                db.execute("UPDATE slots SET slot_number = %s, vehicle_type = %s, is_active = %s WHERE id = %s",
                           (f["slot_number"].strip().upper(), vtype, 1 if f.get("is_active") else 0, int(f["id"])))
                flash("Slot updated.", "success")
            elif action == "delete":
                used = db.query("SELECT COUNT(*) AS n FROM bookings WHERE slot_id = %s", (int(f["id"]),), one=True)["n"]
                if used:
                    db.execute("UPDATE slots SET is_active = 0 WHERE id = %s", (int(f["id"]),))
                    flash("Slot has bookings, so it was deactivated instead of deleted.", "success")
                else:
                    db.execute("DELETE FROM slots WHERE id = %s", (int(f["id"]),))
                    flash("Slot deleted.", "success")
        except Exception:
            flash("Could not save: that slot number may already exist at this location.", "error")
        return redirect(url_for("slots_page"))
    locations = db.query("SELECT id, name FROM parking_locations ORDER BY name")
    slots = db.query("SELECT s.*, l.name AS location_name FROM slots s "
                     "JOIN parking_locations l ON l.id = s.location_id ORDER BY l.name, s.slot_number")
    return render_template("admin/slots.html", locations=locations, slots=slots)


# ---------- JSON API ----------

# All locations with free/total slot counts right now
@app.route("/api/locations")
def api_locations():
    rows = db.query("""
        SELECT l.id, l.name, l.address, l.latitude, l.longitude, l.price_per_hour,
               COUNT(s.id) AS total_slots,
               SUM(CASE WHEN s.id IS NOT NULL AND NOT EXISTS (
                   SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status IN ('booked','entered')
                   AND b.start_time < NOW() AND b.end_time > NOW()) THEN 1 ELSE 0 END) AS free_slots
        FROM parking_locations l
        LEFT JOIN slots s ON s.location_id = l.id AND s.is_active = 1
        GROUP BY l.id ORDER BY l.name""")
    for r in rows:
        for k in ("latitude", "longitude", "price_per_hour"):
            r[k] = float(r[k])
        r["total_slots"] = int(r["total_slots"])
        r["free_slots"] = int(r["free_slots"] or 0)
    return ok(rows)


# Slots of one location, with availability for a time range (default: now)
@app.route("/api/slots")
def api_slots():
    loc = request.args.get("location_id", type=int)
    if not loc:
        return fail("location_id required")
    start = parse_time(request.args["start"]) if request.args.get("start") else datetime.now()
    end = parse_time(request.args["end"]) if request.args.get("end") else start
    if not start or not end:
        return fail("bad time format, use YYYY-MM-DD HH:MM")
    if end == start:
        end = start + timedelta(seconds=1)
    rows = db.query("""
        SELECT s.id, s.slot_number, s.vehicle_type,
               NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = s.id AND b.status IN ('booked','entered')
                           AND b.start_time < %s AND b.end_time > %s) AS available
        FROM slots s WHERE s.location_id = %s AND s.is_active = 1 ORDER BY s.slot_number""", (end, start, loc))
    for r in rows:
        r["available"] = bool(r["available"])
    return ok(rows)


# Book a slot. Blocks double booking with a row lock + overlap check.
@app.route("/api/book", methods=["POST"])
@api_login
def api_book():
    data = body()
    slot_id = int(data.get("slot_id") or 0)
    vehicle = str(data.get("vehicle_number", "")).strip().upper()
    start = parse_time(data.get("start_time"))
    end = parse_time(data.get("end_time"))
    if not slot_id or not vehicle:
        return fail("slot and vehicle number are required")
    if not start or not end:
        return fail("bad time format, use YYYY-MM-DD HH:MM")
    if end <= start:
        return fail("end time must be after start time")
    if end < datetime.now():
        return fail("that time has already passed")

    conn = db.connect()
    conn.autocommit(False)
    try:
        with conn.cursor() as cur:
            # Lock this slot so two people can't book it at the same moment
            cur.execute("SELECT s.id, l.price_per_hour FROM slots s JOIN parking_locations l ON l.id = s.location_id "
                        "WHERE s.id = %s AND s.is_active = 1 FOR UPDATE", (slot_id,))
            slot = cur.fetchone()
            if not slot:
                conn.rollback()
                return fail("slot not found", 404)
            # Overlap: existing start < new end AND existing end > new start
            cur.execute("SELECT COUNT(*) AS n FROM bookings WHERE slot_id = %s AND status IN ('booked','entered') "
                        "AND start_time < %s AND end_time > %s", (slot_id, end, start))
            if cur.fetchone()["n"] > 0:
                conn.rollback()
                return fail("slot already booked for that time", 409)
            hours = max(1, math.ceil((end - start).total_seconds() / 3600))
            amount = hours * float(slot["price_per_hour"])
            cur.execute("INSERT INTO bookings (user_id, slot_id, vehicle_number, start_time, end_time, amount, "
                        "status, payment_status, qr_token) VALUES (%s, %s, %s, %s, %s, %s, 'booked', 'pending', %s)",
                        (session["user"]["id"], slot_id, vehicle, start, end, amount, secrets.token_hex(16)))
            booking_id = cur.lastrowid
        conn.commit()
    finally:
        conn.close()
    return ok({"booking_id": booking_id, "amount": amount})


# Cancel your own unpaid booking
@app.route("/api/cancel", methods=["POST"])
@api_login
def api_cancel():
    bid = int(body().get("booking_id") or 0)
    b = db.query("SELECT * FROM bookings WHERE id = %s AND user_id = %s", (bid, session["user"]["id"]), one=True)
    if not b:
        return fail("booking not found", 404)
    if b["payment_status"] == "paid":
        return fail("paid bookings cannot be cancelled")
    if b["status"] != "booked":
        return fail("booking is already " + b["status"])
    db.execute("UPDATE bookings SET status = 'cancelled' WHERE id = %s", (bid,))
    return ok({"cancelled": True})


# Mock payment: mark the booking as paid
@app.route("/api/pay", methods=["POST"])
@api_login
def api_pay():
    bid = int(body().get("booking_id") or 0)
    b = db.query("SELECT * FROM bookings WHERE id = %s AND user_id = %s", (bid, session["user"]["id"]), one=True)
    if not b:
        return fail("booking not found", 404)
    if b["status"] != "booked":
        return fail("only active bookings can be paid")
    if b["payment_status"] == "paid":
        return ok({"payment_ref": b["payment_ref"], "qr_token": b["qr_token"]})
    ref = "MOCK" + secrets.token_hex(4).upper()
    db.execute("UPDATE bookings SET payment_status = 'paid', payment_ref = %s WHERE id = %s", (ref, bid))
    return ok({"payment_ref": ref, "qr_token": b["qr_token"]})


# The logged-in user's bookings (QR token only once paid)
@app.route("/api/my_bookings")
@api_login
def api_my_bookings():
    rows = db.query("""
        SELECT b.id, b.vehicle_number, b.start_time, b.end_time, b.amount, b.status, b.payment_status,
               b.payment_ref, b.qr_token, b.entry_time, b.exit_time, s.slot_number, l.name AS location_name
        FROM bookings b JOIN slots s ON s.id = b.slot_id JOIN parking_locations l ON l.id = s.location_id
        WHERE b.user_id = %s ORDER BY b.start_time DESC""", (session["user"]["id"],))
    for r in rows:
        r["amount"] = float(r["amount"])
        for k in ("start_time", "end_time", "entry_time", "exit_time"):
            if r[k]:
                r[k] = r[k].strftime("%Y-%m-%d %H:%M:%S")
        if r["payment_status"] != "paid":
            r["qr_token"] = None
    return ok(rows)


# Admin scans QR. Paid+booked -> entered (inside the time window). Entered -> new exit OTP.
@app.route("/api/verify_qr", methods=["POST"])
@api_admin
def api_verify_qr():
    b = db.query("SELECT b.*, s.slot_number, u.name AS user_name FROM bookings b "
                 "JOIN slots s ON s.id = b.slot_id JOIN users u ON u.id = b.user_id WHERE b.qr_token = %s",
                 (str(body().get("qr_token", "")).strip(),), one=True)
    if not b:
        return fail("invalid QR code", 404)
    info = {"booking_id": b["id"], "user_name": b["user_name"],
            "vehicle_number": b["vehicle_number"], "slot_number": b["slot_number"]}
    now = datetime.now()

    if b["status"] == "booked":
        if b["payment_status"] != "paid":
            return fail("booking is not paid")
        if now < b["start_time"] - timedelta(minutes=15):
            return fail("too early: booking starts at %s" % b["start_time"])
        if now > b["end_time"]:
            return fail("booking expired at %s" % b["end_time"])
        db.execute("UPDATE bookings SET status = 'entered', entry_time = NOW() WHERE id = %s", (b["id"],))
        return ok({**info, "action": "entry", "status": "entered"})

    if b["status"] == "entered":
        otp = str(random.randint(100000, 999999))
        db.execute("UPDATE bookings SET exit_otp_hash = %s, otp_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) "
                   "WHERE id = %s", (bcrypt.hashpw(otp.encode(), bcrypt.gensalt()).decode(), b["id"]))
        overstay = max(0, math.ceil((now - b["end_time"]).total_seconds() / 60))
        # Demo only: OTP is returned so it can be shown (in real life it would be SMSed)
        return ok({**info, "action": "exit", "status": "entered", "otp": otp, "overstay_minutes": overstay})

    return fail("booking is " + b["status"])


# Admin confirms exit with the OTP -> completed
@app.route("/api/exit_otp", methods=["POST"])
@api_admin
def api_exit_otp():
    data = body()
    bid = int(data.get("booking_id") or 0)
    b = db.query("SELECT * FROM bookings WHERE id = %s AND status = 'entered'", (bid,), one=True)
    if not b or not b["exit_otp_hash"]:
        return fail("no exit pending for this booking")
    if b["otp_expires_at"] < datetime.now():
        return fail("OTP expired, scan the QR again")
    if not bcrypt.checkpw(str(data.get("otp", "")).strip().encode(), b["exit_otp_hash"].encode()):
        return fail("wrong OTP")
    db.execute("UPDATE bookings SET status = 'completed', exit_time = NOW(), exit_otp_hash = NULL WHERE id = %s", (bid,))
    return ok({"booking_id": bid, "status": "completed"})


# Admin dashboard numbers
@app.route("/api/admin_stats")
@api_admin
def api_admin_stats():
    one = lambda sql: db.query(sql, one=True)["n"]
    recent = db.query("""
        SELECT b.id, u.name AS user_name, b.vehicle_number, s.slot_number, l.name AS location_name,
               b.start_time, b.end_time, b.status, b.payment_status
        FROM bookings b JOIN users u ON u.id = b.user_id JOIN slots s ON s.id = b.slot_id
        JOIN parking_locations l ON l.id = s.location_id ORDER BY b.created_at DESC LIMIT 10""")
    for r in recent:
        r["start_time"] = r["start_time"].strftime("%Y-%m-%d %H:%M:%S")
        r["end_time"] = r["end_time"].strftime("%Y-%m-%d %H:%M:%S")
    return ok({
        "total_slots": int(one("SELECT COUNT(*) AS n FROM slots WHERE is_active = 1")),
        "occupied_now": int(one("SELECT COUNT(DISTINCT slot_id) AS n FROM bookings WHERE status IN ('booked','entered') "
                                "AND start_time < NOW() AND end_time > NOW()")),
        "today_bookings": int(one("SELECT COUNT(*) AS n FROM bookings WHERE DATE(created_at) = CURDATE()")),
        "revenue": float(one("SELECT COALESCE(SUM(amount), 0) AS n FROM bookings "
                             "WHERE payment_status = 'paid' AND status <> 'cancelled'")),
        "recent": recent,
    })


if __name__ == "__main__":
    app.run(debug=True)
