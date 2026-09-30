// poolar-relay — our own message relay for Pool (Cloudflare Worker + Durable Objects).
// Speaks the small part of the ntfy API the pages use, so pages can use it and ntfy.sh side by side:
//   POST|PUT /<topic>            publish (body = message; X-Message/X-Filename headers accepted)
//   GET /<topic>/json?poll=1&since=<12h|10m|all|unix>   recent messages, one JSON per line
//   GET /<topic>/sse?since=...   Server-Sent Events stream (same event shape as ntfy)
//   GET /<topic>/ws?since=...    WebSocket stream (preferred: hibernates, so idle viewers cost nothing)
// One Durable Object per topic keeps the last 12 h of messages (max 500) and fans out new ones.
// Schedule topics (poolar-sched-<hall>: planned nights and tournaments) keep 120 days, one copy per night/tournament.
// Cron (07:00 and 08:00 UTC): at 2 AM Chicago time posts {kind:'reset', ts} to each hall topic; the pages end the day's games.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' };
const TOPIC_RE = /^[A-Za-z0-9_-]{1,80}$/;

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url), parts = url.pathname.split('/').filter(Boolean);
    if (!parts.length) return new Response('poolar relay ok', { headers: CORS });
    const topic = parts[0];
    if (!TOPIC_RE.test(topic)) return new Response('bad topic', { status: 400, headers: CORS });
    const stub = env.TOPIC.get(env.TOPIC.idFromName(topic));
    return stub.fetch(req);
  },
  // Two UTC triggers because Chicago is UTC-5 in summer and UTC-6 in winter; only the one that is 2 AM there posts.
  async scheduled(ev, env) {
    const now = ev.scheduledTime || Date.now(), b = lastReset(now);
    if (now - b > 20 * 6e4) return;
    for (const h of String(env.HALLS || 'surge-chicago').split(',').map(x => x.trim()).filter(Boolean)) {
      const topic = 'poolar-hall-' + h;
      await env.TOPIC.get(env.TOPIC.idFromName(topic)).fetch(new Request(`https://relay/${topic}`, { method: 'POST', body: JSON.stringify({ kind: 'reset', ts: b }) }));
    }
  }
};

// The most recent 2:00 AM in America/Chicago (same as hallday.js in the pages). On the spring-forward night it is the jump (3:00 CDT).
const CHI = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const chi = ms => { const o = {}; for (const p of CHI.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = +p.value; return o; };
const offsetAt = ms => { const o = chi(ms); return Date.UTC(o.year, o.month - 1, o.day, o.hour % 24, o.minute, o.second) - Math.floor(ms / 1000) * 1000; };
function resetOn(y, m, d) {
  const g = Date.UTC(y, m - 1, d, 2), c = [...new Set([g - offsetAt(g - 864e5), g - offsetAt(g + 864e5)])].sort((a, b) => a - b);
  for (const t of c) { const o = chi(t); if (o.day === d && o.hour >= 2) return t; }
  return c[c.length - 1];
}
function lastReset(now) {
  const o = chi(now); let t = resetOn(o.year, o.month, o.day);
  if (t > now) { const p = new Date(Date.UTC(o.year, o.month - 1, o.day - 1)); t = resetOn(p.getUTCFullYear(), p.getUTCMonth() + 1, p.getUTCDate()); }
  return t;
}

const schedKey = t => { try { const j = JSON.parse(t); return j && j.kind && (j.id || j.tid) ? j.kind + ':' + (j.id || j.tid) : ''; } catch { return ''; } };

const sinceMs = s => {
  if (!s) return null; if (s === 'all') return 0;
  const m = /^(\d+)([smhd])$/.exec(s); if (m) return Date.now() - m[1] * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2]];
  if (/^\d+$/.test(s)) return +s * 1000; return null;
};

export class Topic {
  constructor(state) { this.state = state; this.sse = new Set(); this.msgs = null; this.keepMs = 12 * 36e5; }
  async load() { if (!this.msgs) this.msgs = (await this.state.storage.get('msgs')) || []; const cut = Date.now() - this.keepMs; this.msgs = this.msgs.filter(m => m.time * 1000 > cut); return this.msgs; }
  frame(m) { return JSON.stringify(m); }
  async fetch(req) {
    const url = new URL(req.url), parts = url.pathname.split('/').filter(Boolean), topic = parts[0], kind = parts[1];
    const sched = topic.startsWith('poolar-sched-');
    if (sched) this.keepMs = 120 * 864e5;
    if (req.method === 'POST' || req.method === 'PUT') {
      const fn = req.headers.get('X-Filename') || req.headers.get('Filename');
      let message = fn ? (req.headers.get('X-Message') || req.headers.get('Message') || '') : await req.text();
      if (message.length > 16000) return new Response('too big', { status: 413, headers: CORS });
      const m = { id: crypto.randomUUID().slice(0, 12), time: Math.floor(Date.now() / 1000), event: 'message', topic, message };
      let msgs = await this.load();
      if (sched) { const k = schedKey(message); if (k) msgs = this.msgs = msgs.filter(x => schedKey(x.message) !== k); }   // newest copy of each night / tournament only
      msgs.push(m); while (msgs.length > 500) msgs.shift();
      await this.state.storage.put('msgs', msgs);
      const f = this.frame(m);
      for (const ws of this.state.getWebSockets()) { try { ws.send(f); } catch {} }
      for (const w of this.sse) { try { await w.write(new TextEncoder().encode(`data: ${f}\n\n`)); } catch { this.sse.delete(w); } }
      return new Response(JSON.stringify(m), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    const since = sinceMs(url.searchParams.get('since') || (url.searchParams.get('poll') ? '12h' : null));
    const old = since == null ? [] : (await this.load()).filter(m => m.time * 1000 >= since);
    if (kind === 'json') return new Response(old.map(m => this.frame(m)).join('\n') + (old.length ? '\n' : ''), { headers: { ...CORS, 'Content-Type': 'application/x-ndjson' } });
    if (kind === 'ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426, headers: CORS });
      const [client, server] = Object.values(new WebSocketPair());
      this.state.acceptWebSocket(server);
      server.send(JSON.stringify({ event: 'open', topic }));
      for (const m of old) server.send(this.frame(m));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (kind === 'sse') {
      const { readable, writable } = new TransformStream(), w = writable.getWriter(), enc = new TextEncoder();
      w.write(enc.encode(`data: ${JSON.stringify({ event: 'open', topic })}\n\n`));
      for (const m of old) w.write(enc.encode(`data: ${this.frame(m)}\n\n`));
      this.sse.add(w);
      return new Response(readable, { headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
    }
    return new Response('ok', { headers: CORS });
  }
  webSocketMessage() {}
  webSocketClose(ws) { try { ws.close(); } catch {} }
}
