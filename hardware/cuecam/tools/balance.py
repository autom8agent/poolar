#!/usr/bin/env python3
"""
CueCam mass / balance model.

Coordinate system: x = 0 at the TIP, +x toward the butt, millimetres.
A 58 in cue is 1473 mm long, so the butt face sits at x = 1473.

Every mass is an (name, grams, x_mm) triple.  Masses marked `est=True` are
engineering estimates that still need to be confirmed on a scale; the report
prints the total estimated mass so you know how much of the number is guessed.

Run:  python3 balance.py            -> human readable report
      python3 balance.py --json     -> machine readable (used by gen_drawings.py)
"""
import json
import sys
from dataclasses import dataclass, field

MM_PER_IN = 25.4
G_PER_OZ = 28.3495

CUE_LEN = 58.0 * MM_PER_IN          # 1473.2 mm
JOINT1_X = 19.0 * MM_PER_IN         # 482.6 mm  - "one third from the tip"
JOINT2_X = 38.5 * MM_PER_IN         # 977.9 mm
POD_CENTRE_X = 533.0                # centre of the camera cartridge
# The bolt stack is a LONG bore, not a stub: spreading the adjustable mass
# forward shortens its lever arm and halves the balance drift when you change
# weights.  1330 mm is the centroid of a 120 mm stack of 5/16-14 slugs.
BALLAST_X = 1330.0                  # centroid of the weight-bolt stack
BUMPER_X = 1466.0

# A conventional cue balances 18-19 in ahead of the butt face.
TARGET_BALANCE_FROM_BUTT_IN = 18.5
TARGET_BALANCE_X = CUE_LEN - TARGET_BALANCE_FROM_BUTT_IN * MM_PER_IN   # 943.3 mm


@dataclass(frozen=True)
class Part:
    name: str
    grams: float
    x: float
    group: str
    est: bool = True          # True = calculated/estimated, False = weighed or datasheet

    @property
    def moment(self) -> float:
        return self.grams * self.x


# --------------------------------------------------------------------------
# Structure common to every configuration
# --------------------------------------------------------------------------
def structure(grip: str = "tpu") -> list[Part]:
    grip_mass = {"tpu": 22.0, "linen": 14.0, "none": 0.0}[grip]
    return [
        # --- section 1: shaft, 0 -> 482.6 mm -------------------------------
        Part("Tip puck + phenolic pad (9.5 mm)", 1.1, 5.0, "shaft", est=False),
        Part("Ferrule, brass, 4-40 threaded bore", 3.4, 13.0, "shaft"),
        Part("CF shaft tube, 9.5->14.2 mm OD, 1.0 mm wall", 26.0, 232.0, "shaft"),
        Part("Foam core, shaft", 4.5, 240.0, "shaft"),
        Part("Joint 1 male pin, titanium 3/8-10 radial", 9.0, 470.0, "shaft"),
        Part("Joint 1 shaft collar, 6061", 6.5, 476.0, "shaft"),

        # --- camera station: 482.6 -> 556 mm -------------------------------
        Part("Pod barrel, PA6-CF printed", 8.2, 520.0, "pod"),
        Part("Joint 1 female socket, 6061", 10.0, 492.0, "pod"),
        Part("Bayonet ring + 2 lugs, 303 SS", 5.8, 500.0, "pod"),
        Part("Ejector spring + detent", 1.2, 508.0, "pod"),
        Part("Lens window (sapphire) + bezel", 1.5, 506.0, "pod"),

        # --- section 2: mid, 556 -> 977.9 mm -------------------------------
        Part("CF mid tube, 15.7->21.9 mm OD, 1.2 mm wall", 44.0, 768.0, "mid"),
        Part("Joint 2 pin + collar pair, SS", 26.0, 968.0, "mid"),

        # --- section 3: butt, 977.9 -> 1473.2 mm ---------------------------
        Part("CF butt tube, 21.9->29.5 mm OD, 1.4 mm wall", 82.0, 1195.0, "butt"),
        Part(f"Grip sleeve ({grip})", grip_mass, 1290.0, "butt"),
        Part("Weight bore sleeve, 5/16-14, steel", 30.0, 1418.0, "butt"),
        Part("Butt cap, PA6-CF printed", 6.0, 1450.0, "butt"),
        Part("Rubber bumper", 7.0, BUMPER_X, "butt", est=False),
    ]


