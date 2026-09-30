/* build.js — keeps pool pages current. Each page carries <meta name="build">; every 2 minutes (and
 * whenever the page comes back into view) this fetches a fresh copy and reloads if the build changed,
 * so a phone never sits on an old version of the scoreboard or camera page. A page can postpone the
 * reload (mid replay, a ref question open) by returning false from window.POOLAR_CAN_RELOAD(). */
(function () {
  var meta = document.querySelector('meta[name="build"]'); if (!meta) return;
  var cur = meta.content, busy = false;
  function check() {
    if (busy) return; busy = true;
    fetch(location.pathname + '?build=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
      var m = t.match(/<meta name="build" content="([^"]+)"/);
      if (m && m[1] !== cur && !(window.POOLAR_CAN_RELOAD && window.POOLAR_CAN_RELOAD() === false)) location.reload();
    }).catch(function () {}).then(function () { busy = false; });
  }
  setTimeout(check, 4000); setInterval(check, 120000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
})();
