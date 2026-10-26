// Loads every *.test.mjs under this skill into one node:test run, so that
// `node --test skills/ntxp-cpm-gantt-schedule/` (directory → package.json "main") runs them all.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const found = [];
const walk = dir => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.test.mjs')) found.push(p);
  }
};
walk(root);
for (const f of found.sort()) await import(pathToFileURL(f).href);
