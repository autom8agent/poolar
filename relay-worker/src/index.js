// poolar-relay — our own message relay for Pool (Cloudflare Worker + Durable Objects).
// Speaks the small part of the ntfy API the pages use, so pages can use it and ntfy.sh side by side:
//   POST|PUT /<topic>            publish (body = message; X-Message/X-Filename headers accepted)
//   GET /<topic>/json?poll=1&since=<12h|10m|all|unix>   recent messages, one JSON per line
//   GET /<topic>/sse?since=...   Server-Sent Events stream (same event shape as ntfy)
//   GET /<topic>/ws?since=...    WebSocket stream (preferred: hibernates, so idle viewers cost nothing)
// One Durable Object per topic keeps the last 12 h of messages (max 500) and fans out new ones.
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
  }
};

const sinceMs = s => {
  if (!s) return null; if (s === 'all') return 0;
  const m = /^(\d+)([smhd])$/.exec(s); if (m) return Date.now() - m[1] * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2]];
  if (/^\d+$/.test(s)) return +s * 1000; return null;
};

export class Topic {
  constructor(state) { this.state = state; this.sse = new Set(); this.msgs = null; }
  async load() { if (!this.msgs) this.msgs = (await this.state.storage.get('msgs')) || []; const cut = Date.now() - 12 * 36e5; this.msgs = this.msgs.filter(m => m.time * 1000 > cut); return this.msgs; }
  frame(m) { return JSON.stringify(m); }
  async fetch(req) {
    const url = new URL(req.url), parts = url.pathname.split('/').filter(Boolean), topic = parts[0], kind = parts[1];
    if (req.method === 'POST' || req.method === 'PUT') {
      const fn = req.headers.get('X-Filename') || req.headers.get('Filename');
      let message = fn ? (req.headers.get('X-Message') || req.headers.get('Message') || '') : await req.text();
      if (message.length > 16000) return new Response('too big', { status: 413, headers: CORS });
      const m = { id: crypto.randomUUID().slice(0, 12), time: Math.floor(Date.now() / 1000), event: 'message', topic, message };
      const msgs = await this.load(); msgs.push(m); while (msgs.length > 500) msgs.shift();
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
