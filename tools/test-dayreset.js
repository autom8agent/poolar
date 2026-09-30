#!/usr/bin/env node
/* Tests for the 2 AM daily reset and the hall calendar (hallday.js, hall.html, deck.html, wait.html, night.html).
 * Runs the pages in headless Chromium against a local stub relay (this file) with a faked clock. Every request
 * that isn't to localhost is blocked, so nothing ever reaches ntfy.sh or the Cloudflare relay.
 * Run: node tools/test-dayreset.js   (needs Playwright; set PLAYWRIGHT=/path/to/node_modules/playwright if it isn't installed here) */
const http = require('http'), fs = require('fs'), path = require('path');
const D = require('../hallday.js');
const pw = (() => { for (const p of [process.env.PLAYWRIGHT, 'playwright', path.join(__dirname, '../../../browser automation/node_modules/playwright')]) { try { if (p) return require(p); } catch {} } throw new Error('Playwright not found: set PLAYWRIGHT=/path/to/node_modules/playwright'); })();

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('  FAIL', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const Z = s => Date.parse(s);
const iso = t => new Date(t).toISOString();

// ------------------------------------------------------------------ lastReset math (Node)
console.log('lastReset');
const cases = [
  // [now (UTC), expected boundary (UTC), what]
  ['2026-09-30T06:59:00Z', '2026-09-29T07:00:00Z', 'CDT 1:59 AM → yesterday 2 AM'],
  ['2026-09-30T07:00:00Z', '2026-09-30T07:00:00Z', 'CDT 2:00 AM exactly → now'],
  ['2026-09-30T07:01:00Z', '2026-09-30T07:00:00Z', 'CDT 2:01 AM → today 2 AM'],
  ['2026-09-30T05:30:00Z', '2026-09-29T07:00:00Z', 'CDT 12:30 AM (still open) → yesterday'],
  ['2026-09-30T22:00:00Z', '2026-09-30T07:00:00Z', 'CDT 5 PM → today 2 AM'],
  ['2026-01-15T07:59:00Z', '2026-01-14T08:00:00Z', 'CST 1:59 AM → yesterday 2 AM'],
  ['2026-01-15T08:01:00Z', '2026-01-15T08:00:00Z', 'CST 2:01 AM → today 2 AM'],
  ['2026-03-08T07:59:00Z', '2026-03-07T08:00:00Z', 'spring forward: 1:59 CST → yesterday'],
  ['2026-03-08T08:00:00Z', '2026-03-08T08:00:00Z', 'spring forward: the jump (2:00 CST = 3:00 CDT) is the boundary'],
  ['2026-03-08T08:01:00Z', '2026-03-08T08:00:00Z', 'spring forward: 3:01 CDT → the jump'],
  ['2026-03-09T06:59:00Z', '2026-03-08T08:00:00Z', 'day after spring forward: 1:59 CDT → the jump'],
  ['2026-03-09T07:01:00Z', '2026-03-09T07:00:00Z', 'day after spring forward: 2:01 CDT'],
  ['2026-11-01T06:30:00Z', '2026-10-31T07:00:00Z', 'fall back: first 1:30 (CDT) → yesterday'],
  ['2026-11-01T07:30:00Z', '2026-10-31T07:00:00Z', 'fall back: second 1:30 (CST) → still yesterday'],
  ['2026-11-01T07:59:00Z', '2026-10-31T07:00:00Z', 'fall back: 1:59 CST → yesterday'],
  ['2026-11-01T08:01:00Z', '2026-11-01T08:00:00Z', 'fall back: 2:01 CST → today (once)'],
  ['2027-01-01T07:30:00Z', '2026-12-31T08:00:00Z', 'new year 1:30 AM → Dec 31'],
  ['2026-03-01T07:59:00Z', '2026-02-28T08:00:00Z', 'month edge 1:59 AM → Feb 28'],
];
for (const [now, want, what] of cases) eq(iso(D.lastReset(Z(now))), iso(Z(want)), what);
{ // every boundary is exactly a Chicago 2:00 (or 3:00 on the spring-forward night), and days are 23–25 h apart
  let bad = 0, t = Z('2025-01-01T00:00:00Z'), prev = D.lastReset(t);
  for (; t < Z('2029-01-01T00:00:00Z'); t += 3 * 36e5 + 7e5) {
    const b = D.lastReset(t); if (b > t) bad++;
    if (b !== prev) { const gap = (b - prev) / 36e5; if (![23, 24, 25].includes(gap)) bad++;
      const h = new Date(b).toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour12: false }); if (!['02:00:00', '03:00:00'].includes(h)) bad++; prev = b; }
  }
  eq(bad, 0, 'four years of boundaries: all at 2 AM Chicago, never in the future, 23-25 h apart');
}
eq(iso(D.nextReset(Z('2026-03-07T20:00:00Z'))), '2026-03-08T08:00:00.000Z', 'next reset before spring forward');
eq(iso(D.nextReset(Z('2026-10-31T20:00:00Z'))), '2026-11-01T08:00:00.000Z', 'next reset before fall back');
ok(D.hear({ kind: 'reset', ts: Z('2026-09-30T07:00:00Z') }) === true || Date.now() < Z('2026-09-30T06:45:00Z'), 'a genuine 2 AM reset message is heard');
ok(D.hear({ kind: 'reset', ts: Z('2026-09-30T07:05:00Z') }) === false, 'a reset message that is not at 2 AM is ignored');
ok(D.hear({ kind: 'reset', ts: Date.now() + 5 * 864e5 }) === false, 'a reset message from the future is ignored');

