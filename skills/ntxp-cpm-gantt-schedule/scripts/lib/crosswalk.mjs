// Deterministic project-identifier crosswalk (council audit #3, A-13 / F-06). No dependencies.
// The agent runs the connector queries printed by env_scan.mjs, saves the results as one scan
// JSON, and these functions decide which record in each system belongs to the project.
//
//   scoreCandidate(project, candidate)  → { score 0..1, parts }   (explicit WEIGHTS below)
//   resolveLinks(project, candidates)   → { links, confidence, ambiguous, missing }
//   verifyLinks(canonical, scanned)     → { ok, drift:[…] }
//
// Decision rule: a link is picked only when the best candidate scores >= THRESHOLD and beats the
// runner-up by >= MARGIN. Ambiguous matches are never auto-picked; they are returned for the user.
import { view } from './canonical_read.mjs';

export const WEIGHTS = { number: 0.45, name: 0.35, address: 0.12, owner: 0.08 };
export const THRESHOLD = 0.75;
export const MARGIN = 0.1;
export const ARCHIVED_FACTOR = 0.9; // prefer current records over archived ones

// candidates key → link field, and how a candidate's id is read
export const SOURCES = {
  jobtread: { link: 'jobtreadJobId', id: c => c.id },
  driveBid: { link: 'driveBidFolderId', id: c => c.id },
  driveProject: { link: 'driveProjectFolderId', id: c => c.id },
  lightfield: { link: 'lightfieldId', id: c => c.id },
  quickbooks: { link: 'quickbooksProjectId', id: c => c.id },
  kb: { link: 'kbPath', id: c => c.path || c.id },
  site: { link: 'siteSlug', id: c => c.slug || c.id },
};

const ABBR = {
  es: 'elementary', elem: 'elementary', el: 'elementary', ms: 'middle', jh: 'middle', hs: 'high', reno: 'renovation',
  renov: 'renovation', bldg: 'building', univ: 'university', ctr: 'center', cntr: 'center', rm: 'room', rr: 'restroom',
  restrooms: 'restroom', st: 'street', ave: 'avenue', rd: 'road', blvd: 'boulevard', dr: 'drive', hwy: 'highway', ste: 'suite',
  n: 'north', s: 'south', e: 'east', w: 'west', isd: 'isd', utsw: 'utsw', '&': 'and',
};
const STOP = new Set(['the', 'of', 'and', 'at', 'for', 'a', 'an', 'project', 'job', 'bid', 'proposal', 'schedule', 'inc', 'llc', 'to', 'in']);