# --------------------------------------------------------------------------
# The three things that can occupy the cartridge bay
# --------------------------------------------------------------------------
CARTRIDGES = {
    "camera-thumb": [
        Part("Cartridge shell, PA6-CF", 4.4, 533.0, "cart"),
        Part("TPU shock boot (95A, gyroid 20%)", 2.1, 533.0, "cart"),
        Part("RunCam Thumb Pro board stack (de-cased)", 9.8, 528.0, "cart", est=False),
        Part("LiPo 302040, 300 mAh", 6.4, 545.0, "cart", est=False),
        Part("microSD + retainer clip", 0.9, 552.0, "cart", est=False),
        Part("FPC, button, wiring", 1.4, 538.0, "cart"),
    ],
    "camera-esp32": [
        Part("Cartridge shell, PA6-CF", 4.4, 533.0, "cart"),
        Part("TPU shock boot (95A, gyroid 20%)", 2.1, 533.0, "cart"),
        Part("ESP32-S3 + OV5640 + SD carrier PCB", 7.2, 528.0, "cart"),
        Part("LiPo 402040, 400 mAh", 8.1, 545.0, "cart", est=False),
        Part("microSD + retainer clip", 0.9, 552.0, "cart", est=False),
        Part("FPC, button, wiring", 1.4, 538.0, "cart"),
    ],
    # Mass-matched slug so the cue plays identically with the camera removed.
    "blank": [
        Part("Blank slug, PA6-CF shell + brass core", 25.0, 533.0, "cart", est=False),
    ],
}


def solve(parts: list[Part], target_x: float, ballast_x: float = BALLAST_X):
    """Return (ballast_g, total_g, balance_x) needed to put the CG at target_x."""
    m = sum(p.grams for p in parts)
    mom = sum(p.moment for p in parts)
    # (mom + b*ballast_x) / (m + b) = target_x
    denom = ballast_x - target_x
    ballast = (target_x * m - mom) / denom if denom else 0.0
    ballast = max(0.0, ballast)
    total = m + ballast
    bal_x = (mom + ballast * ballast_x) / total
    return ballast, total, bal_x


def config(cartridge: str, grip: str = "tpu", target_x: float = TARGET_BALANCE_X):
    parts = structure(grip) + CARTRIDGES[cartridge]
    ballast, total, bal_x = solve(parts, target_x)
    est = sum(p.grams for p in parts if p.est)
    return {
        "cartridge": cartridge,
        "grip": grip,
        "bare_g": round(sum(p.grams for p in parts), 1),
        "ballast_g": round(ballast, 1),
        "total_g": round(total, 1),
        "total_oz": round(total / G_PER_OZ, 2),
        "balance_mm_from_tip": round(bal_x, 1),
        "balance_in_from_butt": round((CUE_LEN - bal_x) / MM_PER_IN, 2),
        "estimated_fraction": round(est / sum(p.grams for p in parts), 2),
        "parts": [
            {"name": p.name, "g": p.grams, "x": p.x, "group": p.group, "est": p.est}
            for p in parts
        ],
    }


def weight_range(cartridge: str = "camera-thumb", grip: str = "tpu"):
    """What total weights are reachable, and where the balance lands."""
    parts = structure(grip) + CARTRIDGES[cartridge]
    m = sum(p.grams for p in parts)
    mom = sum(p.moment for p in parts)
    rows = []
    for oz in [17, 18, 19, 20, 21]:
        total = oz * G_PER_OZ
        ballast = total - m
        if ballast < 0:
            rows.append({"oz": oz, "ballast_g": None, "note": "below bare mass - not reachable"})
            continue
        bal_x = (mom + ballast * BALLAST_X) / total
        rows.append({
            "oz": oz,
            "ballast_g": round(ballast, 1),
            "balance_in_from_butt": round((CUE_LEN - bal_x) / MM_PER_IN, 2),
            "note": "",
        })
    return {"bare_g": round(m, 1), "bare_oz": round(m / G_PER_OZ, 2), "rows": rows}


