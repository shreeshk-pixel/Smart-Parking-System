# Database helper: one small function to run SQL safely with %s placeholders
import os
import pymysql

# Settings come from environment variables when hosted (Vercel).
# On your laptop they fall back to XAMPP's defaults.
DB = dict(
    host=os.environ.get("DB_HOST", "localhost"),
    port=int(os.environ.get("DB_PORT", "3306")),
    user=os.environ.get("DB_USER", "root"),
    password=os.environ.get("DB_PASSWORD", ""),
    database=os.environ.get("DB_NAME", "smart_parking"),
    charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor, autocommit=True,
)
# Cloud MySQL (Aiven, TiDB) needs an encrypted connection: set DB_SSL=1.
# Aiven also gives a CA certificate: paste its text into DB_SSL_CA_CERT.
if os.environ.get("DB_SSL") == "1":
    cert = os.environ.get("DB_SSL_CA_CERT")
    ca_path = None
    if cert:
        ca_path = "/tmp/db-ca.pem"
        with open(ca_path, "w") as f:
            f.write(cert)
    DB["ssl"] = {"ca": ca_path}


def connect():
    conn = pymysql.connect(**DB)
    with conn.cursor() as cur:
        cur.execute("SET time_zone = '+05:30'")  # Indian time, same as Python side
    return conn


def query(sql, params=(), one=False):
    """Run a SELECT and return rows (or a single row if one=True)."""
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone() if one else cur.fetchall()
    finally:
        conn.close()


def execute(sql, params=()):
    """Run INSERT/UPDATE/DELETE. Returns (rows affected, last insert id)."""
    conn = connect()
    try:
        with conn.cursor() as cur:
            n = cur.execute(sql, params)
            return n, cur.lastrowid
    finally:
        conn.close()
