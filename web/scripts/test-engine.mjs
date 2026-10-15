#!/usr/bin/env node
// Run the scheduling-engine tests (node:test, no deps): node web/scripts/test-engine.mjs
// Equivalent to: node --test web/src/utils/*.test.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const utils = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/utils');
const files = fs.readdirSync(utils).filter(f => f.endsWith('.test.mjs')).map(f => path.join(utils, f));
if (!files.length) { console.error('no *.test.mjs files under', utils); process.exit(1); }
const r = spawnSync(process.execPath, ['--test', ...files, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