def pod_penalty(pod_g: float = 25.0,
                pod_x: float = POD_CENTRE_X,
                target_x: float = TARGET_BALANCE_X,
                ballast_x: float = BALLAST_X) -> float:
    """Grams of butt ballast required per gram of mass added at the pod station."""
    return (target_x - pod_x) / (ballast_x - target_x)



# --------------------------------------------------------------------------
# Two-station ballast
#
# A carbon-tube cue is far too light on its own (~11 oz).  Making that up
# entirely at the butt cap drags the balance point back to ~14 in, which feels
# dead and butt-heavy.  Real cues get their mass distributed along a wooden
# forearm, so we reproduce that with a fixed ballast rod inside the mid
# section plus the user-adjustable bolt stack at the butt.
# --------------------------------------------------------------------------
FOREARM_X = 760.0          # centre of the fixed ballast rod, inside section 2
DESIGN_OZ = 19.0           # the weight the fixed rod is tuned around


def two_station(total_g: float,
                target_x: float = TARGET_BALANCE_X,
                cartridge: str = "camera-thumb",
                grip: str = "tpu"):
    """Solve both ballast masses for a given finished weight AND balance point."""
    parts = structure(grip) + CARTRIDGES[cartridge]
    m = sum(p.grams for p in parts)
    mom = sum(p.moment for p in parts)
    need_m = total_g - m
    need_mom = total_g * target_x - mom
    # m_a + m_b = need_m ; m_a*FOREARM_X + m_b*BALLAST_X = need_mom
    m_b = (need_mom - need_m * FOREARM_X) / (BALLAST_X - FOREARM_X)
    m_a = need_m - m_b
    return m_a, m_b


def trim_table(cartridge: str = "camera-thumb", grip: str = "tpu"):
    """Fixed rod sized at DESIGN_OZ; report balance drift as the bolt changes."""
    parts = structure(grip) + CARTRIDGES[cartridge]
    m = sum(p.grams for p in parts)
    mom = sum(p.moment for p in parts)
    rod, _ = two_station(DESIGN_OZ * G_PER_OZ, cartridge=cartridge, grip=grip)
    base_m = m + rod
    base_mom = mom + rod * FOREARM_X
    rows = []
    for oz in [17, 18, 19, 20, 21]:
        total = oz * G_PER_OZ
        bolt = total - base_m
        bal_x = (base_mom + bolt * BALLAST_X) / total
        rows.append({
            "oz": oz,
            "bolt_g": round(bolt, 1),
            "balance_in_from_butt": round((CUE_LEN - bal_x) / MM_PER_IN, 2),
        })
    return {"rod_g": round(rod, 1), "rod_x": FOREARM_X, "rows": rows}


def isobalance_table(cartridge: str = "camera-thumb", grip: str = "tpu"):
    """Constant-balance mode: change BOTH ballast stations together.

    The forearm slugs thread onto a rod inside section 2 and are reached
    through the joint-2 bore with the cue broken down; the butt bolts go in
    from under the bumper.  Swapping both keeps 18.5 in at every weight.
    """
    rows = []
    for oz in [17, 18, 19, 20, 21]:
        m_a, m_b = two_station(oz * G_PER_OZ, cartridge=cartridge, grip=grip)
        rows.append({"oz": oz, "forearm_g": round(m_a, 1), "butt_g": round(m_b, 1)})
    return rows


