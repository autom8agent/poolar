# 🎱 Pool AR PAL — XREAL Beam Pro MVP

An augmented-reality pool aim assistant that runs in the browser on your **XREAL Beam Pro**
and is viewed through your **XREAL glasses**. It uses the Beam Pro's rear camera + OpenCV.js
to detect balls and the table, then overlays:

- **Aim line** from the cue ball to the ghost-ball contact point
- **Ghost ball** ring (where the cue ball must be at impact)
- **Object-ball path** with **cushion bank** reflections
- **Pocket prediction** (green ring = makeable)
- **Cue-ball tangent** deflection line

Overlay lines default to **deep blue / violet / magenta** — the colors that pop best, including
on yellow felt — with a dark halo so they read against any cloth.

---

## ⚡ The one gotcha: the camera needs HTTPS

Android Chrome only grants camera access on `https://` or `localhost`. Opening the file
directly (`file://…`) will **not** work. Pick one of these:

### Option A — Free static host (recommended, ~3 min)
1. Go to a drag-and-drop static host (e.g. **Cloudflare Pages**, **Netlify**, **GitHub Pages**, or **tiiny.host**).
2. Upload `index.html`.
3. Open the resulting `https://…` URL **in the Beam Pro's browser**.

### Option B — Tunnel from this Mac
From this folder, run a local server and expose it over HTTPS:
```bash
# serve locally
python3 -m http.server 8080
# in another terminal, tunnel it (one of these):
npx localtunnel --port 8080      # gives an https URL
# or:  cloudflared tunnel --url http://localhost:8080
```
Open the printed `https://…` URL on the Beam Pro.

### Option C — On-device server
Install a "Simple HTTP Server" app or Termux on the Beam Pro and serve the folder, then open
`http://localhost:8080` (localhost is exempt from the HTTPS rule).

---

## 🎮 How to use

1. **Mount the Beam Pro** so its rear camera sees the whole table (overhead or a high corner).
2. **Cast** the Beam Pro screen to your XREAL glasses (XREAL Nebula → screen mirror / casting).
3. Open the URL, tap **Start camera**, allow access.
4. **1 · Calibrate corners** → tap the 4 *inner* cushion corners in order: **TL → TR → BR → BL**.
   (This sets the play area for bank shots + pocket positions, and auto-sizes ball detection.)
5. **2 · Set cue ball** → tap the cue ball (or let auto-detect pick the whitest ball).
6. **Drag on the table** to aim — the overlay updates live.

### Controls
- **Auto-detect ⟳** — toggle live ball detection (turn off + **Freeze** to lock a shot).
- **Banks** — toggle cushion-reflection prediction.
- **Freeze** — stop detection so the lines hold still while you get down on the shot.
- **Table size** — 7 / 8 / 9 ft (improves ball-size estimate).
- **Sensitivity / Ball size** — tune detection on your table/lighting.
- **Line color** — Blue / Violet / Magenta.

### Tuning tips
- If balls aren't detected: nudge **Ball size** to match the rings to real balls, then adjust
  **Sensitivity** (lower = more circles, higher = fewer false positives).
- Even, glare-free lighting massively improves detection.
- Bank prediction is an image-space approximation — most accurate when the camera is closer to
  top-down.

---

## ⚠️ What this MVP is (and isn't)
- ✅ **Is:** a working aim assistant viewed as a floating screen in your glasses (casting mode).
- ❌ **Isn't (yet):** *world-locked* see-through AR where lines sit on the real table through the
  lenses. That requires Unity + XREAL **NRSDK** with 6DoF tracking and a camera-equipped headset.

### Upgrade path to true see-through AR
1. **Unity + NRSDK** project targeting the glasses' MR mode (6DoF).
2. Use the camera frame for the same OpenCV detection (via OpenCV-for-Unity or a native plugin).
3. Anchor the detected table plane in world space; render the overlay as 3D geometry so it stays
   glued to the felt as you move your head.
4. Optionally add cue-stick tracking for fully hands-free aiming.

This web MVP is the right place to prove out the detection + physics; that code/logic ports
directly into the Unity version.
