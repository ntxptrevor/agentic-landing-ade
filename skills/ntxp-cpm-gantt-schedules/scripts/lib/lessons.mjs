// Parser for knowledge/lessons-learned.md (shared by lessons_metrics.mjs and lesson_toggle.mjs).
// Entry heading: "### LL-YYYY-MM-DD-NN — title"; a range heading "### LL-2026-10-13-22…25 — …"
// (or "09…18", "-22..25") covers every id in the range. Each entry has a "Status: …" line and
// usually a "Remove by: …" line.

const HEAD = /^###\s+(LL-(\d{4}-\d{2}-\d{2})-(\d{2})(?:\s*(?:…|\.\.\.?|–|-)\s*(\d{2}))?)\s*(?:—|-{1,2})\s*(.*)$/;

export function expandIds(date, from, to) {
  const a = Number(from), b = to ? Number(to) : a;
  const out = [];
  for (let n = a; n <= Math.max(a, b); n++) out.push(`LL-${date}-${String(n).padStart(2, '0')}`);
  return out;
}

export function parseLessons(md) {
  const lines = String(md).split('\n');
  const out = [];
  let cur = null;
  lines.forEach((line, i) => {
    const m = line.match(HEAD);
    if (m) {
      if (cur) cur.end = i - 1;
      cur = { id: m[1].replace(/\s+/g, ''), ids: expandIds(m[2], m[3], m[4]), title: m[5].trim(), status: '', statusLine: -1, removeBy: '', start: i, end: lines.length - 1 };
      out.push(cur);
      return;
    }
    if (/^##\s/.test(line) && cur) { cur.end = i - 1; cur = null; return; }
    if (!cur) return;
    if (cur.statusLine < 0 && /^Status:/.test(line)) { cur.statusLine = i; cur.status = line.replace(/^Status:\s*/, '').split(/\s{2,}Scope:/)[0].replace(/\*\*/g, '').trim(); }
    if (/^Remove by:/.test(line)) cur.removeBy = line.replace(/^Remove by:\s*/, '').trim();
  });
  return out;
}

export function findLesson(lessons, id) {
  return lessons.find(l => l.id === id) || lessons.find(l => l.ids.includes(id)) || null;
}

export const statusKind = s => {
  const t = String(s || '').toLowerCase();
  if (t.startsWith('removed')) return 'removed';
  if (t.includes('awaiting')) return 'awaiting-user';
  if (t.includes('provisional')) return 'applied-provisional';
  if (t.startsWith('applied')) return 'applied';
  if (t.startsWith('answered')) return 'answered';
  return t.split(/[\s(]/)[0] || 'unknown';
};
