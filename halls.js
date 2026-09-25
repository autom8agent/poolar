// Pool hall floor plans for the table picker (hall.html) and the scoreboard (deck.html).
// Coordinates are in plan units: the room is `room.w` wide and `room.h` tall, back wall at the top,
// entrance at the bottom. A 9-ft table is drawn 12 × 24, a 7-ft table 10 × 20 (both 1:2 like the real thing).
window.POOLAR_HALLS = {
  'surge-chicago': {
    name: 'Surge Billiards',
    area: 'Chicago Ave',
    cloth: 'Blue Diamond',
    room: { w: 100, h: 214 },
    tables: [
      // Back room, 7-ft, left to right
      { n: 11, x: 12, y: 8, w: 10, h: 20, ft: 7 },
      { n: 12, x: 34, y: 8, w: 10, h: 20, ft: 7 },
      { n: 13, x: 56, y: 8, w: 10, h: 20, ft: 7 },
      { n: 14, x: 78, y: 8, w: 10, h: 20, ft: 7 },
      // Left side, 9-ft, 6 at the front up to 10 at the back
      { n: 10, x: 8, y: 44, w: 12, h: 24, ft: 9 },
      { n: 9, x: 8, y: 73, w: 12, h: 24, ft: 9 },
      { n: 8, x: 8, y: 102, w: 12, h: 24, ft: 9 },
      { n: 7, x: 8, y: 131, w: 12, h: 24, ft: 9 },
      { n: 6, x: 8, y: 160, w: 12, h: 24, ft: 9 },
      // Middle back, 9-ft, left of table 4
      { n: 5, x: 52, y: 44, w: 12, h: 24, ft: 9 },
      // Right side, 9-ft, 1 at the front up to 4 at the back
      { n: 4, x: 80, y: 44, w: 12, h: 24, ft: 9 },
      { n: 3, x: 80, y: 73, w: 12, h: 24, ft: 9 },
      { n: 2, x: 80, y: 102, w: 12, h: 24, ft: 9 },
      { n: 1, x: 80, y: 131, w: 12, h: 24, ft: 9 },
    ],
    features: [
      { kind: 'wall', x: 4, y: 34, w: 60, h: 2.4, label: 'Rail & stools' },
      { kind: 'seats', x: 36, y: 90, n: 4, gap: 16 },
      { kind: 'bar', x: 46, y: 192, w: 50, h: 10, label: 'Bar' },
      { kind: 'door', x: 8, y: 212, w: 26, label: 'Entrance' },
      { kind: 'label', x: 50, y: 5.2, text: '7-FT TABLES' },
    ],
  },
};
