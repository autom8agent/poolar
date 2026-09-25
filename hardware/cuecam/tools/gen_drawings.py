#!/usr/bin/env python3
"""Generate the CueCam technical drawing set as SVG.

    python3 gen_drawings.py [outdir]     # default ../drawings
"""
import json
import os
import subprocess
import sys

from svgkit import (Svg, INK, DIM, HAIR, FAINT, BLUE, MAGENTA, GREEN, AMBER,
                    RED, STEEL, CF, PAPER)

MM = 25.4
CUE_LEN = 1473.2
JOINT1 = 482.6
JOINT2 = 977.9

# (x_mm, diameter_mm) - the base taper, pod bulge added on top
TAPER = [(0, 9.5), (254, 10.6), (JOINT1, 14.2), (556, 15.3), (JOINT2, 21.9),
         (CUE_LEN, 29.5)]

POD_FRONT, POD_BACK = JOINT1, 600.0
POD_OD = 24.0
BAY_FRONT, BAY_BACK = 500.0, 570.0


def dia(x):
    for (x0, d0), (x1, d1) in zip(TAPER, TAPER[1:]):
        if x0 <= x <= x1:
            return d0 + (d1 - d0) * (x - x0) / (x1 - x0)
    return TAPER[-1][1]


def pod_dia(x):
    """Outer profile of the camera collar, blended into the taper."""
    def blend(t):
        t = max(0.0, min(1.0, t))
        return t * t * t * (t * (t * 6 - 15) + 10)      # smootherstep = fair curve
    if x < JOINT1 or x > POD_BACK:
        return dia(x)
    if x <= 512:                                        # front lead-in, 29 mm
        return 14.2 + (POD_OD - 14.2) * blend((x - JOINT1) / (512 - JOINT1))
    if x <= 562:                                        # parallel over the bay
        return POD_OD
    return POD_OD + (dia(POD_BACK) - POD_OD) * blend((x - 562) / (POD_BACK - 562))


# ==========================================================================
# 01  general arrangement
# ==========================================================================
def d01(out):
    W, H = 1700, 660
    s = Svg(W, H, "CueCam 01 - general arrangement",
            "3-piece carbon cue, 58 in / 1473 mm, 9.5 mm tip. "
            "Length to scale; diameters exaggerated 4.2x for legibility.")
    x0, sx, k, cy = 62, (W - 124) / CUE_LEN, 4.2, 318

    def px(x):  return x0 + x * sx
    def py(d, up=True): return cy - d / 2 * k if up else cy + d / 2 * k

    # ---- shaded activity zones -----------------------------------------
    s.rect(px(203), cy - 96, px(305) - px(203), 192, fill="#fff4e2")
    s.text((px(203) + px(305)) / 2, cy - 104, "bridge hand", size=11,
           fill=AMBER, anchor="middle", font_weight="700")
    s.rect(px(1150), cy - 96, px(1400) - px(1150), 192, fill="#eef4ff")
    s.text((px(1150) + px(1400)) / 2, cy - 104, "grip sleeve", size=11,
           fill=BLUE, anchor="middle", font_weight="700")

    # ---- cue body -------------------------------------------------------
    xs = [i for i in range(0, int(CUE_LEN) + 1, 4)]
    top = [(px(x), py(dia(x))) for x in xs]
    bot = [(px(x), py(dia(x), False)) for x in reversed(xs)]
    s.poly(top + bot, fill="url(#cf)", stroke=INK, sw=1.1)

    d = dia(JOINT2)
    s.rect(px(JOINT2) - 2.5 * sx, py(d), 5 * sx, d * k, fill="url(#alu)",
           stroke=INK, sw=1)

    # ---- camera collar --------------------------------------------------
    pxs = [i for i in range(int(POD_FRONT), int(POD_BACK) + 1, 2)]
    ptop = [(px(x), py(pod_dia(x))) for x in pxs]
    pbot = [(px(x), py(pod_dia(x), False)) for x in reversed(pxs)]
    s.poly(ptop + pbot, fill="url(#cf2)", stroke=BLUE, sw=1.6)
    s.line(px(JOINT1), py(pod_dia(JOINT1)), px(JOINT1), py(pod_dia(JOINT1), False),
           stroke="#dfe6f2", sw=1.4)
    # lens
    s.circle(px(508), py(POD_OD) + 7, 6.5, fill="#0b1220", stroke=BLUE, sw=1.6)
    s.circle(px(508), py(POD_OD) + 7, 2.6, fill=BLUE)
    # cartridge bay outline
    s.rect(px(BAY_FRONT), py(18), (BAY_BACK - BAY_FRONT) * sx, 18 * k,
           fill="none", stroke=MAGENTA, sw=1.3, stroke_dasharray="5 4")

    # ---- tip / ferrule --------------------------------------------------
    s.rect(px(0), py(9.5), 9 * sx, 9.5 * k, fill="#f2e7cf", stroke=INK, sw=1)
    s.rect(px(0), py(9.5), 2.5 * sx, 9.5 * k, fill="#6b4f2a", stroke=INK, sw=1)
    # bumper
    s.rect(px(1466), py(29.5), 8 * sx, 29.5 * k, fill="#22262e", stroke=INK, sw=1)

    s.centreline(px(-2), cy, px(CUE_LEN + 4))

    # ---- balance fulcrum ------------------------------------------------
    bx = px(1003.3)
    s.poly([(bx, cy + 68), (bx - 13, cy + 94), (bx + 13, cy + 94)],
           fill=GREEN, stroke="none")
    s.text(bx, cy + 112, "balance 18.5 in", size=11.5, fill=GREEN, anchor="middle",
           font_weight="700")
    s.text(bx, cy + 127, "from butt face", size=11.5, fill=GREEN, anchor="middle")

    # ---- diameter callouts ----------------------------------------------
    for x, lbl, col in ((4, "⌀8.5 tip", INK), (JOINT1 - 6, "⌀14.2", INK),
                        (534, "⌀24.0 collar", BLUE), (JOINT2, "⌀21.9", INK),
                        (1455, "⌀29.5", INK)):
        lbl = lbl.replace("⌀8.5", "⌀9.5")
        s.leader(px(x), py(pod_dia(x) if POD_FRONT <= x <= POD_BACK else dia(x)) - 2,
                 px(x), 168 if x < 700 else 150, lbl, colour=col, anchor="middle")

    # ---- station dimensions ---------------------------------------------
    yd = cy + 168
    s.dim_h(px(0), px(JOINT1), yd, "482.6 mm / 19.0 in   (one third from the tip)")
    s.dim_h(px(JOINT1), px(JOINT2), yd, "495.3 mm / 19.5 in")
    s.dim_h(px(JOINT2), px(CUE_LEN), yd, "495.3 mm / 19.5 in")
    s.dim_h(px(0), px(CUE_LEN), yd + 46, "1473.2 mm / 58.0 in overall")

    for x in (0, JOINT1, JOINT2, CUE_LEN):
        s.line(px(x), cy + 100, px(x), yd - 8, stroke=HAIR, sw=0.8,
               stroke_dasharray="3 3")

    # ---- section labels --------------------------------------------------
    for a, b, t in ((0, JOINT1, "SECTION 1  shaft"),
                    (JOINT1, JOINT2, "SECTION 2  camera collar + forearm"),
                    (JOINT2, CUE_LEN, "SECTION 3  butt + weight bore")):
        s.text((px(a) + px(b)) / 2, cy - 132, t, size=12.5, fill=INK,
               anchor="middle", font_weight="700")

    # ---- stroke clearance note -------------------------------------------
    s.panel(px(150), H - 118, 690, 92, "Stroke clearance at the collar")
    s.note(px(150) + 12, H - 78, [
        "Rear of bridge hand sits 203-305 mm from the tip. Collar front face is at 482.6 mm,",
        "so at address there is 178 mm of clearance. A normal follow-through (50-80 mm) leaves",
        "~100 mm; a full break follow-through (~150 mm) closes it to ~28 mm. It clears - but break",
        "with a different cue. See docs/ergonomics.md."], colour=DIM, lh=15)

    s.panel(1010, H - 118, 650, 92, "Why the collar is where it is")
    s.note(1022, H - 78, [
        "The 1/3 station is already a joint on a 3-piece cue, so the camera bay reuses",
        "structure that has to exist anyway. The shaft stays a clean 9.5-14.2 mm taper with",
        "nothing bonded to it, and the lens sits far enough back to see the tip, the cue ball",
        "and the object ball in one 150 deg frame."], colour=DIM, lh=15)
    return s.save(os.path.join(out, "01-general-arrangement.svg"))




