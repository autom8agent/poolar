#!/usr/bin/env python3
"""Does the lens actually see anything, or does the cue's own shaft block it?

The lens sits on the top surface of the camera collar, 11 mm above the cue
axis, 533 mm behind the tip.  Everything in front of it - 483 mm of tapering
shaft - is in the way.  This works out how far the lens may be tilted down
before its own axis buries itself in the shaft, and how much of the frame the
shaft eats.
"""
import math

LENS_X = 533.0          # mm behind the tip
LENS_R = 11.0           # mm above the cue axis (collar OD 24 -> surface at 12)
BALL_D = 57.15          # mm, a 2-1/4 in cue ball
CUE_BALL_X = 640.0      # mm in front of the lens at address
FOV_DEG = 150.0

TAPER = [(0, 9.5), (254, 10.6), (482.6, 14.2), (556, 15.3)]


def r_shaft(x: float) -> float:
    for (x0, d0), (x1, d1) in zip(TAPER, TAPER[1:]):
        if x0 <= x <= x1:
            return (d0 + (d1 - d0) * (x - x0) / (x1 - x0)) / 2
    return TAPER[-1][1] / 2


def max_down_tilt(step: float = 0.005) -> float:
    """Steepest nose-down tilt whose optical axis still clears the shaft."""
    best, t = 0.0, 0.0
    while t <= 6.0:
        if all(LENS_R - math.tan(math.radians(t)) * (LENS_X - x) >= r_shaft(x)
               for x in range(0, 483, 2)):
            best = t
        t += step
    return best


def shaft_wedge() -> tuple[float, float]:
    """Angular width of the shaft at the collar mouth and at the tip."""
    near = 2 * math.degrees(math.atan(r_shaft(482.6) / (LENS_X - 482.6)))
    far = 2 * math.degrees(math.atan(r_shaft(0) / LENS_X))
    return near, far


def report() -> str:
    tilt = max_down_tilt()
    near, far = shaft_wedge()
    ball_off = math.degrees(math.atan(LENS_R / CUE_BALL_X))
    ball_sub = 2 * math.degrees(math.atan(BALL_D / 2 / CUE_BALL_X))
    return "\n".join([
        "CueCam lens sightline check",
        "=" * 58,
        f"lens station            : {LENS_X:.0f} mm behind the tip, {LENS_R:.1f} mm off axis",
        f"max nose-down tilt      : {tilt:.2f} deg  <-- before the axis hits the shaft",
        "",
        "So the lens is mounted PARALLEL to the cue axis, not angled down.",
        "Tilting it at the table is the obvious thing to do and it is wrong:",
        "the shaft is in the way and you would be filming carbon fibre.",
        "",
        f"cue ball at address     : {ball_off:.1f} deg below the axis, "
        f"{ball_sub:.1f} deg across",
        f"                          (well inside the {FOV_DEG:.0f} deg cone)",
        f"shaft occlusion         : {near:.0f} deg wide at the collar mouth, "
        f"tapering to {far:.1f} deg at the tip",
        "",
        "That wedge is not wasted frame - it is the aiming reference. The cue",
        "points at the ball down the middle of the shot.",
    ])


if __name__ == "__main__":
    print(report())
