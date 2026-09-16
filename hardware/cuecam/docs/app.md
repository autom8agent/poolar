# PoolarCam — the phone app

You asked for footage on your phone, or a closed-source app, with an SD card and
an adapter and easy removable recordings. This is that app.

## The one job

**A 40 minute card is 40 minutes of a cue lying on a table with about four
minutes of pool in it.** Everything else the app does is housekeeping. If it
cuts a session into shots and nothing else, it is worth having.

## Import: no driver, no pairing, no MFi

microSD → USB-C reader → phone. Both platforms already mount it:

- **iOS** — `UIDocumentPickerViewController`, or a Files extension. The card
  shows up as a normal location. No MFi programme, no accessory framework.
- **Android** — Storage Access Framework, `ACTION_OPEN_DOCUMENT_TREE`, scoped to
  the card's root.

The user picks the card once and the app remembers the bookmark. That is the
whole ingest path, and there is nothing in it that can fail at a pub table.

## Auto-split: the part worth writing

Two signals, both already in the files:

**Audio.** The tip strike is a sharp, broadband transient with a very fast
attack — one of the easiest onsets in audio. High-pass at 2 kHz, take the
envelope, threshold against a rolling median, require 800 ms between strikes.
Cheap enough to run faster than realtime on any phone from the last five years.

**Gyro.** The `.gcsv` says what the cue was doing. Backswing is a low-frequency
yaw reversal; the strike is a spike across all three axes. Use it to reject
false positives — the chalk tap, the cue knocking the rail, someone else's break
on the next table.

Combine: a strike confirmed by both gets cut with **4 s before and 3 s after**.
A strike on audio alone goes in a "probably" bucket rather than the bin.

## What the user sees

1. **Sessions** — date, table, clip count, a thumbnail
2. **Shots** — a strip of clips, scrubbable, swipe to keep or bin
3. **One shot** — play, frame step, and the aim overlay from this repo's solver
   drawn on top
4. **Export** — share sheet, or write back to the card

Four screens. Every feature after that has to fight for its place.

## Where it meets the rest of this repo

The aim solver in the root of this repository already does ghost-ball, tangent
and cushion prediction from a camera frame. That code was written for an
overhead view, but the geometry is the same problem from a different matrix —
the cue-mounted view actually makes cue direction *easier*, because the shaft is
right there in frame and its vanishing direction is the aim line.

So the natural split is: overhead camera for *where the balls are*, cue camera
for *what you did about it*.

## Licensing: closed app, and what constrains it

The phone app can be closed source with no complications — it shares no code
with anything here, and it talks to the camera through a filesystem, which is
not a derivative work of anything.

Two things to keep straight if you sell it:

- **Firmware** may pull in GPL camera drivers (see [firmware.md](firmware.md)).
  That constrains the firmware only. Keeping the app's only interface a file
  format is what keeps that boundary clean and obvious.
- **This hardware folder** is part of an open repository. If you want the CAD
  and the models private, take them out before you publish the app, and decide
  that now rather than after a release.

If you use Gyroflow's stabilisation *library* rather than just its file format,
check its licence — the format is free to write, the implementation may not be
free to link.

## Build order

1. Import + list files from the card. Ship nothing else. Use it for a week.
2. Audio-only auto-split. This is the moment the app becomes worth having.
3. Gyro confirmation, to kill false positives.
4. Keep/bin review, and delete from the card.
5. Aim overlay.
6. Stabilisation.

Steps 1 and 2 are most of the value. Do not start at step 5.