# ==========================================================================
# 02  camera collar, longitudinal section
# ==========================================================================
def d02(out):
    W, H = 1580, 840
    s = Svg(W, H, "CueCam 02 - camera collar, longitudinal section",
            "Section through the 1/3 station, scale 7:1. Cartridge shown home and "
            "locked. Tip is off-sheet to the left.")
    sc, x0, cy = 7.0, 330, 405
    def px(x): return x0 + (x - 470) * sc
    def py(r): return cy - r * sc
    LCOL, RCOL = 300, 1268

    # ---- collar barrel, sectioned ---------------------------------------
    xs = list(range(470, int(POD_BACK) + 3, 2))
    for sign in (1, -1):
        outer = [(px(x), cy - sign * pod_dia(x) / 2 * sc) for x in xs]
        inner = []
        for x in reversed(xs):
            r = max(pod_dia(x) / 2 - 2.0, 5.2)
            if BAY_FRONT - 7 <= x <= BAY_BACK + 6:
                r = 9.6
            inner.append((px(x), cy - sign * r * sc))
        s.poly(outer + inner, fill="url(#hatch)", stroke=INK, sw=1.4)
    s.centreline(px(466), cy, px(POD_BACK + 6))
    s.text(px(468), cy - 6, "◀ to tip", size=11, fill=HAIR, anchor="end")

    # ---- joint 1 female socket ------------------------------------------
    s.rect(px(471), py(9.4), 19 * sc, 18.8 * sc, fill="url(#alu)", stroke=INK, sw=1.2)
    s.rect(px(473), py(4.9), 13 * sc, 9.8 * sc, fill=PAPER, stroke=INK, sw=1)
    for i in range(9):
        s.line(px(473.5 + i * 1.5), py(4.9), px(474.6 + i * 1.5), py(-4.9),
               stroke=INK, sw=0.7)

    # ---- cartridge -------------------------------------------------------
    cf, cb = BAY_FRONT + 1, BAY_BACK - 1
    s.rect(px(cf), py(9.0), (cb - cf) * sc, 18 * sc, fill="#fdf1f9",
           stroke=MAGENTA, sw=1.7, rx=5)
    s.rect(px(cf + 1.3), py(7.7), (cb - cf - 2.6) * sc, 15.4 * sc, fill="#ffe4f5",
           stroke=MAGENTA, sw=1, rx=4, stroke_dasharray="4 3")
    s.rect(px(cf + 3.5), py(0.9), 46 * sc, 1.8 * sc, fill="#0e9c58", stroke=INK, sw=0.8)
    s.rect(px(cf + 4.5), py(6.6), 9 * sc, 5.8 * sc, fill="#20293a", stroke=INK, sw=1)
    # lens barrel - axis PARALLEL to the cue axis, see tools/optics.py
    s.rect(px(cf + 0.6), py(12.2), 6.0 * sc, 5.0 * sc, fill="#2b3648",
           stroke=INK, sw=1)
    s.rect(px(cf - 0.7), py(12.0), 1.6 * sc, 4.6 * sc, fill="#cfe4ff",
           stroke=BLUE, sw=1.6)
    # optical axis, and the shaft tangent that constrains how far it may tilt
    s.line(px(cf + 1), py(9.7), px(472), py(9.7), stroke=BLUE, sw=1.4,
           stroke_dasharray="9 5")
    s.line(px(cf + 1), py(9.7), px(472), py(9.7) + 4, stroke=RED, sw=1.1,
           stroke_dasharray="4 4")
    s.text(px(472) + 6, py(9.7) - 9, "optical axis", size=10.5, fill=BLUE)
    s.text(px(472) + 6, py(9.7) + 22, "0.67° tilt limit", size=10.5, fill=RED)

    s.rect(px(cf + 28), py(-1.0), 26 * sc, 5.6 * sc, fill="#e8eefc", stroke=INK, sw=1)
    s.text(px(cf + 41), py(-3.2), "LiPo", size=10, fill=DIM, anchor="middle")
    s.rect(px(cb - 19), py(5.0), 14 * sc, 2.4 * sc, fill="#f6f0d8", stroke=INK, sw=1)

    # ---- bayonet ring + ejector spring ------------------------------------
    s.rect(px(571), py(11.0), 8 * sc, 22 * sc, fill="url(#hatch2)", stroke=INK, sw=1.3)
    s.path(f"M{px(cb):.1f},{py(6.6):.1f} " + " ".join(
        f"l{1.4*sc:.1f},{(-2.2 if i % 2 == 0 else 2.2)*sc:.1f}" for i in range(8)),
        stroke=INK, sw=1.6)
    s.circle(px(577), py(-8.6), 2.6, fill=PAPER, stroke=INK, sw=1.1)

    # ---- callouts ---------------------------------------------------------
    left = [
        (474, py(6.0), ["joint 1 female socket",
                        "6061, 3/8-10 radial pin"]),
        (cf + 0.1, py(14.3), ["sapphire window 6 x 4 x 0.8",
                              "bonded flush with the barrel"]),
        (cf + 3.5, py(14.7), ["1/4\" sensor + M12 lens, 150°",
                              "axis PARALLEL to the cue - max",
                              "down-tilt 0.67° before the shaft",
                              "blocks it (tools/optics.py)"]),
        (cf + 22, py(1.8), ["camera PCB, 16 mm wide", "long-and-thin is what keeps",
                            "the collar down to ⌀24"]),
    ]
    ys = [138, 224, 320, 440]
    for (x, y, txt), ty in zip(left, ys):
        s.elbow(px(x), y, LCOL, ty, txt, side="left", weight="700")

    right = [
        (cf + 52, py(7.7), ["TPU 95A shock boot", "1.2 mm wall, 20% gyroid"]),
        (cf + 41, py(1.8), ["LiPo 402040, 400 mAh", "captive pocket - never taped"]),
        (cb - 12, py(6.2), ["microSD, push-push", "+ printed retainer clip"]),
        (575, py(11.0), ["bayonet ring + ejector", "spring - see drawing 05"]),
        (577, py(-8.6), ["0.8 mm vent, PTFE membrane", "stops the pod pumping dust"]),
    ]
    ys = [150, 236, 322, 408, 494]
    for (x, y, txt), ty in zip(right, ys):
        s.elbow(px(x), y, RCOL, ty, txt, side="right", weight="700")

    # ---- dimensions --------------------------------------------------------
    s.leader(px(566), py(-POD_OD / 2), px(566), cy + 122, "⌀24.0 collar OD",
             colour=BLUE, anchor="middle")
    s.leader(px(516), cy + 9.6 * sc, px(455), cy + 122, "⌀19.2 bore",
             anchor="middle")
    s.dim_h(px(JOINT1), px(POD_BACK), cy + 168, "117.4 mm collar length")
    s.dim_h(px(BAY_FRONT), px(BAY_BACK), cy + 204, "70.0 mm cartridge bay")

    s.panel(x0 - 30, H - 164, 690, 130, "Collar diameter is the whole design fight")
    s.note(x0 - 18, H - 106, [
        "The cue is only ⌀14.2 mm at this station, so any camera makes a bump. How big",
        "is set by the WIDEST dimension of the electronics, not by the sensor:",
        "    16 mm custom PCB, stood on edge   →  ⌀24.0 mm collar   (this drawing)",
        "    19 mm RunCam Thumb Pro, de-cased  →  ⌀29.0 mm collar   (fast path)",
        "    21 mm cased action camera        →  ⌀33 mm - unplayable, don't",
        "POD_OD is a parameter in cad/collar.scad. Print whichever you are building."],
        colour=DIM, lh=16)

    s.panel(x0 + 690, H - 164, 540, 130, "Shock case")
    s.note(x0 + 702, H - 106, [
        "Tip-to-ball contact lasts about 1 ms and takes the cue from",
        "~7 m/s to ~2 m/s. That is roughly 500 g of axial deceleration,",
        "every shot, thousands of times. Nothing in the cartridge is",
        "held by tape or friction: the cell sits in a captive pocket, the",
        "card is retained, and the whole cartridge floats on the TPU boot.",
        "Bayonet lugs take the load in shear, not the detent."],
        colour=DIM, lh=16)
    return s.save(os.path.join(out, "02-collar-section.svg"))


