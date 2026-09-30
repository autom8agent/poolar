// Pool hall floor plans for the table picker (hall.html) and the scoreboard (deck.html).
// Coordinates are in plan units: the room is `room.w` wide and `room.h` tall, back wall at the top,
// entrance at the bottom. A 9-ft table is 12 × 24 (or 24 × 12 when it runs across the room), a 7-ft table 10 × 20.
window.POOLAR_HALLS = {
  'surge-chicago': {
    name: 'Surge Billiards',
    area: 'Chicago Ave',
    cloth: 'Blue Diamond',
    // Admin and tournament pages ask for a PIN; this is a light guard against accidental edits, not real security.
    // Hash of '<hall id>:<PIN>' made with POOLAR.hash below.
    adminPin: '1vgiu2s',
    room: { w: 100, h: 134 },
    tables: [
      // Back room, 7-ft, left to right, lengthwise front-to-back
      { n: 11, x: 10, y: 3, w: 13, h: 25, ft: 7 },
      { n: 12, x: 32, y: 3, w: 13, h: 25, ft: 7 },
      { n: 13, x: 55, y: 3, w: 13, h: 25, ft: 7 },
      { n: 14, x: 77, y: 3, w: 13, h: 25, ft: 7 },
      // Left side, 9-ft, lengthwise across the room: 10 at the back down to 7 nearest the bar
      { n: 10, x: 2.5, y: 46, w: 30, h: 15, ft: 9 },
      { n: 9, x: 2.5, y: 64, w: 30, h: 15, ft: 9 },
      { n: 8, x: 2.5, y: 82, w: 30, h: 15, ft: 9 },
      { n: 7, x: 2.5, y: 100, w: 30, h: 15, ft: 9 },
      // Middle, 9-ft, lengthwise front-to-back: 5 at the back, 6 further forward
      { n: 5, x: 42.5, y: 46, w: 15, h: 30, ft: 9 },
      { n: 6, x: 42.5, y: 85, w: 15, h: 30, ft: 9 },
      // Right side, 9-ft, lengthwise across the room: 4 at the back down to 1 nearest the bar
      { n: 4, x: 67.5, y: 46, w: 30, h: 15, ft: 9 },
      { n: 3, x: 67.5, y: 64, w: 30, h: 15, ft: 9 },
      { n: 2, x: 67.5, y: 82, w: 30, h: 15, ft: 9 },
      { n: 1, x: 67.5, y: 100, w: 30, h: 15, ft: 9 },
    ],
    features: [
      // Rail with stools across the room, with a walkway above table 5 through to 12 and 13
      { kind: 'divider', y: 31, label: '▲ 7-FT TABLES' },
      { kind: 'wall', x: 2, y: 34.5, w: 38, h: 1.8 },
      { kind: 'wall', x: 60, y: 34.5, w: 38, h: 1.8 },
      { kind: 'divider', y: 42, label: '▼ 9-FT TABLES' },
      { kind: 'bar', x: 16.5, y: 119, w: 60, h: 5, label: 'Bar' },
      { kind: 'door', x: 76, y: 132.6, w: 20, label: 'Entrance' },
    ],
  },
};

// Shared helpers for the hall, admin, tournament, waitlist and profile pages.
window.POOLAR = {
  hash: k => { let h = 5381; for (const c of String(k)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return h.toString(36); },
  relay: () => new URLSearchParams(location.search).get('relay') || 'https://ntfy.sh',
  // Colour for a waitlist length: green when empty, then yellow-green, orange, red.
  lineColor: n => n <= 0 ? '#57d98a' : n <= 2 ? '#c8e04a' : n <= 4 ? '#f59a3a' : '#e4574a',
  BALL: ['#f5c518','#1f4fd1','#d9302a','#5b2a86','#f07b1a','#1e8a4c','#8a1f2a','#111'],
  ballSvg(n, size = 18){
    const c = this.BALL[(n - 1) % 8], stripe = n > 8;
    return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true"><defs><clipPath id="bc${n}"><circle cx="10" cy="10" r="9.5"/></clipPath></defs>` +
      `<circle cx="10" cy="10" r="9.5" fill="${stripe ? '#f4efe2' : c}"/>` + (stripe ? `<rect x="0" y="5" width="20" height="10" fill="${c}" clip-path="url(#bc${n})"/>` : '') +
      `<circle cx="10" cy="10" r="5" fill="#f4efe2"/><text x="10" y="13" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="${n > 9 ? 6 : 7.5}" fill="#111">${n}</text></svg>`;
  },
  peopleSvg(dbl, size = 18){
    const one = x => `<circle cx="${x}" cy="6" r="3.4"/><path d="M${x-5.5} 18c0-4 2.5-6.5 5.5-6.5s5.5 2.5 5.5 6.5z"/>`;
    return `<svg width="${dbl ? size * 1.5 : size}" height="${size}" viewBox="0 0 ${dbl ? 30 : 20} 20" fill="currentColor" aria-hidden="true">${dbl ? one(9) + one(21) : one(10)}</svg>`;
  },
  profile(){ try { return JSON.parse(localStorage.getItem('poolar-profile') || 'null'); } catch { return null; } },
  // The signed-in member (auth.js) merged over the saved profile; { } when neither exists. Has `uid` when signed in.
  me(){ const p = this.profile() || {}, m = window.PoolarAuth && window.PoolarAuth.current(); return m ? { ...p, ...m } : p; },
};
