#!/usr/bin/env node
// Deterministic sanity audit of the BidForge engine against NTXP benchmarks.
// usage: node schedule_audit.mjs [scenarios.json] > audit.json
// Scenario: { id, label, sf, sector, tier, modules[], expect: { constructionWd:[lo,hi], totalCd:[lo,hi] } }
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const imp = p => import(pathToFileURL(path.join(root, p)).href);
const { buildWbs, envelopeWd } = await imp('web/src/utils/jevTree.js');
const { calculateSchedule } = await imp('web/src/utils/scheduler.js');

// ntxp-gantt-schedule parametric benchmark (fitted on four NTXP projects):
// WD = 2.13 x AffectedSF^0.379 x sector x tier x constraints
export const parametricWd = (sf, k = 1) => Math.round(2.13 * Math.pow(sf, 0.379) * k);

// Council consensus target bands (2026-10-13 schedule audit, overlap of the three seats' ranges).
const DEFAULT_SCENARIOS = [
  { id: 'A', label: 'ISD light refresh — paint, ceilings, flooring, 3,000 SF, summer', scope: { tier: 'light', sf: 3000, sector: 'isd', constraints: [] }, modules: ['isd_college'], target: { cons: [20, 35], cd: [65, 125], conc: 60 } },
  { id: 'B', label: 'Standard interior renovation — 10,000 SF office/classroom', scope: { tier: 'standard', sf: 10000, sector: 'isd', constraints: [] }, modules: ['selective_demo', 'fire_alarm', 'fire_suppression', 'low_voltage'], target: { cons: [60, 85], cd: [140, 195], conc: 70 } },
  { id: 'C', label: 'Occupied clinic renovation with ICRA — 6,000 SF', scope: { tier: 'standard', sf: 6000, sector: 'healthcare', constraints: ['occupied', 'icra', 'phased'] }, modules: ['selective_demo', 'abatement', 'icra', 'occupied_phasing', 'medical_specific', 'medical_specialties', 'fire_alarm', 'fire_suppression', 'low_voltage'], target: { cons: [75, 100], cd: [175, 235], conc: 70 } },
  { id: 'D', label: 'ISD summer RTU replacement — 4 units', scope: { tier: 'equipment', sf: 2000, sector: 'isd', constraints: [], units: 4 }, modules: ['hvac_replacement', 'isd_college'], target: { cons: [15, 36], cd: [95, 200], conc: 50 } },
  { id: 'E', label: 'County jail holding-area renovation — 4,000 SF', scope: { tier: 'standard', sf: 4000, sector: 'secured', constraints: ['secure'] }, modules: ['selective_demo', 'secured_building', 'access_control', 'fire_alarm'], target: { cons: [55, 80], cd: [140, 210], conc: 70 } },
];

const DAY = 86400000;
const d = s => new Date(`${s}T00:00:00`);
const wdBetween = (a, b) => { let n = 0; for (let x = d(a); x <= d(b); x = new Date(x.getTime() + DAY)) { const w = x.getDay(); if (w && w < 6) n++; } return n; };

function audit(sc) {
  const { wbs, dependencies } = buildWbs(sc.modules, sc.scope || null);
  const p = calculateSchedule({ name: sc.label, startDate: '2027-01-04', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], holidays: [], hoursPerDay: 8, wbs, dependencies });
  const phase = k => {
    const gs = p.wbs.filter(x => x.phaseKey === k && x.startDate);
    return gs.length ? { startDate: gs.map(g => g.startDate).sort()[0], endDate: gs.map(g => g.endDate).sort().pop(), children: gs.flatMap(g => g.children) } : null;
  };
  const span = ph => (ph?.startDate && ph?.endDate ? wdBetween(ph.startDate, ph.endDate) : 0);
  const cons = (phase('construction')?.children || []).filter(t => t.duration > 0);
  const concurrent = cons.filter(t => cons.some(o => o !== t && o.startDate <= t.endDate && o.endDate >= t.startDate)).length;
  const all = p.wbs.flatMap(x => x.children).filter(t => !t.isReference);
  const bench = sc.scope ? envelopeWd(sc.scope) : parametricWd(sc.sf, sc.k);
  const consWd = span(phase('construction'));
  const conc = Math.round((concurrent / Math.max(cons.length, 1)) * 100);
  const crit = Math.round((all.filter(t => t.isCritical).length / all.length) * 100);
  const tgt = sc.target;
  const over10 = all.filter(t => t.duration > 10 && !/submittal|review|approv|processing/i.test(t.name));
  const checks = tgt ? {
    construction: consWd >= tgt.cons[0] && consWd <= tgt.cons[1],
    calendar: p.calendarDuration >= tgt.cd[0] && p.calendarDuration <= tgt.cd[1],
    concurrency: conc >= tgt.conc,
    critical: crit <= 50,
    tenDayCap: over10.length === 0,
  } : null;
  return {
    id: sc.id, label: sc.label, modules: sc.modules, activities: all.length,
    totalWd: p.workingDuration, totalCd: p.calendarDuration,
    precWd: span(phase('preconstruction')), constructionWd: consWd, closeoutWd: span(phase('closeout')),
    benchmarkConstructionWd: bench, ratioToBenchmark: Math.round((consWd / bench) * 100) / 100,
    pctConcurrentConstruction: conc,
    criticalPct: crit,
    target: tgt || null, checks, pass: checks ? Object.values(checks).every(Boolean) : null,
    maxActivityWd: Math.max(...all.map(t => t.duration)),
    over10Wd: all.filter(t => t.duration > 10).map(t => `${t.name} (${t.duration}d)`),
    linkTypes: [...new Set(dependencies.map(x => x.type))],
    sumOfDurationsConstruction: cons.reduce((s, t) => s + t.duration, 0),
  };
}

const scenarios = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : DEFAULT_SCENARIOS;
const results = scenarios.map(audit);
process.stdout.write(JSON.stringify({ engine: 'bidforge jevTree + scheduler', at: new Date().toISOString(), results }, null, 2));
