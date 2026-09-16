# Printing on the P1S

Two plates, two materials, about nine hours.

## Plate 1 — PA6-CF (or PET-CF)

Collar barrel halves, cartridge shell, nose and tail caps, butt cap, blank slug
shell, tip spanner, trim washers.

| | |
|---|---|
| Nozzle | **0.4 mm hardened** — CF eats a brass nozzle in hours |
| Nozzle temp | 280–290 °C |
| Bed | 100 °C, engineering plate, glue stick |
| Chamber | closed, top on |
| Layer | 0.16 mm |
| Walls | **6** on the collar barrel, 4 elsewhere |
| Infill | 40% gyroid |
| Cooling | 20% or off |

**Dry the filament.** 12 hours at 70 °C, and print it out of a dry box. Wet
PA6-CF produces parts that look perfect and delaminate under shock — which, on
this cue, means they fail three weeks later at the table rather than on the
plate.

PET-CF is the easier alternative: less hygroscopic, stiffer, more brittle. If
you have not printed nylon before, start there.

## Plate 2 — TPU 95A

Shock boots ×2, grip sleeves, spare bumper.

| | |
|---|---|
| Spool | **external, not the AMS** — TPU and the AMS buffer do not get along |
| Nozzle | 230 °C |
| Bed | 40 °C |
| Layer | 0.2 mm |
| Speed | **20 mm/s** and do not be tempted |
| Retraction | as short as you can get away with |
| Walls | 3 |
| Infill | 20% gyroid on the boots, 15% on the grips |

Print the grip sleeve **seam down, flat**, split facing the plate.

## Orientation, and why

- **Collar barrel** — split on the parting line, flat face down. Layer lines run
  around the barrel so the bayonet lug loads are in-plane rather than across
  layers. This is the one part where orientation actually decides whether it
  survives.
- **Cartridge shell** — upright. Slight loss of strength, but the bore comes out
  round, and round matters more here.
- **Nose cap** — window face down for a flat optical seat.
- **Butt cap** — bore up, so the bolt-stack thread is not fighting a seam.

## Never print these

Joint pins and sockets, the ferrule, the weight sleeve, the weight bolts, the
bayonet lugs in the production build. All metal, all bought, all bonded or
threaded in. A printed thread under 28 g of bolt preload plus a 500 g shock will
creep, and you will not notice until the cue rattles.

**No PLA anywhere on this cue.** It creeps under bolt preload within a month at
room temperature, and a cue lives in a car boot in the sun.

## Bonding the collar halves

1. Scuff both faces, 120 grit, and clean with IPA
2. 3M DP420 or Loctite EA 9460, thin, both faces
3. Clamp with the alignment pins seated; 24 h at room temperature
4. Then one layer of 3k carbon sleeve over the joint, wetted out with laminating
   epoxy, peel-ply and sand flush

Step 4 is not optional. The bond line is a stress riser sitting right where the
bayonet lugs pull, and the sleeve is what turns two printed halves into a part.