# ==========================================================================
# 03  what the camera actually sees
# ==========================================================================
def d03(out):
    import math
    W, H = 1580, 760
    s = Svg(W, H, "CueCam 03 - camera viewpoint",
            "Left: FOV geometry in plan. Right: simulated frame with the Pool AR "
            "overlay drawn on top.")

    # ---------------- left: plan geometry --------------------------------
    s.panel(40, 92, 720, 560, "Plan view - lens at 533 mm behind the tip, 150° FOV")
    ox, oy, k = 700, 380, 0.50      # table mm -> px, cue pointing left
    lens = (ox - 0 * k, oy)
    tip = (ox - 533 * k, oy)
    cue_ball = (ox - 640 * k, oy)
    obj_ball = (ox - 1180 * k, oy - 300 * k)

    with s.clip(44, 122, 712, 526):
        s.wedge(lens[0], lens[1], 780, 105, 255, fill=BLUE, stroke=BLUE,
                opacity=0.10)
    s.text(lens[0] - 210, oy - 148, "150° horizontal FOV", size=11.5, fill=BLUE,
           anchor="middle")

    s.line(lens[0], oy, tip[0] - 40, oy, stroke=CF, sw=7)
    s.line(lens[0] - 8, oy, lens[0] + 40, oy, stroke=CF, sw=11)
    s.circle(lens[0] - 2, oy - 9, 5, fill=BLUE, stroke=INK, sw=1)
    s.text(lens[0] + 52, oy + 4, "collar", size=11, fill=DIM)

    for c, r, fill, lbl in ((cue_ball, 57.15 / 2 * k, "#ffffff", "cue ball"),
                            (obj_ball, 57.15 / 2 * k, "#f0c419", "object ball")):
        s.circle(c[0], c[1], r, fill=fill, stroke=INK, sw=1.4)
        s.text(c[0], c[1] - r - 8, lbl, size=11, fill=DIM, anchor="middle")
    s.line(cue_ball[0], cue_ball[1], obj_ball[0], obj_ball[1], stroke=MAGENTA,
           sw=1.6, stroke_dasharray="7 5")

    s.dim_h(tip[0], lens[0], oy + 150, "533 mm lens setback")
    s.note(60, 578, [
        "At 533 mm the lens sees the last 0.5 m of shaft, the cue ball and a wide cone of",
        "table beyond it. Closer to the tip and the shaft fills the frame; further back and",
        "the tip leaves frame on a long follow-through.",
        "",
        "The shaft itself eats a wedge 16° wide at the collar, narrowing to 1° at the tip -",
        "a tapering spike up the middle of the shot. That spike IS the aiming reference."],
        colour=DIM)

    # ---------------- right: simulated frame ------------------------------
    fx, fy, fw, fh = 800, 92, 740, 440
    s.panel(fx, fy, fw, fh, None, fill="#0c5c3a", stroke=INK)
    s.text(fx, fy - 10, "Simulated 1080p frame, barrel distortion of a 150° lens",
           size=12.5, weight="700", fill=INK)
    # cloth vignette
    s.rect(fx + 2, fy + 2, fw - 4, fh - 4, fill="#0a5334", rx=6)
    # cushion
    s.path(f"M{fx+2},{fy+96} Q{fx+fw/2},{fy+40} {fx+fw-2},{fy+96} "
           f"L{fx+fw-2},{fy+2} L{fx+2},{fy+2} Z", fill="#0d3f6b", stroke="none")
    s.text(fx + fw / 2, fy + 34, "far cushion + pocket", size=11, fill="#9fc6ee",
           anchor="middle")
    s.circle(fx + 150, fy + 74, 17, fill="#06121f", stroke="#0d3f6b", sw=2)

    # shaft, fisheye-curved, entering bottom of frame
    s.path(f"M{fx+300},{fy+fh} Q{fx+352},{fy+300} {fx+372},{fy+205}",
           stroke="#11161f", sw=54, fill="none", stroke_linecap="round")
    s.path(f"M{fx+300},{fy+fh} Q{fx+352},{fy+300} {fx+372},{fy+205}",
           stroke="#2b3444", sw=30, fill="none", stroke_linecap="round")
    s.circle(fx + 374, fy + 198, 10, fill="#e8dcc0", stroke="#11161f", sw=2)
    s.text(fx + 300, fy + fh - 40, "own shaft + tip", size=11, fill="#cfe0d6",
           anchor="middle")

    # balls
    s.circle(fx + 374, fy + 172, 26, fill="#fbfbf7", stroke="#2a2a2a", sw=1.4)
    s.circle(fx + 366, fy + 164, 8, fill="#ffffff", opacity="0.85")
    s.circle(fx + 232, fy + 128, 19, fill="#f0c419", stroke="#2a2a2a", sw=1.4)
    s.circle(fx + 540, fy + 140, 19, fill="#c0392b", stroke="#2a2a2a", sw=1.4)

    # overlay in the app's colours
    s.line(fx + 374, fy + 172, fx + 232, fy + 128, stroke="#3a7bff", sw=3,
           opacity="0.95")
    s.circle(fx + 252, fy + 135, 26, fill="none", stroke="#3a7bff", sw=2.4,
             stroke_dasharray="6 4")
    s.line(fx + 232, fy + 128, fx + 150, fy + 82, stroke="#ff3df0", sw=2.6)
    s.circle(fx + 150, fy + 74, 20, fill="none", stroke="#39ff88", sw=2.6)
    s.text(fx + 16, fy + fh - 16, "overlay rendered by the Pool AR engine in this repo",
           size=11, fill="#9ad9b4")

    s.panel(800, 560, 740, 140, "Why this viewpoint is worth having")
    s.note(812, 592, [
        "A ceiling or tripod camera sees the table but not your stroke. This one sees the",
        "cue, the tip, the cue ball and the line - from the only place that shows whether",
        "the cue went straight through the ball or steered off it. Frame-to-frame lens",
        "motion is also a direct read of stroke yaw, which is the single hardest fault",
        "to self-diagnose. The gyro log lands in the same file as the video.",
    ], colour=DIM, lh=17)
    return s.save(os.path.join(out, "03-camera-viewpoint.svg"))


