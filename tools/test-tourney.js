#!/usr/bin/env node
/* Tests for tourney.js: races, bracket shapes for every format, placements and the table queue.
 * Run: node tools/test-tourney.js */
const T = require('../tourney.js');
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('  FAIL', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

// A tiny seeded random so failures can be reproduced.
const rng = seed => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

console.log('Races');
const apa8 = { rules: 'apa', gtype: 8, reduce: {} }, apa8r = { rules: 'apa', gtype: 8, reduce: { wb: true, lb: true, semi: true, final: true } };
eq(T.raceFor(apa8, 'wb', 3, 6).race, [2, 5], 'SL3 v SL6 is 2/5');
eq(T.raceFor(apa8, 'wb', 4, 6).race, [3, 5], 'SL4 v SL6 is 3/5');
eq(T.raceFor(apa8r, 'wb', 4, 6).race, [2, 4], 'SL4 v SL6 reduced is 2/4');
eq(T.raceFor(apa8r, 'wb', 3, 6).race, [2, 5], 'SL3 v SL6 reduced stays 2/5');
eq(T.raceFor(apa8r, 'wb', 6, 3).race, [5, 2], 'SL6 v SL3 reduced stays 5/2');
eq(T.raceFor(apa8, 'wb', 7, 7).race, [5, 5], 'SL7 v SL7 is 5/5');
eq(T.raceFor(apa8r, 'final', 7, 7).race, [4, 4], 'SL7 v SL7 reduced is 4/4');
eq(T.raceFor(apa8, 'wb', undefined, 6).race, [2, 5], 'unknown skill level counts as 3');
eq(T.raceFor({ rules: 'apa', gtype: 8, reduce: { lb: true } }, 'wb', 4, 6).race, [3, 5], 'reduction only on the stages it is turned on for');
eq(T.raceFor({ rules: 'apa', gtype: 8, reduce: { lb: true } }, 'lb', 4, 6).race, [2, 4], 'reduced in the losers bracket');
eq(T.raceFor({ rules: 'apa', gtype: 9, reduce: {} }, 'wb', 3, 6).race, [25, 46], 'APA 9-ball points SL3 v SL6');
eq(T.reduceRace([2, 2]), [2, 2], 'race 2/2 is not reduced');
eq(T.reduceRace([3, 3]), [2, 2], 'race 3/3 reduced to 2/2');
eq(T.raceFor({ rules: 'bca', gtype: 8, raceN: 5, races: { final: 7 }, reduce: {} }, 'wb', 3, 6).race, [5, 5], 'fixed race ignores skill levels');
eq(T.raceFor({ rules: 'bca', gtype: 8, raceN: 5, races: { final: 7 }, reduce: {} }, 'final', 3, 6).race, [7, 7], 'fixed race per stage');
eq(T.raceFor({ rules: 'none', gtype: 9, raceN: 4, races: {}, reduce: { semi: true } }, 'semi', 1, 1).race, [3, 3], 'fixed race reduced');
eq(T.raceFor({ rules: 'none', gtype: 9, raceN: 2, races: {}, reduce: { semi: true } }, 'semi', 1, 1).race, [2, 2], 'fixed race 2 not reduced');

console.log('Seeding');
eq(T.seedPositions(8), [0, 7, 3, 4, 1, 6, 2, 5], 'standard 8-draw positions');
{ const B = T.build('single', 5); const byes = B.matches.filter(m => m.round === 1 && m.bye).map(m => [m.a.s, m.b.s].find(s => s < 5));
  eq(byes.sort(), [0, 1, 2], 'with 5 players the byes go to seeds 1-3'); }

// Play a whole tournament with random winners; returns the final resolution and bookkeeping.
function play(format, n, seed, reset = true) {
  const B = T.build(format, n, { reset }), seeds = Array.from({ length: n }, (_, i) => 'p' + i), r = rng(seed);
  let results = {}, guard = 0, lbEntrants = new Set(), wbLosers = new Set(), cEntrants = new Set(), r1Losers = new Set();
  for (;;) {
    const res = T.resolve(B, seeds, results);
    if (res.complete) return { B, res, seeds, results, lbEntrants, wbLosers, cEntrants, r1Losers };
    const ready = B.matches.filter(m => res.m[m.id].status === 'ready');
    if (!ready.length || ++guard > 500) throw new Error(`${format} ${n}: stuck`);
    for (const m of ready) {
      const s = res.m[m.id];
      // Players may only be in the losers / second-chance bracket after a loss.
      for (const p of [s.pa, s.pb]) { if (m.sec === 'L') lbEntrants.add(p); if (m.sec === 'C') cEntrants.add(p); }
      const w = r() < .5 ? s.pa : s.pb, l = w === s.pa ? s.pb : s.pa;
      if (m.sec === 'W') wbLosers.add(l);
      if (m.sec === 'W' && m.round === 1) r1Losers.add(l);
      results = T.setResult(B, seeds, results, m.id, w);
    }
  }
}

console.log('Brackets');
for (const format of ['single', 'double', 'modified']) for (const n of [2, 3, 4, 5, 8, 13, 16, 32]) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
  const tag = `${format} ${n} players (run ${seed})`;
  let g; try { g = play(format, n, seed, seed % 2 === 1); } catch (e) { ok(false, `${tag}: ${e.message}`); continue; }
  const { B, res, seeds } = g;
  const places = res.places, vals = seeds.map(p => places[p]);
  ok(seeds.every(p => Number.isInteger(places[p]) && places[p] >= 1 && places[p] <= n), `${tag}: every player has one placement`);
  ok(Object.keys(places).length === n, `${tag}: no extra placements`);
  ok(vals.filter(v => v === 1).length === 1 && places[res.champion] === 1, `${tag}: exactly one champion`);
  // Tied places are consistent: a place p shared by k players means the next place is p + k.
  const sorted = [...vals].sort((a, b) => a - b);
  ok(sorted.every((v, i) => v === 1 + sorted.findIndex(x => x === v) && sorted.indexOf(v) <= i), `${tag}: shared places are consistent`);
  ok(sorted.every((v, i) => i === 0 || v === sorted[i - 1] || v === i + 1), `${tag}: places skip correctly after ties`);
  const losses = p => res.losses[p] || 0;
  const nonChamp = seeds.filter(p => p !== res.champion);
  if (format === 'single') ok(nonChamp.every(p => losses(p) === 1) && losses(res.champion) === 0, `${tag}: everyone but the champion lost exactly once`);
  if (format === 'double') {
    // Without the reset, a winners-bracket champ who loses the one grand final is out with a single loss.
    const noReset = !B.reset && res.m.G1.w === res.m.G1.pb;
    ok(nonChamp.every(p => losses(p) === 2 || (noReset && p === res.m.G1.pa && losses(p) === 1)), `${tag}: everyone but the champion lost exactly twice`);
    ok(losses(res.champion) <= 1, `${tag}: champion lost at most once`);
    ok([...g.lbEntrants].every(p => g.wbLosers.has(p)), `${tag}: only winners-bracket losers play in the losers bracket`);
    // Every winners-bracket loser plays on in the losers bracket (or gets a bye there).
    if (n > 2) ok([...g.wbLosers].every(p => g.lbEntrants.has(p) || B.matches.some(m => m.sec === 'L' && m.bye && [res.m[m.id].pa, res.m[m.id].pb].includes(p))), `${tag}: every winners-bracket loser drops to the losers bracket`);
    const lbCount = B.matches.filter(m => m.sec === 'L').length;
    ok(lbCount === (B.size >= 4 ? B.size - 2 : 0), `${tag}: losers bracket has size-2 match slots (${lbCount})`);
    const g2 = res.m.G2, g1 = res.m.G1;
    if (g1.w === g1.pb && B.reset) ok(g2.status === 'done', `${tag}: reset final played when the losers-bracket player won`);
    else ok(g2.status === 'dead', `${tag}: no reset final otherwise`);
    ok(places[g1.pa] <= 2 && places[g1.pb] <= 2, `${tag}: grand finalists are 1st and 2nd`);
  }
  if (format === 'modified' && B.size >= 4) {
    ok([...g.cEntrants].every(p => g.r1Losers.has(p)), `${tag}: only round-1 losers play second chance`);
    ok(nonChamp.every(p => losses(p) === (g.r1Losers.has(p) ? 2 : 1)), `${tag}: round-1 losers get two lives, everyone else one`);
    ok(losses(res.champion) <= 1, `${tag}: champion lost at most once`);
    ok(seeds.filter(p => g.r1Losers.has(p) && p !== res.champion).every(p => losses(p) === 2), `${tag}: round-1 losers are knocked out by their second loss`);
  }
  // Match numbers are 1..N with no gaps, and bye matches have no number.
  const nums = B.matches.filter(m => m.play).map(m => m.num).sort((a, b) => a - b);
  ok(nums.every((v, i) => v === i + 1), `${tag}: match numbers run 1..${nums.length}`);
  ok(B.matches.every(m => [m.a, m.b].every(s => s.s != null || B.matches.indexOf(B.byId[s.w || s.l]) < B.matches.indexOf(m))), `${tag}: matches are in play order`);
}

