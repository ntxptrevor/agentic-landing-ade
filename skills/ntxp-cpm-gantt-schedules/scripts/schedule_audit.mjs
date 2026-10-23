#!/usr/bin/env node
// Deterministic sanity audit of the NTXP CPM Gantt Schedules engine against NTXP benchmarks.
// usage: node schedule_audit.mjs [scenarios.json] > audit.json
// Scenario: { id, label, sf, sector, tier, modules[], expect: { constructionWd:[lo,hi], totalCd:[lo,hi] } }
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const imp = p => import(pathToFileURL(path.join(root, p)).href);
const { buildWbs, envelopeWd, valueEnvelopeWd, sizeBand } = await imp('web/src/utils/jevTree.js');
const { calculateSchedule } = await imp('web/src/utils/scheduler.js');

// ntxp-gantt-schedule parametric benchmark (fitted on four NTXP projects):
// WD = 2.13 x AffectedSF^0.379 x sector x tier x constraints
export const parametricWd = (sf, k = 1) => Math.round(2.13 * Math.pow(sf, 0.379) * k);

// Council consensus target bands (2026-10-13 schedule audit, overlap of the three seats' ranges).
const DEFAULT_SCENARIOS = [
  { id: 'A', label: 'ISD light refresh — paint, ceilings, flooring, 3,000 SF, summer', scope: { tier: 'light', sf: 3000, sector: 'isd', constraints: [] }, modules: ['isd_college'], target: { cons: [20, 35], cd: [65, 125], conc: 60 }, accepted: { critical: 'serial precon set-up chain on a micro job — accepted by user (LL-2026-10-14-03 (5))' } },
  { id: 'B', label: 'Standard interior renovation — 10,000 SF office/classroom', scope: { tier: 'standard', sf: 10000, sector: 'isd', constraints: [] }, modules: ['selective_demo', 'fire_alarm', 'fire_suppression', 'low_voltage'], target: { cons: [60, 85], cd: [140, 195], conc: 70 } },
  { id: 'C', label: 'Occupied clinic renovation with ICRA — 6,000 SF', scope: { tier: 'standard', sf: 6000, sector: 'healthcare', constraints: ['occupied', 'icra', 'phased'] }, modules: ['selective_demo', 'abatement', 'icra', 'occupied_phasing', 'medical_specific', 'medical_specialties', 'fire_alarm', 'fire_suppression', 'low_voltage'], target: { cons: [75, 100], cd: [175, 235], conc: 70 }, userAdjustWd: 10, userAdjustReason: 'two 5 WD healthcare mockup gates added by user decision LL-2026-10-13-23 after the council set this band' },
  { id: 'D', label: 'ISD summer RTU replacement — 4 units', scope: { tier: 'equipment', sf: 2000, sector: 'isd', constraints: [], units: 4 }, modules: ['hvac_replacement', 'isd_college'], target: { cons: [15, 36], cd: [95, 200], conc: 50 }, accepted: { calendar: 'shorter precon after audit #2 (submittals start at subcontract signing) — accepted by user (LL-2026-10-14-03 (5))' } },
  { id: 'E', label: 'County jail holding-area renovation — 4,000 SF', scope: { tier: 'standard', sf: 4000, sector: 'secured', constraints: ['secure'] }, modules: ['selective_demo', 'secured_building', 'access_control', 'fire_alarm'], target: { cons: [55, 80], cd: [140, 210], conc: 70 } },
  // Council audit #2 (2026-10-14): real UT System / UNT schedules from Drive. Bands are the median
  // of the three seats' pass bands; precon/closeout bands by value and size band.
  { id: 'UNT-01', label: 'UNT Starbucks Ph2 — executed, $98.6k food-service remodel, ~400 SF', real: { cons: 30, prec: 0, close: 9 }, scope: { tier: 'standard', sf: 400, sector: 'college', constraints: ['occupied'], contractValue: 98604, valueYear: 2024, ownerProfile: 'unt' }, modules: ['kitchen_foodservice', 'selective_demo', 'isd_college', 'occupied_phasing', 'fire_alarm', 'low_voltage'], target: { cons: [22, 34], prec: [5, 25], close: [5, 10], conc: 60 } },
  { id: 'UTSW-02', label: 'UTSW Memorial Garden Ash Vault — executed, $173.7k prefab vault, site only', real: { cons: 17, prec: 22, close: 7 }, scope: { tier: 'exterior', sf: 2030, sector: 'healthcare', constraints: [], contractValue: 173688, valueYear: 2025, precast: true, footprintSf: 144, startDate: '2025-02-24' }, modules: ['exterior_improvements', 'below_grade_structural'], target: { cons: [14, 26], prec: [5, 30], close: [5, 10], conc: 50 } },
  { id: 'UTSW-03', label: 'UTSW NB10.208 tissue lab — NTXP proposal, $171.9k, ~300 SF, ICRA', real: { cons: 31, prec: 6, close: 3 }, scope: { tier: 'standard', sf: 300, sector: 'healthcare', constraints: ['occupied', 'icra'], contractValue: 171919, valueYear: 2025 }, modules: ['selective_demo', 'mep_lab', 'hvac_replacement', 'fire_alarm', 'fire_suppression', 'icra', 'low_voltage', 'complex_owner'], target: { cons: [26, 40], prec: [5, 25], close: [5, 10], conc: 60 }, userAdjustWd: 10, userAdjustReason: 'healthcare mockup gates on research labs (user decision LL-2026-10-14-03 (6)) added after the council set this band' },
  { id: 'UTSW-01', label: 'UTSW C1 Mech Vault — executed, $517.8k below-grade CIP vault (target = 96 WD baseline; 189 WD actual is a risk tail)', real: { cons: 96, prec: 47, close: 20 }, scope: { tier: 'exterior', sf: 200, sector: 'healthcare', constraints: ['occupied'], contractValue: 517828, valueYear: 2024, wallLifts: 3, footprintSf: 200, startDate: '2024-09-16' }, modules: ['site_work', 'selective_demo', 'abatement', 'hvac_replacement', 'exterior_improvements', 'below_grade_structural', 'occupied_phasing'], target: { cons: [80, 130], prec: [20, 50], close: [8, 20], conc: 50 } },
  { id: 'UTD-1', label: 'UTD Balcony Rebuild — proposal (not awarded), $683.6k, 4 buildings', real: { cons: 53, prec: 1, close: 10 }, scope: { tier: 'exterior', sf: 3860, sector: 'college', constraints: ['occupied', 'phased'], contractValue: 683590, valueYear: 2026, startDate: '2026-05-18', buildings: 4 }, modules: ['exterior_improvements', 'structural_exterior_rebuild', 'occupied_phasing', 'isd_college'], target: { cons: [45, 65], prec: [5, 45], close: [5, 15], conc: 50 } },
  { id: 'UTD-2', label: 'UTD WSTC Wind Energy suite — proposal duration only, $559.8k, ~3,500 SF', real: { cons: 69 }, scope: { tier: 'standard', sf: 3500, sector: 'college', constraints: ['occupied'], contractValue: 559848, valueYear: 2023 }, modules: ['selective_demo', 'hvac_replacement', 'mep_lab', 'low_voltage', 'access_control', 'isd_college'], target: { cons: [50, 75], prec: [15, 45], close: [8, 15], conc: 60 } },
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
  const over10 = all.filter(t => t.duration > 10 && !t.weather && !/submittal|review|approv|processing/i.test(t.name));
  const precWd = span(phase('preconstruction'));
  // Closeout is measured SC → Final Walk (council audit #2); billing rows run beside it.
  const fw = p.wbs.flatMap(x => x.children).find(t => t.name === 'Final Walk');
  const scRow = p.wbs.flatMap(x => x.children).find(t => t.name === 'Owner Punch Walk / Substantial Completion');
  const closeWd = fw && scRow ? wdBetween(scRow.endDate, fw.endDate) - 1 : span(phase('closeout'));
  const inBand = (x, b) => x >= b[0] && x <= b[1];
  const checks = tgt ? {
    construction: consWd >= tgt.cons[0] && consWd <= tgt.cons[1] + (sc.userAdjustWd || 0),
    ...(tgt.cd ? { calendar: p.calendarDuration >= tgt.cd[0] && p.calendarDuration <= tgt.cd[1] + Math.round((sc.userAdjustWd || 0) * 1.4) } : {}),
    ...(tgt.prec ? { precon: inBand(precWd, tgt.prec) } : {}),
    ...(tgt.close ? { closeout: inBand(closeWd, tgt.close) } : {}),
    concurrency: conc >= tgt.conc,
    critical: crit <= 50,
    tenDayCap: over10.length === 0,
  } : null;
  return {
    id: sc.id, label: sc.label, modules: sc.modules, activities: all.length,
    totalWd: p.workingDuration, totalCd: p.calendarDuration, sizeBand: sc.scope ? sizeBand(sc.scope) : null,
    precWd, constructionWd: consWd, closeoutWd: closeWd, real: sc.real || null,
    valueEnvelopeWd: sc.scope ? valueEnvelopeWd(sc.scope) : null, decisionPending: sc.decisionPending || null,
    benchmarkConstructionWd: bench, ratioToBenchmark: Math.round((consWd / bench) * 100) / 100,
    pctConcurrentConstruction: conc,
    criticalPct: crit,
    accepted: sc.accepted || null, target: tgt || null, userAdjust: sc.userAdjustWd ? { wd: sc.userAdjustWd, reason: sc.userAdjustReason } : null, checks, pass: checks ? (sc.decisionPending ? null : Object.entries(checks).every(([k, v]) => v || sc.accepted?.[k])) : null,
    maxActivityWd: Math.max(...all.map(t => t.duration)),
    over10Wd: all.filter(t => t.duration > 10).map(t => `${t.name} (${t.duration}d)`),
    linkTypes: [...new Set(dependencies.map(x => x.type))],
    sumOfDurationsConstruction: cons.reduce((s, t) => s + t.duration, 0),
  };
}

const scenarios = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : DEFAULT_SCENARIOS;
const results = scenarios.map(audit);
process.stdout.write(JSON.stringify({ engine: 'ntxp-cpm-gantt-schedules jevTree + scheduler', at: new Date().toISOString(), results }, null, 2));
