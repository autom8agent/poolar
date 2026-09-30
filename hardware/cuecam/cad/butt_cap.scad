// ===========================================================================
// Butt cap. Stays captive on the cue; the rubber bumper threads into it with
// a LEFT hand thread so a hard shot tightens rather than loosens it.
// ===========================================================================
include <lib.scad>;

difference() {
    union() {
        cylinder(h = CAP_LEN, d1 = BUTT_OD, d2 = BUTT_OD);
        translate([0, 0, -6]) cylinder(h = 6, d = BUTT_OD - 2*BUTT_WALL - FIT);
    }
    // bumper thread pocket - tap M12x1 LH after printing, or bond a brass nut
    translate([0, 0, CAP_LEN - 11]) cylinder(h = 12, d = BUMPER_THREAD - 1.0);
    // 4 mm hex access straight through to the bolt stack
    translate([0, 0, -7]) cylinder(h = CAP_LEN + 8, d = BOLT_BORE_DIA + FIT);
    // grip sleeve shoulder: the sleeve is trapped here, no glue
    translate([0, 0, -6.1]) cylinder(h = 3, d = BUTT_OD - 2*GRIP_WALL);
    // spanner flats
    for (i = [0, 1]) rotate([0, 0, i * 180])
        translate([BUTT_OD/2 - 0.8, -6, 4]) cube([3, 12, 10]);
}