export function normalizeName(s) {
  return String(s ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\((?:bid|test[^)]*|archived?|old|copy)\)/g, ' ')
    .replace(/\btest\s*-\s*safe to delete\b/g, ' ')
    .replace(/^[!#\s]+/, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ').filter(Boolean).map(w => ABBR[w] || w).join(' ')
    .trim();
}

export function tokens(s) {
  return normalizeName(s).split(' ').filter(w => w && !STOP.has(w));
}

const digits = s => String(s ?? '').replace(/\D+/g, '');

// Token similarity: max of Dice coefficient and containment of the shorter set (handles
// "McShan ES" vs "McShan Elementary Restroom Renovation").
export function nameSimilarity(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const dice = (2 * inter) / (A.size + B.size);
  const contain = inter / Math.min(A.size, B.size);
  // containment needs at least two shared tokens (or a one-token name) to count fully
  const c = Math.min(A.size, B.size) === 1 || inter >= 2 ? contain : contain * 0.6;
  return Math.max(dice, 0.85 * c);
}

function numberSimilarity(project, cand) {
  const pn = digits(project.number);
  if (!pn) return null;
  const cn = digits(cand.number);
  if (cn) return cn === pn ? 1 : 0;
  // folder / account names often carry the job number
  const hay = ` ${String(cand.name ?? '')} ${String(cand.path ?? '')} `;
  return new RegExp(`(^|\\D)${pn}(\\D|$)`).test(hay) ? 1 : null;
}

export function scoreCandidate(project, candidate) {
  const parts = {};
  const num = numberSimilarity(project, candidate);
  if (num !== null) parts.number = num;
  if (project.name && (candidate.name || candidate.path || candidate.slug)) parts.name = nameSimilarity(project.name, candidate.name || candidate.path || candidate.slug);
  if (project.address && candidate.address) parts.address = nameSimilarity(project.address, candidate.address);
  if (project.owner && candidate.owner) parts.owner = nameSimilarity(project.owner, candidate.owner);
  let w = 0, s = 0;
  for (const [k, v] of Object.entries(parts)) { w += WEIGHTS[k]; s += WEIGHTS[k] * v; }
  let score = w ? s / w : 0;
  if (parts.number === 0) score = Math.min(score, 0.5); // a different job number is never the same job
  if (candidate.archived || /\barchiv/i.test(String(candidate.name ?? '') + String(candidate.path ?? ''))) score *= ARCHIVED_FACTOR;
  return { score: Math.round(score * 1000) / 1000, parts };
}

export function resolveLinks(project, candidates = {}, { threshold = THRESHOLD, margin = MARGIN } = {}) {
  const links = {}, confidence = {}, ambiguous = [], missing = [];
  for (const [key, def] of Object.entries(SOURCES)) {
    const list = Array.isArray(candidates[key]) ? candidates[key] : [];
    const ranked = list.map(c => ({ c, ...scoreCandidate(project, c) })).sort((a, b) => b.score - a.score);
    const [best, second] = ranked;
    if (!best || best.score < threshold) {
      missing.push({ key, link: def.link, best: best ? { id: def.id(best.c), name: best.c.name, score: best.score } : null, searched: list.length });
      continue;
    }
    if (second && best.score - second.score < margin) {
      ambiguous.push({ key, link: def.link, candidates: ranked.slice(0, 3).map(r => ({ id: def.id(r.c), name: r.c.name, score: r.score })) });
      continue;
    }
    links[def.link] = def.id(best.c);
    confidence[def.link] = best.score;
    if (key === 'jobtread' && best.c.number) { links.jobNumber = String(best.c.number); confidence.jobNumber = best.score; }
  }
  return { links, confidence, ambiguous, missing };
}

// Project identity from a canonical document (either shape).
export function projectOf(canonical) {
  const v = view(canonical);
  const s = v.scope || {};
  return {
    name: v.project.name || v.name,
    number: v.links.jobNumber || v.project.jobNumber || v.project.number || s.jobNumber || '',
    address: v.project.address || s.address || '',
    owner: v.project.owner || s.owner || s.ownerName || '',
    slug: v.slug,
  };
}

// Drift between the links stored in a canonical and a fresh scan.
//   missing_id    a linked id is no longer found in its system
//   name_changed  the linked record's name no longer matches the project (score < threshold)
//   better_match  another record now resolves with confidence above the linked one (by MARGIN)
export function verifyLinks(canonical, scanned = {}, opts = {}) {
  const v = view(canonical);
  const project = projectOf(canonical);
  const links = { ...v.links };
  const cands = scanned.candidates || scanned;
  const fresh = resolveLinks(project, cands, opts);
  const drift = [];
  for (const [key, def] of Object.entries(SOURCES)) {
    let linked = links[def.link];
    // legacy single Drive link: accept it in either Drive list
    if (!linked && (key === 'driveBid' || key === 'driveProject') && links.driveFolderId) {
      const inThis = (cands[key] || []).some(c => def.id(c) === links.driveFolderId);
      if (!inThis) continue;
      linked = links.driveFolderId;
    }
    if (!linked) {
      if (fresh.links[def.link]) drift.push({ key, link: def.link, type: 'unlinked_match', found: fresh.links[def.link], score: fresh.confidence[def.link] });
      continue;
    }
    const list = Array.isArray(cands[key]) ? cands[key] : null;
    if (!list) continue; // source not scanned: nothing to compare
    const rec = list.find(c => def.id(c) === linked);
    if (!rec) { drift.push({ key, link: def.link, type: 'missing_id', linked }); continue; }
    const own = scoreCandidate(project, rec).score;
    if (own < (opts.threshold ?? THRESHOLD)) drift.push({ key, link: def.link, type: 'name_changed', linked, name: rec.name, score: own });
    const better = fresh.links[def.link];
    if (better && better !== linked && fresh.confidence[def.link] - own >= (opts.margin ?? MARGIN)) {
      drift.push({ key, link: def.link, type: 'better_match', linked, found: better, score: fresh.confidence[def.link], linkedScore: own });
    }
  }
  return { ok: drift.length === 0, project, drift, ambiguous: fresh.ambiguous };
}
