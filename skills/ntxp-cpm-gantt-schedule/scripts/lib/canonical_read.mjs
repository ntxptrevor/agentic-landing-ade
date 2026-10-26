// Read-only view over a bidforge.canonical.v1 document, shared by schedule_query.mjs and
// oac_gate.mjs. No dependencies. Tolerates both document shapes:
//   flat (buildCanonicalDocument): { version, project, wbs, changelog, sync, ... }
//   nested: { meta: { version, changelog, links, scope, coda, sync }, project: { wbs, ... } }
// Every accessor degrades to an empty value when a field is missing.
import fs from 'node:fs';

const DAY = 86400000;

export function loadCanonical(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const doc = JSON.parse(raw);
  if (!doc || typeof doc !== 'object') throw new Error('canonical file is not a JSON object');
  return doc;
}

export function isoDate(d) { return new Date(d).toISOString().slice(0, 10); }
export function parseDay(s) { return s ? new Date(`${String(s).slice(0, 10)}T00:00:00Z`) : null; }
export function calDays(a, b) { return Math.round((parseDay(b) - parseDay(a)) / DAY); }
export function addDays(s, n) { return isoDate(parseDay(s).getTime() + n * DAY); }
export function mondayOf(s) { const d = parseDay(s); const w = d.getUTCDay() || 7; return isoDate(d.getTime() - (w - 1) * DAY); }

const arr = v => (Array.isArray(v) ? v : []);

export function view(doc) {
  const meta = doc.meta && typeof doc.meta === 'object' ? doc.meta : {};
  const get = k => (meta[k] !== undefined ? meta[k] : doc[k]);
  const project = doc.project || {};
  const wbs = arr(project.wbs).length ? project.wbs : arr(doc.wbs);
  const tasks = [];
  const walk = (nodes, phase) => {
    for (const n of arr(nodes)) {
      if (!n || typeof n !== 'object') continue;
      if (n.type === 'phase' || (!phase && arr(n.children).length && n.type !== 'task')) { walk(n.children, n); continue; }
      tasks.push({ ...n, phaseName: phase?.name || '', phaseKey: phase?.phaseKey || '' });
      if (arr(n.children).length) walk(n.children, phase);
    }
  };
  walk(wbs, null);
  const linkKeys = ['jobtreadJobId', 'driveFolderId', 'driveFolderName', 'quickbooksProjectId', 'kbPath', 'hostUrl'];
  const links = { ...Object.fromEntries(linkKeys.filter(k => project[k]).map(k => [k, project[k]])), ...(get('links') || {}) };
  const sync = get('sync') || {};
  return {
    doc, meta, get, project, wbs, tasks, links, sync,
    name: project.name || doc.name || '(unnamed project)',
    slug: project.slug || '',
    version: Number(get('version') ?? 0) || 0,
    changelog: arr(get('changelog')),
    activity: arr(get('activity')),
    scope: get('scope') || null,
    trackers: get('trackers') || {},
  };
}

export const pct = t => (t.actualFinish ? 100 : Number(t.percentComplete) || 0);
export const real = t => !t.isReference;

// Substantial completion: the last non-reference task named "substantial completion".
export function scInfo(v) {
  const cands = v.tasks.filter(t => real(t) && /substantial\s+completion/i.test(t.name || '') && t.endDate);
  cands.sort((a, b) => String(a.endDate).localeCompare(String(b.endDate)));
  const sc = cands[cands.length - 1] || null;
  const ref = v.tasks.find(t => t.isReference && /substantial\s+completion/i.test(t.name || ''));
  const s = v.scope || {};
  const contract = sc?.contractDate || ref?.contractDate || s.contractScDate || s.substantialCompletion
    || v.project.contractScDate || v.project.contractEndDate || null;
  const forecast = sc?.endDate || maxEnd(v) || null;
  return { task: sc, forecast, contract, varianceDays: contract && forecast ? calDays(contract, forecast) : null };
}

export function maxEnd(v) {
  return v.tasks.map(t => t.endDate).filter(Boolean).sort().pop() || v.project.endDate || null;
}

export function percentComplete(v) {
  const ts = v.tasks.filter(t => real(t) && !t.isMilestone);
  const w = ts.reduce((s, t) => s + Math.max(1, Number(t.duration) || 0), 0);
  if (!w) return 0;
  return Math.round((ts.reduce((s, t) => s + Math.max(1, Number(t.duration) || 0) * pct(t), 0) / w) * 10) / 10;
}

export function variance(t) {
  if (typeof t.milestoneVariance === 'number') return t.milestoneVariance;
  return t.contractDate && t.endDate ? calDays(t.contractDate, t.endDate) : null;
}

// Pending sync items, under whichever name a writer used.
export function pendingItems(v) {
  const s = v.sync;
  const lists = [s.pending, s.pendingItems, s.pending_sync, s.pendingSync, v.get('pending_sync'), v.get('pendingSync'), v.get('pending')];
  const seen = new Set();
  const out = [];
  for (const l of lists) for (const it of arr(l)) {
    if (!it || typeof it !== 'object' || seen.has(it)) continue;
    seen.add(it);
    out.push(it);
  }
  // Changelog entries explicitly awaiting acknowledgement count too.
  for (const e of v.changelog) if (e && (e.acknowledged === false || e.status === 'pending_ack')) out.push({ ...e, fromChangelog: true });
  return out;
}