console.log('Specific shapes');
{ const B = T.build('double', 8); eq(B.matches.filter(m => m.sec === 'W').length, 7, 'double 8: 7 winners matches');
  eq(B.matches.filter(m => m.sec === 'L').length, 6, 'double 8: 6 losers matches');
  eq(B.byId['L2.0'].b, { l: 'W2.1' }, 'double 8: losers round 2 takes winners round 2 losers crossed over');
  eq(B.byId['L4.0'].b, { l: 'W3.0' }, "double 8: losers' final takes the winners' final loser");
  eq(B.byId.G1.b, { w: 'L4.0' }, 'double 8: grand final is winners champ v losers champ'); }
{ const B = T.build('modified', 8); eq(B.matches.filter(m => m.sec === 'C').map(m => [m.a, m.b]), [[{ l: 'W1.0' }, { l: 'W1.1' }], [{ l: 'W1.2' }, { l: 'W1.3' }]], 'modified 8: second chance takes the round-1 losers');
  eq(B.byId['M1.0'].b, { w: 'C1.1' }, 'modified 8: second-chance winners rejoin from the far side');
  eq(B.matches.filter(m => m.play).length, 11, 'modified 8: 11 matches'); }
{ const B = T.build('modified', 5); const seeds = ['a', 'b', 'c', 'd', 'e'];
  // Seed 0,1,2 have byes; only seed 3 (d) v seed 4 (e) is a real round-1 match.
  const res = T.resolve(B, seeds, {}); eq(B.matches.filter(m => m.sec === 'W' && m.round === 1 && m.play).length, 1, 'modified 5: one real round-1 match');
  let r = T.setResult(B, seeds, {}, 'W1.1', 'd'); // W1.1 is seed 3 v seed 4
  const res2 = T.resolve(B, seeds, r); const p = T.playerPath(B, res2, 'e');
  ok(p.status === 'alive' && p.match.sec !== 'W', 'modified 5: the round-1 loser is still alive in second chance'); }