# ==========================================================================
# 04  cartridge, exploded
# ==========================================================================
def d04(out):
    W, H = 1580, 700
    s = Svg(W, H, "CueCam 04 - camera cartridge, exploded",
            "The whole camera is one removable cartridge. A mass-matched blank "
            "slug takes its place so the cue plays identically either way.")
    y = 300
    items = [
        ("nose cap\n+ window", 110, 74, 46, "#cfe4ff", BLUE, "1.6 g"),
        ("TPU shock\nboot, front", 226, 66, 52, "#ffe4f5", MAGENTA, "1.0 g"),
        ("camera PCB\n16 x 58 mm", 372, 150, 26, "#d8f3e4", GREEN, "7.2 g"),
        ("LiPo 402040\n400 mAh", 560, 78, 44, "#e8eefc", INK, "8.1 g"),
        ("microSD +\nretainer", 700, 40, 30, "#f6f0d8", AMBER, "0.9 g"),
        ("TPU shock\nboot, rear", 806, 66, 52, "#ffe4f5", MAGENTA, "1.1 g"),
        ("cartridge\nshell", 930, 120, 62, "#f4f6fa", INK, "4.4 g"),
        ("tail cap +\nbayonet lugs", 1110, 56, 58, "#e7ebf2", STEEL, "0.7 g"),
    ]
    # assembly axis and envelope go down first, so nothing draws over a label
    s.rect(96, y - 52, 1046, 104, fill="none", stroke=DIM, sw=1.1,
           stroke_dasharray="9 6", rx=10)
    for a, b in zip(items, items[1:]):
        s.line(a[1] + a[2] / 2 + 6, y, b[1] - b[2] / 2 - 6, y, stroke=HAIR,
               sw=1.1, stroke_dasharray="5 4")
    for label, cx, w, h, fill, stroke, mass in items:
        s.rect(cx - w / 2, y - h / 2, w, h, fill=fill, stroke=stroke, sw=1.6, rx=6)
        for i, ln in enumerate(label.split("\n")):
            s.text(cx, y + 80 + i * 15, ln, size=11.5, fill=INK, anchor="middle",
                   weight="700" if i == 0 else "400")
        s.text(cx, y - 68, mass, size=11, fill=DIM, anchor="middle")
    s.text(1172, y + 4, "→ into the collar bore", size=12, fill=DIM, weight="700")

    pen = _model()["pod_penalty_g_per_g"]
    s.panel(40, 452, 740, 210, "Total cartridge mass: 25.0 g")
    s.note(56, 490, [
        "25 g at the 1/3 station is not 25 g of cue. The station is 470 mm ahead of the",
        f"balance point, so holding the balance costs another {pen:.2f} g of butt ballast",
        f"per gram up front - {25 * (1 + pen):.0f} g of finished cue weight for a 25 g camera.",
        "",
        "That lever is the reason the cartridge is a mass budget rather than a parts list.",
        "Every gram you save here you save twice. Run tools/balance.py after any change.",
    ], colour=DIM, lh=17)

    s.panel(800, 452, 740, 210, "The blank slug")
    s.note(816, 490, [
        "Pop the camera out and the bay is empty - 25 g gone from the worst possible",
        "place, and the cue is suddenly butt-heavy and rattles. So the kit includes a",
        "blank: a printed shell with a brass core, turned down on a scale until it",
        "matches the camera cartridge to within 0.5 g.",
        "",
        "League night: blank in, nothing to declare, cue plays exactly as it did in practice.",
    ], colour=DIM, lh=17)
    return s.save(os.path.join(out, "04-cartridge-exploded.svg"))


