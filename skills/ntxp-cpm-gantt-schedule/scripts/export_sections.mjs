#!/usr/bin/env node
// Regenerate knowledge/sections/*.md from the executable data files. A section's version only
// bumps when its content hash changes, so each section evolves independently.
// usage: node export_sections.mjs [repoRoot]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(new URL(import.meta.url).pathname), '../../..'));
const data = p => import(pathToFileURL(path.join(root, 'web/src/data', p)).href);
const { CONSTRUCTION_PHASES } = await data('constructionPhases.js');
const { MODULE_TASKS } = await data('jevModuleTasks.js');
const { JEV_MODULES, JEV_CLASSES } = await data('jevTaxonomy.js');
const { JEV_LIBRARY } = await data('jevLibrary.js');
const outDir = path.join(root, 'skills/ntxp-cpm-gantt-schedule/knowledge/sections');
fs.mkdirSync(outDir, { recursive: true });
const today = new Date().toISOString().slice(0, 10);

const table = (rows, cols) => [`| ${cols.map(c => c[0]).join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`, ...rows.map(r => `| ${cols.map(c => String(c[1](r) ?? '').replace(/\|/g, '/')).join(' | ')} |`)].join('\n');

const sections = [];
for (const p of CONSTRUCTION_PHASES) {
  sections.push({ id: `backbone-${p.id}`, title: `Backbone — ${p.name}`, source: 'web/src/data/constructionPhases.js (NTXP canon)',
    body: table(p.defaultTasks, [['#', (r) => p.defaultTasks.indexOf(r) + 1], ['Task', r => r.name], ['Dur', r => r.duration], ['Trade', r => r.trade], ['Sub-phase', r => r.sub], ['Critical', r => (r.critical ? 'yes' : '')], ['Module', r => (r.module || []).join(', ')], ['Lesson', r => r.lesson || '']]) });
}
for (const m of JEV_MODULES) {
  const rows = MODULE_TASKS[m.id] || [];
  sections.push({ id: `module-${m.id}`, title: `Module — ${m.label}`, source: 'council consensus (jevModuleTasks.js) + taxonomy',
    body: `Class: ${m.cls}\n\nConfirm question: ${m.confirm}\n\nDetection keywords: ${m.keywords.join(', ')}\n\n` + table(rows, [['Task', r => r.name], ['Dur', r => r.duration], ['Trade', r => r.trade], ['Class', r => r.cls], ['Submittal/Lead', r => (r.hasSubmittal ? `Y ${r.leadDays}d` : 'N')], ['Phase', r => r.phase], ['After', r => r.after], ['Par', r => (r.parallel ? 'Y' : '')], ['Seats', r => r.council?.seats], ['Override', r => (r.override ? 'Y' : '')]]) });
}
sections.push({ id: 'classification', title: 'Classification — classes and council library', source: 'jevTaxonomy.js + jevLibrary.js',
  body: table(JEV_CLASSES, [['Class', r => r.id], ['Label', r => r.label], ['Color', r => r.color]]) + '\n\n' + table(JEV_LIBRARY, [['Item', r => r.name], ['Class', r => r.cls], ['Trade', r => r.trade], ['CSI', r => r.csi], ['Sub/Lead', r => (r.hasSubmittal ? `Y ${r.leadDays}d` : 'N')], ['Phase', r => r.phase], ['Seats', r => r.seats]]) });

let changed = 0;
for (const s of sections) {
  const file = path.join(outDir, `${s.id}.md`);
  const hash = crypto.createHash('sha256').update(s.body).digest('hex').slice(0, 12);
  let version = 1; let log = '';
  if (fs.existsSync(file)) {
    const prev = fs.readFileSync(file, 'utf8');
    const v = Number(prev.match(/^version: (\d+)/m)?.[1] || 1);
    const h = prev.match(/^hash: (\w+)/m)?.[1];
    log = prev.split('## Changelog\n')[1] || '';
    if (h === hash) continue;
    version = v + 1;
  }
  log = `- v${version} ${today} — regenerated (hash ${hash})\n${log}`;
  fs.writeFileSync(file, `---\nid: ${s.id}\nversion: ${version}\nupdated: ${today}\nhash: ${hash}\nsource: ${s.source}\n---\n\n# ${s.title}\n\n${s.body}\n\n## Changelog\n${log}`);
  changed++;
}
console.log(`${sections.length} sections, ${changed} written`);