console.log('Editing results');
{ const B = T.build('single', 4), seeds = ['a', 'b', 'c', 'd'];
  let r = {}; r = T.setResult(B, seeds, r, 'W1.0', 'a'); r = T.setResult(B, seeds, r, 'W1.1', 'b'); r = T.setResult(B, seeds, r, 'W2.0', 'a');
  eq(T.resolve(B, seeds, r).champion, 'a', 'a wins');
  r = T.setResult(B, seeds, r, 'W1.0', 'd');
  eq(r['W2.0'], undefined, 'changing a semifinal clears the final that depended on it');
  eq(T.resolve(B, seeds, r).m['W2.0'].status, 'ready', 'final is ready again with the new player'); }

console.log('Player path');
{ const B = T.build('double', 4), seeds = ['a', 'b', 'c', 'd'], res = T.resolve(B, seeds, {});
  const p = T.playerPath(B, res, 'a');
  ok(p.status === 'alive' && p.opp === 'd', 'a plays d first');
  ok(p.ifWin.match.id === 'W2.0' && p.ifWin.oppText === 'Winner of #2', `a would play the winner of #2 (${p.ifWin.oppText})`);
  ok(p.ifLose.match.sec === 'L' && /Loser of #2/.test(p.ifLose.oppText), `a would drop to the losers bracket v the loser of #2 (${p.ifLose.oppText})`);
  const s = T.playerPath(T.build('single', 4), T.resolve(T.build('single', 4), seeds, {}), 'a');
  ok(s.ifLose.out === true, 'single: losing means out'); }

console.log('Table queue');
{ let q = T.assignTables(['m1', 'm2', 'm3'], {}, [6, 7]);
  eq(q.assign, { m1: 6, m2: 7 }, 'first two ready matches get the two tables');
  eq(q.called, ['m1', 'm2'], 'both are called');
  // m1 finishes: its table frees up and the next ready match is called to it.
  q = T.assignTables(['m2', 'm3', 'm4'], { m2: 7 }, [6, 7]);
  eq(q.assign, { m2: 7, m3: 6 }, 'freed table 6 goes to the next ready match');
  eq(q.called, ['m3'], 'only the new match is called');
  // Admin adds table 9 then removes table 7.
  q = T.assignTables(['m2', 'm3', 'm4'], { m2: 7, m3: 6 }, [6, 7, 9]); eq(q.assign, { m2: 7, m3: 6, m4: 9 }, 'an added table takes the next match');
  q = T.assignTables(['m2', 'm3', 'm4'], { m2: 7, m3: 6, m4: 9 }, [6, 9]);
  eq(q.moved, ['m2'], 'removing a table takes its match off it');
  eq(q.assign, { m3: 6, m4: 9 }, 'the match waits for the next free table');
  q = T.assignTables([], {}, [1, 2]); eq(q.assign, {}, 'nothing ready, nothing assigned'); }

console.log('Relay messages');
{ const big = { kind: 'tourney', tid: 'x', ts: 5, players: Array.from({ length: 64 }, (_, i) => ({ id: 'p' + i, n: 'Player ñame ' + i, sl: 3, paid: true })) };
  const parts = T.pack(big); ok(parts.length > 1, 'a large state is split'); ok(parts.every(p => Buffer.byteLength(p) < 4000), 'every part fits in an ntfy message');
  const take = T.Collector(); let got = null; for (const p of [...parts].reverse()) got = take(JSON.parse(p)) || got;
  eq(got, big, 'parts reassemble in any order');
  const small = { kind: 'tourney', tid: 'y', ts: 1 }; eq(T.pack(small).length, 1, 'a small state is one message'); }

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