# ==========================================================================
# 05  pop-out mechanism
# ==========================================================================
def d05(out):
    import math
    W, H = 1580, 700
    s = Svg(W, H, "CueCam 05 - bayonet pop-out mechanism",
            "Quarter-turn bayonet with a sprung ejector. No push-push latch: a "
            "500 g axial shock every shot would eventually fire one.")

    # ---- three states ----------------------------------------------------
    states = [
        (120, "1  LOCKED", 0, 0, "Lugs sit past the detent bump. Axial shock loads\n"
                                 "them in shear against the track wall."),
        (560, "2  TWISTED 28°", 28, 0, "Thumb rolls the knurled ring 28°. The detent\n"
                                       "clicks over; lugs reach the axial slot."),
        (1000, "3  EJECTED", 28, 84, "The spring pushes the cartridge out 9 mm.\n"
                                     "Two fingers pull it clear."),
    ]
    for x0, title, ang, pop, desc in states:
        s.text(x0 + 150, 118, title, size=14, weight="700", fill=INK, anchor="middle")
        cy = 250
        # collar barrel
        s.rect(x0, cy - 42, 220, 84, fill="url(#cf2)", stroke=INK, sw=1.4, rx=8)
        # cartridge, popped out by `pop`
        s.rect(x0 + 150 + pop, cy - 32, 150, 64, fill="#fdf1f9", stroke=MAGENTA,
               sw=1.7, rx=6)
        # bayonet ring, knurled
        s.rect(x0 + 206, cy - 46, 26, 92, fill="url(#hatch2)", stroke=INK, sw=1.4)
        for i in range(9):
            s.line(x0 + 209 + i * 2.6, cy - 44, x0 + 209 + i * 2.6, cy + 44,
                   stroke=INK, sw=0.6)
        # rotation arrow
        if ang:
            s.path(f"M{x0+196},{cy-62} A 34,34 0 0 1 {x0+244},{cy-54}",
                   stroke=BLUE, sw=2.6, fill="none", marker_end="url(#ab)")
            s.text(x0 + 254, cy - 50, f"{ang}°", size=12.5, fill=BLUE, weight="700")
        if pop:
            s.line(x0 + 300 + pop, cy + 52, x0 + 300 + pop + 40, cy + 52,
                   stroke=GREEN, sw=2.4, marker_end="url(#a)")
            s.text(x0 + 300 + pop + 46, cy + 56, "9 mm", size=12, fill=GREEN,
                   weight="700")
        for i, ln in enumerate(desc.split("\n")):
            s.text(x0, 334 + i * 16, ln, size=11.5, fill=DIM)

    # ---- developed bayonet track -----------------------------------------
    s.panel(40, 396, 740, 250, "Bayonet track, developed flat (one of two, 180° apart)")
    tx, ty, tw = 90, 470, 620
    s.rect(tx, ty, tw, 92, fill="#f0f3f8", stroke=HAIR, sw=1)
    # axial entry slot
    s.rect(tx + 40, ty, 34, 56, fill=PAPER, stroke=INK, sw=1.6)
    # circumferential run
    s.rect(tx + 40, ty + 30, 300, 26, fill=PAPER, stroke=INK, sw=1.6)
    # detent bump + pocket
    s.path(f"M{tx+300},{ty+30} q 14,13 28,0", stroke=INK, sw=1.6, fill="none")
    s.rect(tx + 328, ty + 30, 46, 26, fill="#e9f7ef", stroke=GREEN, sw=1.6)
    s.circle(tx + 351, ty + 43, 9, fill=STEEL, stroke=INK, sw=1.2)
    s.text(tx + 351, ty + 22, "lug, locked", size=11, fill=GREEN, anchor="middle",
           weight="700")
    s.text(tx + 57, ty - 8, "insert", size=11, fill=DIM, anchor="middle")
    s.text(tx + 190, ty + 78, "28° rotation", size=11, fill=DIM, anchor="middle")
    s.text(tx + 314, ty + 80, "detent", size=11, fill=AMBER, anchor="middle")
    s.dim_h(tx + 40, tx + 374, ty + 108, "28° = 5.9 mm at ⌀24")

    s.panel(800, 396, 740, 250, "Why not a push-push latch")
    s.note(816, 434, [
        "A push-push (ballpoint / SD-slot) latch is the obvious choice and it is the",
        "wrong one here. It stores its release in an axial cam, and the cue delivers a",
        "~500 g axial spike into that cam on every single shot. Sooner or later it",
        "indexes on its own and the cartridge leaves the cue at speed, mid-break.",
        "",
        "The bayonet needs rotation the shot cannot supply, holds the load in shear",
        "across two steel lugs rather than a plastic cam, and still opens one-handed.",
        "The detent is a comfort feature, not the retention - pull the ring off and",
        "the lugs still cannot leave the track without being turned.",
    ], colour=DIM, lh=17)
    return s.save(os.path.join(out, "05-popout-mechanism.svg"))


# ==========================================================================
# 06  butt: weight bore, bumper, grip
# ==========================================================================
def d06(out):
    W, H = 1580, 800
    s = Svg(W, H, "CueCam 06 - butt assembly, weight and grip",
            "Section through the last 340 mm. Scale 2.4:1. Weight changes from "
            "the bottom, grip goes on last and comes off again.")
    sc, cy = 2.4, 212
    X0, X1 = 1130.0, 1473.2
    x0p = 90
    def px(x): return x0p + (x - X0) * sc
    def py(r): return cy - r * sc

    def r_out(x):
        return (21.9 + (29.5 - 21.9) * (x - JOINT2) / (CUE_LEN - JOINT2)) / 2

    # ---- butt tube, sectioned -------------------------------------------
    xs = [X0 + i for i in range(0, int(X1 - X0) + 1, 2)]
    for sign in (1, -1):
        outer = [(px(x), cy - sign * r_out(x) * sc) for x in xs]
        inner = [(px(x), cy - sign * (r_out(x) - 1.4) * sc) for x in reversed(xs)]
        s.poly(outer + inner, fill="url(#hatch)", stroke=INK, sw=1.3)
    s.centreline(px(X0 - 6), cy, px(X1 + 40))

    # ---- threaded steel weight sleeve, bonded in -------------------------
    s.rect(px(1270), py(6.2), 190 * sc, 12.4 * sc, fill="url(#hatch2)",
           stroke=INK, sw=1.3)
    s.rect(px(1272), py(4.0), 186 * sc, 8.0 * sc, fill=PAPER, stroke=INK, sw=1)
    for i in range(46):
        s.line(px(1273 + i * 4), py(4.0), px(1275 + i * 4), py(-4.0),
               stroke=INK, sw=0.55)

    # ---- bolt stack ------------------------------------------------------
    for i, (a, b, col) in enumerate([(1276, 1316, "#8d97a8"),
                                     (1318, 1358, "#8d97a8"),
                                     (1360, 1400, "#b9c2d0")]):
        s.rect(px(a), py(3.9), (b - a) * sc, 7.8 * sc, fill=col, stroke=INK, sw=1.1)
        s.text(px((a + b) / 2), cy + 4, f"{28.3:.0f} g", size=10, fill=PAPER,
               anchor="middle", weight="700")

    # ---- butt cap + bumper ----------------------------------------------
    s.rect(px(1440), py(14.6), 26 * sc, 29.2 * sc, fill="#eef1f6", stroke=INK,
           sw=1.4, rx=3)
    s.rect(px(1464), py(14.2), 9 * sc, 28.4 * sc, fill="#22262e", stroke=INK,
           sw=1.4, rx=4)

    # ---- grip sleeve ------------------------------------------------------
    s.rect(px(1150), py(r_out(1150) + 2.6), 260 * sc, (r_out(1150) + 2.6) * 2 * sc,
           fill="none", stroke=BLUE, sw=1.8, rx=6)
    s.text(px(1280), py(r_out(1280) + 2.6) - 12, "grip sleeve, split, slides on last",
           size=11.5, fill=BLUE, anchor="middle", weight="700")

    # ---- callouts ---------------------------------------------------------
    outs = [
        (1272, py(6.2), ["steel sleeve, bonded", "190 mm long bore"]),
        (1300, py(3.9), ["5/16-14 bolts", "28.3 g each"]),
        (1380, py(3.9), ["trim slug", "4 / 8 / 14 g"]),
        (1450, py(14.6), ["butt cap, printed", "PA6-CF, captive"]),
        (1466, py(14.2), ["rubber bumper", "unscrews, M12x1"]),
    ]
    for (x, y, txt), ty in zip(outs, [128, 176, 224, 272, 320]):
        s.elbow(px(x), y, 1020, ty, txt, side="right", weight="700")

    s.dim_h(px(1270), px(1460), cy + 108, "190 mm bore - long on purpose")
    s.note(px(1240), cy + 140, [
        "A short bolt pocket at the very end of the cue is the usual arrangement and it",
        "makes the balance lurch every time you change weight. Spreading the same mass",
        "over 190 mm pulls its centroid 90 mm forward and cuts the swing by a third."],
        colour=DIM)

    s.panel(40, 442, 960, 330, "Changing weight, and where the grip comes in")
    s.note(58, 482, [
        "1.  Twist the rubber bumper off - left-hand thread, so a hard shot tightens it.",
        "2.  The cap stays captive on the cue; a 4 mm hex reaches the bolt stack.",
        "3.  Add or remove 28.3 g bolts for whole ounces, 4 / 8 / 14 g trim slugs between.",
        "4.  Bumper back on. Two minutes, no tools beyond the hex key.",
        "",
        "Balance drifts about 0.7 in per ounce added at the butt - that is what a weight",
        "bolt does, on any cue. If you want the SAME balance at every weight, the forearm",
        "rod inside section 2 takes slugs too: break the cue at joint 2 and the rod is",
        "right there. tools/balance.py prints both tables.",
        "",
        "The grip sleeve is deliberately last in the build order. It is a split TPU tube",
        "that springs over the butt and is trapped by the cap shoulder - so you can play",
        "the cue bare, print three durometers, and swap without touching the structure.",
        "The lens index mark moulded into the sleeve tells your hand which way is up.",
    ], colour=DIM, lh=17)
    return s.save(os.path.join(out, "06-butt-weight-grip.svg"))