// ------------------------------------------------------------------ local stub relay + static server
const topics = {}, subs = {}, posted = [];
const relay = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), [, topic, kind] = u.pathname.split('/');
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.method === 'POST' || req.method === 'PUT') {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      const m = { id: Math.random().toString(36).slice(2), time: Math.floor(Date.now() / 1000), event: 'message', topic, message: body };
      (topics[topic] = topics[topic] || []).push(m); posted.push(m);
      for (const r of subs[topic] || []) r.write(`data: ${JSON.stringify(m)}\n\n`);
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(m)); });
    return;
  }
  const msgs = topics[topic] || [];
  if (kind === 'json') { res.writeHead(200, { ...cors, 'Content-Type': 'application/x-ndjson' }); return res.end(msgs.map(m => JSON.stringify(m)).join('\n') + (msgs.length ? '\n' : '')); }
  if (kind === 'sse') { res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write(`data: ${JSON.stringify({ event: 'open', topic })}\n\n`); (subs[topic] = subs[topic] || []).push(res); req.on('close', () => { subs[topic] = subs[topic].filter(r => r !== res); }); return; }
  res.writeHead(200, cors); res.end('ok');
});
const root = path.join(__dirname, '..');
const site = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const pub = (topic, obj) => { const m = { id: Math.random().toString(36).slice(2), time: Math.floor(Date.now() / 1000), event: 'message', topic, message: JSON.stringify(obj) }; (topics[topic] = topics[topic] || []).push(m);
  for (const r of subs[topic] || []) r.write(`data: ${JSON.stringify(m)}\n\n`); };
const reset = () => { for (const k in topics) delete topics[k]; posted.length = 0; };
const sent = (topic, pred) => posted.filter(m => m.topic === topic).map(m => { try { return JSON.parse(m.message); } catch { return null; } }).filter(x => x && pred(x));

