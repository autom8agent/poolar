# Electronics

The cartridge has to do four things: see, record, survive, and get out of the
way. In that order.

## The envelope is the spec

Everything else follows from one number: the cartridge's **widest** dimension
sets the collar diameter, and the collar diameter is what you feel when you
play.

```
collar OD  =  widest electronics dimension  +  2 × 1.2 (shell)
                                            +  2 × 1.2 (TPU boot)
                                            +  2 × 2.0 (barrel wall)
                                            ≈  widest + 8.8 mm
```

So a 16 mm-wide board gives ⌀24.8 (we round to 24 by letting the boot ribs
crush), and a 19 mm one gives ⌀29. **A long, thin board is not a style choice.**

Budget: **25 g**, because at 2.44 g of cue per gram of camera, 25 g is already
61 g of finished weight.

| | mass |
|---|---|
| shell + caps | 5.1 g |
| TPU boots ×2 | 2.1 g |
| board + sensor + lens | 7.2 g |
| cell, 400 mAh | 8.1 g |
| card + retainer | 0.9 g |
| wiring | 1.4 g |
| **total** | **24.8 g** |

## Two paths

### Fast path — RunCam Thumb Pro, de-cased

Buy the camera, take the case off, drop the board stack into a ⌀29 cartridge.
You get 4K30, a usable lens, and — the part that matters — **gyro logging that
Gyroflow already understands**, which means stabilised footage and a free read
of stroke yaw.

Downsides: ⌀29 collar, the shutter button and LED need extending to the
cartridge tail, and you own the thermals now that the case is gone.

Build this one first. It is a weekend, and it tells you whether the whole idea
is worth a PCB project.

### Slim path — custom board

16 × 58 mm, four layers, components on one side so the board stands on edge in
a 19 mm bore.

- **ESP32-S3-WROOM-1-N16R8** — 8 MB PSRAM is the reason; without it you cannot
  hold frames while writing to the card
- **OV5640** on a 16 mm flex carrier, **M12 150°** lens, IR-cut
- **microSD, push-push, SDIO 4-bit** — 1-bit SPI will not keep up
- **LSM6DSO** IMU for the gyro log, written alongside the video as `.gcsv`
- **TP4057 + DW01** charge and protection, USB-C on the cartridge tail

Be realistic about what an S3 can do: **1280×720 at 25–30 fps MJPEG** is the
honest target. It is not 4K and it never will be. For watching your own stroke
that is plenty; if you want pretty footage, stay on the fast path.

If you want more than that in this envelope you are looking at a dedicated DVR
SoC, and at that point you are designing a camera rather than a cue.

## Power

A 402040 cell is 400 mAh in 4 × 20 × 40 mm and 8.1 g. Expect **45–70 minutes**
of recording on the slim path, less on the fast path.

Charging is USB-C on the cartridge tail — pop the cartridge, plug it in. Which
means the cue is never plugged into anything, and there is no connector on the
cue to fill with chalk.

Rules for the cell, learned the expensive way:

- It sits in a **captive pocket**, never on tape. Tape creeps, then the cell
  moves 500 g at a time.
- **Protected cell only.** A puncture inside a sealed carbon tube against your
  hands is the one genuinely dangerous failure mode in this project.
- Never charge it inside the cue.
- Check it after any drop, and bin it if the pouch has swelled at all.

## Shock

Every shot is roughly a **500 g axial spike** (7 → 2 m/s in about a
millisecond). Design rules that follow:

1. Connectors face **radially**, not axially — an axial connector unseats itself.
2. The cell and the card are **retained**, not friction-fitted.
3. The board is supported along its **length**, not cantilevered off one end.
4. The TPU boot's crush ribs set the preload; the wall is just a wall.
5. Anything socketed gets a dab of silicone. Anything soldered gets strain
   relief.

## Why Wi-Fi is version two

Streaming to the phone sounds better and is worse:

- a radio is **+8 g** at the camera station, so **+20 g** of finished cue
- it roughly halves runtime on a 400 mAh cell
- it needs pairing, at a pub table, on someone else's crowded 2.4 GHz
- and it puts a transmitter inside a carbon tube, which is a fair approximation
  of a Faraday cage — the antenna has to live in a printed window in the collar,
  which is another hole in the part that carries the bayonet lugs

The card path needs none of that and cannot fail at the table. The cartridge is
swappable precisely so this can be a later decision rather than a founding one.
