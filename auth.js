/* auth.js — member sign-in for the pool pages. Load after halls.js.
 *
 *   PoolarAuth.current()                          -> member or null (sync; the saved session on this phone)
 *   await PoolarAuth.signUp({ name, contact, pin }) -> member        (create an account)
 *   await PoolarAuth.signIn({ contact, pin })       -> member        (sign back in)
 *   await PoolarAuth.update({ name, sl8, ... })     -> member        (edit the signed-in member)
 *   await PoolarAuth.signOut()
 *   PoolarAuth.uid(contact)                        -> short public id for a phone/email (no contact details in it)
 *   PoolarAuth.onChange(fn)                        -> called with the member after any sign-in / out / update
 *
 * member: { uid, name, contact, contactType: 'phone'|'email', masked, createdAt, provider, sl8, sl9, apa, fargo }
 *
 * TODAY (no backend): the "local" provider keeps accounts in this browser only. An account made on one phone
 * doesn't exist on another, and nothing is verified: whoever types a phone number or email is taken at their
 * word. The optional PIN only guards against someone else signing in as you ON THIS PHONE. No codes are sent.
 *
 * TODO(auth backend): add a real provider here and pick it in PROVIDER below — nothing else needs to change,
 * because the pages only call the functions above (and they already await them). With Supabase, for example:
 *   signUp/signIn -> supabase.auth.signInWithOtp({ phone }) or ({ email }), then show a "code" field and call
 *                    supabase.auth.verifyOtp({ phone, token, type: 'sms' }); store name / skill levels in a
 *                    `members` table keyed by auth.users.id; current() reads supabase.auth.getSession().
 *   The pages' sign-in forms would then need one extra step (the code box); see profile.html `signInForm`.
 * Until then, don't show or imply verification anywhere.
 */
(function () {
  var LS_MEMBERS = 'poolar-members', LS_SESSION = 'poolar-session', LS_PROFILE = 'poolar-profile';
  var listeners = [];
  var hash = function (k) { return window.POOLAR ? POOLAR.hash(k) : String(k); };
  var read = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  var write = function (k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  // Phone numbers become digits (US 10-digit numbers get a leading 1); emails are lower-cased.
  function normalize(contact) {
    var c = String(contact || '').trim();
    if (!c) return null;
    if (c.indexOf('@') > 0) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? { value: c.toLowerCase(), type: 'email' } : null;
    var d = c.replace(/\D/g, '');
    if (d.length === 10) d = '1' + d;
    return d.length >= 8 && d.length <= 15 ? { value: '+' + d, type: 'phone' } : null;
  }
  function mask(n) {
    if (!n) return '';
    if (n.type === 'email') { var p = n.value.split('@'); return p[0].slice(0, 1) + '•••@' + p[1]; }
    return '••• ' + n.value.slice(-4);
  }
  function uid(contact) { var n = normalize(contact); return n ? 'u' + hash('member:' + n.value) : null; }

  // Mirror the member into the old profile record so every page that uses POOLAR.profile() keeps working.
  function syncProfile(m) {
    var p = read(LS_PROFILE, {}) || {};
    if (m) { p.name = m.name; p.uid = m.uid; ['sl8', 'sl9', 'apa', 'fargo'].forEach(function (k) { if (m[k] != null && m[k] !== '') p[k] = m[k]; }); write(LS_PROFILE, p); try { localStorage.setItem('poolar-my-name', m.name); } catch (e) {} }
    else if (p.uid) { delete p.uid; write(LS_PROFILE, p); }
  }
  function emit(m) { listeners.forEach(function (fn) { try { fn(m); } catch (e) {} }); }

  var local = {
    name: 'local',
    current: function () { var s = read(LS_SESSION, null); if (!s) return null; var all = read(LS_MEMBERS, {}); return all[s.uid] || null; },
    signUp: function (o) {
      var n = normalize(o.contact), name = String(o.name || '').trim().slice(0, 24);
      if (!name) return Promise.reject(new Error('Add your name.'));
      if (!n) return Promise.reject(new Error('Enter a phone number or an email address.'));
      var all = read(LS_MEMBERS, {}), id = 'u' + hash('member:' + n.value), old = all[id];
      if (old && old.pinHash && old.pinHash !== hash(id + ':' + (o.pin || ''))) return Promise.reject(new Error('That phone/email already has an account on this phone with a PIN. Sign in instead.'));
      var m = Object.assign({}, old || {}, { uid: id, name: name, contact: n.value, contactType: n.type, masked: mask(n), provider: 'local', createdAt: (old && old.createdAt) || Date.now() });
      if (o.pin) m.pinHash = hash(id + ':' + String(o.pin)); else if (!old) m.pinHash = '';
      ['sl8', 'sl9'].forEach(function (k) { if (o[k] != null && o[k] !== '') m[k] = o[k]; });
      all[id] = m; write(LS_MEMBERS, all); write(LS_SESSION, { uid: id, at: Date.now() }); syncProfile(m); emit(m);
      return Promise.resolve(m);
    },
    signIn: function (o) {
      var n = normalize(o.contact);
      if (!n) return Promise.reject(new Error('Enter a phone number or an email address.'));
      var all = read(LS_MEMBERS, {}), id = 'u' + hash('member:' + n.value), m = all[id];
      if (!m) return Promise.reject(new Error('No account with that phone/email on this phone yet. Create one — accounts are saved on each phone until online accounts arrive.'));
      if (m.pinHash && m.pinHash !== hash(id + ':' + String(o.pin || ''))) return Promise.reject(new Error("That PIN isn't right."));
      write(LS_SESSION, { uid: id, at: Date.now() }); syncProfile(m); emit(m);
      return Promise.resolve(m);
    },
    update: function (fields) {
      var cur = local.current(); if (!cur) return Promise.reject(new Error('Not signed in.'));
      var all = read(LS_MEMBERS, {}), m = Object.assign({}, cur);
      ['name', 'sl8', 'sl9', 'apa', 'fargo'].forEach(function (k) { if (k in fields) m[k] = fields[k]; });
      all[m.uid] = m; write(LS_MEMBERS, all); syncProfile(m); emit(m);
      return Promise.resolve(m);
    },
    signOut: function () { write(LS_SESSION, null); syncProfile(null); emit(null); return Promise.resolve(); },
  };

  // TODO(auth backend): set this to the real provider once one exists.
  var PROVIDER = local;

  window.PoolarAuth = {
    provider: function () { return PROVIDER.name; },
    verified: false,   // true only once a provider really checks the phone/email
    current: function () { return PROVIDER.current(); },
    signUp: function (o) { return PROVIDER.signUp(o); },
    signIn: function (o) { return PROVIDER.signIn(o); },
    update: function (o) { return PROVIDER.update(o); },
    signOut: function () { return PROVIDER.signOut(); },
    normalize: normalize, mask: mask, uid: uid,
    onChange: function (fn) { listeners.push(fn); },
  };
})();