def report() -> str:
    L = []
    w = L.append
    w("CueCam mass & balance model")
    w("=" * 62)
    w(f"Cue length              : {CUE_LEN:.1f} mm (58.0 in)")
    w(f"Joint 1 (1/3 from tip)  : {JOINT1_X:.1f} mm (19.0 in)")
    w(f"Cartridge centre        : {POD_CENTRE_X:.1f} mm ({POD_CENTRE_X/MM_PER_IN:.1f} in from tip)")
    w(f"Target balance point    : {TARGET_BALANCE_X:.1f} mm from tip "
      f"({TARGET_BALANCE_FROM_BUTT_IN} in ahead of the butt face)")
    w("")
    w(f"LEVER PENALTY: every 1.0 g at the cartridge station costs "
      f"{pod_penalty():.2f} g of butt ballast")
    w(f"              to hold the balance point, i.e. "
      f"{1 + pod_penalty():.2f} g of finished cue weight per gram of camera.")
    w("")

    w("Configurations at the target balance point")
    w("-" * 62)
    w(f"{'config':<22}{'bare g':>8}{'ballast g':>11}{'total g':>9}{'total oz':>10}")
    for c in ("camera-thumb", "camera-esp32", "blank"):
        r = config(c)
        w(f"{c:<22}{r['bare_g']:>8.1f}{r['ballast_g']:>11.1f}"
          f"{r['total_g']:>9.1f}{r['total_oz']:>10.2f}")
    w("")

    wr = weight_range()
    w("Naive single-station ballast (all make-up weight at the butt cap)")
    w("-" * 62)
    w(f"bare cue, no ballast: {wr['bare_g']} g = {wr['bare_oz']} oz")
    w(f"{'target oz':>10}{'bolt stack g':>14}{'balance in from butt':>24}")
    for r in wr["rows"]:
        w(f"{r['oz']:>10}{r['ballast_g']:>14.1f}{r['balance_in_from_butt']:>24.2f}")
    lo = min(r["balance_in_from_butt"] for r in wr["rows"])
    hi = max(r["balance_in_from_butt"] for r in wr["rows"])
    w(f"  ^ {lo:.1f}-{hi:.1f} in balance: far too butt-heavy. "
      f"A real cue sits at 18-19 in.")
    w("")

    tt = trim_table()
    w(f"Two-station ballast: fixed rod {tt['rod_g']} g at x={tt['rod_x']:.0f} mm "
      f"(inside section 2)")
    w("-" * 62)
    w(f"{'target oz':>10}{'bolt stack g':>14}{'balance in from butt':>24}")
    for r in tt["rows"]:
        w(f"{r['oz']:>10}{r['bolt_g']:>14.1f}{r['balance_in_from_butt']:>24.2f}")
    drift = tt["rows"][0]["balance_in_from_butt"] - tt["rows"][-1]["balance_in_from_butt"]
    w(f"  balance drift across the full 17-21 oz range: {drift:.2f} in "
      f"- normal for a weight-bolt cue; pick a weight and the balance follows.")
    w("")

    w("Mode B - constant balance: swap BOTH stations, 18.5 in at every weight")
    w("-" * 62)
    w(f"{'target oz':>10}{'forearm slugs g':>17}{'butt bolts g':>14}")
    for r in isobalance_table():
        w(f"{r['oz']:>10}{r['forearm_g']:>17.1f}{r['butt_g']:>14.1f}")
    w("")

    cam = config("camera-thumb")
    blank = config("blank")
    d = cam["bare_g"] - blank["bare_g"]
    w("Camera-in vs camera-out parity")
    w("-" * 62)
    w(f"camera cartridge mass : {sum(p['g'] for p in cam['parts'] if p['group']=='cart'):.1f} g")
    w(f"blank slug mass       : {sum(p['g'] for p in blank['parts'] if p['group']=='cart'):.1f} g")
    w(f"delta                 : {d:+.1f} g  "
      f"-> trim the blank slug's brass core to null this out")
    w("")
    w(f"Estimated (not yet weighed) fraction of bare mass: "
      f"{cam['estimated_fraction']*100:.0f}%")
    return "\n".join(L)


def dump() -> dict:
    return {
        "geometry": {
            "cue_len_mm": CUE_LEN,
            "joint1_x": JOINT1_X,
            "joint2_x": JOINT2_X,
            "pod_centre_x": POD_CENTRE_X,
            "ballast_x": BALLAST_X,
            "target_balance_x": TARGET_BALANCE_X,
        },
        "pod_penalty_g_per_g": round(pod_penalty(), 3),
        "configs": {c: config(c) for c in CARTRIDGES},
        "weight_range": weight_range(),
        "trim_table": trim_table(),
        "isobalance": isobalance_table(),
        "forearm_x": FOREARM_X,
    }


if __name__ == "__main__":
    if "--json" in sys.argv:
        print(json.dumps(dump(), indent=2))
    else:
        print(report())
