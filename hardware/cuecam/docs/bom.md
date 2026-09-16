# Bill of materials

Prices are rough UK retail, autumn 2025, for a single cue. Nothing here is
exotic; the expensive line is always the tubes.

## Cue structure

| # | Part | Spec | Qty | ~£ | Notes |
|---|---|---|---|---|---|
| 1 | Shaft tube | CF, 14.2 → 9.5 mm taper, 483 mm | 1 | 95 | Buy a finished taper. Do not try to taper a parallel tube. |
| 2 | Mid tube | CF, 21.9 → 15.7 mm, 495 mm, 1.2 mm wall | 1 | 45 | |
| 3 | Butt tube | CF, 29.5 → 21.9 mm, 495 mm, 1.4 mm wall | 1 | 55 | |
| 4 | Joint 1 pin + socket | 3/8-10 radial, Ti pin / 6061 socket | 1 set | 38 | Pin in shaft, socket bonded into the collar |
| 5 | Joint 2 pin + collar | stainless, 5/16-14 or 3/8-10 | 1 set | 30 | |
| 6 | Ferrule | carbon-loaded, ⌀9.5 × 13 mm, 6.3 mm bore | 1 | 9 | |
| 7 | Brass tip insert | 4-40 UNC, ⌀6.2 | 1 | 4 | Bonded into the ferrule |
| 8 | Tip pucks | 9.5 mm layered leather + 0.8 mm phenolic + 4-40 stud | 3 | 24 | Prepare off the cue |
| 9 | Weight sleeve | steel, 5/16-14 tapped, 190 mm | 1 | 22 | Bonded into the butt tube |
| 10 | Weight bolts | 5/16-14 steel, 28.3 g | 6 | 18 | One ounce each |
| 11 | Trim slugs | 4 / 8 / 14 g | 2 ea | 8 | Between-ounce adjustment |
| 12 | Forearm ballast rod | M6 studding + slugs, in section 2 | 1 | 12 | Mode B only |
| 13 | Rubber bumper | M12×1 **left hand** | 1 | 5 | |
| 14 | Structural adhesive | 3M DP420 or Loctite EA 9460 | 1 | 22 | Toughened epoxy. Not CA, not 5-minute. |
| 15 | Carbon sleeve | 3k braided, 25 mm, 0.5 m | 1 | 14 | Over the collar bond line |
| | | | | **~£396** | |

## Camera cartridge — fast path (⌀29 collar)

| # | Part | Spec | Qty | ~£ |
|---|---|---|---|---|
| 20 | Camera | RunCam Thumb Pro, de-cased | 1 | 78 |
| 21 | microSD | 64 GB A2 V30 | 1 | 9 |
| 22 | LiPo | 402040, 400 mAh, protected | 1 | 7 |
| 23 | Sapphire window | 6 × 4 × 0.8 mm | 1 | 6 |
| 24 | Optical adhesive | Norland NOA61 or equivalent | 1 | 14 |
| | | | | **~£114** |

De-casing voids the warranty and the camera is then only as waterproof as your
collar. Weigh it before and after; the model assumes 9.8 g for the board stack.

## Camera cartridge — slim path (⌀24 collar)

| # | Part | Spec | Qty | ~£ |
|---|---|---|---|---|
| 30 | MCU | ESP32-S3-WROOM-1-N16R8 | 1 | 6 |
| 31 | Sensor | OV5640 on 16 mm-wide flex carrier | 1 | 12 |
| 32 | Lens | M12, 150°, IR-cut, f/2.0 | 1 | 9 |
| 33 | microSD socket | push-push, SMD | 1 | 2 |
| 34 | IMU | LSM6DSO, for the gyro log | 1 | 4 |
| 35 | Charger + protection | TP4057 + DW01 | 1 | 3 |
| 36 | PCB | 16 × 58 mm, 4 layer, ENIG | 5 | 40 |
| 37 | LiPo | 402040, 400 mAh | 1 | 7 |
| | | | | **~£83 + assembly** |

See [electronics.md](electronics.md) before ordering any of this — the slim path
is a real PCB project and buys you 5 mm of collar diameter, nothing else.

## Hardware for the pop-out

| # | Part | Spec | Qty | ~£ |
|---|---|---|---|---|
| 40 | Bayonet lug pins | ⌀2 × 4 mm, 303 stainless | 2 | 2 |
| 41 | Ejector spring | 0.5 mm music wire, 6 mm OD, 14 mm free | 1 | 2 |
| 42 | Detent ball + spring | ⌀2.5 mm | 1 | 2 |
| 43 | PTFE vent membrane | ⌀3 mm adhesive patch | 1 | 3 |

## Filament

| Part | Material | ~g |
|---|---|---|
| Collar, cartridge, caps, slug, spanner | PA6-CF or PET-CF | 90 |
| Shock boots, grip sleeves, spare bumper | TPU 95A | 120 |

One 1 kg spool of each covers many iterations, which you will want.

## Tools you need and might not have

- Digital scale reading to 0.1 g — **not optional**, the whole design is a mass
  budget
- 4 mm hex key, a 9.5 mm reamer, 4-40 tap
- Dry box or filament dryer for the nylon
- Hardened 0.4 mm nozzle for the P1S (CF filament eats brass in hours)
