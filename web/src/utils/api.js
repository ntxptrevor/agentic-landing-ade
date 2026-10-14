// Client for the schedule.ntxpllc.com server (web/public/api, PHP on Hostinger).
// Without a server (local dev, file://, a static mirror) every call resolves to
// { available: false } and the app runs offline with browser storage.

const H = { 'Content-Type': 'application/json', 'X-BidForge': '1' };

async function call(path, opts = {}) {
  let res;
  try {
    res = await fetch(path, { credentials: 'same-origin', ...opts });
  } catch {
    return { ok: false, status: 0, offline: true };
  }
  const type = res.headers.get('content-type') || '';
  if (!type.includes('application/json')) return { ok: false, status: res.status, offline: res.status === 404 || res.ok };
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, data };
}

export async function getSession() {
  const r = await call('./api/session.php');
  if (r.offline || (!r.ok && !r.data)) return { available: false, authenticated: false };
  return { available: true, ...r.data };
}

export async function loginPassphrase(passphrase) {
  const r = await call('./api/login.php', { method: 'POST', headers: H, body: JSON.stringify({ passphrase }) });
  return r.ok ? { ok: true, ...r.data } : { ok: false, error: r.status === 429 ? 'Too many attempts — wait 15 minutes.' : 'Passphrase not accepted.' };
}

export async function logout() {
  await call('./api/logout.php', { method: 'POST', headers: H, body: '{}' });
}

export async function listProjects(all = false) {
  const r = await call(`./api/projects.php${all ? '?all=1' : ''}`);
  return r.ok ? r.data.projects || [] : [];
}

export async function loadProject(slug) {
  const r = await call(`./api/project.php?slug=${encodeURIComponent(slug)}`);
  return r.ok ? r.data : null;
}

// Fork guard: the server refuses the save (409) unless baseVersion/baseHash match what it holds.
export async function saveProject({ slug, name, status, canonical, baseVersion, baseHash, reason, sources }) {
  const r = await call('./api/save.php', { method: 'POST', headers: H, body: JSON.stringify({ slug, name, status, canonical, baseVersion, baseHash, reason, sources }) });
  if (r.status === 409) return { ok: false, conflict: true, ...r.data };
  return r.ok ? { ok: true, ...r.data } : { ok: false, error: r.data?.error || `Save failed (${r.status || 'offline'})` };
}

export async function uploadFiles(slug, kind, files) {
  const fd = new FormData();
  fd.append('slug', slug);
  fd.append('kind', kind);
  for (const f of files) fd.append('files[]', f, f.name);
  const r = await call('./api/upload.php', { method: 'POST', headers: { 'X-BidForge': '1' }, body: fd });
  return r.ok ? r.data.files || r.data.uploads || [] : [];
}

export const liveUrl = slug => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}?project=${encodeURIComponent(slug)}`;

// sha256 hex of a string (matches the server's hash of the stored canonical bytes).
export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
