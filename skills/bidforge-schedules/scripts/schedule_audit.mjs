#!/usr/bin/env node
// Deterministic sanity audit of the BidForge engine against NTXP benchmarks.
// usage: node schedule_audit.mjs [scenarios.json] > audit.json
// Scenario: { id, label, sf, sector, tier, modules[], expect: { constructionWd:[lo,hi], totalCd:[lo,hi] } }
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const imp = p => import(pathToFileURL(path.join(root, p)).href);
const { buildWbs } = await imp('web/src/utils/jevTree.js');
const { calculateSchedule } = await imp('web/src/utils/scheduler.js');

// ntxp-gantt-schedule parametric benchmark (fitted on four NTXP projects):
// WD = 2.13 x AffectedSF^0.379 x sector x tier x constraints
export const parametricWd = (sf, k = 1) => Math.round(2.13 * Math.pow(sf, 0.379) * k);

const DEFAULT_SCENARIOS = [
  { id: 'A', label: 'ISD light refresh — paint, ceilings, flooring, 3,000 SF, summer', sf: 3000, k: 0.8, modules: ['isd_college'] },
  { id: 'B', label: 'Standard interior renovation — 10,000 SF office/classroom', sf: 10000, k: 1.0, modules: ['selective_demo', 'fire_alarm', 'fire_suppression', 'low_voltage'] },
  { id: 'C', label: 'Occupied clinic renovation with ICRA — 6,000 SF', sf: 6000, k: 1.3, modules: ['selective_demo', 'abatement', 'icra', 'occupied_phasing', 'medical_specific', 'medical_specialties', 'fire_alarm', 'fire_suppression', 'low_voltage'] },
  { id: 'D', label: 'ISD summer RTU replacement — 4 units', sf: 2000, k: 0.9, modules: ['hvac_replacement', 'isd_college'] },
  { id: 'E', label: 'County jail holding-area renovation — 4,000 SF', sf: 4000, k: 1.35, modules: ['selective_demo', 'secured_building', 'access_control', 'fire_alarm'] },
];

const DAY = 86400000;
const d = s => new Date(`${s}T00:00:00`);
const wdBetween = (a, b) => { let n = 0; for (let x = d(a); x <= d(b); x = new Date(x.getTime() + DAY)) { const w = x.getDay(); if (w && w < 6) n++; } return n; };

function audit(sc) {
  const { wbs, dependencies } = buildWbs(sc.modules);
  const p = calculateSchedule({ name: sc.label, startDate: '2027-01-04', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], holidays: [], hoursPerDay: 8, wbs, dependencies });
  const phase = k => p.wbs.find(x => x.phaseKey === k);
  const span = ph => (ph?.startDate && ph?.endDate ? wdBetween(ph.startDate, ph.endDate) : 0);
  const cons = (phase('construction')?.children || []).filter(t => t.duration > 0);
  const concurrent = cons.filter(t => cons.some(o => o !== t && o.startDate <= t.endDate && o.endDate >= t.startDate)).length;
  const all = p.wbs.flatMap(x => x.children).filter(t => !t.isReference);
  const bench = parametricWd(sc.sf, sc.k);
  const consWd = span(phase('construction'));
  return {
    id: sc.id, label: sc.label, modules: sc.modules, activities: all.length,
    totalWd: p.workingDuration, totalCd: p.calendarDuration,
    precWd: span(phase('preconstruction')), constructionWd: consWd, closeoutWd: span(phase('closeout')),
    benchmarkConstructionWd: bench, ratioToBenchmark: Math.round((consWd / bench) * 100) / 100,
    pctConcurrentConstruction: Math.round((concurrent / Math.max(cons.length, 1)) * 100),
    criticalPct: Math.round((all.filter(t => t.isCritical).length / all.length) * 100),
    maxActivityWd: Math.max(...all.map(t => t.duration)),
    over10Wd: all.filter(t => t.duration > 10).map(t => `${t.name} (${t.duration}d)`),
    linkTypes: [...new Set(dependencies.map(x => x.type))],
    sumOfDurationsConstruction: cons.reduce((s, t) => s + t.duration, 0),
  };
}

const scenarios = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : DEFAULT_SCENARIOS;
const results = scenarios.map(audit);
process.stdout.write(JSON.stringify({ engine: 'bidforge jevTree + scheduler', at: new Date().toISOString(), results }, null, 2));
