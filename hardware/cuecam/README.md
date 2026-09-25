# CueCam — a 3-piece carbon cue with a pop-out camera

A full design package for the cue you described: three pieces, carbon fibre,
9.5 mm tip, a camera that pops out and back in about a third of the way from
the tip, adjustable 17–21 oz, a grip you add at the end, printable parts on a
Bambu Lab P1S, and footage that gets to your phone on an SD card rather than
through a Raspberry Pi.

Everything here is dimensioned, weighed and drawn. The numbers come from two
small models in `tools/` rather than from guesswork, and the drawings are
generated from those same models, so a drawing cannot quietly disagree with the
mass budget.

---

## Start here: the five things that decide this design

I ran the numbers before drawing anything. Five of them pushed back hard enough
to change the design, and they are worth understanding before you commit money
to tubes.

### 1. At the 1/3 station your cue is 14.2 mm thick. Nothing fits.

A 58 in cue with a 9.5 mm tip is about **14.2 mm in diameter 19 in back from the
tip**. A camera, a cell and a card do not fit inside that, so the camera has to
live in a *bump*. How big the bump is depends entirely on the widest dimension
of the electronics:

| Electronics | Collar OD | Verdict |
|---|---|---|
| 16 mm custom PCB, stood on edge | **⌀24.0 mm** | the design in these drawings |
| 19 mm RunCam Thumb Pro, de-cased | ⌀29.0 mm | works, fast to build, fat |
| 21 mm cased action camera | ⌀33 mm | as thick as the butt — no |

The whole shape of this project follows from that table. A long, narrow board is
worth designing precisely because it buys back 5 mm of diameter.

### 2. Every gram at the camera costs 2.44 g of finished cue

The camera station is 470 mm ahead of where the cue should balance. To hold the
balance point you need **1.44 g of butt ballast per gram of camera** — so a 25 g
cartridge is 61 g of cue, and a 45 g one is 110 g and puts 21 oz out of reach at
any balance you would want to play.

That is why the camera is a *mass budget*, not a parts list. Run
`python3 tools/balance.py` after any change.

### 3. A carbon tube cue weighs 11.3 oz. The ballast is the design.

Bare, this cue comes out at **11.3 oz** — miles under your 17–21 oz range. Every
cue in that weight class is carrying ballast; wooden cues just hide it in the
forearm. Put all of it under the bumper and the balance lands at 14.7–16.8 in,
which feels dead and butt-heavy.

So there are two ballast stations: a fixed rod in section 2, and the adjustable
bolt stack in the butt. Two ways to use them:

- **Mode A** — fixed rod, swap butt bolts. Balance moves ~0.7 in per ounce,
  exactly like any weight-bolt cue. This is what you will use.
- **Mode B** — swap both. 18.5 in balance at *every* weight from 17 to 21 oz.
  Fiddlier, and the reason it exists is below.

### 4. You cannot tilt the lens down at the table

The obvious move is to angle the lens toward the cloth. It does not work: from
11 mm above the cue axis, the sightline grazes your own shaft at **0.67°**. Tilt
it any further and you are filming carbon fibre.

So the lens looks *straight down the cue*. The cue ball sits 1.0° below that
axis at address and the 150° cone picks up everything else. The shaft eats a
wedge 16° wide at the collar narrowing to 1° at the tip — and that tapering
spike up the middle of frame is the aiming reference, not wasted picture.
(`python3 tools/optics.py`.)

### 5. Every shot is a ~500 g shock

Tip-to-ball contact lasts about a millisecond and takes the cue from ~7 m/s to
~2 m/s. Thousands of times. Nothing in the cartridge is held by tape or
friction, nothing relies on a plastic cam, and the latch is a bayonet rather
than a push-push — a push-push latch stores its release in an axial cam and the
cue spikes that cam on every shot until one day the cartridge leaves the cue
mid-break.

---

## The design

```
 tip ├─────────── SECTION 1 ───────────┤ SECTION 2 ├────── SECTION 3 ──────┤ butt
     0                              482.6        977.9                 1473.2 mm
     9.5 mm                     ┌──── camera collar ⌀24            weight bore │
                                └ cartridge pops out here          grip sleeve │
```

**Three pieces, and the camera lives at the first joint.** On a 3-piece cue the
1/3 station is already a joint, so the camera bay reuses structure that has to
exist anyway. The shaft stays a clean 9.5–14.2 mm taper with nothing bonded to
it, which matters because that is the part that has to flex predictably.

**The camera is a cartridge, and it is optional.** Twist the collar ring 28°,
a spring pushes the cartridge out 9 mm, pull it clear. Its place is taken by a
**blank slug** — a printed shell with a brass core, turned down on a scale until
it matches the camera cartridge to within 0.5 g. Blank in, and the cue plays
exactly as it did in practice, with nothing to declare on league night. That
parity is what Mode B ballast is really for: proving the camera changed nothing.

**Weight comes off the bottom.** The rubber bumper unscrews (left-hand thread,
so a hard shot tightens it), the cap stays captive, a 4 mm hex reaches a stack
of 28.3 g bolts in a **190 mm** bore. The bore is long on purpose: spreading the
adjustable mass pulls its centroid 90 mm forward and cuts the balance swing by
about a third versus a stub pocket at the very end.

**Grip goes on last and comes off again.** A split TPU sleeve springs over the
butt and is trapped by the cap shoulder — no glue, so you can play the cue bare,
print three durometers, and pick one with the cue in your hand. A moulded index
rib runs at the same clock position as the lens, so your grip hand knows which
way is up without looking.

