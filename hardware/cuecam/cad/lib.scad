// Small helpers shared by the CueCam parts.
include <params.scad>;

// A solid of revolution from a list of [x, radius] points.
module revolve(profile, fn = $fn) {
    rotate_extrude($fn = fn)
        polygon(concat([[0, profile[0][0]]],
                       [for (p = profile) [p[1], p[0]]],
                       [[0, profile[len(profile) - 1][0]]]));
}

// Smootherstep, the same blend the drawings use, so printed parts and
// drawings agree on the collar silhouette.
function blend(t) = let (u = max(0, min(1, t))) u*u*u*(u*(u*6 - 15) + 10);

function collar_r(x) =
      x <= LEAD_IN
    ? (SHAFT_DIA_AT_J1 + (POD_OD - SHAFT_DIA_AT_J1) * blend(x / LEAD_IN)) / 2
    : x <= COLLAR_LEN - LEAD_OUT
    ? POD_OD / 2
    : (POD_OD + (15.9 - POD_OD)
        * blend((x - (COLLAR_LEN - LEAD_OUT)) / LEAD_OUT)) / 2;

function collar_profile(n = 80) =
    [for (i = [0 : n]) let (x = COLLAR_LEN * i / n) [x, collar_r(x)]];

// A bayonet track cut: axial entry, then a circumferential run to a detent.
module bayonet_track(r, angle = BAYONET_ANGLE, w = LUG_W + 2*FIT,
                     t = LUG_T + 2*FIT, depth = LUG_H + FIT) {
    // axial entry slot
    translate([0, 0, -0.1]) rotate([0, 0, -w/2 / (PI*r) * 180])
        rotate_extrude(angle = w / (PI * r) * 180, $fn = 128)
            translate([r - depth, 0]) square([depth + 1, t + 2]);
    // circumferential run
    translate([0, 0, t - 0.1])
        rotate_extrude(angle = angle, $fn = 128)
            translate([r - depth, 0]) square([depth + 1, w]);
}

module knurl(r, h, n = 36, d = 0.6) {
    for (i = [0 : n - 1]) rotate([0, 0, i * 360 / n])
        translate([r, 0, 0]) cylinder(h = h, d = d, $fn = 8);
}
