// ===========================================================================
// Camera collar barrel - the part that makes this cue a camera cue.
// Prints in two halves split on the parting line; bond with 3M DP420 or
// Loctite EA 9460, then wrap one layer of 3k carbon sleeve and wet it out.
// The bond line is NOT structural on its own.
// ===========================================================================
include <lib.scad>;

HALF = true;        // false = whole part, for visualisation

module collar_solid() {
    revolve(collar_profile());
}

module bores() {
    // through bore for the cue's internal ballast rod / wiring route
    translate([0, 0, -1]) cylinder(h = COLLAR_LEN + 2, d = 9.6);
    // joint 1 female socket pocket (the 6061 insert is bonded in)
    translate([0, 0, -0.1]) cylinder(h = 19, d = 18.8 + PRESS);
    // cartridge bay
    translate([0, 0, 17.4]) cylinder(h = BAY_LEN + 6, d = BAY_DIA + FIT);
    // lens window aperture, looking forward, axis PARALLEL to the cue
    translate([0, LENS_R - 4, 30.6]) rotate([90, 0, 0])
        cylinder(h = 8, d = LENS_BORE);
    // window seat, 0.3 deep rebate so the sapphire finishes flush
    translate([-WINDOW_W/2, POD_OD/2 - WINDOW_T - 0.3, 30.6 - WINDOW_H/2])
        cube([WINDOW_W, WINDOW_T + 0.4, WINDOW_H]);
    // vent
    translate([0, -POD_OD/2 - 1, 92]) rotate([-90, 0, 0]) cylinder(h = 6, d = 0.8);
}

module lugs_and_track() {
    r = BAY_DIA / 2 + FIT;
    for (i = [0 : BAY_LUGS - 1]) rotate([0, 0, i * 360 / BAY_LUGS])
        translate([0, 0, 17.4 + BAY_LEN - LUG_T - 2]) bayonet_track(r);
}

module collar() {
    difference() {
        collar_solid();
        bores();
        lugs_and_track();
        // knurl relief on the tail so the bayonet ring has something to grip
        translate([0, 0, COLLAR_LEN - 30]) knurl(POD_OD/2 - 0.3, 14, 48, 0.9);
        if (HALF)
            translate([-POD_OD, -POD_OD/2 - 1, -1])
                cube([POD_OD * 2, POD_OD, COLLAR_LEN + 2]);
    }
    // alignment pins on the parting face
    if (HALF) for (z = [22, 58, 96])
        translate([0, -POD_OD/2 - 1, z]) rotate([90, 0, 0])
            cylinder(h = 3, d = 2.4 - FIT);
}

collar();
