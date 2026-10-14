#!/usr/bin/env node
// Merge the "Lag table" blocks of independent council seat reports.
// A link (from, to, type) is adopted when >= 2 seats propose it; lag = median.
// "+FFn" / "plus FF+n" in a condition counts as an FF proposal for the same pair.
// usage: node council_lag_merge.mjs <out.json> seat_a.md seat_b.md seat_c.md
import fs from 'node:fs';

const [out, ...seatFiles] = process.argv.slice(2);
const norm = s => s.trim().replace(/\s+/g, ' ');
const proposals = new Map();
function add(seat, from, to, type, lag, cond) {
  const key = `${norm(from)}|${norm(to)}|${type}`;
  const p = proposals.get(key) || { from: norm(from), to: norm(to), type, lags: [], seats: new Set(), conds: [] };
  if (!p.seats.has(seat)) { p.seats.add(seat); p.lags.push(lag); if (cond) p.conds.push(cond); }
  proposals.set(key, p);
}

seatFiles.forEach((file, seat) => {
  const text = fs.readFileSync(file, 'utf8');
  const block = text.split(/##\s*4\.?\s*Lag table/i)[1]?.split(/```/)[1] || '';
  for (const line of block.split('\n')) {
    const cols = line.split('|').map(c => c.trim());
    if (cols.length < 5 || /^from_task$/i.test(cols[0])) continue;
    const [from, to, type, lag, cond = ''] = cols;
    if (!/^(SS|FS|FF|SF)$/.test(type)) continue;
    add(seat, from, to, type, Number(lag) || 0, cond);
    const ff = cond.match(/(?:\+|plus\s+)FF\s*\+?\s*(\d+)/i);
    if (ff && type === 'SS') add(seat, from, to, 'FF', Number(ff[1]), `from SS condition: ${cond}`);
  }
});

const median = xs => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]; };
const all = [...proposals.values()].map(p => ({ from: p.from, to: p.to, type: p.type, lag: median(p.lags), seats: p.seats.size, lags: p.lags, conditions: p.conds }));
const adopted = all.filter(p => p.seats >= 2).sort((a, b) => b.seats - a.seats);
const single = all.filter(p => p.seats < 2);
fs.writeFileSync(out, JSON.stringify({ adopted, single }, null, 2));
console.log(`adopted ${adopted.length} (3/3: ${adopted.filter(a => a.seats === 3).length}), single-seat ${single.length}`);
