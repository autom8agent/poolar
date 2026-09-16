# Build plan

Seven phases, each of which ends with something you can hold, and each of which
can be the last one if the answer it gives you is "no".

---

## Phase 0 — the bump mock-up · ~£15 · an evening

Print `cad/collar.scad` in PLA at ⌀24 and again at ⌀29. Fill each with coins to
25 g. Tape one 19 in from the tip of the cue you already own. Play twenty racks.

**The question:** does the bump bother you?

Nothing else in this document matters until you have answered it, and no drawing
can answer it for you. If ⌀29 is fine, you have just saved yourself the entire
PCB project. If even ⌀24 is intolerable, you have saved yourself £400 and found
out in one evening.

---

## Phase 1 — print everything · ~£40 · a weekend

Both plates, real materials ([print-settings.md](print-settings.md)). Bond the
collar halves. Dry-fit the cartridge, the boots, the bayonet.

**Exit criteria:** the cartridge goes in, twists, locks, and ejects 9 mm when you
twist it back. Do this a hundred times. It should not get looser.

Expect to reprint the collar at least once. `FIT` in `params.scad` is the number
you will be adjusting.

---

## Phase 2 — cue structure · £280–420 · two or three weekends

The expensive, irreversible one. Order tubes only after Phase 0.

1. Cut tubes to length, square the ends on a mitre sled
2. Bond joint 1 pin into the shaft, socket into the collar
3. Bond joint 2 hardware
4. Bond the collar to the mid tube, then sleeve the joint in 3k carbon
5. Bond the weight sleeve into the butt
6. Ream the shaft nose, bond the ferrule, bond the brass insert

**Exit criteria:** it screws together, it is straight (roll it on a flat table —
a cue that wobbles is a cue you rebuild), and it rings rather than buzzes when
you tap the butt on the floor.

Do not shortcut the adhesive. Toughened epoxy, 24 hour cure, every time.

---

## Phase 3 — camera cartridge · ~£90 · a weekend

Fast path: de-case a RunCam Thumb Pro, mount it in the ⌀29 cartridge, extend the
button and LED to the tail, bond the sapphire window with optical adhesive.

**Exit criteria:** a 30 minute recording with the cue in normal use, card pulled
and read on your phone, files intact. Then **drop the cue** — from bench height,
onto carpet — and check the file closed cleanly.

---

## Phase 4 — weight and balance · ~£40 · an evening

Now you weigh things instead of trusting my estimates.

1. Weigh every part as built. Update the tables in `tools/balance.py`.
2. `python3 tools/balance.py` — it will now tell you the truth
3. Size the forearm rod, install it in section 2
4. Load the bolt stack for your target weight
5. **Verify on a balance beam**, not on the model: rest the cue on a ruler edge
   and find the point

**Exit criteria:** target weight ±2 g, balance ±5 mm. And the blank slug matches
the camera cartridge within 0.5 g — check it by swapping and re-weighing the
whole cue, not by weighing the slug on its own.

---

## Phase 5 — the app · the long pole

[app.md](app.md) has the build order. Ship import first, use it for a week, then
do auto-split. Everything else is optional for a long time.

This is the phase that never finishes, so treat step 2 (audio auto-split) as the
real deliverable and everything after it as a bonus.

---

## Phase 6 — the slim cartridge · £120 + boards · months

Only if Phase 0 told you ⌀29 is too fat, and only after you have used the fast
path enough to know what you actually want.

Board bring-up, camera driver, SD throughput, IMU logging, power management.
Budget three board revisions; nobody gets a camera board right first time.

---

## A running checklist

- [ ] Phase 0 answered, ⌀ chosen
- [ ] Printed parts fit, bayonet cycles 100× without loosening
- [ ] Tubes cut square, joints bonded, cue rolls straight
- [ ] Ferrule and insert in, a puck threads on and seats flat
- [ ] Camera records 30 min, survives a drop, file closes clean
- [ ] Every part weighed, `balance.py` updated with real numbers
- [ ] Target weight ±2 g, balance ±5 mm, verified on an edge
- [ ] Blank slug matches cartridge within 0.5 g, checked by whole-cue weighing
- [ ] Grip sleeve chosen from three durometers, index rib aligned to the lens
- [ ] App imports from the card and splits a session into shots
