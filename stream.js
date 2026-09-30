/* stream.js — a polite EventSource for the free ntfy.sh relay.
 * ntfy.sh limits each internet address. A plain EventSource that gets refused (HTTP 429) retries every
 * few seconds forever, and every pool page on the same Wi-Fi doing that keeps the whole address
 * blocked. PoolarStream closes on error and reconnects with backoff (2 s, 4 s ... 60 s), and again
 * when the page comes back into view. Same shape as EventSource: set onopen / onmessage / onerror. */
(function () {
  function PoolarStream(url) {
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