**Tips change in 30 seconds.** A brass insert is bonded into the ferrule bore;
tips are prepared in advance as pucks — leather bonded to a 0.8 mm phenolic pad
with a 4-40 stainless stud, shaped and burnished off the cue. Printed spanner,
quarter turn, done. The shoulder locates the puck, not the thread.

---

## Drawings

All ten are generated by `python3 tools/gen_drawings.py`.

| | |
|---|---|
| [01 general arrangement](drawings/01-general-arrangement.svg) | whole cue, stations, balance, stroke clearance |
| [02 collar section](drawings/02-collar-section.svg) | how the camera station is built |
| [03 camera viewpoint](drawings/03-camera-viewpoint.svg) | what the footage actually looks like |
| [04 cartridge exploded](drawings/04-cartridge-exploded.svg) | the 25 g budget, part by part |
| [05 pop-out mechanism](drawings/05-popout-mechanism.svg) | bayonet, ejector, developed track |
| [06 butt, weight and grip](drawings/06-butt-weight-grip.svg) | weight bore, bumper, sleeve |
| [07 tip system](drawings/07-tip-system.svg) | 9.5 mm quick-change |
| [08 weight and balance](drawings/08-weight-and-balance.svg) | the chart that drives the design |
| [09 footage workflow](drawings/09-footage-workflow.svg) | card to phone |
| [10 print plates](drawings/10-print-plates.svg) | P1S layout, both materials |

---

## Getting the footage off

Card first. Twist, pop, pull the microSD, USB-C reader, phone. iOS Files and
Android SAF both mount it as a drive with no app involved, which means the path
that gets your footage off the cue cannot fail at the table.

The app is worth writing for exactly one reason: **a 40 minute card is 40
minutes of a cue lying on a table with four minutes of pool in it.** The tip
strike is an unmistakable audio transient and the gyro log rides in the same
file, so: detect strike, take 4 s before and 3 s after, that is one shot.
Everything after that is a list of clips with thumbnails. Closed source is fine
— see [docs/app.md](docs/app.md) for the licence split, since the firmware side
has constraints the app side does not.

Wi-Fi is version two, and [docs/electronics.md](docs/electronics.md) explains
why: a radio is +8 g at the 2.44:1 station, halves runtime, needs pairing at a
pub table, and sits inside a carbon tube that is doing a decent impression of a
Faraday cage. The cartridge is swappable precisely so this stays a later
decision.

---

## What I would actually do first

**Phase 0 costs about £15 and will save you several hundred.** Print the collar
barrel in PLA, fill it with 25 g of coins, tape it to your current cue 19 in
from the tip, and play twenty racks. You are answering one question: *does the
bump bother me?* No amount of drawing answers it, and every later decision
depends on it.

Then:

| Phase | What | Rough cost | Rough time |
|---|---|---|---|
| 0 | Bump mock-up on your current cue | £15 | an evening |
| 1 | Print all parts, dry-fit, no electronics | £40 | a weekend |
| 2 | Cue structure: tubes, joints, ferrule, ballast | £280–£420 | 2–3 weekends |
| 3 | Camera cartridge, RunCam path (⌀29 collar) | £90 | a weekend |
| 4 | Balance and weight to target, on a scale | £40 | an evening |
| 5 | App: import, auto-split, review | — | the long pole |
| 6 | Slim cartridge, custom PCB (⌀24 collar) | £120 + boards | months |

Full detail in [docs/build-plan.md](docs/build-plan.md).

---

## Honest risks

- **The bump.** 24 mm at a station that is normally 14 mm is a real change to
  how the cue looks and feels. Phase 0 exists for this.
- **Don't break with it.** At address the collar clears your bridge hand by
  178 mm; a normal follow-through leaves ~100 mm, but a full break
  follow-through closes it to ~28 mm. It clears — and a 9.5 mm tip is an
  unforgiving thing to break with anyway. Keep a break cue.
- **Printed parts are not structural.** Joints, ferrule, weight sleeve and
  bayonet lugs are metal, bought and bonded. PLA anywhere on this cue creeps
  under bolt preload within a month.
- **Not legal in sanctioned play**, and recording in a venue needs the venue's
  agreement and some awareness of who else is in frame. See
  [docs/rules-and-etiquette.md](docs/rules-and-etiquette.md).
- **The CAD has not been rendered.** OpenSCAD is not installed in the
  environment this was written in, so `cad/*.scad` is parametric source that has
  been checked by eye and by brace balance, not compiled. Run `make` in `cad/`
  and expect to fix a thing or two before slicing.
- **92% of the bare mass is estimated**, not weighed. The model tells you this
  when you run it. Weigh parts as they arrive and update `tools/balance.py` —
  the drawings will follow.

---

## What's in here

```
tools/balance.py        mass & balance model          python3 tools/balance.py
tools/optics.py         lens sightline check          python3 tools/optics.py
tools/gen_drawings.py   regenerates all 10 drawings   python3 tools/gen_drawings.py
tools/svgkit.py         tiny SVG writer, no deps
cad/*.scad              parametric parts, driven by cad/params.scad
cad/Makefile            make  ->  STLs (needs OpenSCAD)
drawings/*.svg          generated, do not hand-edit
docs/                   BOM, electronics, firmware, app, build plan, print settings
```

No dependencies beyond Python 3.10+. The drawing kit validates its own SVG
output, so a malformed drawing fails loudly instead of rendering blank.
