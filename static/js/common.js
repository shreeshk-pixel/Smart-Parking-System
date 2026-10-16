// Small helper used by every page: calls an API and returns data, or throws an error message.
async function api(url, body) {
  const opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
  const res = await fetch((window.BASE || '') + url, opts);
  if (res.status === 401) { location.href = (window.BASE || '') + '/login'; throw new Error('login required'); }
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}
function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }
function msg(el, text, ok) { el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err'); }
