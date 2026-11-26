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
  // Login is required for everything: a 401 (e.g. the session expired) sends you back to the login page
  if (res.status === 401 && typeof window !== 'undefined'
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

// ---------------------------------------------------------------------------
// Small in-memory cache so pages open instantly:
//   apiCached(url, onData) shows the last known data right away (if any), then fetches fresh data
//   and calls onData again. prefetchApi(url) warms the cache (used on hover and after login).
// Only GET requests are cached, only in this browser tab, and every page still refreshes from the server.
// ---------------------------------------------------------------------------
const cache = new Map();
const inflight = new Map();

const fetchedAt = new Map();

// maxAge (ms): skip the request if this URL was fetched that recently (used by background warming)
export function prefetchApi(url, maxAge = 0) {
  if (inflight.has(url)) return inflight.get(url);
  if (maxAge && cache.has(url) && Date.now() - (fetchedAt.get(url) || 0) < maxAge) return Promise.resolve(cache.get(url));
  const p = api(url).then((d) => { cache.set(url, d); fetchedAt.set(url, Date.now()); return d; }).finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

export function apiCached(url, onData) {
  if (cache.has(url)) onData(cache.get(url));
  return prefetchApi(url).then((d) => { onData(d); return d; });
}

export function peekApi(url) { return cache.get(url); }
export function clearApiCache() { cache.clear(); fetchedAt.clear(); }
