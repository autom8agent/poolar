/* build.js — tells you when a newer version of a pool page is out. Each page carries
 * <meta name="build">; every 2 minutes (and when the page comes back into view) this checks for a
 * newer build and shows a small "New version · Refresh" button. Most pages never reload by themselves (an
 * automatic reload once wiped names typed into a half-filled form, and restarted a live camera).
 * Exception: a running scoreboard (deck.html?game=…) updates itself when it's safe, because its game is
 * saved: nothing being typed, no sheet or ref pop-up open, and no taps for 20 s. */
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
  var lastInput = Date.now();
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (e) { document.addEventListener(e, function () { lastInput = Date.now(); }, true); });
  function safeToReload() {
    if (!/deck\.html$/.test(location.pathname) || !/[?&]game=/.test(location.search)) return false;
    var a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return false;
    if (document.querySelector('.sheet:not([hidden])')) return false;
    var pop = document.getElementById('refPop'); if (pop && !pop.hidden) return false;
    return Date.now() - lastInput > 20000;
  }
  setInterval(function () { if (shown && safeToReload()) location.reload(); }, 3000);
  function check() {
    if (busy || shown) return; busy = true;
    fetch(location.pathname + '?build=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
      var m = t.match(/<meta name="build" content="([^"]+)"/);
      if (m && m[1] !== cur) show();
    }).catch(function () {}).then(function () { busy = false; });
  }
  setTimeout(check, 4000); setInterval(check, /deck\.html$/.test(location.pathname) ? 60000 : 120000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
})();
