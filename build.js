/* build.js — tells you when a newer version of a pool page is out. Each page carries
 * <meta name="build">; every 2 minutes (and when the page comes back into view) this checks for a
 * newer build and shows a small "New version · Refresh" button. It never reloads by itself: an
 * automatic reload once wiped names typed into a half-filled form, and restarted a live camera. */
(function () {
  var meta = document.querySelector('meta[name="build"]'); if (!meta) return;
  var cur = meta.content, busy = false, shown = false;
  function show() {
    if (shown) return; shown = true;
    var b = document.createElement('button');
    b.textContent = '↻ New version · Refresh';
    b.setAttribute('style', 'position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:99;' +
      'font:700 14px system-ui,sans-serif;padding:10px 16px;border-radius:999px;border:0;background:#f2c14e;color:#1d1606;box-shadow:0 6px 20px rgba(0,0,0,.4);cursor:pointer');
    b.onclick = function () { location.reload(); };
    document.body.appendChild(b);
  }
  function check() {
    if (busy || shown) return; busy = true;
    fetch(location.pathname + '?build=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
      var m = t.match(/<meta name="build" content="([^"]+)"/);
      if (m && m[1] !== cur) show();
    }).catch(function () {}).then(function () { busy = false; });
  }
  setTimeout(check, 4000); setInterval(check, 120000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
})();