# ==========================================================================
# 07  tip system
# ==========================================================================
def d07(out):
    W, H = 1580, 720
    s = Svg(W, H, "CueCam 07 - 9.5 mm quick-change tip",
            "Scale 8:1. Screw-on tip pucks so a tip change is a 30 second job at the "
            "table, not a night with a lathe and a glue-up.")
    sc, cy = 8.0, 250
    x0p = 430
    def px(x): return x0p + x * sc
    def py(r): return cy - r * sc

    # shaft nose
    s.poly([(px(0), py(4.75)), (px(46), py(5.2)), (px(46), py(-5.2)),
            (px(0), py(-4.75))], fill="url(#hatch)", stroke=INK, sw=1.4)
    # ferrule
    s.rect(px(0), py(4.75), 13 * sc, 9.5 * sc, fill="#f3ead6", stroke=INK, sw=1.4)
    # brass insert + 4-40 thread
    s.rect(px(1.5), py(3.1), 10 * sc, 6.2 * sc, fill="#d9b25e", stroke=INK, sw=1.2)
    s.rect(px(2.5), py(1.4), 8.5 * sc, 2.8 * sc, fill=PAPER, stroke=INK, sw=1)
    for i in range(10):
        s.line(px(2.6 + i * 0.85), py(1.4), px(3.0 + i * 0.85), py(-1.4),
               stroke=INK, sw=0.6)
    s.centreline(px(-14), cy, px(50))

    # --- the puck, exploded off the front ---------------------------------
    ox = -26
    s.rect(px(ox + 3.2), py(4.75), 1.6 * sc, 9.5 * sc, fill="#c9c2b4",
           stroke=INK, sw=1.3)                                   # phenolic pad
    s.path(f"M{px(ox)},{py(4.75)} Q{px(ox-4.6)},{cy} {px(ox)},{py(-4.75)} "
           f"L{px(ox+3.2)},{py(-4.75)} L{px(ox+3.2)},{py(4.75)} Z",
           fill="#6b4f2a", stroke=INK, sw=1.4)                   # leather tip
    s.rect(px(ox + 4.8), py(1.35), 7.0 * sc, 2.7 * sc, fill="#d9b25e",
           stroke=INK, sw=1.2)                                   # 4-40 stud
    s.line(px(ox + 12.5), cy, px(-1), cy, stroke=HAIR, sw=1.2, stroke_dasharray="6 4")

    lbl = [
        (ox - 3, py(0), ["9.5 mm layered leather tip", "pre-shaped, pre-burnished"]),
        (ox + 4, py(4.75), ["0.8 mm phenolic backing pad", "takes the clamp load"]),
        (ox + 8, py(1.35), ["4-40 stainless stud, Loctite 243", "into the pad, not the leather"]),
        (6, py(3.1), ["brass insert, bonded into", "the ferrule bore"]),
        (9, py(4.75), ["⌀9.5 mm carbon-loaded ferrule", "13 mm long, 3.4 g"]),
    ]
    for (x, y, txt), ty in zip(lbl, [140, 196, 252, 330, 386]):
        s.elbow(px(x), y, 1000, ty, txt, side="right", weight="700")

    s.dim_v(px(-34), py(4.75), py(-4.75), "⌀9.5")

    s.panel(40, 452, 740, 240, "The 9.5 mm decision")
    s.note(58, 492, [
        "9.5 mm is a snooker tip, not a pool tip - most pool shafts are 11.75-12.4 mm.",
        "On a 9.5 mm carbon shaft you get:",
        "",
        "  + very low deflection; the thin, stiff shaft squirts the cue ball less",
        "  + a lot more spin for the same offset, because you can hit further out",
        "  − a much smaller margin for error - a miscue is 1-2 mm away, not 3-4",
        "  − the ferrule bore is only ~6 mm, so the insert thread has to be 4-40",
        "",
        "It is the right tip for a practice cue you are filming. It is an unforgiving",
        "tip to break with - another reason the break cue stays a separate cue.",
    ], colour=DIM, lh=17)

    s.panel(800, 452, 740, 240, "Changing a tip at the table")
    s.note(818, 492, [
        "1.  Printed spanner over the ferrule flats, thumb on the puck, quarter turn.",
        "2.  Old puck off. Wipe the shoulder.",
        "3.  New puck on, finger tight, then the spanner until the pad seats flat",
        "    against the ferrule - the shoulder does the locating, not the thread.",
        "4.  Play.",
        "",
        "Pucks are prepared in advance: leather bonded to pad, stud set with Loctite,",
        "shaped and burnished off the cue. Carry three in the case. A tip change stops",
        "being an evening's work and becomes a decision you make mid-session.",
    ], colour=DIM, lh=17)
    return s.save(os.path.join(out, "07-tip-system.svg"))


