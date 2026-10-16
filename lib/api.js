// Browser-side helper used by the pages.
// api(url)              -> GET
// api(url, body)        -> POST JSON
// api(url, body, 'PUT') -> any method with JSON
// Returns `data` on success, throws Error(message) on failure. A 401 sends you to /login.
export async function api(url, body, method) {
  const opts = { method: method || (body === undefined ? 'GET' : 'POST'), headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({ ok: false, error: 'server error' }));
  // /api/me is allowed to return 401 (it just means "logged out"), so guests can still see the map and register.
  if (res.status === 401 && typeof window !== 'undefined' && !url.startsWith('/api/me')
      && !location.pathname.startsWith('/login') && !location.pathname.startsWith('/register')) {
    location.href = '/login';
  }
  if (!json.ok) throw new Error(json.error || 'something went wrong');
  return json.data;
}

// "2026-10-16 18:30:00" -> "16 Oct 2026, 6:30 pm"
export function fmt(t) {
  if (!t) return '-';
  // The API sends IST text with no zone, so add +05:30 and show it in IST whatever the viewer's clock says
  const d = new Date(String(t).replace(' ', 'T') + (/[Z+]/.test(String(t).slice(10)) ? '' : '+05:30'));
  if (isNaN(d)) return t;
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}
