# 🎱 Pool AR PAL — XREAL Beam Pro MVP

> **Live:** https://autom8agent.github.io/poolar/ — open this on the Beam Pro.
> Hosted on GitHub Pages over HTTPS, which is what unlocks camera access.
> Push to `main` and the live site updates in ~20 seconds.

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

## 📹 Pool Cam — top-down camera + recording

**https://autom8agent.github.io/poolar/phonecam.html**

1. On the phone mounted over the table: open the link → **Use this phone as the camera**.
   It switches to the ultra-wide lens automatically (iPhone "Back Ultra Wide Camera", or 0.5× zoom on Android).
2. On the iPad/TV/laptop: open the link → **Watch the camera** (or scan the QR). No code — the live view opens full screen.
   The scoreboard's camera button → **Show top-down feed** does the same beside the score.
   Everything shares one channel; add `?t=3` to both the camera and watch links to give a table its own.
3. Tap **● Record** on either screen; when you stop, **Save / share** puts the clip in Photos/Files.

Peer-to-peer WebRTC; the ntfy.sh relay only carries the connection handshake. Works across
networks, most reliably with both devices on the same Wi-Fi.

## ⚡ The one gotcha: the camera needs HTTPS

Android Chrome only grants camera access on `https://` or `localhost`. Opening the file
directly (`file://…`) will **not** work — this is why the app is hosted rather than
side-loaded. The live URL above already satisfies this.

<details>
<summary>Running it somewhere else instead</summary>

- **Vercel** — import this repo at vercel.com/new, or `vercel login && vercel --prod`.
- **Netlify / Cloudflare Pages** — drag this folder onto their drop zone.
- **Local testing** — `python3 -m http.server 8080` then `npx localtunnel --port 8080`
  for a temporary HTTPS URL. Requires the host machine to stay awake.

</details>

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

---

## 🏆 Tournaments & open table nights

**Pages**
- `tournament.html` — the tournament: *My match* (your table, opponent, race, where you go if you win or lose, your path), *Bracket* (tiered to the final), *Players*, *Rules* (plain-English format explanation + diagram, races, APA chart) and *Run* (organiser, admin PIN).
- `join.html` — the sign-up page the QR code points at (name, phone or email, skill level). Always joins the hall's current tournament, so a printed QR keeps working.
- `night.html` — open table night planner: date/time, templates (All 8-ball, All 9-ball, Mixed, Doubles, Challenge races), per-table game / singles-doubles / winner stays-rotation-race / notes. Publishes `kind:'night'` and sets the tables up with `kind:'config'` when the night starts.
- `profile.html` — sign in / create account (auth.js) and *My tournaments*.
- `tourney.js` — all bracket/race/queue logic as pure functions. Test: `node tools/test-tourney.js`.
- `auth.js` — member accounts. **Local only for now** (saved on each phone, nothing verified, no codes sent). One `PROVIDER` swap plugs in a real backend such as Supabase phone/email OTP — see the TODO at the top of the file.

**Formats:** single elimination; double elimination (optional grand-final reset, default on); modified single elimination (round-1 losers get one second-chance bracket and rejoin the main draw for the final stage; after round 1 one loss is out). Byes go to the top seeds (random draw, list order or skill level).

**Races:** APA 8-ball from the chart, APA 9-ball points, fixed race for BCA / no skill levels (per stage: winners, losers/second chance, semis, final). Reduced races take one game off both players only when both stay ≥ 2 (4v6 3/5 → 2/4; 3v6 2/5 stays).

**Relay messages** (ntfy.sh)
- `poolar-tourney-<hall>`: `kind:'tourney'` full snapshot (latest `ts` wins; split into `tourney-part` messages if over ~2.6 KB) and `kind:'signup'` from players' phones. The organiser's phone merges sign-ups into the snapshot.
- `poolar-hall-<hall>`: `kind:'config'` per table (tournament matches carry `names`, `races`, `sl`), `kind:'tsum'` tournament summary for the hall map, `kind:'night'` plan.
- `poolar-results-<hall>`: `kind:'tourney-match'` results and `kind:'placings'` at the end. Results posted by the scoreboard on a tournament table fill in the winner automatically.

**Daily reset (2 AM Chicago):** the hall is open 9 AM–1 AM. `hallday.js` `lastReset()` gives the most recent 2:00 AM America/Chicago (DST-safe). The map ignores table statuses from before it; a scoreboard whose game was last touched before it archives the game to `poolar-history` (full copy; profile lists it) and starts clean, clearing its waitlist; waitlist entries from before it are dropped. A game touched after 2 AM is never ended, and if the archive can't be written the game is left alone. The relay's cron (07:00 + 08:00 UTC, only the one that is 2 AM in Chicago posts) sends `{kind:'reset', ts}` to `poolar-hall-<hall>`. Test: `node tools/test-dayreset.js` (Playwright, local stub relay).

**Calendar:** `poolar-sched-<hall>` carries every planned night (`kind:'night'`, one per id) and tournament summary (`kind:'tsum'`); our relay keeps that topic 120 days (newest copy per id). The tables page shows today's date, an upcoming strip and a month calendar (tap a date → `night.html?date=`); the planner has the same calendar and a list of what's scheduled, and can plan several nights ahead.

**Limits without a backend:** ntfy.sh keeps messages 12 h — an organiser phone with the page open re-posts the tournament / night plan every 8 h, so plans days ahead need an admin to open the page once in a while. Sign-up messages (with phone/email) are readable by anyone who knows the topic name. The free relay also rate-limits per internet address (everyone on the hall Wi-Fi shares one).
