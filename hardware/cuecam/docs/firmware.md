# Firmware

Only relevant on the slim path — the fast path runs RunCam's own firmware and
you should leave it alone.

## What it has to do

1. Wake on a single button press, start recording within 2 seconds
2. Write 720p25–30 MJPEG to the card in segments
3. Write an IMU log alongside, sharing a timebase with the video
4. Stop on a press, sleep on a long press, and **never** leave a corrupt file
5. Tell you what it is doing with one LED

That is the whole specification. Resist everything else.

## Recording

Segment into **2 minute files**, closed and flushed each time. A cue gets
dropped, cells die, cards get pulled by people who did not wait for the LED —
segmenting means you lose at most two minutes, and it keeps individual files
small enough for a phone to import without complaint.

`SHOT_NNNN_YYYYMMDD_HHMM.avi` alongside `SHOT_NNNN.gcsv`. No RTC needed: keep a
monotonic counter in NVS and let the app assign real dates on import.

## The gyro log

`.gcsv` is what Gyroflow reads, and writing it means stabilisation is a solved
problem you do not have to solve:

```
GYROFLOW IMU LOG
version,1.3
id,cuecam
orientation,YxZ
tscale,0.001
gscale,0.00122173
ascale,0.00048828
t,gx,gy,gz,ax,ay,az
0,12,-4,3,-9,102,16
```

Sample the IMU at 200 Hz. The same log is what lets the app find tip strikes and
measure stroke yaw, so it earns its place twice.

## Shot detection happens in the app, not here

It is tempting to detect the strike on-device and only record shots. Don't:

- the strike is *already over* by the time you detect it, so you need a
  pre-roll buffer anyway
- a false negative means a missed shot, and you will never know which
- PSRAM spent on ring buffers is PSRAM not spent on frame queues

Record continuously, segment, and let the phone — which has orders of magnitude
more compute and no thermal or power limit — do the cutting.

## LED, one of them

| | |
|---|---|
| slow breathe | idle, ready |
| solid | recording |
| double blink | card full or card error |
| fast blink | battery below 10% |
| triple on wake | last file was closed cleanly |

That last one matters more than it looks: it is how you know the cue survived
being dropped in the case.

## Firmware licensing

If you build on ESP-IDF you are in Apache-2.0 territory, which is fine for a
closed product. Watch for GPL components — some camera driver forks are GPL, and
that is a constraint on the *firmware*, never on the phone app, which shares no
code with it. See [app.md](app.md).
