"""Tiny dependency-free SVG writer for the CueCam drawing set."""
from html import escape

PAPER   = "#ffffff"
INK     = "#141a26"
HAIR    = "#98a2b6"
DIM     = "#5b6478"
FAINT   = "#e6eaf2"
BLUE    = "#2f6bff"
MAGENTA = "#c81fa8"
GREEN   = "#0e9c58"
AMBER   = "#c9760f"
RED     = "#cf2f3d"
STEEL   = "#aab3c4"
CF      = "#2b3240"
FONT    = "'Helvetica Neue',Helvetica,Arial,sans-serif"


class Svg:
    def __init__(self, w, h, title, subtitle=""):
        self.w, self.h = w, h
        self.o = []
        self.o.append(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}" font-family="{FONT}">')
        self.o.append(f'<title>{escape(title)}</title>')
        self.defs()
        self.rect(0, 0, w, h, fill=PAPER)
        self.text(34, 44, title, size=22, weight="700", fill=INK)
        if subtitle:
            self.text(34, 68, subtitle, size=13, fill=DIM)

    # ---- defs -----------------------------------------------------------
    def defs(self):
        self.o.append(f'''<defs>
<marker id="a" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
  <path d="M0,0 L9,4.5 L0,9 z" fill="{DIM}"/></marker>
<marker id="ab" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
  <path d="M0,0 L9,4.5 L0,9 z" fill="{BLUE}"/></marker>
<marker id="as" markerWidth="9" markerHeight="9" refX="1" refY="4.5" orient="auto">
  <path d="M9,0 L0,4.5 L9,9 z" fill="{DIM}"/></marker>
<pattern id="hatch" width="7" height="7" patternTransform="rotate(45)"
         patternUnits="userSpaceOnUse">
  <line x1="0" y1="0" x2="0" y2="7" stroke="{CF}" stroke-width="1.6" opacity="0.55"/>
</pattern>
<pattern id="hatch2" width="6" height="6" patternTransform="rotate(-45)"
         patternUnits="userSpaceOnUse">
  <line x1="0" y1="0" x2="0" y2="6" stroke="{STEEL}" stroke-width="2" opacity="0.9"/>
</pattern>
<pattern id="hatch3" width="5" height="5" patternTransform="rotate(45)"
         patternUnits="userSpaceOnUse">
  <line x1="0" y1="0" x2="0" y2="5" stroke="{AMBER}" stroke-width="1.6" opacity="0.6"/>
</pattern>
<linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#4a5568"/><stop offset="0.35" stop-color="#1c2331"/>
  <stop offset="0.62" stop-color="#2c3648"/><stop offset="1" stop-color="#0d1219"/>
</linearGradient>
<linearGradient id="cf2" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#57637a"/><stop offset="0.4" stop-color="#232c3b"/>
  <stop offset="1" stop-color="#0b0f16"/></linearGradient>
<linearGradient id="alu" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#e8ecf3"/><stop offset="0.45" stop-color="#b3bccd"/>
  <stop offset="1" stop-color="#7e8798"/></linearGradient>
</defs>''')

    # ---- primitives -----------------------------------------------------
    def rect(self, x, y, w, h, fill="none", stroke="none", sw=1, rx=0, **kw):
        self.o.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" '
                      f'rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"'
                      f'{self._kw(kw)}/>')

    def circle(self, cx, cy, r, fill="none", stroke="none", sw=1, **kw):
        self.o.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="{fill}" '
                      f'stroke="{stroke}" stroke-width="{sw}"{self._kw(kw)}/>')

    def path(self, d, fill="none", stroke=INK, sw=1.4, **kw):
        self.o.append(f'<path d="{d}" fill="{fill}" stroke="{stroke}" '
                      f'stroke-width="{sw}"{self._kw(kw)}/>')

    def line(self, x1, y1, x2, y2, stroke=INK, sw=1.2, **kw):
        self.o.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" '
                      f'stroke="{stroke}" stroke-width="{sw}"{self._kw(kw)}/>')

    def text(self, x, y, s, size=12, fill=INK, weight="400", anchor="start", **kw):
        weight = kw.pop("font_weight", weight)   # avoid emitting font-weight twice
        self.o.append(f'<text x="{x:.2f}" y="{y:.2f}" font-size="{size}" fill="{fill}" '
                      f'font-weight="{weight}" text-anchor="{anchor}"'
                      f'{self._kw(kw)}>{escape(s)}</text>')

    def poly(self, pts, fill="none", stroke="none", sw=1, **kw):
        p = " ".join(f"{a:.2f},{b:.2f}" for a, b in pts)
        self.o.append(f'<polygon points="{p}" fill="{fill}" stroke="{stroke}" '
                      f'stroke-width="{sw}"{self._kw(kw)}/>')

    # ---- drafting helpers ----------------------------------------------
    def dim_h(self, x1, x2, y, label, colour=DIM, above=True):
        """Horizontal dimension with arrows and a centred label."""
        self.line(x1, y - 5, x1, y + 5, stroke=colour, sw=1)
        self.line(x2, y - 5, x2, y + 5, stroke=colour, sw=1)
        self.o.append(f'<line x1="{x1:.2f}" y1="{y:.2f}" x2="{x2:.2f}" y2="{y:.2f}" '
                      f'stroke="{colour}" stroke-width="1" marker-start="url(#as)" '
                      f'marker-end="url(#a)"/>')
        ty = y - 7 if above else y + 15
        self.text((x1 + x2) / 2, ty, label, size=11.5, fill=colour, anchor="middle")

    def dim_v(self, x, y1, y2, label, colour=DIM):
        self.line(x - 5, y1, x + 5, y1, stroke=colour, sw=1)
        self.line(x - 5, y2, x + 5, y2, stroke=colour, sw=1)
        self.o.append(f'<line x1="{x:.2f}" y1="{y1:.2f}" x2="{x:.2f}" y2="{y2:.2f}" '
                      f'stroke="{colour}" stroke-width="1" marker-start="url(#as)" '
                      f'marker-end="url(#a)"/>')
        self.text(x + 8, (y1 + y2) / 2 + 4, label, size=11.5, fill=colour)

    def leader(self, x, y, tx, ty, label, colour=DIM, anchor="start", size=11.5,
               weight="400"):
        self.circle(x, y, 2.2, fill=colour)
        self.o.append(f'<path d="M{x:.2f},{y:.2f} L{tx:.2f},{ty:.2f}" fill="none" '
                      f'stroke="{colour}" stroke-width="0.9"/>')
        dx = 5 if anchor == "start" else -5
        self.text(tx + dx, ty + 4, label, size=size, fill=colour, anchor=anchor,
                  weight=weight)

    def centreline(self, x1, y, x2):
        self.line(x1, y, x2, y, stroke=HAIR, sw=0.9, **{"stroke-dasharray": "14 4 3 4"})

    def elbow(self, x, y, colx, ty, lines, colour=DIM, side="left", size=11.5,
              lh=14, weight="400", dotcol=None):
        """Callout with an elbow leader into a left/right text column."""
        mid = colx + (26 if side == "left" else -26)
        self.circle(x, y, 2.4, fill=dotcol or colour)
        self.path(f"M{x:.2f},{y:.2f} L{mid:.2f},{ty:.2f} L{colx:.2f},{ty:.2f}",
                  stroke=colour, sw=0.9, fill="none")
        if isinstance(lines, str):
            lines = [lines]
        anchor = "end" if side == "left" else "start"
        off = -7 if side == "left" else 7
        for i, ln in enumerate(lines):
            self.text(colx + off, ty + 4 + i * lh, ln, size=size, fill=colour,
                      anchor=anchor, weight=weight if i == 0 else "400")

    def wedge(self, cx, cy, r, a0, a1, fill=None, stroke=None, sw=1, opacity=0.14):
        import math
        p0 = (cx + r * math.cos(math.radians(a0)), cy + r * math.sin(math.radians(a0)))
        p1 = (cx + r * math.cos(math.radians(a1)), cy + r * math.sin(math.radians(a1)))
        large = 1 if abs(a1 - a0) > 180 else 0
        d = (f"M{cx:.1f},{cy:.1f} L{p0[0]:.1f},{p0[1]:.1f} "
             f"A{r:.1f},{r:.1f} 0 {large} 1 {p1[0]:.1f},{p1[1]:.1f} Z")
        if fill:
            self.o.append(f'<path d="{d}" fill="{fill}" opacity="{opacity}"/>')
        if stroke:
            self.path(d, stroke=stroke, sw=sw, fill="none",
                      **{"stroke-dasharray": "6 5"})

    _clip_n = 0

    def clip(self, x, y, w, h):
        """Context manager: everything drawn inside is clipped to this box."""
        kit = self

        class _C:
            def __enter__(inner):
                Svg._clip_n += 1
                inner.cid = f"clip{Svg._clip_n}"
                kit.o.append(f'<clipPath id="{inner.cid}"><rect x="{x}" y="{y}" '
                             f'width="{w}" height="{h}"/></clipPath>')
                kit.o.append(f'<g clip-path="url(#{inner.cid})">')
                return inner

            def __exit__(inner, *a):
                kit.o.append("</g>")
                return False
        return _C()

    def note(self, x, y, lines, colour=DIM, size=11.5, lh=15, weight="400"):
        for i, ln in enumerate(lines):
            self.text(x, y + i * lh, ln, size=size, fill=colour, weight=weight)

    def panel(self, x, y, w, h, label=None, fill="#f7f9fc", stroke=FAINT):
        self.rect(x, y, w, h, fill=fill, stroke=stroke, sw=1.2, rx=8)
        if label:
            self.text(x + 12, y + 20, label, size=12.5, weight="700", fill=INK)

    @staticmethod
    def _kw(kw):
        return "".join(f' {k.replace("_","-")}="{v}"' for k, v in kw.items())

    def save(self, path):
        self.o.append("</svg>")
        doc = "\n".join(self.o)
        # Fail loudly on malformed SVG (duplicate attributes, unescaped text...)
        from xml.dom.minidom import parseString
        parseString(doc)
        open(path, "w").write(doc)
        return path
