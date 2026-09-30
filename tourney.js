/* tourney.js — tournament logic for the pool pages, as plain functions with no page code in them.
 * Loaded by tournament.html / join.html in the browser (window.Tourney) and by tools/test-tourney.js in Node.
 *
 * The idea: a bracket's SHAPE depends only on the format and the field size. build() returns that shape as a
 * list of matches whose two slots say where the player comes from: a seed, the winner of a match or the loser
 * of a match. The tournament state only stores the seed order and the results ('p3>p7' = p3 beat p7), and
 * resolve() replays them through the shape. That keeps the relay message small and makes editing a result
 * safe: results that no longer fit (the players changed) simply drop out.
 *
 * Formats
 *   single    Single elimination. Lose once and you're out.
 *   double    Double elimination. Your first loss drops you to the losers bracket; a second loss and you're out.
 *             The losers-bracket winner meets the winners-bracket winner in the grand final. If the
 *             losers-bracket player wins it, both have one loss, so (when `reset` is on) they play once more.
 *   modified  Modified single elimination. Lose your first-round match and you drop into a one-loss
 *             second-chance bracket; win that and you rejoin the main draw. After round 1, one loss and you're out.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------- races
  // APA 8-ball race chart (same numbers as deck.html): APA8[mine][theirs - 2] = games I need.
  const APA8 = { 2: [2, 2, 2, 2, 2, 2], 3: [3, 2, 2, 2, 2, 2], 4: [4, 3, 3, 3, 3, 2], 5: [5, 4, 4, 4, 4, 3], 6: [6, 5, 5, 5, 5, 4], 7: [7, 6, 5, 5, 5, 5] };
  // APA 9-ball points a skill level needs (index = SL 1..9).
  const APA9 = [0, 14, 19, 25, 31, 38, 46, 55, 65, 75];
  const DEFAULT_SL = 3;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const slRange = gtype => gtype === 9 ? [1, 9] : [2, 7];
  const cleanSl = (sl, gtype) => { const [lo, hi] = slRange(gtype); const n = parseInt(sl, 10); return Number.isFinite(n) ? clamp(n, lo, hi) : clamp(DEFAULT_SL, lo, hi); };
  const apa8Race = (a, b) => APA8[clamp(a, 2, 7)][clamp(b, 2, 7) - 2];

  // Reduced race: take one game off BOTH players, but only if both still need at least 2.
  // If either would drop below 2, the race stays as it was (4v6 = 3/5 -> 2/4, but 3v6 = 2/5 stays 2/5).
  function reduceRace(r) { return r[0] - 1 >= 2 && r[1] - 1 >= 2 ? [r[0] - 1, r[1] - 1] : [r[0], r[1]]; }

  // Skill-level (handicapped) tournaments: APA 8-ball races from the chart, APA 9-ball points.
  const usesSkill = T => T.rules === 'apa' && (T.gtype === 8 || T.gtype === 9);
  const STAGES = ['wb', 'lb', 'semi', 'final'];
  const STAGE_NAME = { wb: 'Winners / main bracket', lb: 'Losers / second-chance bracket', semi: 'Semifinals', final: 'Final' };

  /* The race for one match. T: tournament settings { rules, gtype, raceN, races: {stage: n}, reduce: {stage: bool} },
   * stage: 'wb' | 'lb' | 'semi' | 'final', slA/slB: skill levels. Returns { race: [a, b], points, reduced, label }. */
  function raceFor(T, stage, slA, slB) {
    const red = !!(T.reduce && T.reduce[stage]);
    if (usesSkill(T)) {
      const a = cleanSl(slA, T.gtype), b = cleanSl(slB, T.gtype);
      if (T.gtype === 9) { const r = [APA9[a], APA9[b]]; return { race: r, points: true, reduced: false, label: `${r[0]}–${r[1]} pts` }; }
      const base = [apa8Race(a, b), apa8Race(b, a)], r = red ? reduceRace(base) : base;
      return { race: r, base, points: false, reduced: r[0] !== base[0], label: `Race ${r[0]}–${r[1]}` };
    }
    const n = clamp(parseInt((T.races && T.races[stage]) || T.raceN, 10) || 3, 1, 21);
    const base = [n, n], r = red ? reduceRace(base) : base;
    return { race: r, base, points: false, reduced: r[0] !== base[0], label: `Race to ${r[0]}` };
  }

  // ---------------------------------------------------------------- bracket shape
  const pow2 = n => { let s = 2; while (s < n) s *= 2; return s; };
  // Standard seeding positions: 1 v 16, 8 v 9, ... so byes (the seeds past the field) meet the top seeds.
  function seedPositions(size) { let o = [0]; while (o.length < size) { const m = o.length * 2; o = o.flatMap(s => [s, m - 1 - s]); } return o; }

  /* build(format, n, opts) -> { format, n, size, matches: [...] } in play order (every source points to an earlier match).
   * match: { id, sec: 'W'|'L'|'C'|'M'|'G', round, idx, a: src, b: src, stage, out, name }
   *   src:  { s: seedIndex } | { w: matchId } | { l: matchId }
   *   out:  elimination rank of the loser (bigger = went further), or null when the loser drops to another bracket. */
  function build(format, n, opts = {}) {
    n = Math.max(2, n | 0);
    const size = pow2(n), k = Math.log2(size), pos = seedPositions(size);
    const M = [], byId = {};
    const add = m => { M.push(m); byId[m.id] = m; return m; };
    const W = (r, i) => `W${r}.${i}`, L = (r, i) => `L${r}.${i}`, C = (r, i) => `C${r}.${i}`, X = (r, i) => `M${r}.${i}`;
    if (format === 'modified' && size < 4) format = 'single';

    // Winners (main) bracket round 1 — shared by all formats.
    for (let i = 0; i < size / 2; i++) add({ id: W(1, i), sec: 'W', round: 1, idx: i, a: { s: pos[2 * i] }, b: { s: pos[2 * i + 1] } });

    if (format === 'single' || format === 'double') {
      for (let r = 2; r <= k; r++) for (let i = 0; i < size / 2 ** r; i++) add({ id: W(r, i), sec: 'W', round: r, idx: i, a: { w: W(r - 1, 2 * i) }, b: { w: W(r - 1, 2 * i + 1) } });
      for (const m of M) {
        if (format === 'single') { m.out = m.round; m.stage = m.round === k ? 'final' : m.round === k - 1 ? 'semi' : 'wb'; }
        else { m.out = null; m.stage = m.round === k && k > 1 ? 'semi' : 'wb'; }
      }
    }

    if (format === 'double') {
      // Losers bracket: odd rounds pair up the survivors, even rounds take in the losers dropping from the winners bracket.
      // Drop-ins are fed in reverse order every other time so people don't meet the player who just beat them.
      let last = null;
      if (k >= 2) {
        for (let i = 0; i < size / 4; i++) add({ id: L(1, i), sec: 'L', round: 1, idx: i, a: { l: W(1, 2 * i) }, b: { l: W(1, 2 * i + 1) } });
        for (let j = 1; j <= k - 1; j++) {
          const cnt = size / 2 ** (j + 1), dr = 2 * j;
          for (let i = 0; i < cnt; i++) add({ id: L(dr, i), sec: 'L', round: dr, idx: i, a: { w: L(dr - 1, i) }, b: { l: W(j + 1, j % 2 ? cnt - 1 - i : i) } });
          if (j < k - 1) for (let i = 0; i < cnt / 2; i++) add({ id: L(dr + 1, i), sec: 'L', round: dr + 1, idx: i, a: { w: L(dr, 2 * i) }, b: { w: L(dr, 2 * i + 1) } });
        }
        last = L(2 * (k - 1), 0);
      }
      const lbRounds = 2 * (k - 1);
      for (const m of M) if (m.sec === 'L') { m.out = m.round; m.stage = m.round === lbRounds ? 'semi' : 'lb'; }
      const G = lbRounds + 1;
      add({ id: 'G1', sec: 'G', round: 1, idx: 0, a: { w: W(k, 0) }, b: last ? { w: last } : { l: W(k, 0) }, stage: 'final', out: G });
      // Second final ("reset"): only played when the losers-bracket player wins the first one and opts.reset is on.
      add({ id: 'G2', sec: 'G', round: 2, idx: 0, a: { w: 'G1' }, b: { l: 'G1' }, stage: 'final', out: G, reset: true });
    }

    if (format === 'modified') {
      // Round 2 of the main draw; round-1 losers play one second-chance round; the two sets of survivors
      // (size/4 each) merge into a single-elimination final stage.
      for (const m of M) { m.out = null; m.stage = 'wb'; }
      const q = size / 4;
      for (let i = 0; i < q; i++) add({ id: W(2, i), sec: 'W', round: 2, idx: i, a: { w: W(1, 2 * i) }, b: { w: W(1, 2 * i + 1) }, stage: 'wb', out: 1 });
      for (let i = 0; i < q; i++) add({ id: C(1, i), sec: 'C', round: 1, idx: i, a: { l: W(1, 2 * i) }, b: { l: W(1, 2 * i + 1) }, stage: 'lb', out: 1 });
      // Merge: main-draw survivor i meets the second-chance survivor from the far side of the draw (no instant rematch).
      const mr = Math.log2(size / 2);
      for (let i = 0; i < q; i++) add({ id: X(1, i), sec: 'M', round: 1, idx: i, a: { w: W(2, i) }, b: { w: C(1, q - 1 - i) } });
      for (let r = 2; r <= mr; r++) for (let i = 0; i < size / 2 ** (r + 1); i++) add({ id: X(r, i), sec: 'M', round: r, idx: i, a: { w: X(r - 1, 2 * i) }, b: { w: X(r - 1, 2 * i + 1) } });
      for (const m of M) if (m.sec === 'M') { m.out = 1 + m.round; m.stage = m.round === mr ? 'final' : m.round === mr - 1 ? 'semi' : 'wb'; }
    }

    const B = { format, n, size, k, matches: M, byId, reset: opts.reset !== false };
    staticPass(B); nameRounds(B); routes(B);
    return B;
  }

  // Which matches can actually be played: a seed past the field is a bye, the loser of a bye is a bye, and so on.
  // This depends only on the field size, so match numbers never shift once the draw is made.
  function staticPass(B) {
    const kind = {};   // matchId -> { w: 'P'|'B', l: 'P'|'B' }
    const val = src => src.s != null ? (src.s < B.n ? 'P' : 'B') : kind[src.w || src.l][src.w ? 'w' : 'l'];
    for (const m of B.matches) {
      const a = val(m.a), b = val(m.b);
      m.play = a === 'P' && b === 'P';
      m.dead = a === 'B' && b === 'B';
      m.bye = !m.play && !m.dead;
      kind[m.id] = m.play ? { w: 'P', l: 'P' } : m.dead ? { w: 'B', l: 'B' } : { w: 'P', l: 'B' };
      if (m.reset) { m.play = true; m.dead = m.bye = false; kind[m.id] = { w: 'P', l: 'P' }; }
    }
    // Play order: a match's wave is one more than the latest match feeding it. Numbers follow waves, then bracket.
    const wave = {}, secOrder = { W: 0, C: 1, L: 1, M: 2, G: 3 };
    for (const m of B.matches) wave[m.id] = 1 + Math.max(0, ...[m.a, m.b].filter(s => s.s == null).map(s => wave[s.w || s.l]));
    const order = B.matches.filter(m => m.play).sort((x, y) => wave[x.id] - wave[y.id] || secOrder[x.sec] - secOrder[y.sec] || x.round - y.round || x.idx - y.idx);
    order.forEach((m, i) => { m.num = i + 1; m.wave = wave[m.id]; });
  }

  function nameRounds(B) {
    const fromEnd = (r, last) => { const d = last - r; return d === 0 ? 'Final' : d === 1 ? 'Semifinals' : d === 2 ? 'Quarterfinals' : `Round of ${2 ** (d + 1)}`; };
    const lbLast = 2 * (B.k - 1), mLast = Math.log2(B.size / 2);
    for (const m of B.matches) {
      if (B.format === 'single') m.name = fromEnd(m.round, B.k).replace(`Round of ${B.size}`, 'Round 1');
      else if (B.format === 'double') m.name = m.sec === 'W' ? (m.round === B.k ? "Winners' final" : `Winners round ${m.round}`)
        : m.sec === 'L' ? (m.round === lbLast ? "Losers' final" : `Losers round ${m.round}`) : m.round === 1 ? 'Grand final' : 'Grand final, 2nd set';
      else m.name = m.sec === 'W' ? `Round ${m.round}` : m.sec === 'C' ? 'Second chance' : fromEnd(m.round, mLast);
    }
  }

  // Where the winner and the loser of each match go next.
  function routes(B) {
    for (const m of B.matches) { m.winTo = null; m.loseTo = null; }
    for (const m of B.matches) for (const slot of ['a', 'b']) {
      const s = m[slot]; if (s.w) B.byId[s.w].winTo = { id: m.id, slot }; if (s.l) B.byId[s.l].loseTo = { id: m.id, slot };
    }
  }

  // ---------------------------------------------------------------- replaying results
  const BYE = '~';
  const parseRes = r => { const i = String(r || '').indexOf('>'); return i > 0 ? [r.slice(0, i), r.slice(i + 1)] : null; };
  const resKey = (w, l) => `${w}>${l}`;

  /* resolve(B, seeds, results) -> { m: {matchId: state}, out: {pid: rank}, champion, complete, places }
   * seeds: player ids in seed order (seed 0 = top seed). results: { matchId: 'winner>loser' }.
   * state: { pa, pb, w, l, status } where a player is an id, BYE ('~'), or null (not known yet);
   * status: 'pending' | 'ready' | 'done' | 'bye' | 'dead'. A result whose players don't match is ignored. */
  function resolve(B, seeds, results = {}) {
    const R = {}, out = {}, losses = {};
    const val = src => {
      if (src.s != null) return src.s < seeds.length ? seeds[src.s] : BYE;
      const r = R[src.w || src.l]; if (!r) return null;
      return src.w ? (r.w === undefined ? null : r.w) : (r.l === undefined ? null : r.l);
    };
    for (const m of B.matches) {
      const st = { pa: val(m.a), pb: val(m.b), status: 'pending' };
      R[m.id] = st;
      if (m.reset) {
        // Grand-final reset: only if the losers-bracket player won the first final.
        const g1 = R.G1, g1m = B.byId.G1;
        if (g1.status === 'done' && B.reset && g1.w === g1.pb && g1m) { /* live */ }
        else if (g1.status === 'done') { st.pa = st.pb = BYE; st.w = st.l = BYE; st.status = 'dead'; continue; }
        else { st.pa = st.pb = null; continue; }
      }
      if (st.pa === null || st.pb === null) continue;
      if (st.pa === BYE && st.pb === BYE) { st.w = st.l = BYE; st.status = 'dead'; continue; }
      if (st.pa === BYE || st.pb === BYE) { st.w = st.pa === BYE ? st.pb : st.pa; st.l = BYE; st.status = 'bye'; continue; }
      const r = parseRes(results[m.id]);
      if (r && ((r[0] === st.pa && r[1] === st.pb) || (r[0] === st.pb && r[1] === st.pa))) {
        st.w = r[0]; st.l = r[1]; st.status = 'done';
        losses[st.l] = (losses[st.l] || 0) + 1;
        let eliminated = m.out != null;
        if (m.id === 'G1' && B.reset && st.w === st.pb) eliminated = false;   // winners-bracket champ has only one loss now
        if (eliminated) out[st.l] = m.out;
      } else st.status = 'ready';
    }
    // Champion: the winner of the last match that was actually needed.
    let champion = null;
    if (B.format === 'double') { const g1 = R.G1, g2 = R.G2; champion = g2.status === 'done' ? g2.w : g1.status === 'done' && g2.status === 'dead' ? g1.w : null; }
    else { const fin = R[B.matches[B.matches.length - 1].id]; champion = fin.status === 'done' || fin.status === 'bye' ? fin.w : null; }
    const complete = !!champion;
    // Places: players knocked out at the same stage share a place (e.g. both losing semifinalists are 3rd).
    let places = null;
    if (complete) {
      places = {};
      const rank = p => p === champion ? Infinity : out[p];
      for (const p of seeds) places[p] = 1 + seeds.filter(q => rank(q) > rank(p)).length;
    }
    return { m: R, out, losses, champion, complete, places };
  }

  // Keep only the results that still fit the bracket (used after a result is changed or cleared).
  function prune(B, seeds, results) {
    const res = resolve(B, seeds, results), keep = {};
    for (const id in results) if (res.m[id] && res.m[id].status === 'done') keep[id] = results[id];
    return keep;
  }

  // Record (or clear, with winner = null) a result and drop any later results that depended on the old one.
  function setResult(B, seeds, results, matchId, winner) {
    const res = resolve(B, seeds, results), st = res.m[matchId];
    const next = { ...results };
    if (!winner) delete next[matchId];
    else {
      if (!st || !(st.status === 'ready' || st.status === 'done')) return results;
      if (winner !== st.pa && winner !== st.pb) return results;
      next[matchId] = resKey(winner, winner === st.pa ? st.pb : st.pa);
    }
    return prune(B, seeds, next);
  }

  // ---------------------------------------------------------------- player's view
  // Describe where a slot's player comes from, skipping byes ("Winner of #5", "Loser of #3").
  function slotText(B, src) {
    for (let guard = 0; guard < 64; guard++) {
      if (src.s != null) return src.s < B.n ? null : 'Bye';
      const m = B.byId[src.w || src.l];
      if (!m || m.dead || (src.l && !m.play)) return 'Bye';
      if (m.play) return `${src.w ? 'Winner' : 'Loser'} of #${m.num}`;
      // A bye match passes its one real player straight through: describe where that player comes from.
      src = isReal(B, m.a) ? m.a : m.b;
    }
    return null;
  }
  const isReal = (B, s) => s.s != null ? s.s < B.n : s.w ? !B.byId[s.w].dead : B.byId[s.l].play;

  /* For player pid: { status: 'champion'|'out'|'alive'|'waiting', match, opp, ifWin, ifLose, played }
   *   match: the next match they're in (ready or waiting for an opponent); opp: pid or null; oppText: where the opponent comes from.
   *   ifWin / ifLose: { match, opp, oppText } for the match they'd go to, or { out: true } / { champion: true }. */
  function playerPath(B, res, pid) {
    const played = B.matches.filter(m => res.m[m.id].status === 'done' && (res.m[m.id].w === pid || res.m[m.id].l === pid));
    if (res.champion === pid) return { status: 'champion', played };
    if (res.out[pid] != null) return { status: 'out', played, place: res.places ? res.places[pid] : null };
    // The next match: the earliest one with this player in it that isn't decided.
    const cur = B.matches.find(m => { const s = res.m[m.id]; return (s.pa === pid || s.pb === pid) && (s.status === 'ready' || s.status === 'pending'); });
    if (!cur) return { status: 'waiting', played };
    const s = res.m[cur.id], mySlot = s.pa === pid ? 'a' : 'b', other = mySlot === 'a' ? 'b' : 'a';
    const oppId = s['p' + other];
    const where = to => {
      if (!to) return null;
      while (B.byId[to.id].bye && B.byId[to.id].winTo) to = B.byId[to.id].winTo;   // skip straight through byes
      const m = B.byId[to.id], os = to.slot === 'a' ? 'b' : 'a', o = res.m[m.id]['p' + os];
      if (m.reset) return { match: m, opp: null, oppText: 'the same opponent again' };
      return { match: m, opp: o && o !== BYE ? o : null, oppText: o && o !== BYE ? null : slotText(B, m[os]) };
    };
    let ifWin = where(cur.winTo), ifLose = where(cur.loseTo);
    // Winning the first grand final as the winners-bracket player, or the final match of any draw, wins it all.
    if (cur.id === 'G1' && mySlot === 'a') ifWin = { champion: true };
    else if (!cur.winTo || (cur.id === 'G1' && !B.reset)) ifWin = { champion: true };
    if (cur.id === 'G1' && mySlot === 'b' && B.reset) ifWin = { match: B.byId.G2, opp: oppId || null, oppText: 'the same opponent again' };
    if (cur.id === 'G1' && mySlot === 'a' && B.reset) ifLose = { match: B.byId.G2, opp: oppId || null, oppText: 'the same opponent again' };
    else if (cur.out != null) ifLose = { out: true };
    return { status: 'alive', match: cur, ready: s.status === 'ready', opp: oppId && oppId !== BYE ? oppId : null,
      oppText: oppId && oppId !== BYE ? null : slotText(B, cur[other]), ifWin, ifLose, played };
  }

  // ---------------------------------------------------------------- tables
  /* Hand ready matches to free tournament tables.
   * ready: match ids that can be played now, most urgent first; assign: { matchId: table } for matches already
   * on a table (finished matches must be left out); tables: the tournament's tables in the order to use them.
   * Returns { assign, called: [ids newly given a table], moved: [ids taken off a table that left the tournament] }. */
  function assignTables(ready, assign, tables) {
    const next = {}, moved = [], called = [];
    for (const id in assign) { if (tables.includes(assign[id])) next[id] = assign[id]; else moved.push(id); }
    const used = new Set(Object.values(next));
    const free = tables.filter(t => !used.has(t));
    for (const id of ready) {
      if (next[id] != null) continue;
      if (!free.length) break;
      next[id] = free.shift(); called.push(id);
    }
    return { assign: next, called, moved };
  }

  // ---------------------------------------------------------------- seeding
  function shuffle(a, rand = Math.random) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  /* players: [{ id, sl }]. mode: 'random' (draw), 'order' (as listed, top = seed 1), 'skill' (highest skill level first). */
  function seedPlayers(players, mode, rand) {
    if (mode === 'order') return players.map(p => p.id);
    if (mode === 'skill') return players.map((p, i) => [p, i]).sort((x, y) => (+y[0].sl || 0) - (+x[0].sl || 0) || x[1] - y[1]).map(x => x[0].id);
    return shuffle(players.map(p => p.id), rand);
  }

  // ---------------------------------------------------------------- relay messages
  // ntfy.sh turns a message over 4,096 bytes into a file attachment, so big states are split into parts.
  const ascii = s => s.replace(/[\u0080-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  function pack(obj, kind = 'tourney', max = 2600) {
    const body = ascii(JSON.stringify(obj));
    if (body.length <= max) return [body];
    const n = Math.ceil(body.length / max), ts = obj.ts || Date.now(), parts = [];
    for (let i = 0; i < n; i++) parts.push(JSON.stringify({ kind: kind + '-part', tid: obj.tid, ts, i, n, d: body.slice(i * max, (i + 1) * max) }));
    return parts;
  }
  // Collects parts; returns the whole object once every part of one version has arrived.
  function Collector(kind = 'tourney') {
    const got = {};
    return function take(m) {
      if (!m || typeof m !== 'object') return null;
      if (m.kind === kind) return m;
      if (m.kind !== kind + '-part') return null;
      const key = `${m.tid}:${m.ts}`, g = got[key] = got[key] || { n: m.n, d: [] };
      g.d[m.i] = m.d;
      if (g.d.filter(x => x != null).length === g.n) { delete got[key]; try { return JSON.parse(g.d.join('')); } catch { return null; } }
      return null;
    };
  }

  // ---------------------------------------------------------------- explanations
  const EXPLAIN = {
    single: 'Single elimination: lose once and you\'re out. Winners move on each round until two players meet in the final.',
    double: 'Double elimination: everyone gets two lives. Your first loss drops you into the losers bracket, where you keep playing; a second loss and you\'re out. The losers-bracket winner plays the winners-bracket winner in the grand final.',
    reset: 'Grand-final reset: the winners-bracket player hasn\'t lost yet. If the losers-bracket player wins the first final, both have one loss, so they play one more final to decide it. Turn this off to make the grand final a single match.',
    modified: 'Modified single elimination: lose your first-round match and you\'re not out yet — you drop into a one-loss second-chance bracket. Win there and you rejoin the main draw for the final stage. After round 1, any loss and you\'re out. A player with a round-1 bye has no second chance: the bye is their advantage.',
    byes: 'Byes: when the field isn\'t 4, 8, 16 or 32, some players skip round 1. Byes go to the top seeds, so with a random draw they go to whoever the draw puts on top.',
    races: 'APA skill levels: each player\'s race comes from the APA 8-ball chart (e.g. SL3 vs SL6 = 2 games to 5). APA 9-ball uses points (SL3 needs 25). Reduced races take one game off both players only if both still need at least 2 — 3/5 becomes 2/4, but 2/5 stays 2/5.',
  };

  // ---------------------------------------------------------------- diagrams
  /* A small picture of how players move through each format (SVG string). Colours come from CSS variables
   * with fallbacks, so it matches the dark pool pages. */
  function diagram(format, reset = true) {
    const W = 340, box = (x, y, w, label, cls = '') => `<g class="dg-box ${cls}"><rect x="${x}" y="${y}" width="${w}" height="24" rx="6" fill="${cls === 'gold' ? '#3a2a08' : cls === 'lb' ? '#2a1a1a' : '#16303f'}" stroke="${cls === 'gold' ? '#f2c14e' : cls === 'lb' ? '#e4574a' : '#139fdc'}" stroke-width="1.2"/><text x="${x + w / 2}" y="${y + 16}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#eef3f7" font-family="Barlow,system-ui,sans-serif">${label}</text></g>`;
    const arrow = (x1, y1, x2, y2, col = '#8c9bab', dash = false) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="1.4" ${dash ? 'stroke-dasharray="4 3"' : ''} marker-end="url(#ah${col.slice(1)})"/>`;
    const out = (x, y) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="9" fill="#e4574a" font-family="Barlow,system-ui,sans-serif">lose → out</text>`;
    const note = (x, y, t, col = '#8c9bab', anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="9" fill="${col}" font-family="Barlow,system-ui,sans-serif">${t}</text>`;
    const defs = `<defs>${['8c9bab', 'e4574a', 'f2c14e', '57d98a'].map(c => `<marker id="ah${c}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="#${c}"/></marker>`).join('')}</defs>`;
    let g = '', h = 90;
    if (format === 'single') {
      const xs = [4, 72, 140, 208], lab = ['Round 1', 'Quarters', 'Semis', 'Final'];
      xs.forEach((x, i) => { g += box(x, 20, 58, lab[i], i === 3 ? 'gold' : ''); g += out(x + 29, 60); if (i < 3) g += arrow(x + 58, 32, xs[i + 1] - 2, 32, '#57d98a'); });
      g += arrow(266, 32, 286, 32, '#f2c14e') + note(310, 36, '🏆 1st', '#f2c14e') + note(170, 80, 'Win and move right. One loss and you\'re out.');
      h = 90;
    } else if (format === 'double') {
      h = 150;
      const xs = [4, 70, 136];
      ['W round 1', 'W round 2', 'W final'].forEach((l, i) => { g += box(xs[i], 14, 58, l); if (i < 2) g += arrow(xs[i] + 58, 26, xs[i + 1] - 2, 26, '#57d98a'); g += arrow(xs[i] + 29, 38, xs[i] + 29 + (i ? 14 : 0), 88, '#e4574a', true); });
      g += note(34, 62, '1st loss', '#e4574a', 'start');
      const lx = [4, 70, 136, 202];
      ['L round 1', 'L round 2', 'L round 3', 'L final'].forEach((l, i) => { g += box(lx[i], 90, 58, l, 'lb'); if (i < 3) g += arrow(lx[i] + 58, 102, lx[i + 1] - 2, 102, '#57d98a'); });
      g += note(130, 132, '2nd loss (any losers-bracket match) → out', '#e4574a');
      g += box(222, 50, 70, 'Grand final', 'gold') + arrow(194, 26, 238, 48, '#57d98a') + arrow(260, 90, 258, 76, '#57d98a');
      g += arrow(292, 62, 312, 62, '#f2c14e') + note(326, 58, '🏆', '#f2c14e');
      if (reset) g += note(257, 144, 'If the L player wins: play again', '#f2c14e');
    } else {
      h = 150;
      g += box(4, 14, 58, 'Round 1') + arrow(62, 26, 74, 26, '#57d98a') + box(76, 14, 58, 'Round 2') + out(105, 50);
      g += arrow(134, 26, 158, 44, '#57d98a');
      g += arrow(33, 38, 33, 88, '#e4574a', true) + note(38, 66, '1st-round loss', '#e4574a', 'start');
      g += box(4, 90, 92, 'Second chance', 'lb') + out(50, 128) + arrow(96, 100, 158, 64, '#57d98a');
      g += box(160, 42, 58, 'Last 8') + arrow(218, 54, 234, 54, '#57d98a') + box(236, 42, 50, 'Final', 'gold') + out(189, 80) + out(261, 80);
      g += arrow(286, 54, 304, 54, '#f2c14e') + note(320, 58, '🏆', '#f2c14e');
      g += note(222, 110, 'After round 1, one loss and you\'re out.');
    }
    return `<svg viewBox="0 0 ${W} ${h}" width="100%" role="img" aria-label="How ${format} elimination works" style="display:block;max-width:520px">${defs}${g}</svg>`;
  }

  const api = { APA8, APA9, DEFAULT_SL, STAGES, STAGE_NAME, BYE, EXPLAIN, apa8Race, reduceRace, raceFor, usesSkill, cleanSl, slRange,
    seedPositions, build, resolve, prune, setResult, parseRes, resKey, slotText, playerPath, assignTables, seedPlayers, shuffle, pack, Collector, diagram };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Tourney = api;
})(typeof self !== 'undefined' ? self : this);