(async () => {
  await new Promise(r => relay.listen(0, r)); await new Promise(r => site.listen(0, r));
  const RELAY = `http://localhost:${relay.address().port}`, SITE = `http://localhost:${site.address().port}`;
  const browser = await pw.chromium.launch();
  const errors = [];
  // A fresh phone (empty storage) at a fixed Chicago time. seed(): localStorage/sessionStorage to put in place first.
  async function phone(at, seed, opts = {}){
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Chicago', locale: 'en-US' });
    await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());   // never the real relays, fonts or anything else
    if (seed) await ctx.addInitScript(([s, origin]) => { if (location.origin !== origin || sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
      for (const [k, v] of Object.entries(s.local || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      for (const [k, v] of Object.entries(s.session || {})) sessionStorage.setItem(k, v); }, [seed, SITE]);
    if (opts.init) await ctx.addInitScript(opts.init);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${page.url().split('/').pop()}: ${e.message}`));
    page.on('dialog', d => d.accept());
    await page.clock.install({ time: at });
    return { ctx, page };
  }
  const ls = (page, k) => page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return localStorage.getItem(k); } }, k);
  const settle = page => page.waitForTimeout(700);
  const T0 = Z('2026-10-15T07:00:00Z');                  // Thu Oct 15 2026, 2:00 AM CDT
  const AT = (h, m = 0) => T0 + ((h - 2) * 60 + m) * 6e4;  // Chicago wall time on the morning of Oct 15 (h may be < 2)

  // ---------------------------------------------------------------- browser: lastReset with a faked Date
  console.log('lastReset in the browser (faked Date)');
  for (const [now, want, what] of [['2026-03-08T07:59:00Z', '2026-03-07T08:00:00Z', '1:59 AM before spring forward'], ['2026-03-08T08:01:00Z', '2026-03-08T08:00:00Z', 'after the jump'],
    ['2026-11-01T07:59:00Z', '2026-10-31T07:00:00Z', 'second 1:59 on fall back'], ['2026-11-01T08:01:00Z', '2026-11-01T08:00:00Z', '2:01 CST on fall back'],
    ['2026-10-15T06:59:00Z', '2026-10-14T07:00:00Z', '1:59 AM'], ['2026-10-15T07:01:00Z', '2026-10-15T07:00:00Z', '2:01 AM']]) {
    const { ctx, page } = await phone(Z(now)); await page.goto(`${SITE}/wait.html?hall=surge-chicago&t=1&relay=${RELAY}`);
    eq(iso(await page.evaluate(() => PoolarDay.lastReset())), iso(Z(want)), `browser ${what}`); await ctx.close();
  }

  // ---------------------------------------------------------------- hall ignores yesterday's statuses
  console.log('Hall map');
  {
    reset();
    const H = 'poolar-hall-surge-chicago';
    pub(H, { kind: 'table', t: 3, ts: AT(1, 50), state: 'busy', names: ['Old', 'Game'], score: [2, 1], gh: 'x' });
    pub(H, { kind: 'table', t: 4, ts: AT(2, 5), state: 'busy', names: ['New', 'Game'], score: [0, 0], gh: 'y' });
    const { ctx, page } = await phone(AT(2, 10)); await page.goto(`${SITE}/hall.html?hall=surge-chicago&relay=${RELAY}`); await settle(page);
    ok(!(await page.locator('#tb3').getAttribute('class')).includes('busy'), 'a 1:50 AM status (20 min old, before 2 AM) shows as free');
    ok((await page.locator('#tb4').getAttribute('class')).includes('busy'), 'a 2:05 AM status is in use');
    eq(await page.locator('#gs3').textContent(), 'Open', 'list says table 3 is open');
    await ctx.close();

    reset();
    pub(H, { kind: 'table', t: 3, ts: AT(1, 50), state: 'busy', names: ['Late', 'Night'], score: [2, 1], gh: 'x' });
    const b = await phone(AT(1, 58)); await b.page.goto(`${SITE}/hall.html?hall=surge-chicago&relay=${RELAY}`); await settle(b.page);
    ok((await b.page.locator('#tb3').getAttribute('class')).includes('busy'), 'at 1:58 AM the 1:50 game is in use');
    await b.page.clock.fastForward(3 * 60 * 1000); await b.page.waitForTimeout(300);
    ok(!(await b.page.locator('#tb3').getAttribute('class')).includes('busy'), 'an open map clears itself after 2 AM');
    await b.ctx.close();

    // A reset message from the relay's cron ends the day even on a device whose clock is 3 minutes slow
    // (and one that isn't a 2 AM boundary is ignored).
    reset();
    pub(H, { kind: 'table', t: 3, ts: AT(1, 50), state: 'busy', names: ['Slow', 'Clock'], gh: 'x' });
    const c = await phone(AT(1, 57)); await c.page.goto(`${SITE}/hall.html?hall=surge-chicago&relay=${RELAY}`); await settle(c.page);
    ok((await c.page.locator('#tb3').getAttribute('class')).includes('busy'), 'slow clock: table 3 still in use before the message');
    pub(H, { kind: 'reset', ts: T0 + 6e4 }); await c.page.waitForTimeout(300);
    ok(await c.page.evaluate(() => PoolarDay.boundary()) < T0, 'a reset message that is not at 2 AM is ignored');
    pub(H, { kind: 'reset', ts: T0 }); await c.page.waitForTimeout(400);
    eq(await c.page.evaluate(() => PoolarDay.boundary()), T0, 'the 2 AM reset message moves the boundary');
    ok(!(await c.page.locator('#tb3').getAttribute('class')).includes('busy'), 'and the map clears');
    await c.ctx.close();
  }

  // ---------------------------------------------------------------- deck: archive, never wipe
  console.log('Scoreboard (deck.html)');
  const game = (id, ts, extra) => ({ game: id, names: ['Alice', 'Bob'], race: [5, 5], racks: [{ w: 0, b: 1, t: ts - 6e5 }, { w: 1, b: 0, t: ts - 3e5 }, { w: 0, b: 1, t: ts }],
    t0: ts - 36e5, ts, clockV: 2, gtype: 8, rules: 'bca', fmtMode: 'race', queue: [{ id: 'q1', name: 'Carol', sl: 0 }], qSince: ts - 36e5, ...extra });
  {
    // 1. Personal scoreboard with a game from 12:40 AM, opened at 9 AM: archived, not resumed; relay's old copy ignored.
    reset();
    const old = game('g1old', AT(0, 40));
    pub('poolar-g1old', { ts: old.ts, from: 'other', st: old });
    const { ctx, page } = await phone(AT(9), { local: { 'poolar-deck-v2': old, 'poolar-game-g1old': old } });
    await page.goto(`${SITE}/deck.html?game=g1old&screen=lite&relay=${RELAY}`); await settle(page);
    const h = await ls(page, 'poolar-history') || [];
    const rec = h.find(x => x.kind === 'reset');
    ok(!!rec, 'the old game is in poolar-history');
    ok(rec && rec.game && rec.game.racks.length === 3 && rec.game.queue[0].name === 'Carol', 'history keeps the full game (3 racks, the waitlist)');
    eq(rec && rec.score, [2, 1], 'archived score');
    const now = await ls(page, 'poolar-game-g1old');
    ok(now && now.racks.length === 0 && now.queue.length === 0, 'the table starts clean (no racks, empty waitlist)');
    eq(now && now.names, ['Alice', 'Bob'], 'a personal scoreboard keeps its names');
    await page.reload(); await settle(page);
    eq((await ls(page, 'poolar-history')).filter(x => x.kind === 'reset').length, 1, 'reloading does not archive twice');
    eq((await ls(page, 'poolar-game-g1old')).racks.length, 0, "the relay's pre-2 AM copy is not applied back");
    await ctx.close();
  }
  {
    // 2. A game touched at 2:05 AM is never ended.
    reset();
    const g = game('g2new', AT(2, 5));
    const { ctx, page } = await phone(AT(9), { local: { 'poolar-deck-v2': g, 'poolar-game-g2new': g } });
    await page.goto(`${SITE}/deck.html?game=g2new&screen=lite&relay=${RELAY}`); await settle(page);
    eq((await ls(page, 'poolar-game-g2new')).racks.length, 3, 'a game active after 2 AM is resumed untouched');
    ok(!(await ls(page, 'poolar-history') || []).some(x => x.kind === 'reset'), 'and nothing is archived');
    await ctx.close();
  }
  {
    // 3. Archive can't be written (storage full): the game is left exactly as it was.
    reset();
    const g = game('g3full', AT(0, 30));
    const init = () => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'poolar-history') throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); }; };
    const { ctx, page } = await phone(AT(9), { local: { 'poolar-deck-v2': g, 'poolar-game-g3full': g } }, { init });
    await page.goto(`${SITE}/deck.html?game=g3full&screen=lite&relay=${RELAY}`); await settle(page);
    eq((await ls(page, 'poolar-game-g3full')).racks.length, 3, 'if the archive fails, the game is kept (not wiped)');
    await ctx.close();
  }
  {
    // 4. Table mode: this phone's table-5 game from last night; opening table 5 in the morning archives it and offers a fresh start.
    reset();
    const g = game('k5old', AT(0, 45), { table: 'surge-chicago-5' });
    pub('poolar-hall-surge-chicago', { kind: 'table', t: 5, ts: AT(0, 50), state: 'busy', gh: 'whatever', names: ['Alice', 'Bob'] });
    const { ctx, page } = await phone(AT(9, 30), { local: { 'poolar-deck-v2': g, 'poolar-game-k5old': g, 'poolar-mytables': { 'surge-chicago-5': 'k5old' } } });
    await page.goto(`${SITE}/deck.html?hall=surge-chicago&t=5&relay=${RELAY}`); await settle(page);
    ok(!page.url().includes('game='), 'does not go back into last night\'s game');
    ok(await page.locator('#gClaim').isVisible(), 'table 5 is open: "Start a game" is offered');
    ok((await ls(page, 'poolar-history') || []).some(x => x.kind === 'reset' && x.game && x.game.game === 'k5old' && x.table === 5), 'last night\'s game is in history');
    eq(await ls(page, 'poolar-mytables'), {}, "this phone's claim on the table is cleared");
    // start a new game: its waitlist doesn't pick up last night's joins
    pub('poolar-wait-surge-chicago-t5', { kind: 'join', id: 'wold', name: 'Last night', ts: AT(1, 55) });
    pub('poolar-wait-surge-chicago-t5', { kind: 'join', id: 'wnew', name: 'This morning', ts: AT(9, 29) });
    await page.locator('#gClaim').click(); await page.waitForURL(/game=/); await settle(page);
    const key = page.url().match(/game=([a-z0-9]+)/)[1], ng = await ls(page, 'poolar-game-' + key);
    eq(ng && ng.queue.map(q => q.name), ['This morning'], 'the new table\'s waitlist drops entries from before 2 AM');
    await ctx.close();
  }
  {
    // 5. Page open on the table when 2 AM passes: game archived, table freed on the map, back to the start screen.
    reset();
    const g = game('k7live', AT(1, 50), { table: 'surge-chicago-7' });
    const { ctx, page } = await phone(AT(1, 55), { local: { 'poolar-deck-v2': g, 'poolar-game-k7live': g, 'poolar-mytables': { 'surge-chicago-7': 'k7live' } } });
    await page.goto(`${SITE}/deck.html?hall=surge-chicago&t=7&game=k7live&screen=lite&relay=${RELAY}`); await settle(page);
    eq((await ls(page, 'poolar-game-k7live')).racks.length, 3, 'at 1:55 AM the game is still on');
    await page.clock.runFor(2500);
    const busyPosts = sent('poolar-hall-surge-chicago', m => m.kind === 'table' && m.t === 7 && m.state === 'busy').length;
    ok(busyPosts > 0, 'the table reported itself busy');
    await page.clock.fastForward(7 * 60 * 1000); await page.waitForURL(u => !String(u).includes('game='), { timeout: 8000 }).catch(() => {}); await settle(page);
    ok(sent('poolar-hall-surge-chicago', m => m.kind === 'table' && m.t === 7 && m.state === 'free').length === 1, 'at 2 AM the table posts "free"');
    ok((await ls(page, 'poolar-history') || []).some(x => x.kind === 'reset' && x.game && x.game.game === 'k7live'), 'the game is archived');
    ok(!page.url().includes('game='), 'the page goes back to the table\'s start screen');
    await ctx.close();
  }
  {
    // 6. A game last touched at 2:00:30 AM is never ended, even with the page left open all morning.
    reset();
    const g = game('g8late', AT(2, 0) + 30000);
    const { ctx, page } = await phone(AT(2, 1), { local: { 'poolar-deck-v2': g, 'poolar-game-g8late': g } });
    await page.goto(`${SITE}/deck.html?game=g8late&screen=lite&relay=${RELAY}`); await settle(page);
    eq((await ls(page, 'poolar-game-g8late')).racks.length, 3, 'a game touched at 2:00:30 AM is resumed');
    await page.clock.fastForward(6 * 3600 * 1000); await page.waitForTimeout(300);
    eq((await ls(page, 'poolar-game-g8late')).racks.length, 3, '...and survives the page staying open until 8 AM');
    ok(!(await ls(page, 'poolar-history') || []).some(x => x.kind === 'reset'), '...with nothing archived');
    await ctx.close();
  }

  // ---------------------------------------------------------------- waitlist page
  console.log('Waitlist (wait.html)');
  {
    reset();
    const T = 'poolar-wait-surge-chicago-t2';
    pub(T, { kind: 'line', q: [{ id: 'a', n: 'Old Ann' }], now: ['X', 'Y'], score: [1, 0], fmt: 'race', table: 2, ts: AT(1, 30) });
    const oldMe = { id: 'w' + AT(1, 20).toString(36) + 'abcd', name: 'Old Ann' };
    const { ctx, page } = await phone(AT(10), { local: { ['poolar-wait-me-' + T]: oldMe } });
    await page.goto(`${SITE}/wait.html?hall=surge-chicago&t=2&relay=${RELAY}`); await settle(page);
    ok(await page.locator('#joinCard').isVisible(), "yesterday's spot in line is dropped: the join form shows");
    eq(await ls(page, 'poolar-wait-me-' + T), null, 'the stale "me" entry is removed');
    ok(!(await page.locator('#list').textContent()).includes('Old Ann'), "yesterday's line isn't shown");
    pub(T, { kind: 'line', q: [{ id: 'b', n: 'New Nick' }], now: ['P', 'Q'], score: [0, 0], fmt: 'race', table: 2, ts: AT(9, 50) });
    await page.waitForTimeout(400);
    ok((await page.locator('#list').textContent()).includes('New Nick'), "today's line is shown");
    await ctx.close();
  }
  {
    // Joined at 1:30 AM, page still open at 2 AM: the spot goes away by itself.
    reset();
    const T = 'poolar-wait-surge-chicago-t2';
    const { ctx, page } = await phone(AT(1, 30)); await page.goto(`${SITE}/wait.html?hall=surge-chicago&t=2&relay=${RELAY}`); await settle(page);
    await page.fill('#name', 'Night Owl'); await page.click('#joinForm button[type=submit]'); await page.waitForTimeout(300);
    ok(await page.locator('#youCard').isVisible(), 'joined at 1:30 AM');
    await page.clock.fastForward(32 * 60 * 1000); await page.waitForTimeout(300);
    ok(await page.locator('#joinCard').isVisible(), 'at 2 AM the stale spot is dropped');
    await ctx.close();
  }

  // ---------------------------------------------------------------- calendar
  console.log('Calendar (hall.html, night.html)');
  {
    reset();
    const SCH = 'poolar-sched-surge-chicago';
    const night = (id, date, title, extra) => ({ kind: 'night', id, on: true, title, date, start: '19:00', end: '23:00', note: '', tables: [{ t: 1, g: 8, dbl: false, fmt: 'wso', race: 0, note: '' }], applied: 0, ended: 0, ts: AT(0), ...extra });
    pub(SCH, night('n1', '2026-10-17', 'Saturday Doubles'));
    pub(SCH, night('n2', '2026-10-24', 'Ladies Night'));
    pub(SCH, night('n3', '2026-10-20', 'Cancelled one', { on: false }));
    pub(SCH, { kind: 'tsum', tid: 'tt1', title: 'Fall 8-Ball Open', phase: 'reg', open: true, n: 4, fmt: 'double', gtype: 8, when: '2026-10-31T13:00', ts: AT(0) });
    const { ctx, page } = await phone(AT(15)); await page.goto(`${SITE}/hall.html?hall=surge-chicago&relay=${RELAY}`); await settle(page);
    eq(await page.locator('#today').textContent(), 'Thursday, October 15', "today's date (Chicago)");
    const chips = await page.locator('#up a').allTextContents();
    eq(chips.length, 3, 'upcoming strip: two nights and the tournament (not the cancelled night)');
    ok(chips[0].includes('Saturday Doubles') && chips[0].includes('SAT, OCT 17') && chips[2].includes('Fall 8-Ball Open'), 'upcoming strip in date order');
    ok(await page.locator('#cal').isHidden(), 'calendar starts folded');
    await page.click('#calBtn');
    ok(await page.locator('#cal').isVisible(), 'the Calendar button opens it');
    eq(await page.locator('#cal .pcal-h b').textContent(), 'October 2026', 'shows this month');
    eq(await page.locator('#cal [data-date="2026-10-17"] .pcal-d s.night').count(), 1, 'dot on Oct 17 (night)');
    eq(await page.locator('#cal [data-date="2026-10-31"] .pcal-d s.tour').count(), 1, 'gold dot on Oct 31 (tournament)');
    eq(await page.locator('#cal [data-date="2026-10-20"] .pcal-d').count(), 0, 'no dot for a night taken off the calendar');
    ok((await page.locator('#cal [data-date="2026-10-15"]').getAttribute('class')).includes('today'), 'today is outlined');
    eq(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'hall fits a 390 px phone (no sideways scroll)');
    await page.screenshot({ path: path.join(require('os').tmpdir(), 'poolar-hall-calendar.png'), fullPage: true });
    await page.click('#cal [data-date="2026-10-22"]'); await page.waitForURL(/night\.html/); await settle(page);
    ok(page.url().includes('date=2026-10-22'), 'tapping a date opens the planner on that date');
    ok((await page.locator('#when').textContent()).includes('Nothing planned for Thursday, October 22'), 'planner: nothing planned that day');
    ok((await page.locator('#cal [data-date="2026-10-22"]').getAttribute('class')).includes('sel'), 'planner calendar shows the picked date');
    eq((await page.locator('#sched .srow').allTextContents()).length, 3, "planner lists what's already scheduled");
    await ctx.close();

    // Admin plans a night on the picked date; it goes to the calendar and to both topics.
    const a = await phone(AT(15), { session: { 'poolar-admin-surge-chicago': '1' } });
    await a.page.goto(`${SITE}/night.html?hall=surge-chicago&date=2026-10-22&relay=${RELAY}`); await settle(a.page);
    eq(await a.page.inputValue('#nDate'), '2026-10-22', 'the editor is pre-filled with the date');
    await a.page.fill('#nTitle', 'Thursday 9-Ball'); await a.page.click('[data-tpl="all9"]'); await a.page.click('#publish'); await a.page.waitForTimeout(400);
    ok(sent('poolar-hall-surge-chicago', m => m.kind === 'night' && m.title === 'Thursday 9-Ball' && m.date === '2026-10-22').length === 1, 'published to the hall topic');
    ok(sent(SCH, m => m.kind === 'night' && m.title === 'Thursday 9-Ball').length === 1, 'published to the schedule topic');
    eq(await a.page.locator('#cal [data-date="2026-10-22"] .pcal-d s.night').count(), 1, 'the new night gets a dot');
    // pick another planned night: its plan loads into the editor; the first one is still there
    await a.page.click('#cal [data-date="2026-10-17"]'); await a.page.waitForTimeout(200);
    eq(await a.page.inputValue('#nTitle'), 'Saturday Doubles', 'tapping a planned date opens that night');
    eq(await a.page.textContent('#title'), 'Saturday Doubles', 'and shows it');
    // typed changes are not thrown away when a relay message arrives
    await a.page.fill('#nNote', 'Bring a partner'); pub(SCH, night('n9', '2026-10-28', 'Someone else')); await a.page.waitForTimeout(500);
    eq(await a.page.inputValue('#nNote'), 'Bring a partner', 'a typed note survives an incoming plan');
    eq(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'planner fits a 390 px phone');
    await a.page.screenshot({ path: path.join(require('os').tmpdir(), 'poolar-night-calendar.png'), fullPage: true });
    await a.ctx.close();

    const c = await phone(AT(16)); await c.page.goto(`${SITE}/hall.html?hall=surge-chicago&relay=${RELAY}`); await settle(c.page);
    ok((await c.page.locator('#up').textContent()).includes('Thursday 9-Ball'), 'another phone sees the new night on the hall page');
    await c.ctx.close();
  }

  eq(errors, [], 'no page errors');
  await browser.close(); relay.close(); site.close();
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