const DONE = new Set(['applied', 'acknowledged', 'approved', 'rejected', 'dismissed', 'resolved', 'declined']);
export const rating = it => Number(it.jevRating ?? it.rating ?? 0) || 0;
export const isOpen = it => !(it.acknowledged === true || it.approved === true || it.applied === true || it.resolved === true || DONE.has(String(it.status || '').toLowerCase()));

export function publishedVersion(v) {
  const s = v.sync;
  const cands = [s.publishedVersion, s.lastPublish?.version, s.publish?.version, s.lastPublishedVersion,
    v.get('publishedVersion'), v.get('published')?.version, v.get('publish')?.version, v.links.publishedVersion];
  for (const c of cands) if (c !== undefined && c !== null && c !== '') return Number(c);
  return null;
}

export function lastSync(v) {
  const s = v.sync;
  const ts = [s.lastFullSyncAt, s.lastSyncAt].filter(Boolean).sort();
  return ts.length ? ts[ts.length - 1] : null;
}

export function lastOac(v, today) {
  const s = v.sync;
  const direct = s.lastOacAt || v.get('oac')?.lastAt || v.get('oac')?.lastReportAt;
  if (direct) return direct;
  const fromLog = v.changelog.filter(e => /oac/i.test(String(e.type || ''))).map(e => e.at).filter(Boolean).sort().pop();
  if (fromLog) return fromLog;
  const meeting = v.tasks.filter(t => /\boac\b/i.test(t.name || '') && t.actualFinish && t.actualFinish <= today).map(t => t.actualFinish).sort().pop();
  return meeting || null;
}

// Sources + links of a changelog entry, normalized to [{type, title, link}].
export function entrySources(e) {
  const out = [];
  const push = (s, fallbackType) => {
    if (!s) return;
    if (typeof s === 'string') out.push({ type: fallbackType || 'note', title: s, link: /^https?:\/\//.test(s) ? s : '' });
    else out.push({ type: s.type || s.kind || fallbackType || 'source', title: s.title || s.name || s.summary || '', link: s.link || s.url || s.href || '' });
  };
  push(e.source, 'source');
  for (const s of arr(e.sources)) push(s, 'source');
  for (const l of arr(e.links)) push(typeof l === 'string' ? { type: 'link', title: l, link: l } : l, 'link');
  if (e.link || e.url) push({ type: 'link', title: e.title || 'link', link: e.link || e.url });
  return out;
}

// Unpulled hosted-site saves: entries from GET /api/changes.php (un-acked pending saves) for this
// project, plus sync.siteSavedVersion newer than the KB-published version.
export function unpulledSiteSaves(v, changes) {
  const out = [];
  const list = Array.isArray(changes) ? changes : arr(changes?.changes);
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    if (v.slug && c.slug && c.slug !== v.slug) continue;
    out.push({ slug: c.slug || v.slug, version: Number(c.version) || null, savedAt: c.savedAt || null, by: c.by || null, reason: c.reason || '' });
  }
  const site = Number(v.sync.siteSavedVersion);
  const pub = publishedVersion(v);
  if (site && (pub === null || site > pub) && !out.some(c => c.version === site)) out.push({ slug: v.slug, version: site, savedAt: v.sync.siteSavedAt || null, by: null, reason: 'sync.siteSavedVersion > sync.publishedVersion' });
  return out;
}

export function checkGate(v, { maxAgeHours = 24, now = new Date(), changes = null } = {}) {
  const reasons = [];
  const last = lastSync(v);
  if (!last) reasons.push('Schedule has never been synced (no sync.lastSyncAt / sync.lastFullSyncAt).');
  else {
    const ageH = (now - new Date(last)) / 3600000;
    if (!(ageH <= maxAgeHours)) reasons.push(`Last sync ${last} is ${Math.round(ageH * 10) / 10} h old (limit ${maxAgeHours} h).`);
  }
  const blocking = pendingItems(v).filter(it => rating(it) >= 4 && isOpen(it));
  for (const it of blocking) reasons.push(`Pending JEV ${rating(it)} item not acknowledged: ${it.id || it.taskId || ''} ${it.summary || it.reason || it.type || ''}`.replace(/\s+/g, ' ').trim());
  const pub = publishedVersion(v);
  if (pub === null) reasons.push(`No published version recorded (sync.publishedVersion); canonical is v${v.version}.`);
  else if (pub !== v.version) reasons.push(`Published version v${pub} differs from canonical v${v.version} — republish first.`);
  const unpulled = unpulledSiteSaves(v, changes);
  for (const c of unpulled) reasons.push(`Unpulled site save${c.version ? ` v${c.version}` : ''}${c.savedAt ? ` (${c.savedAt}${c.by ? `, ${c.by}` : ''})` : ''} — pull it into the KB canonical (changes.php) and republish first.`);
  return { pass: reasons.length === 0, reasons, lastSync: last, publishedVersion: pub, version: v.version, blockingPending: blocking.length, unpulledSiteSaves: unpulled.length, maxAgeHours };
}

export const GATE_INSTRUCTION = (slug) => `Run /ntxp-cpm-gantt-schedule --sync ${slug || '<project>'} before generating the OAC report`;
