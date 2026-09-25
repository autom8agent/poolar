// Pool hall floor plans for the table picker (hall.html) and the scoreboard (deck.html).
// Coordinates are in plan units: the room is `room.w` wide and `room.h` tall, back wall at the top,
// entrance at the bottom. A 9-ft table is 12 × 24 (or 24 × 12 when it runs across the room), a 7-ft table 10 × 20.
window.POOLAR_HALLS = {
  'surge-chicago': {
    name: 'Surge Billiards',
    area: 'Chicago Ave',
    cloth: 'Blue Diamond',
    room: { w: 100, h: 170 },
    tables: [
      // Back room, 7-ft, left to right, lengthwise front-to-back
      { n: 11, x: 12, y: 7, w: 10, h: 20, ft: 7 },
      { n: 12, x: 34, y: 7, w: 10, h: 20, ft: 7 },
      { n: 13, x: 56, y: 7, w: 10, h: 20, ft: 7 },
      { n: 14, x: 78, y: 7, w: 10, h: 20, ft: 7 },
      // Left side, 9-ft, lengthwise across the room: 10 at the back down to 6 nearest the bar
      { n: 10, x: 5, y: 42, w: 24, h: 12, ft: 9 },
      { n: 9, x: 5, y: 60, w: 24, h: 12, ft: 9 },
      { n: 8, x: 5, y: 78, w: 24, h: 12, ft: 9 },
      { n: 7, x: 5, y: 96, w: 24, h: 12, ft: 9 },
      { n: 6, x: 5, y: 114, w: 24, h: 12, ft: 9 },
      // Middle back, 9-ft, lengthwise front-to-back, left of table 4
      { n: 5, x: 44, y: 40, w: 12, h: 24, ft: 9 },
      // Right side, 9-ft, lengthwise across the room: 4 at the back down to 1 nearest the bar
      { n: 4, x: 71, y: 42, w: 24, h: 12, ft: 9 },
      { n: 3, x: 71, y: 60, w: 24, h: 12, ft: 9 },
      { n: 2, x: 71, y: 78, w: 24, h: 12, ft: 9 },
      { n: 1, x: 71, y: 96, w: 24, h: 12, ft: 9 },
    ],
    features: [
      { kind: 'wall', x: 4, y: 32, w: 60, h: 2.4, label: 'Rail & stools' },
      { kind: 'seats', x: 44, y: 76, n: 4, gap: 11 },
      { kind: 'bar', x: 32, y: 142, w: 36, h: 10, label: 'Bar' },
      { kind: 'door', x: 8, y: 168, w: 22, label: 'Entrance' },
      { kind: 'label', x: 50, y: 4.6, text: '7-FT TABLES' },
    ],
  },
};
