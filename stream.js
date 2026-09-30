/* stream.js — a polite EventSource for the free ntfy.sh relay.
 * ntfy.sh limits each internet address. A plain EventSource that gets refused (HTTP 429) retries every
 * few seconds forever, and every pool page on the same Wi-Fi doing that keeps the whole address
 * blocked. PoolarStream closes on error and reconnects with backoff (2 s, 4 s ... 60 s), and again
 * when the page comes back into view. Same shape as EventSource: set onopen / onmessage / onerror. */
(function () {
  // ---- Two relays, always in sync ----
  // Every message goes to our own relay (Cloudflare) AND ntfy.sh; every page listens to both and
  // drops duplicates. If one refuses a busy network or is down, the other carries on.
  // Pages keep talking to 'https://ntfy.sh'; this file mirrors those calls to the second relay.
  var NTFY = 'https://ntfy.sh';
  var OWN = window.POOLAR_OWN_RELAY || 'https://poolar-relay.poolar-relay.workers.dev';
  var qs = new URLSearchParams(location.search);
  var pairs = [];
  if (OWN.indexOf('http') === 0) pairs.push([NTFY, OWN]);
  if (qs.get('relay') && qs.get('relay2')) pairs.push([qs.get('relay'), qs.get('relay2')]);   // tests
  if (window.POOLAR_PAIRS) pairs = pairs.concat(window.POOLAR_PAIRS);   // tests (set before this file loads)
  function mirrorOf(url) { for (var i = 0; i < pairs.length; i++) if (typeof url === 'string' && url.indexOf(pairs[i][0] + '/') === 0) return pairs[i][1] + url.slice(pairs[i][0].length); return null; }
  window.POOLAR_MIRROR = mirrorOf;
  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url), m = mirrorOf(url);
    if (!m) return realFetch(input, init);
    var method = ((init && init.method) || 'GET').toUpperCase();
    if (method === 'POST' || method === 'PUT') {
      // publish to both; succeed if either accepts
      var a = realFetch(url, init), b = realFetch(m, init);
      return new Promise(function (res, rej) {
        var left = 2, first = null;
        [a, b].forEach(function (p) { p.then(function (r) { if (r.ok && !first) { first = r; res(r); } else if (--left === 0 && !first) res(r); }, function (e) { if (--left === 0 && !first) rej(e); }); });
      });
    }
    // polls: read both, merge, keep one copy of each message
    if (url.indexOf('/json') > 0) {
      var ga = realFetch(url, init).then(function (r) { return r.ok ? r.text() : ''; }, function () { return ''; });
      var gb = realFetch(m, init).then(function (r) { return r.ok ? r.text() : ''; }, function () { return ''; });
      return Promise.all([ga, gb]).then(function (t) {
        var seen = {}, out = [];
        (t[0] + '\n' + t[1]).split('\n').forEach(function (l) { if (!l) return; var j; try { j = JSON.parse(l); } catch (e) { return; }
          var k = j.event + '|' + (j.message || ''); if (seen[k]) return; seen[k] = 1; out.push(j); });
        out.sort(function (x, y) { return (x.time || 0) - (y.time || 0); });
        return new Response(out.map(function (j) { return JSON.stringify(j); }).join('\n') + '\n', { status: 200 });
      });
    }
    return realFetch(input, init);
  };

  function PoolarStream(url) {
    var m = mirrorOf(typeof url === 'function' ? url() : url);
    if (m) {
      // listen to both relays; pass each message on once
      var self = { onopen: null, onmessage: null, onerror: null, readyState: 0, url: url, close: function () { a.close(); b.close(); self.readyState = 2; } };
      var seen = new Map();
      var fwd = function (e) { var k = e.data; try { var d = JSON.parse(e.data); if (d.event !== 'message') { if (d.event === 'open') return; } k = d.event + '|' + (d.message || ''); } catch (x) {}
        var now = Date.now(); if (seen.has(k) && now - seen.get(k) < 180000) return; seen.set(k, now);
        if (seen.size > 400) seen.forEach(function (v, kk) { if (now - v > 180000) seen.delete(kk); });
        if (self.onmessage) self.onmessage(e); };
      var a = single(url), b = single(typeof url === 'function' ? function () { return mirrorOf(url()); } : m);
      [a, b].forEach(function (s) { s.onmessage = fwd; s.onopen = function (e) { if (self.readyState !== 1) { self.readyState = 1; if (self.onopen) self.onopen(e); } }; s.onerror = function (e) { if (a.readyState !== 1 && b.readyState !== 1) { self.readyState = 0; if (self.onerror) self.onerror(e); } }; });
      return self;
    }
    return single(url);
  }
  // Our own relay: WebSocket instead of a streaming HTTP connection. On Cloudflare an idle WebSocket
  // lets the relay sleep (free), which is what lets ~100 devices and 15 tables run on the free tier.
  function singleWS(url) {
    var self = { onopen: null, onmessage: null, onerror: null, readyState: 0, url: url, close: function () { stopped = true; clearTimeout(t); if (ws) ws.close(); self.readyState = 2; } };
    var ws = null, back = 2000, t = 0, stopped = false, first = true;
    function open() {
      if (stopped) return;
      var u = (typeof url === 'function' ? url() : url).replace(/^http/, 'ws').replace(/\/sse(\?|$)/, '/ws$1');
      if (!first) u = u.replace(/since=[^&]*/, 'since=3m') + (u.indexOf('since=') < 0 ? (u.indexOf('?') < 0 ? '?' : '&') + 'since=3m' : '');   // catch up after a drop
      first = false;
      try { ws = new WebSocket(u); } catch (e) { return retry(); }
      ws.onopen = function (e) { back = 2000; self.readyState = 1; if (self.onopen) self.onopen(e); };
      ws.onmessage = function (e) { if (self.onmessage) self.onmessage({ data: e.data }); };
      ws.onclose = ws.onerror = function (e) { if (self.readyState === 2) return; self.readyState = 0; if (self.onerror) self.onerror(e); retry(); };
    }
    function retry() { clearTimeout(t); if (stopped) return; t = setTimeout(open, back + Math.random() * 1000); back = Math.min(60000, back * 2); }
    open();
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !stopped && self.readyState !== 1) { clearTimeout(t); back = 2000; open(); } });
    return self;
  }
  function single(url) {
    var u0 = typeof url === 'function' ? url() : url;
    if (OWN.indexOf('http') === 0 && typeof u0 === 'string' && u0.indexOf(OWN + '/') === 0) return singleWS(url);
    var self = { onopen: null, onmessage: null, onerror: null, readyState: 0, url: url,
      close: function () { stopped = true; clearTimeout(t); if (es) es.close(); self.readyState = 2; } };
    var es = null, back = 2000, t = 0, stopped = false;
    function open() {
      if (stopped) return;
      es = new EventSource(typeof url === 'function' ? url() : url);
      es.onopen = function (e) { back = 2000; self.readyState = 1; if (self.onopen) self.onopen(e); };
      es.onmessage = function (e) { if (self.onmessage) self.onmessage(e); };
      es.onerror = function (e) {
        if (self.onerror) self.onerror(e);
        if (es.readyState === 1) return;
        es.close(); self.readyState = 0; clearTimeout(t);
        t = setTimeout(open, back + Math.random() * 1000); back = Math.min(60000, back * 2);
      };
    }
    open();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && !stopped && self.readyState !== 1) { clearTimeout(t); back = 2000; open(); }
    });
    return self;
  }
  window.PoolarStream = PoolarStream;
})();
