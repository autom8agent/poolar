/* hallday.js — the hall's day and its calendar, shared by hall.html, deck.html, wait.html and night.html.
 *
 * The hall is open 9 AM–1 AM. At 2 AM Chicago time every game ends and the tables start clean for the next day.
 * lastReset() is that boundary: the most recent 2:00 AM in America/Chicago, as epoch ms. It is DST-safe: on the
 * spring-forward night 2:00 doesn't exist and the boundary is the jump itself (3:00 CDT); on the fall-back night
 * 1:00–1:59 happens twice and the boundary is the single 2:00 CST after it.
 * Anything older than boundary() (a table status, a saved game, a waitlist entry) belongs to a finished day.
 *
 * Sched(hall) keeps the hall's schedule (open table nights and tournaments) on this device, and calendar() draws
 * the small month calendar both pages use. Browser: window.PoolarDay. Node (tests): module.exports. */
(function (root) {
  'use strict';
  const TZ = 'America/Chicago', HOUR = 2, DAY = 864e5;
  const F = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const parts = ms => { const o = {}; for (const p of F.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = +p.value; return o; };
  const pad = n => String(n).padStart(2, '0');
  // Chicago's offset from UTC at a moment, in ms (-5 h or -6 h).
  const offset = ms => { const o = parts(ms); return Date.UTC(o.year, o.month - 1, o.day, o.hour % 24, o.minute, o.second) - Math.floor(ms / 1000) * 1000; };
  // First moment of Chicago date y-m-d at which the clock reads 2:00 or later.
  function resetOn(y, m, d){
    const g = Date.UTC(y, m - 1, d, HOUR);
    const c = [...new Set([g - offset(g - DAY), g - offset(g + DAY)])].sort((a, b) => a - b);
    for (const t of c) { const o = parts(t); if (o.day === d && o.hour >= HOUR) return t; }
    return c[c.length - 1];
  }
  function lastReset(now){
    now = now == null ? Date.now() : +now;
    const o = parts(now); let t = resetOn(o.year, o.month, o.day);
    if (t > now) { const p = new Date(Date.UTC(o.year, o.month - 1, o.day - 1)); t = resetOn(p.getUTCFullYear(), p.getUTCMonth() + 1, p.getUTCDate()); }
    return t;
  }
  const nextReset = now => lastReset(lastReset(now) + 26 * 36e5);

  // A {kind:'reset', ts} from the relay's 2 AM cron moves the boundary even if this device's clock is behind.
  // Only trusted when ts is exactly a 2 AM boundary and not in the future, so a stray message can't end games early.
  let heard = 0;
  const hear = m => { const ts = m && m.kind === 'reset' ? +m.ts : 0;
    if (!ts || lastReset(ts) !== ts || ts > Date.now() + 15 * 6e4 || ts <= heard) return false; heard = ts; return true; };
  const boundary = now => Math.max(lastReset(now), heard);

  // Chicago calendar date 'YYYY-MM-DD' for a moment; today(); a friendly "Tuesday, September 30".
  const ymd = ms => { const o = parts(ms); return `${o.year}-${pad(o.month)}-${pad(o.day)}`; };
  const today = () => ymd(Date.now());
  const label = (ms, opt) => new Date(ms == null ? Date.now() : ms).toLocaleDateString([], { timeZone: TZ, ...(opt || { weekday: 'long', month: 'long', day: 'numeric' }) });
  const dayLabel = (d, opt) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd, 12)).toLocaleDateString([], { timeZone: 'UTC', ...(opt || { weekday: 'short', month: 'short', day: 'numeric' }) }); };
  const addDays = (d, k) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd + k)).toISOString().slice(0, 10); };
  const addMonth = (ym, k) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 7); };

  // ---- The hall's schedule ----
  // Open table nights arrive as kind:'night' (one per id), tournaments as kind:'tsum' (one per tid); the newest copy
  // of each wins. They are kept on this device too, so the calendar still shows plans the relay has forgotten.
  function Sched(hall){
    const LS = 'poolar-sched-' + hall;
    let d = { n: {}, t: {} };
    try { const j = JSON.parse(localStorage.getItem(LS) || 'null'); if (j && j.n && j.t) d = j; } catch {}
    const keep = () => { const old = addDays(today(), -3), cut = Date.now() - 30 * DAY;
      for (const k in d.n) if ((d.n[k].date || '') < old) delete d.n[k];
      for (const k in d.t) if ((d.t[k].ts || 0) < cut) delete d.t[k];
      try { localStorage.setItem(LS, JSON.stringify(d)); } catch {} };
    const tourDate = t => t.when && t.phase && t.phase !== 'none' ? String(t.when).slice(0, 10) : '';
    const S = {
      take(m){
        if (!m) return false;
        const box = m.kind === 'night' && m.id && m.date ? d.n : m.kind === 'tsum' && m.tid ? d.t : null, k = box && (m.id || m.tid);
        if (!box || (box[k] && (box[k].ts || 0) > (m.ts || 0))) return false;
        if (box[k] && JSON.stringify(box[k]) === JSON.stringify(m)) return false;
        box[k] = m; keep(); return true;
      },
      // Planned nights (not taken off the calendar), by date and start time.
      nights: () => Object.values(d.n).filter(p => p.on).sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || ''))),
      night: id => d.n[id] || null,
      tours: () => Object.values(d.t).filter(tourDate),
      tourDate,
      // { 'YYYY-MM-DD': ['night', 'tour'] } for the calendar dots.
      marks(){ const m = {}; const add = (k, v) => { if (!k) return; m[k] = m[k] || []; if (!m[k].includes(v)) m[k].push(v); };
        S.nights().forEach(p => add(p.date, 'night')); S.tours().forEach(t => add(tourDate(t), 'tour')); return m; },
      // What's coming up from a date on: [{ date, kind, title, time, id }], soonest first.
      upcoming(from){
        from = from || today();
        const n = S.nights().filter(p => !p.ended && p.date >= from).map(p => ({ date: p.date, kind: 'night', title: p.title || 'Open table night', time: p.start || '', id: p.id }));
        const t = S.tours().filter(x => (x.phase === 'reg' || x.phase === 'live') && tourDate(x) >= from).map(x => ({ date: tourDate(x), kind: 'tour', title: x.title || 'Tournament', time: String(x.when).slice(11, 16), id: x.tid }));
        return [...n, ...t].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      },
    };
    return S;
  }

  // ---- Month calendar ----
  // calendar(el, { marks: () => ({date: kinds}), sel: 'YYYY-MM-DD', onPick(date) }) → { paint(), select(date) }.
  // Dots: blue = open table night, gold = tournament. Past days are dimmed, today is outlined.
  const CSS = `.pcal{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:10px 10px 8px}
.pcal-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.pcal-h b{font-family:var(--num);font-weight:900;font-size:20px;letter-spacing:.03em;text-transform:uppercase}
.pcal-h button{background:none;border:1px solid var(--line);color:var(--text);border-radius:8px;width:40px;height:34px;padding:0;font:700 18px var(--ui);cursor:pointer}
.pcal-g{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;text-align:center}
.pcal-g i{font-style:normal;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--muted);padding:2px 0}
.pcal-g button{position:relative;height:38px;min-width:0;border:1px solid transparent;border-radius:8px;background:none;color:var(--text);padding:0 0 6px;font:700 14px var(--ui);cursor:pointer}
.pcal-g button.past{color:var(--muted);opacity:.55}
.pcal-g button.has{background:rgba(19,159,220,.13)}
.pcal-g button.today{border-color:var(--gold);color:var(--gold);opacity:1}
.pcal-g button.sel{background:var(--felt);border-color:var(--felt);color:#04162b;opacity:1}
.pcal-d{position:absolute;left:0;right:0;bottom:4px;display:flex;justify-content:center;gap:3px}
.pcal-d s{width:6px;height:6px;border-radius:50%;background:var(--felt)}
.pcal-d s.tour{background:var(--gold)}
.pcal-g button.sel .pcal-d s{box-shadow:0 0 0 1.5px #04162b}
.pcal-k{display:flex;gap:12px;margin-top:6px;font-size:11px;font-weight:600;color:var(--muted)}
.pcal-k span{display:inline-flex;align-items:center;gap:5px}
.pcal-k s{width:7px;height:7px;border-radius:50%;background:var(--felt)} .pcal-k s.tour{background:var(--gold)}`;
  function calendar(el, o){
    if (typeof document !== 'undefined' && !document.getElementById('pcal-css')) { const s = document.createElement('style'); s.id = 'pcal-css'; s.textContent = CSS; document.head.appendChild(s); }
    let sel = o.sel || '', ym = (sel || today()).slice(0, 7);
    el.classList.add('pcal');
    function paint(){
      const t = today(), marks = o.marks ? o.marks() : {}, [y, m] = ym.split('-').map(Number);
      const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      let g = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<i aria-hidden="true">${x}</i>`).join('') + '<span></span>'.repeat(lead);
      for (let dd = 1; dd <= days; dd++) {
        const k = `${ym}-${pad(dd)}`, mk = marks[k] || [];
        const cls = [k < t && 'past', mk.length && 'has', k === t && 'today', k === sel && 'sel'].filter(Boolean).join(' ');
        const what = mk.map(x => x === 'tour' ? 'tournament' : 'open table night').join(' and ');
        g += `<button type="button" data-date="${k}"${cls ? ` class="${cls}"` : ''} aria-label="${dayLabel(k, { weekday: 'long', month: 'long', day: 'numeric' })}${what ? ': ' + what : ''}"${k === sel ? ' aria-pressed="true"' : ''}>${dd}${mk.length ? `<span class="pcal-d">${mk.map(x => `<s class="${x}"></s>`).join('')}</span>` : ''}</button>`;
      }
      el.innerHTML = `<div class="pcal-h"><button type="button" data-mon="-1" aria-label="Previous month">‹</button><b>${dayLabel(ym + '-01', { month: 'long', year: 'numeric' })}</b><button type="button" data-mon="1" aria-label="Next month">›</button></div>`
        + `<div class="pcal-g">${g}</div><div class="pcal-k"><span><s></s>Open table night</span><span><s class="tour"></s>Tournament</span></div>`;
    }
    el.addEventListener('click', e => { const b = e.target.closest('[data-mon],[data-date]'); if (!b) return;
      if (b.dataset.mon) { ym = addMonth(ym, +b.dataset.mon); paint(); return; }
      if (o.onPick) o.onPick(b.dataset.date); });
    paint();
    return { paint, select(d){ sel = d || ''; if (d) ym = d.slice(0, 7); paint(); } };
  }

  const api = { TZ, lastReset, nextReset, boundary, hear, today, ymd, label, dayLabel, addDays, addMonth, Sched, calendar };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PoolarDay = api;
})(typeof window !== 'undefined' ? window : globalThis);