# ==========================================================================
# 08  mass & balance  (data from balance.py)
# ==========================================================================
S1, S2, S3 = "#2a78d6", "#eb6834", "#1baf7a"     # validated categorical slots 1-3

_MODEL = None


def _model():
    """Numbers come from balance.py so a drawing can never drift from the model."""
    global _MODEL
    if _MODEL is None:
        _MODEL = json.loads(subprocess.run(
            [sys.executable, "balance.py", "--json"], capture_output=True, text=True,
            cwd=os.path.dirname(os.path.abspath(__file__))).stdout)
    return _MODEL


def d08(out):
    data = _model()
    naive = {r["oz"]: r["balance_in_from_butt"] for r in data["weight_range"]["rows"]}
    modeA = {r["oz"]: r["balance_in_from_butt"] for r in data["trim_table"]["rows"]}
    iso = {r["oz"]: r for r in data["isobalance"]}

    W, H = 1580, 760
    s = Svg(W, H, "CueCam 08 - finished weight vs balance point",
            "Where the ballast lives decides whether the cue is adjustable or just "
            "heavy. Generated from tools/balance.py.")

    # ---- plot frame -------------------------------------------------------
    PX, PY, PW, PH = 96, 152, 830, 430
    YLO, YHI = 14.0, 21.0
    def gx(oz): return PX + (oz - 17) / 4 * PW
    def gy(v): return PY + PH - (v - YLO) / (YHI - YLO) * PH

    # conventional balance window
    s.rect(PX, gy(19.5), PW, gy(18.0) - gy(19.5), fill="#eef1f6")
    s.text(PX + PW - 8, gy(19.5) + 16, "conventional balance window, 18.0-19.5 in",
           size=11, fill=DIM, anchor="end")

    for v in range(14, 22):
        s.line(PX, gy(v), PX + PW, gy(v), stroke="#eceff4", sw=1)
        s.text(PX - 10, gy(v) + 4, f"{v}", size=11.5, fill=DIM, anchor="end")
    for oz in range(17, 22):
        s.text(gx(oz), PY + PH + 24, f"{oz}", size=11.5, fill=DIM, anchor="middle")
    s.line(PX, PY + PH, PX + PW, PY + PH, stroke=HAIR, sw=1.2)
    s.text(PX + PW / 2, PY + PH + 52, "finished cue weight, oz", size=12.5,
           fill=INK, anchor="middle", weight="700")
    s.text(PX - 58, 92, "balance point, inches ahead of the butt face",
           size=12.5, fill=INK, weight="700")

    series = [
        ("All ballast at the butt cap", naive, S3,
         "rejected - 13-16 in, dead and butt-heavy"),
        ("Mode A  fixed forearm rod + butt bolts", modeA, S1,
         "0.7 in per oz, like any weight-bolt cue"),
        ("Mode B  both stations swapped", {r["oz"]: 18.5 for r in data["isobalance"]},
         S2, "flat 18.5 in at every weight"),
    ]
    for name, d, col, _ in series:
        pts = " ".join(f"{gx(o):.1f},{gy(v):.1f}" for o, v in sorted(d.items()))
        s.path("M" + pts.replace(" ", " L"), stroke=col, sw=2.4, fill="none",
               stroke_linejoin="round")
        for o, v in sorted(d.items()):
            s.circle(gx(o), gy(v), 5.4, fill=col, stroke=PAPER, sw=2)

    # direct labels at the right-hand end
    for name, d, col, _ in series:
        v = d[21]
        short = {"All ballast at the butt cap": "butt cap only"}.get(
            name, name.split("  ")[0])
        s.text(gx(21) + 12, gy(v) + 4, short, size=11.5, fill=DIM, weight="700")

    # legend
    lx, ly = PX, 122
    for i, (name, d, col, note) in enumerate(series):
        s.rect(lx + i * 280, ly - 9, 11, 11, fill=col, rx=2)
        s.text(lx + i * 280 + 18, ly, name, size=11.5, fill=DIM)

    # ---- table view -------------------------------------------------------
    tx, ty = 1000, 150
    s.text(tx, ty - 22, "Table view", size=12.5, weight="700", fill=INK)
    cols = ["oz", "Mode A bolts", "balance", "Mode B forearm", "Mode B butt"]
    xs = [tx, tx + 52, tx + 170, tx + 250, tx + 390]
    for c, x in zip(cols, xs):
        s.text(x, ty, c, size=11, fill=DIM, weight="700")
    s.line(tx, ty + 8, tx + 470, ty + 8, stroke=FAINT, sw=1.2)
    for i, r in enumerate(data["trim_table"]["rows"]):
        y = ty + 30 + i * 26
        b = iso[r["oz"]]
        for v, x in zip([f"{r['oz']}", f"{r['bolt_g']:.0f} g",
                         f"{r['balance_in_from_butt']:.2f} in",
                         f"{b['forearm_g']:.0f} g", f"{b['butt_g']:.0f} g"], xs):
            s.text(x, y, v, size=11.5, fill=INK)
    s.text(tx, ty + 190, f"fixed forearm rod: {data['trim_table']['rod_g']:.0f} g "
           f"at {data['trim_table']['rod_x']:.0f} mm", size=11, fill=DIM)

    s.panel(1000, 372, 540, 210, "Read this before choosing a weight")
    s.note(1016, 408, [
        "A bare carbon-tube cue of this geometry comes out at",
        f"{data['weight_range']['bare_oz']:.1f} oz. Every cue in this weight class is",
        "carrying ballast somewhere - wooden cues just hide it in",
        "the forearm. Putting all of it under the bumper is what",
        "makes a light cue feel wrong, not the weight itself.",
        "",
        "Mode A is what you will actually use day to day.",
        "Mode B exists for the one comparison that matters:",
        "proving the camera changed nothing.",
    ], colour=DIM, lh=17)

    s.panel(40, 620, 900, 118, "The camera's real cost")
    s.note(58, 656, [
        f"The cartridge station is 470 mm ahead of the balance point, so each gram there",
        f"needs {data['pod_penalty_g_per_g']:.2f} g of butt ballast to stay in balance - "
        f"{1 + data['pod_penalty_g_per_g']:.2f} g of finished cue per gram of camera.",
        f"A 25 g cartridge is {25 * (1 + data['pod_penalty_g_per_g']):.0f} g of cue. "
        f"A 45 g one is {45 * (1 + data['pod_penalty_g_per_g']):.0f} g, and 21 oz stops "
        f"being reachable with any balance you would want."], colour=DIM, lh=17)
    return s.save(os.path.join(out, "08-weight-and-balance.svg"))


