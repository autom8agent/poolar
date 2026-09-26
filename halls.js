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
    room: { w: 100, h: 170 },
    tables: [
      // Back room, 7-ft, left to right, lengthwise front-to-back
      { n: 11, x: 12, y: 7, w: 10, h: 20, ft: 7 },
      { n: 12, x: 34, y: 7, w: 10, h: 20, ft: 7 },
      { n: 13, x: 56, y: 7, w: 10, h: 20, ft: 7 },
      { n: 14, x: 78, y: 7, w: 10, h: 20, ft: 7 },
      // Left side, 9-ft, lengthwise across the room: 10 at the back down to 7 nearest the bar
      { n: 10, x: 5, y: 42, w: 24, h: 12, ft: 9 },
      { n: 9, x: 5, y: 60, w: 24, h: 12, ft: 9 },
      { n: 8, x: 5, y: 78, w: 24, h: 12, ft: 9 },
      { n: 7, x: 5, y: 96, w: 24, h: 12, ft: 9 },
      // Middle, 9-ft, lengthwise front-to-back: 5 at the back left of table 4, 6 further forward among the high-tops
      { n: 5, x: 44, y: 40, w: 12, h: 24, ft: 9 },
      { n: 6, x: 44, y: 96, w: 12, h: 24, ft: 9 },
      // Right side, 9-ft, lengthwise across the room: 4 at the back down to 1 nearest the bar
      { n: 4, x: 71, y: 42, w: 24, h: 12, ft: 9 },
      { n: 3, x: 71, y: 60, w: 24, h: 12, ft: 9 },
      { n: 2, x: 71, y: 78, w: 24, h: 12, ft: 9 },
      { n: 1, x: 71, y: 96, w: 24, h: 12, ft: 9 },
    ],
    features: [
      { kind: 'wall', x: 4, y: 32, w: 60, h: 2.4, label: 'Rail & stools' },
      { kind: 'seats', x: 44, y: 74, n: 2, gap: 10 },
      { kind: 'seats', x: 44, y: 128, n: 1, gap: 10 },
      { kind: 'bar', x: 32, y: 142, w: 36, h: 10, label: 'Bar' },
      { kind: 'door', x: 8, y: 168, w: 22, label: 'Entrance' },
      { kind: 'label', x: 50, y: 4.6, text: '7-FT TABLES' },
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
};
