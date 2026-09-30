/*
 * tablecv.js — top-down pool table vision for the Pool Cam feed. No dependencies.
 *
 *  TableCV.findCorners(imageData)  finds the felt and fits its four rail edges, so the
 *                                  table can be straightened automatically.
 *  new TableCV.Warper(canvas)      WebGL keystone correction: draws the table as a clean
 *                                  2:1 rectangle, long side horizontal.
 *  new TableCV.Tracker()           follows balls on the straightened table and reports shots:
 *                                  first ball the cue ball hit, balls pocketed, scratches.
 *
 * Corners are normalised 0..1 of the camera frame so they survive resolution changes.
 * Straightened-table coordinates are also 0..1 (x along the long rail).
 */
(function (G) {
  'use strict';

  // ---------- homography (same maths as Pool AI PAL's table-warp.js) ----------
  const adj = m => [m[4]*m[8]-m[5]*m[7], m[2]*m[7]-m[1]*m[8], m[1]*m[5]-m[2]*m[4],
                    m[5]*m[6]-m[3]*m[8], m[0]*m[8]-m[2]*m[6], m[2]*m[3]-m[0]*m[5],
                    m[3]*m[7]-m[4]*m[6], m[1]*m[6]-m[0]*m[7], m[0]*m[4]-m[1]*m[3]];
  const mmul = (a, b) => { const c = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let k = 0; k < 3; k++) s += a[3*i+k] * b[3*k+j]; c[3*i+j] = s; } return c; };
  const mv = (m, v) => [m[0]*v[0]+m[1]*v[1]+m[2]*v[2], m[3]*v[0]+m[4]*v[1]+m[5]*v[2], m[6]*v[0]+m[7]*v[1]+m[8]*v[2]];
  const basis = (x1,y1,x2,y2,x3,y3,x4,y4) => { const m = [x1,x2,x3, y1,y2,y3, 1,1,1], v = mv(adj(m), [x4,y4,1]); return mmul(m, [v[0],0,0, 0,v[1],0, 0,0,v[2]]); };
  const proj = (s, d) => mmul(basis(...d), adj(basis(...s)));        // maps quad s -> quad d
  const quadArr = q => [q.tl.x, q.tl.y, q.tr.x, q.tr.y, q.br.x, q.br.y, q.bl.x, q.bl.y];
  const UNIT = [0,0, 1,0, 1,1, 0,1];
  // Straightened table (0..1) -> camera frame (0..1), and back.
  const toCam = q => proj(UNIT, quadArr(q));
  const apply = (H, x, y) => { const p = mv(H, [x, y, 1]); return { x: p[0] / p[2], y: p[1] / p[2] }; };

  function hsv(r, g, b){
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, mx ? d / mx : 0, mx / 255];
  }
  const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  const median = a => { const s = Float32Array.from(a).sort(); return s.length ? s[s.length >> 1] : 0; };

  // ---------- automatic corners ----------
  // Felt colour = median of the middle of the frame (the camera is mounted over the table).
  // Flood-fill the felt from the centre, take the outermost felt pixel on every row/column,
  // fit a straight line to each rail with outliers (pockets, balls, hands) trimmed, and
  // intersect the lines. Pocket cut-outs don't pull the corners in because the lines are fitted
  // along the rails, not at the corners.
  function findCorners(img){
    const { width: w, height: h, data: d } = img;
    const cs = [], hs = [], vs = [];
    for (let y = Math.floor(h * .35); y < h * .65; y += 2) for (let x = Math.floor(w * .35); x < w * .65; x += 2) {
      const i = (y * w + x) * 4, c = hsv(d[i], d[i+1], d[i+2]); hs.push(c[0]); cs.push(c[1]); vs.push(c[2]);
    }
    // circular hue median: rotate so the mode sits mid-range
    const hist = new Array(36).fill(0); hs.forEach(v => hist[Math.floor(v / 10) % 36]++);
    const mode = hist.indexOf(Math.max(...hist)) * 10 + 5;
    const fh = (median(hs.map(v => ((v - mode + 540) % 360) - 180)) + mode + 360) % 360, fs = median(cs), fv = median(vs);
    if (fs < .12) return null;                                        // no coloured cloth in the middle
    const felt = new Uint8Array(w * h);
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      const c = hsv(d[i], d[i+1], d[i+2]);
      felt[p] = c[1] > Math.max(.1, fs * .45) && hueDist(c[0], fh) < 24 && c[2] > fv * .35 && c[2] < Math.min(1, fv * 2.2) + .05 ? 1 : 0;
    }
    // flood fill from the felt pixel nearest the centre
    let seed = -1;
    for (let r = 0; r < Math.min(w, h) / 3 && seed < 0; r++) for (let a = 0; a < 8 && seed < 0; a++) {
      const x = Math.round(w / 2 + r * Math.cos(a * Math.PI / 4)), y = Math.round(h / 2 + r * Math.sin(a * Math.PI / 4)), p = y * w + x;
      if (felt[p]) seed = p;
    }
    if (seed < 0) return null;
    const reg = new Uint8Array(w * h), st = [seed]; reg[seed] = 1; let area = 0;
    while (st.length) {
      const p = st.pop(); area++; const x = p % w;
      if (x > 0 && felt[p-1] && !reg[p-1]) { reg[p-1] = 1; st.push(p-1); }
      if (x < w-1 && felt[p+1] && !reg[p+1]) { reg[p+1] = 1; st.push(p+1); }
      if (p >= w && felt[p-w] && !reg[p-w]) { reg[p-w] = 1; st.push(p-w); }
      if (p < w*(h-1) && felt[p+w] && !reg[p+w]) { reg[p+w] = 1; st.push(p+w); }
    }
    if (area < w * h * .12) return null;
    // Holes from balls don't matter: only the outermost felt pixel of each row/column is used.
    let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (let p = 0; p < w * h; p++) if (reg[p]) { const x = p % w, y = (p - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const top = [], bot = [], lef = [], rig = [];
    for (let x = Math.round(x0 + (x1 - x0) * .15); x <= x0 + (x1 - x0) * .85; x++) {
      let a = -1, b = -1; for (let y = 0; y < h; y++) if (reg[y * w + x]) { if (a < 0) a = y; b = y; }
      if (a >= 0) { top.push([x, a]); bot.push([x, b]); }
    }
    for (let y = Math.round(y0 + (y1 - y0) * .15); y <= y0 + (y1 - y0) * .85; y++) {
      let a = -1, b = -1; for (let x = 0; x < w; x++) if (reg[y * w + x]) { if (a < 0) a = x; b = x; }
      if (a >= 0) { lef.push([y, a]); rig.push([y, b]); }
    }
    // v = m*u + c with two rounds of outlier trimming
    const fit = pts => {
      let P = pts;
      for (let k = 0; k < 3; k++) {
        const n = P.length; if (n < 5) return null;
        let su = 0, sv = 0, suu = 0, suv = 0; P.forEach(([u, v]) => { su += u; sv += v; suu += u*u; suv += u*v; });
        const m = (n * suv - su * sv) / (n * suu - su * su || 1), c = (sv - m * su) / n;
        if (k === 2) return { m, c };
        const res = P.map(([u, v]) => Math.abs(v - (m * u + c))), lim = Math.max(1.5, median(res) * 2.5);
        P = P.filter((_, i) => res[i] <= lim);
      }
    };
    const T = fit(top), B = fit(bot), L = fit(lef), R = fit(rig);
    if (!T || !B || !L || !R) return null;
    // y = T.m x + T.c  and  x = L.m y + L.c
    const cross = (H, V) => { const x = (V.m * H.c + V.c) / (1 - V.m * H.m); return { x, y: H.m * x + H.c }; };
    let q = { tl: cross(T, L), tr: cross(T, R), br: cross(B, R), bl: cross(B, L) };
    const len = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const qa = Math.abs((q.tl.x*q.tr.y - q.tr.x*q.tl.y) + (q.tr.x*q.br.y - q.br.x*q.tr.y) + (q.br.x*q.bl.y - q.bl.x*q.br.y) + (q.bl.x*q.tl.y - q.tl.x*q.bl.y)) / 2;
    const inside = p => p.x > -w * .15 && p.x < w * 1.15 && p.y > -h * .15 && p.y < h * 1.15;
    if (!Object.values(q).every(inside) || qa < w * h * .12) return null;
    // Long rail horizontal on screen.
    if (len(q.tl, q.bl) > len(q.tl, q.tr) * 1.05) q = { tl: q.bl, tr: q.tl, br: q.tr, bl: q.br };
    const n = p => ({ x: p.x / w, y: p.y / h });
    return { tl: n(q.tl), tr: n(q.tr), br: n(q.br), bl: n(q.bl), felt: [fh, fs, fv], cover: area / (w * h) };
  }
  // Corners from several frames agree -> stable.
  const cornerDiff = (a, b) => Math.max(...['tl', 'tr', 'br', 'bl'].map(k => Math.hypot(a[k].x - b[k].x, a[k].y - b[k].y)));

  // ---------- WebGL keystone correction ----------
  class Warper {
    // fixed: [w, h] for a small copy the tracker reads with read() (fast GPU readback).
    constructor(canvas, fixed){
      this.c = canvas; this.fixed = fixed || null;
      const gl = this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
      if (!gl) return;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 a;varying vec2 uv;void main(){uv=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}'));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, 'precision highp float;varying vec2 uv;uniform sampler2D t;uniform mat3 H;uniform float f;' +
        'void main(){vec2 q=f>.5?1.-uv:uv;vec3 s=H*vec3(q,1.);vec2 c=s.xy/s.z;' +
        'if(c.x<0.||c.x>1.||c.y<0.||c.y>1.)gl_FragColor=vec4(0.,0.,0.,1.);else gl_FragColor=texture2D(t,c);}'));
      gl.linkProgram(p); gl.useProgram(p);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(p, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
      this.uH = gl.getUniformLocation(p, 'H'); this.uF = gl.getUniformLocation(p, 'f');
      this.setQuad(null);
    }
    get ok(){ return !!this.gl; }
    // quad: normalised corners, or null for the plain camera picture.
    setQuad(q){ this.q = q; const H = q ? toCam(q) : [1,0,0, 0,1,0, 0,0,1]; this.H = [H[0], H[3], H[6], H[1], H[4], H[7], H[2], H[5], H[8]]; }
    draw(video, flip){
      const gl = this.gl, vw = video.videoWidth || video.width, vh = video.videoHeight || video.height;
      if (!gl || !vw) return false;
      // Output size: 2:1 when straightened, the camera's own shape otherwise.
      const [W, Hh] = this.fixed || [1280, this.q ? 640 : Math.round(1280 * vh / vw)];
      if (this.c.width !== W || this.c.height !== Hh) { this.c.width = W; this.c.height = Hh; }
      gl.viewport(0, 0, W, Hh);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); } catch { return false; }
      gl.uniformMatrix3fv(this.uH, false, this.H); gl.uniform1f(this.uF, flip ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return true;
    }
    // Pixels of the last draw as ImageData (rows flipped: WebGL reads bottom-up).
    read(){
      const gl = this.gl, w = this.c.width, h = this.c.height;
      if (!this.buf || this.buf.length !== w * h * 4) { this.buf = new Uint8Array(w * h * 4); this.img = new ImageData(w, h); }
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, this.buf);
      const row = w * 4, out = this.img.data;
      for (let y = 0; y < h; y++) out.set(this.buf.subarray((h - 1 - y) * row, (h - y) * row), y * row);
      return this.img;
    }
  }

  // ---------- ball tracking on the straightened table ----------
  // Works on a small copy of the straightened table (default 480 x 240). A 9 ft table's 50 in
  // width over 240 px makes a 2.25 in ball about 11 px across.
  const POCKETS = [[0, 0], [.5, 0], [1, 0], [0, 1], [.5, 1], [1, 1]];
  // Ball colours by hue (solids 1-7; the stripe with the same colour is +8). Boundaries measured from
  // Terry's rental set on Surge's blue cloth (data/training/ball-photos/profile-surge-blue.json):
  // 1 yellow 36°, 5 orange 18°, 3 red 350° (bright) vs 7 maroon 346° (dark), 6 green 168°, 2 blue 216°,
  // 4 purple 248°.
  function ballNumber(hue, val){
    if (hue < 8 || hue >= 330) return val < .62 ? 7 : 3;     // maroon (dark) / red (bright): same hue
    if (hue < 27) return 5;                                   // orange
    if (hue < 70) return 1;                                   // yellow
    if (hue < 195) return 6;                                  // green
    if (hue < 238) return 2;                                  // blue
    return 4;                                                 // purple
  }
  class Tracker {
    constructor(opt){
      this.o = Object.assign({ w: 480, h: 240, still: .6, move: 1.6, endQuiet: 2500, maxShot: 15000, gone: 700, pocketR: .085 }, opt || {});
      this.tracks = []; this.nid = 1; this.shot = null; this.quietFrom = 0; this.onShot = null; this.onPocket = null; this.frame = 0;
    }
    get ballPx(){ return this.o.h * 2.25 / 50; }
    detect(img){
      const { width: w, height: h, data: d } = img, A = Math.PI * Math.pow(this.ballPx / 2, 2);
      // felt reference = median of a sparse grid (balls are a small fraction of the cloth)
      const R = [], Gc = [], Bc = [];
      for (let y = 3; y < h; y += 6) for (let x = 3; x < w; x += 6) { const i = (y * w + x) * 4; R.push(d[i]); Gc.push(d[i+1]); Bc.push(d[i+2]); }
      const fr = median(R), fg = median(Gc), fb = median(Bc), fhsv = hsv(fr, fg, fb);
      // Local cloth colour: lighting is never even (brighter in the middle, darker at the rails), so each
      // pixel is compared with the cloth colour of its own area (a 12 x 6 grid of cell medians, blended),
      // not one colour for the whole table. Cells mostly covered by something else fall back to the table's.
      const GX = 12, GY = 6, cw = w / GX, ch = h / GY, ref = new Float32Array(GX * GY * 3);
      for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
        const rr = [], gg = [], bb = [];
        for (let y = Math.floor(gy * ch) + 1; y < (gy + 1) * ch; y += 3) for (let x = Math.floor(gx * cw) + 1; x < (gx + 1) * cw; x += 3) { const i = (y * w + x) * 4; rr.push(d[i]); gg.push(d[i+1]); bb.push(d[i+2]); }
        let mr = median(rr), mg = median(gg), mb = median(bb);
        if (Math.abs(mr - fr) + Math.abs(mg - fg) + Math.abs(mb - fb) > 90) { mr = fr; mg = fg; mb = fb; }
        const k = (gy * GX + gx) * 3; ref[k] = mr; ref[k+1] = mg; ref[k+2] = mb;
      }
      const dist = new Float32Array(w * h), ds = [];
      for (let y = 0; y < h; y++) {
        const fy = Math.min(GY - 1.001, Math.max(0, y / ch - .5)), y0 = Math.floor(fy), ty = fy - y0, y1 = Math.min(GY - 1, y0 + 1);
        for (let x = 0; x < w; x++) {
          const fx = Math.min(GX - 1.001, Math.max(0, x / cw - .5)), x0 = Math.floor(fx), tx = fx - x0, x1 = Math.min(GX - 1, x0 + 1);
          const a = (y0 * GX + x0) * 3, b2 = (y0 * GX + x1) * 3, c = (y1 * GX + x0) * 3, e = (y1 * GX + x1) * 3, p = y * w + x, i = p * 4;
          let dd = 0;
          for (let ch2 = 0; ch2 < 3; ch2++) { const top = ref[a + ch2] * (1 - tx) + ref[b2 + ch2] * tx, bot = ref[c + ch2] * (1 - tx) + ref[e + ch2] * tx; dd += Math.abs(d[i + ch2] - (top * (1 - ty) + bot * ty)); }
          dist[p] = dd; if ((p & 15) === 0) ds.push(dd);
        }
      }
      const md = median(ds), mad = median(ds.map(v => Math.abs(v - md)));
      const thr = Math.max(55, md + 6 * mad);
      const m = Math.round(this.ballPx * .25), mask = new Uint8Array(w * h);
      for (let y = m; y < h - m; y++) for (let x = m; x < w - m; x++) { const p = y * w + x; if (dist[p] > thr) mask[p] = 1; }
      const lab = new Int32Array(w * h), blobs = [];
      for (let s = 0; s < w * h; s++) {
        if (!mask[s] || lab[s]) continue;
        const b = { n: 0, sx: 0, sy: 0, x0: w, x1: 0, y0: h, y1: 0, wh: 0, dk: 0, hue: new Array(36).fill(0), vs: 0, ss: 0, cn: 0, cc: 0, vall: 0 };
        const stk = [s]; lab[s] = blobs.length + 1;
        while (stk.length) {
          const p = stk.pop(), x = p % w, y = (p - x) / w, i = p * 4;
          b.n++; b.sx += x; b.sy += y; if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
          const r = d[i], g = d[i+1], bl = d[i+2], mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
          // White includes the ivory of the cue ball and stripe caps (cream: yellowish, low saturation).
          // Compressed video greys the white a little, hence 145 / 60.
          const c = hsv(r, g, bl); b.vall += c[2];
          // (Terry's table 4: the cue ball is cream with a blue cast from the cloth, and the 8 is blue-black.)
          if ((mn > 145 && mx - mn < 60) || (c[2] > .62 && c[0] >= 25 && c[0] <= 65 && c[1] < .45) || (c[2] > .6 && c[1] < .28)) b.wh++;
          else if (mx < 70 || (c[2] < .36 && c[1] < .75)) b.dk++;
          // Ball colour, but not the cloth showing through at the ball's edge (blue cloth vs the 2/10 balls:
          // the balls are darker and more saturated than the cloth).
          else if (c[1] > .3 && !(hueDist(c[0], fhsv[0]) < 22 && c[2] > fhsv[2] * .82)) { b.hue[Math.floor(c[0] / 10) % 36]++; b.vs += c[2]; b.ss += c[1]; b.cn++; if (hueDist(c[0], fhsv[0]) < 32) b.cc++; }
          const L = lab[s];
          if (x > 0 && mask[p-1] && !lab[p-1]) { lab[p-1] = L; stk.push(p-1); }
          if (x < w-1 && mask[p+1] && !lab[p+1]) { lab[p+1] = L; stk.push(p+1); }
          if (p >= w && mask[p-w] && !lab[p-w]) { lab[p-w] = L; stk.push(p-w); }
          if (p < w*(h-1) && mask[p+w] && !lab[p+w]) { lab[p+w] = L; stk.push(p+w); }
        }
        blobs.push(b);
      }
      const balls = [], occ = [];   // (relative cue / 8 pick happens after classification, below)
      for (const b of blobs) {
        if (b.n < A * .55) continue;   // coins, chalk, diamonds: smaller than half a ball
        const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1, fill = b.n / (bw * bh), x = b.sx / b.n / w, y = b.sy / b.n / h;
        // The pocket openings themselves are dark blobs on the table edge: not balls.
        if (POCKETS.some(([px, py]) => Math.hypot(x - px, (y - py) * .5) < .04)) continue;
        // Our table edge is the cushion's outer line, so a real ball's centre can't be this close to it:
        // anything there is a rail diamond, a pocket jaw or a hand on the rail. (Occluders still count.)
        const EM = this.ballPx * .5;
        const nearEdge = x < EM / w || x > 1 - EM / w || y < EM / h || y > 1 - EM / h;
        if (nearEdge && b.n <= A * 1.9) continue;
        if (b.n <= A * 1.9 && fill > .45 && Math.max(bw, bh) < this.ballPx * 2) {
          const wf = b.wh / b.n, df = b.dk / b.n, cf = b.cn / b.n;
          let cls, num = 0;
          // Seen from above, a stripe with its cap up is almost all white; only a coloured ring at the
          // edge shows. White with a colour ring = stripe; white with none = the cue ball.
          // Cue ball: white with no ball colour. The blue cloth showing at its edge doesn't count as colour
          // (on Terry's table it made the cue ball read as a cap-up stripe, so the ref never saw a cue ball).
          const cfBall = (b.cn - b.cc) / b.n;
          if (wf > .5 && (cf < .08 || cfBall < .1)) cls = 'cue';
          else if (df > .45 && wf < .2) { cls = 'eight'; num = 8; }
          else {
            cls = wf > .13 ? 'stripe' : 'solid';
            // Pick the ball's colour. Cloth-coloured hues (the blue bleeding into a ball's edge) only win when
            // nothing else is there, so a stripe's thin ring isn't mistaken for the blue 10.
            const clothy = i => hueDist(i * 10 + 5, fhsv[0]) < 32;
            let hb = -1, best = 0, other = 0;
            b.hue.forEach((v, i) => { if (!clothy(i)) { other += v; if (v > best) { best = v; hb = i; } } });
            if (hb < 0 || other < Math.max(2, b.cn * .2)) hb = b.hue.indexOf(Math.max(...b.hue));
            num = b.cn ? ballNumber(hb * 10 + 5, b.vs / b.cn) + (cls === 'stripe' ? 8 : 0) : 0;
          }
          balls.push({ x, y, cls, num, wf, df, cf, vmean: b.vall / b.n, cfBall: (b.cn - b.cc) / b.n, sat: b.cn ? b.ss / b.cn : 0, cc: b.cc / b.n, fh: fhsv[0], hue: b.cn ? b.hue.indexOf(Math.max(...b.hue)) * 10 + 5 : -1 });
        } else if (b.n <= A * 7 && fill > .4 && Math.max(bw, bh) < this.ballPx * 5) balls.push({ x, y, cls: 'cluster', num: 0, n: Math.max(2, Math.round(b.n / (A * 1.3))) });   // shadows make touching balls look bigger: count cautiously
        else {
          // Something that isn't a ball: a cue shaft is long and thin (about a ball wide); a hand, glove
          // or arm is much thicker. Measure thickness as area / length of the shape.
          const len = Math.hypot(bw, bh), thick = b.n / Math.max(1, len);
          // People and cues reach in from the side: a shape that doesn't touch the table edge isn't an arm. (On table 4
          // the 6 ball plus a patch of lamp glare in the middle read as an 'arm' and blocked the ref on every shot.)
          const touchesEdge = b.x0 < w * .06 || b.x1 > w * .94 || b.y0 < h * .08 || b.y1 > h * .92;
          if (!touchesEdge) {
            if (b.cn / b.n > .08 || b.dk / b.n > .15 || b.wh / b.n > .15) {   // a ball inside the glare: read it by its colour
              const clothy = i => hueDist(i * 10 + 5, fhsv[0]) < 32; let hb = -1, best = 0; b.hue.forEach((v2, i) => { if (!clothy(i) && v2 > best) { best = v2; hb = i; } });
              const wf = b.wh / b.n, df = b.dk / b.n;
              if (wf > .35 && best < b.n * .03) balls.push({ x, y, cls: 'cue', num: 0, wf, df, cf: b.cn / b.n });
              else if (df > .3 && best < b.n * .05) balls.push({ x, y, cls: 'eight', num: 8, wf, df });
              else if (hb >= 0) balls.push({ x, y, cls: wf > .13 ? 'stripe' : 'solid', num: ballNumber(hb * 10 + 5, b.vs / Math.max(1, b.cn)) + (wf > .13 ? 8 : 0), wf, df, glare: true });
            }
            continue;
          }
          // area = real pixel share of the table (a thin rail ring round the cloth has a huge box but tiny area)
          occ.push({ x0: b.x0 / w, x1: b.x1 / w, y0: b.y0 / h, y1: b.y1 / h, area: b.n / (w * h), dark: b.dk / b.n > .45 && b.n > A * 6, thick, id: blobs.indexOf(b) + 1 });
        }
      }
      // Lighting varies table to table, so fixed colour cut-offs can miss the two balls that matter most.
      // There's exactly one cue ball and one 8: if none was found, take the brightest ball with little ball colour
      // as the cue ball, and the darkest ball as the 8.
      const real = balls.filter(b => b.cls !== 'cluster');
      if (real.length >= 3 && !real.some(b => b.cls === 'cue')) {
        const c = real.filter(b => b.wf > .4 && b.cfBall < .08).sort((a, b) => (b.wf - b.cfBall) - (a.wf - a.cfBall))[0];   // a cap-up stripe shows a colour ring: not the cue
        if (c) { c.cls = 'cue'; c.num = 0; }
      }
      if (real.length >= 3 && !real.some(b => b.cls === 'eight')) {
        const byV = real.filter(b => b.cls !== 'cue').sort((a, b) => a.vmean - b.vmean), d = byV[0], next = byV[1];
        if (d && next && d.vmean < .5 && d.vmean < next.vmean * .9) { d.cls = 'eight'; d.num = 8; }
      }
      // The rental ball tray (or a dark glove holding the cue ball): a big dark shape. Balls inside it
      // aren't in play.
      const trays = occ.filter(o => o.dark);
      const inPlay = trays.length ? balls.filter(bb => !trays.some(o => bb.x > o.x0 && bb.x < o.x1 && bb.y > o.y0 && bb.y < o.y1)) : balls;
      this._lab = lab; this._w = w; this._h = h;
      return { balls: inPlay, occ };
    }
    // Is a hand (or glove) on the cue ball? Look only at a small window around the ball: a cue shaft
    // crossing it is a thin line (little of the window), a hand or glove covers a lot of it.
    handNear(cue, occ){
      if (!occ.length || !this._lab) return false;
      const ids = new Set(occ.map(o => o.id)), w = this._w, h = this._h, r = Math.round(this.ballPx * 1.6);
      const cx = Math.round(cue.x * w), cy = Math.round(cue.y * h); let hit = 0, all = 0;
      for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y++) for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x++) {
        const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy > r * r || dx * dx + dy * dy < (this.ballPx * .55) ** 2) continue;
        all++; if (ids.has(this._lab[y * w + x])) hit++;
      }
      return all > 0 && hit / all > .38;
    }
    // Feed one straightened frame (ImageData) with its time in ms.
    feed(img, t){
      const { balls, occ } = this.detect(img), px = 1 / this.o.w, R = this.ballPx / this.o.w;
      this.frame++; this.last = { balls, occ, t };
      // match detections to tracks (nearest within 3 ball radii, same class preferred)
      const used = new Set();
      for (const tr of this.tracks) {
        let best = -1, bd = R * (tr.cls === 'cue' ? 9 : 3) + Math.min(R * 6, tr.v * px * 1.2);   // fast balls travel far between frames
        balls.forEach((b, i) => { if (used.has(i)) return; const dd = Math.hypot(b.x - tr.x, (b.y - tr.y) * .5) * (b.cls === tr.cls && (!tr.num || b.num === tr.num) ? 1 : 4); if (dd < bd) { bd = dd; best = i; } });
        if (best >= 0) {
          const b = balls[best]; used.add(best);
          const dt = Math.max(1, t - tr.t), v = Math.hypot(b.x - tr.x, (b.y - tr.y) * .5) / px / (dt / 66);
          tr.v = tr.v * .4 + v * .6; tr.x = b.x; tr.y = b.y; tr.t = t; tr.seen = t;
          tr.votes[b.cls + ':' + b.num] = (tr.votes[b.cls + ':' + b.num] || 0) + 1;
          const top = Object.entries(tr.votes).sort((a, c) => c[1] - a[1])[0][0].split(':'); tr.cls = top[0]; tr.num = +top[1];
          if (tr.v < this.o.still) { if (!tr.stillFrom) tr.stillFrom = t; } else tr.stillFrom = 0;
        }
      }
      // A struck ball can travel further between frames than the match radius, so it looked lost and no shot started.
      // Re-attach a lost track to the one unmatched detection of the same ball (the cue ball, or the same number).
      for (const tr of this.tracks) {
        if (tr.seen === t) continue;
        const key = tr.cls === 'cue' ? 'cue' : (tr.num && tr.cls !== 'cluster') ? tr.num : null; if (key == null) continue;
        const cands = []; balls.forEach((b, i) => { if (!used.has(i) && (key === 'cue' ? b.cls === 'cue' : b.num === key && b.cls !== 'cluster')) cands.push(i); });
        if (cands.length !== 1) continue;
        const b = balls[cands[0]]; used.add(cands[0]);
        const dt = Math.max(1, t - tr.t), v = Math.hypot(b.x - tr.x, (b.y - tr.y) * .5) / px / (dt / 66);
        tr.v = Math.max(v, this.o.move * 1.5); tr.x = b.x; tr.y = b.y; tr.t = t; tr.seen = t; tr.stillFrom = 0;
      }
      const hasCue = this.tracks.some(tr => tr.cls === 'cue' && t - tr.seen < 1500);
      balls.forEach((b, i) => { if (!used.has(i) && !(b.cls === 'cue' && hasCue) && this.shot) this.shot.spawned = (this.shot.spawned || 0) + 1; });
      balls.forEach((b, i) => { if (!used.has(i) && !(b.cls === 'cue' && hasCue)) this.tracks.push({ id: this.nid++, x: b.x, y: b.y, cls: b.cls, num: b.num, v: 0, t, seen: t, stillFrom: t, votes: { [b.cls + ':' + b.num]: 1 } }); });
      // forget tracks unseen for long (unless mid-shot, where "gone" means pocketed)
      this.tracks = this.tracks.filter(tr => t - tr.seen < (this.shot ? 20000 : 4000));
      const nearOcc = tr => occ.some(o => tr.x > o.x0 - R * 2 && tr.x < o.x1 + R * 2 && tr.y > o.y0 - R * 4 && tr.y < o.y1 + R * 4);
      const cue = this.tracks.find(tr => tr.cls === 'cue' && tr.seen === t);
      // When each ball was last at rest, and since when. Kept while it moves, so a shot whose first moment is
      // blocked (bridge hand right next to the cue ball) still starts a moment later instead of never.
      const restBook = () => { for (const tr of this.tracks) { if (tr.seen !== t) continue;
        if (tr.v < this.o.still) { if (!tr.restSince) tr.restSince = t; tr.lastRest = t; tr.restDur = t - tr.restSince; tr.restX = tr.x; tr.restY = tr.y; }
        else if (tr.v > this.o.move) tr.restSince = 0; } };
      // Ball count history, so a shot that starts late still knows how many balls were up before it.
      const nNow = balls.filter(b => b.cls !== 'cluster').length + balls.filter(b => b.cls === 'cluster').reduce((a, b) => a + (b.n || 2), 0);
      (this.cnt = this.cnt || []).push([t, nNow]); while (this.cnt.length && t - this.cnt[0][0] > 3000) this.cnt.shift();
      const nBefore = () => Math.max(...this.cnt.filter(c => t - c[0] <= 2600).map(c => c[1]));
      const wasResting = tr => tr.lastRest && t - tr.lastRest < 2500 && tr.restDur > 500;
      const displaced = tr => tr.restX != null && Math.hypot(tr.x - tr.restX, (tr.y - tr.restY) * .5) > R * 3;
      // ---- shot state machine ----
      if (!this.shot) {
        // A hand (or glove) touching the cue ball while it moves = placing it (ball in hand), not a shot.
        const handOnCue = cue && this.handNear(cue, occ);
        // A hand next to the cue ball blocks a shot start briefly (it may be placing it). Only a hand that stays with the
        // ball while it moves for several frames is carrying it (ball in hand): then its old rest spot is forgotten.
        // A bridge hand at the strike is next to the ball for a frame or two only, so the shot still starts.
        if (handOnCue) { this.handUntil = t + 900; if (cue.v > this.o.move) { cue.carry = (cue.carry || 0) + 1; if (cue.carry >= 3) { cue.restX = null; cue.lastRest = 0; } } if (this.onHand) this.onHand({ t, x: cue.x, y: cue.y }); }
        else if (cue) cue.carry = 0;
        if (cue && (cue.v > this.o.move || displaced(cue)) && wasResting(cue) && !(this.handUntil > t)) {
          this.shot = { t0: t, cueFrom: { x: cue.x, y: cue.y }, first: null, n0: nBefore(), before: this.tracks.filter(tr => t - tr.seen < 1500 && tr.cls !== 'cluster' && tr.num).map(tr => tr.num), moved: new Set(), stillAtStart: new Set(this.tracks.filter(tr => tr !== cue && tr.v < this.o.move).map(tr => tr.id))   /* compressed video jitters: 'not moving' is enough */, cueId: cue.id };
          this.quietFrom = 0;
        }
        // Fallback when the cue ball isn't recognised as the cue ball (ivory under this light, a cap-up stripe…):
        // the first ball to move off a still table is the one that was struck, so treat it as the cue ball.
        if (!this.shot && !(this.handUntil > t)) {
          const movers = this.tracks.filter(tr => tr.seen === t && (tr.v > this.o.move || displaced(tr)) && wasResting(tr));
          if (movers.length === 1 && !this.handNear(movers[0], occ)) {
            const m = movers[0];
            this.shot = { t0: t, cueFrom: { x: m.x, y: m.y }, first: null, n0: nBefore(), before: this.tracks.filter(tr => t - tr.seen < 1500 && tr.cls !== 'cluster' && tr.num).map(tr => tr.num), moved: new Set(), stillAtStart: new Set(this.tracks.filter(tr => tr !== m && tr.v < this.o.move).map(tr => tr.id)), cueId: m.id, guessedCue: m.cls !== 'cue' };
            this.quietFrom = 0;
          }
        }
        if (this.shot && this.onStart) try { this.onStart(this.shot); } catch {}
        if (this.shot) { this.shot.rest0 = {}; for (const tr of this.tracks) { this.shot.rest0[tr.id] = tr.restX != null ? [tr.restX, tr.restY] : [tr.x, tr.y]; tr.restSince = 0; tr.lastRest = 0; tr.restDur = 0; tr.restX = null; } }
        else {
          if (!(this.handUntil > t)) restBook();   // a hand right by the cue ball: keep the pre-shot rest spot until it's gone
          // Safety net: the cue ball settled in a new spot (1.2 s still) and no shot was called since it last settled.
          if (cue && cue.restDur > 1200 && !(this.handUntil > t)) {
            const nowN = nNow;
            if (this.settled && Math.hypot(cue.x - this.settled.x, (cue.y - this.settled.y) * .5) > R * 3 && this.settled.t > (this.lastShotT || 0)) {
              const ev = { type: 'shot', missed: true, first: null, pocketed: [], scratch: false, cuePocket: -1, rail: false, kick: false, noHit: false, before: this.settled.n, after: nowN, ms: 0, t };
              this.lastShotT = t; this.settled = { x: cue.x, y: cue.y, t, n: nowN };
              if (this.onShot) this.onShot(ev);
            } else if (!this.settled || Math.hypot(cue.x - this.settled.x, (cue.y - this.settled.y) * .5) <= R * 3) this.settled = { x: cue.x, y: cue.y, t: this.settled && Math.hypot(cue.x - this.settled.x, (cue.y - this.settled.y) * .5) <= R * 3 ? this.settled.t : t, n: nowN };
          }
        }
        for (const tr of this.tracks) if (tr.seen === t) tr.prevStill = tr.stillFrom || (tr.v < this.o.still ? t : 0);
        if (cue) cue.prevStill = cue.stillFrom || (cue.v < this.o.still ? t : 0);
        return;
      }
      const s = this.shot;
      s.seenMoving = s.seenMoving || new Set();
      // Paths for the breakdown page: where the cue ball went, and where the first ball it hit went.
      { const c0 = this.tracks.find(x => x.id === s.cueId); if (c0 && c0.seen === t) (s.path = s.path || []).push([+c0.x.toFixed(3), +c0.y.toFixed(3), Math.round(t - s.t0)]);
        if (s.first && s.first.id != null) { const f0 = this.tracks.find(x => x.id === s.first.id); if (f0 && f0.seen === t) (s.firstPath = s.firstPath || []).push([+f0.x.toFixed(3), +f0.y.toFixed(3), Math.round(t - s.t0)]); } }
      for (const tr of this.tracks) if (tr.seen === t && tr.v > this.o.move) s.seenMoving.add(tr.id);
      for (const tr of this.tracks) {
        if (tr.id === s.cueId || tr.cls === 'cue' || s.moved.has(tr.id) || !s.stillAtStart.has(tr.id)) continue;
        // A struck ball can jump further than the tracker matches in one frame, so "gone from its
        // resting spot" (with no hand or cue covering it) counts as moved too.
        const moved = tr.seen === t ? tr.v > this.o.move : (t - tr.seen > 120 && !nearOcc(tr));
        if (moved) {
          s.moved.add(tr.id);
          if (!s.first) {
            const c = this.tracks.find(x => x.id === s.cueId);
            const near = c ? Math.hypot(c.x - tr.x, (c.y - tr.y) * .5) / R : 99;
            s.first = { cls: tr.cls, num: tr.num, conf: near < 3.5 ? .8 : near < 6 ? .55 : .3, x: tr.x, y: tr.y, id: tr.id, at: Math.round(t - s.t0) };
            if (this.onContact) try { this.onContact(s.first, c); } catch {}
          }
        }
      }
      // A ball gone for `gone` ms next to a pocket has dropped: announce it now, not when the balls stop
      // (the "made the 7" flash belongs right after the drop — never at the strike, never a few seconds late).
      for (const tr of this.tracks) {
        if (tr.dropSent || tr.id === s.cueId || tr.seen < s.t0 || t - tr.seen < this.o.gone) continue;
        const pk = POCKETS.findIndex(([px2, py]) => Math.hypot(tr.x - px2, (tr.y - py) * .5) < this.o.pocketR);
        if (pk < 0 || nearOcc(tr)) continue;
        tr.dropSent = true; if (this.onPocket) try { this.onPocket({ cls: tr.cls, num: tr.num, pocket: pk, t }); } catch {}
      }
      // Quiet = nothing moving AND the cue ball seen at rest (a lost cue ball is not a stopped one),
      // unless it vanished at a pocket (scratch).
      const c = this.tracks.find(x => x.id === s.cueId);
      const cueGoneAtPocket = c && t - c.seen > this.o.gone && POCKETS.some(([px2, py]) => Math.hypot(c.x - px2, (c.y - py) * .5) < this.o.pocketR);
      const cueResting = c && ((c.seen === t && c.v < this.o.still) || cueGoneAtPocket);
      const moving = this.tracks.some(tr => tr.seen === t && tr.v > this.o.still) || !cueResting;
      // APA: after legal contact some ball (cue ball included) must reach a rail. A moving ball whose
      // centre comes within ~2.6 ball radii of the table edge (our edge is the cushion's outer line)
      // counts as a rail contact.
      if (s.first && !s.rail) {
        const rx = R * 2.6, ry = R * 2.6 * 2;
        s.rail = this.tracks.some(tr => tr.seen === t && tr.v > this.o.still && (tr.x < rx || tr.x > 1 - rx || tr.y < ry || tr.y > 1 - ry));
      }
      // Shot type: the cue ball reaching a cushion before it hits anything = kick; an object ball reaching a
      // cushion (away from the pockets) before it drops = bank.
      { const rx = R * 2.6, ry = R * 2.6 * 2, edge = tr => tr.x < rx || tr.x > 1 - rx || tr.y < ry || tr.y > 1 - ry,
          nearPk = tr => POCKETS.some(([px2, py]) => Math.hypot(tr.x - px2, (tr.y - py) * .5) < this.o.pocketR * 1.8);
        s.cush = s.cush || new Set();
        for (const tr of this.tracks) { if (tr.seen !== t || tr.v <= this.o.still || !edge(tr) || nearPk(tr)) continue;
          if (tr.id === s.cueId) { if (!s.first) s.kick = true; } else if (s.moved.has(tr.id)) s.cush.add(tr.id); } }
      if (!moving) { if (!this.quietFrom) this.quietFrom = t; } else this.quietFrom = 0;
      const blocked = occ.some(o => o.area > .012);   // a person/arm over the table hides balls (by real area, not the box)
      if ((this.quietFrom && t - this.quietFrom > this.o.endQuiet && (!blocked || t - this.quietFrom > this.o.endQuiet + 5000)) || t - s.t0 > this.o.maxShot) {
        // Balls that vanished during the shot next to a pocket were pocketed.
        const pocketed = [];
        let scratch = false, cuePocket = -1;
        // A fast ball is often last seen well before the pocket, so a ball that moved and then vanished (with no
        // hand or cue over it) counts too, in the nearest pocket, as long as the table really has that many fewer balls.
        const byPocket = tr => { const r0 = (s.rest0 || {})[tr.id]; if (!r0) return false; return POCKETS.some(([px2, py]) => Math.hypot(r0[0] - px2, (r0[1] - py) * .5) < .09); };   // where it rested before the shot
        const leftRest = tr => { const r0 = (s.rest0 || {})[tr.id]; return !!r0 && Math.hypot(tr.x - r0[0], (tr.y - r0[1]) * .5) > R * 3; };
        const hitFirst = tr => !!(s.first && s.first.num && s.first.num === tr.num);   // the ball the cue ball struck did move
        const reallyMoved = tr => tr.id === s.cueId || s.seenMoving.has(tr.id) || leftRest(tr) || hitFirst(tr) || (s.moved.has(tr.id) && !byPocket(tr));
        const cand = [];
        for (const tr of this.tracks) {
          if (t - tr.seen < this.o.gone || tr.seen < s.t0 || nearOcc(tr)) continue;
          let pk = -1, d = 9; POCKETS.forEach(([px2, py], k) => { const dd = Math.hypot(tr.x - px2, (tr.y - py) * .5); if (dd < d) { d = dd; pk = k; } });
          // Only a ball seen moving in this shot can go down. A ball resting near a pocket flickers in and out of view
          // (the pocket opening is masked), which made a still 8 ball read as pocketed.
          const moved = reallyMoved(tr), strict = moved && d < this.o.pocketR;
          if (strict || (moved && d < .35)) cand.push({ tr, pk, d, strict });
        }
        const fewer = Math.max(0, (s.n0 || 0) - nNow);
        cand.sort((a, b) => (b.strict - a.strict) || (a.d - b.d));
        let loose = 0;
        for (const c of cand) {
          if (!c.strict && loose >= fewer) continue; if (!c.strict) loose++;
          const tr = c.tr;
          if (tr.id === s.cueId) { scratch = true; cuePocket = c.pk; } else pocketed.push({ cls: tr.cls, num: tr.num, pocket: c.pk, bank: !!(s.cush && s.cush.has(tr.id)), sure: c.strict });
          tr.pocketed = true;
        }
        // Count before vs after: a numbered ball that was on the table at the start and isn't now, when the table
        // really has fewer balls, went down even if it was never tracked moving (blue 10 on blue cloth, under an arm).
        const nowNums = new Set(this.tracks.filter(tr => !tr.pocketed && t - tr.seen < 1200).map(tr => tr.num).concat(((this.last && this.last.balls) || []).map(b => b.num)));
        const gone = [...new Set(s.before || [])].filter(n => n && !nowNums.has(n) && !pocketed.some(p => p.num === n));
        let room = blocked ? 0 : Math.max(0, (s.n0 || 0) - nNow - pocketed.length - (scratch ? 1 : 0));
        for (const n of gone) { if (room <= 0) break; room--;
          const tr = this.tracks.find(x => x.num === n), pos = tr || { x: .5, y: .5 };
          if (tr && !nearOcc(tr) && !reallyMoved(tr) && byPocket(tr)) { (s.maybe = s.maybe || []).push(n); room++; continue; }   // ask, don't guess
          if (tr && (nearOcc(tr) || !reallyMoved(tr))) { room++; continue; }
          let pk = 0, d = 9; POCKETS.forEach(([px2, py], k) => { const dd = Math.hypot(pos.x - px2, (pos.y - py) * .5); if (dd < d) { d = dd; pk = k; } });
          pocketed.push({ cls: n === 8 ? 'eight' : n > 8 ? 'stripe' : 'solid', num: n, pocket: pk, counted: true });
          if (tr) tr.pocketed = true; }
        this.tracks = this.tracks.filter(tr => !tr.pocketed);
        this.shot = null;
        const ev = { type: 'shot', first: s.first, pocketed, scratch, cuePocket, rail: !!s.rail, kick: !!s.kick, maybe: s.maybe || [], path: s.path || [], firstPath: s.firstPath || [], noHit: !s.first && !pocketed.length && !(s.spawned > 1) && s.moved.size === 0 && ![...(s.seenMoving || [])].some(id => id !== s.cueId) && !blocked && (s.n0 || 0) <= nNow, n0: s.n0 || 0, n1: nNow, blocked, ms: t - s.t0, t };
        this.lastShotT = t; { const c2 = this.tracks.find(x => x.id === s.cueId); this.settled = c2 && !scratch ? { x: c2.x, y: c2.y, t, n: nNow } : null; }
        if (this.onShot) this.onShot(ev);
      }
    }
  }

  // The whole table for display: the cloth corners pushed out over the rails and pockets (mu along the
  // table, mv across it, in cloth widths). The tracker keeps using the exact cloth corners.
  const withRails = (q, mu = .05, mv = .1) => { if (!q) return q; const H = toCam(q);
    return { tl: apply(H, -mu, -mv), tr: apply(H, 1 + mu, -mv), br: apply(H, 1 + mu, 1 + mv), bl: apply(H, -mu, 1 + mv) }; };
  Tracker.prototype.onTable = function(){ const t = this.last ? this.last.t : 0; return [...new Set(this.tracks.filter(tr => t - tr.seen < 2000 && tr.num && tr.cls !== 'cluster').map(tr => tr.num))].sort((a, b) => a - b); };
  G.TableCV = { findCorners, cornerDiff, Warper, Tracker, toCam, apply, withRails, POCKETS };
})(window);