# ==========================================================================
# 09  footage workflow
# ==========================================================================
def d09(out):
    W, H = 1580, 720
    s = Svg(W, H, "CueCam 09 - getting the footage onto your phone",
            "Card-first. No pairing, no app-in-the-middle, nothing to go wrong at "
            "the table.")
    y = 210
    steps = [
        ("Twist + pop", "collar ring 28°,\ncartridge ejects 9 mm", BLUE),
        ("Card out", "push-push microSD,\nor USB-C the whole pod", BLUE),
        ("USB-C reader", "£6 adapter,\nlives in the cue case", BLUE),
        ("Phone Files", "iOS Files / Android SAF\nsees it as a drive", GREEN),
        ("PoolarCam app", "import, auto-split,\nreview, keep or bin", MAGENTA),
    ]
    bw, gap = 250, 42
    for i, (t, d, col) in enumerate(steps):
        x = 60 + i * (bw + gap)
        s.rect(x, y, bw, 130, fill=PAPER, stroke=col, sw=2, rx=12)
        s.text(x + bw / 2, y + 40, t, size=15, weight="700", fill=INK, anchor="middle")
        for j, ln in enumerate(d.split("\n")):
            s.text(x + bw / 2, y + 68 + j * 17, ln, size=11.5, fill=DIM,
                   anchor="middle")
        s.text(x + 14, y - 14, f"{i + 1}", size=12, weight="700", fill=col)
        if i < len(steps) - 1:
            s.line(x + bw + 8, y + 65, x + bw + gap - 8, y + 65, stroke=HAIR,
                   sw=2, marker_end="url(#a)")

    s.panel(60, 400, 720, 280, "What the app has to do that the file manager can't")
    s.note(78, 438, [
        "A 40 minute card is 40 minutes of a cue lying on a table with four minutes of",
        "pool in it. The one job worth writing an app for is cutting it up:",
        "",
        "  •  the tip strike is a sharp, unmistakable audio transient - that is the cut",
        "  •  the gyro log in the same file says which way the cue was pointing",
        "  •  so: detect strike, take 4 s before and 3 s after, that is one shot",
        "",
        "Everything after that is a list of clips with a date and a thumbnail. Tag the",
        "misses, delete the rest, and a session becomes 30 shots you can actually watch.",
        "Aim overlay reuses the solver already in this repo.",
    ], colour=DIM, lh=17)

    s.panel(800, 400, 720, 280, "The Wi-Fi version, and why it is version two")
    s.note(818, 438, [
        "Streaming to the phone sounds better and is worse:",
        "",
        "  •  a radio in the collar is +8 g at the 1.13:1 station, so +17 g of cue",
        "  •  it roughly halves a 400 mAh cell's runtime",
        "  •  pairing at a pub table, on someone else's 2.4 GHz, before you can play",
        "  •  and it puts a transmitter inside a carbon tube, which is a Faraday cage",
        "",
        "The card path needs none of that and never fails at the table. Build v1 on the",
        "card. If you still want Wi-Fi after a month of using it, the cartridge is the",
        "part you swap - that is the entire point of making it a cartridge.",
    ], colour=DIM, lh=17)
    return s.save(os.path.join(out, "09-footage-workflow.svg"))


# ==========================================================================
# 10  P1S build plate
# ==========================================================================
def d10(out):
    W, H = 1580, 800
    s = Svg(W, H, "CueCam 10 - Bambu Lab P1S build plates",
            "256 x 256 mm plate. Two plates, two materials, ~9 h total. Nothing "
            "structural is printed.")
    BED = 256
    for pi, (ox, title, mat, parts) in enumerate([
        (70, "Plate 1  ·  PA6-CF or PET-CF", "0.4 mm hardened nozzle, 280 °C, "
         "chamber closed, dried filament",
         [("collar barrel", 30, 30, 118, 26, "upright, split at the parting line"),
          ("cartridge shell", 30, 66, 72, 22, "upright"),
          ("nose cap", 30, 96, 34, 26, "window down"),
          ("tail cap", 70, 96, 30, 26, "flat"),
          ("butt cap", 30, 130, 34, 34, "bore up"),
          ("blank slug shell", 72, 130, 40, 22, "upright"),
          ("tip spanner", 30, 170, 96, 18, "flat"),
          ("bolt trim washers x6", 30, 196, 60, 14, "flat")]),
        (830, "Plate 2  ·  TPU 95A", "external spool, not the AMS, 20 mm/s, "
         "0.2 mm layers",
         [("shock boot, front", 30, 30, 46, 24, "upright"),
          ("shock boot, rear", 84, 30, 46, 24, "upright"),
          ("grip sleeve A, split", 30, 66, 150, 34, "flat, seam down"),
          ("grip sleeve B, split", 30, 108, 150, 34, "flat, seam down"),
          ("bumper, spare", 30, 150, 40, 32, "flat")]),
    ]):
        k = 2.0
        s.text(ox, 106, title, size=15, weight="700", fill=INK)
        s.text(ox, 126, mat, size=11.5, fill=DIM)
        s.rect(ox, 140, BED * k, BED * k, fill="#f7f9fc", stroke=HAIR, sw=1.4, rx=4)
        for i in range(1, 8):
            s.line(ox + i * 32 * k, 140, ox + i * 32 * k, 140 + BED * k,
                   stroke="#eceff4", sw=1)
            s.line(ox, 140 + i * 32 * k, ox + BED * k, 140 + i * 32 * k,
                   stroke="#eceff4", sw=1)
        col = BLUE if pi == 0 else MAGENTA
        for name, x, y, w, h, orient in parts:
            s.rect(ox + x * k, 140 + y * k, w * k, h * k, fill=PAPER, stroke=col,
                   sw=1.8, rx=4)
            s.text(ox + (x + w / 2) * k, 140 + (y + h / 2) * k + 2, name, size=10.5,
                   fill=INK, anchor="middle", weight="700")
            s.text(ox + (x + w / 2) * k, 140 + (y + h / 2) * k + 17, orient,
                   size=9.5, fill=DIM, anchor="middle")
        s.text(ox + BED * k / 2, 140 + BED * k + 20, "256 x 256 mm", size=11,
               fill=DIM, anchor="middle")

    s.panel(70, 690, 1440, 96, "Print settings that actually matter here")
    s.note(88, 726, [
        "Dry the nylon - 12 h at 70 °C, and print it out of a dry box. Wet PA6-CF prints "
        "look fine and delaminate under shock.   •   Collar barrel: 6 walls, 40% gyroid; "
        "the walls carry the bayonet lugs, infill does nothing.",
        "Never print the joint threads, the weight sleeve or the ferrule - those are metal, "
        "bought and bonded.   •   PLA anywhere on this cue will creep under the bolt "
        "preload within a month. ABS/ASA is the fallback; PA6-CF is the right answer."],
        colour=DIM, lh=18)
    return s.save(os.path.join(out, "10-print-plates.svg"))


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "drawings")
    os.makedirs(out, exist_ok=True)
    for fn in (d01, d02, d03, d04, d05, d06, d07, d08, d09, d10):
        print(fn(out))


if __name__ == "__main__":
    main()
