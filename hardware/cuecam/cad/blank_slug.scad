// ===========================================================================
// Blank slug - the part that makes the camera optional.
// Shell prints; the brass core is turned to suit. Weigh the camera cartridge,
// then face the core back until the blank matches it within 0.5 g.
// ===========================================================================
include <lib.scad>;
LEN = BAY_LEN - 4;
CORE_D = 10.0;

difference() {
    union() {
        cylinder(h = LEN, d = CART_OD);
        for (i = [0 : BAY_LUGS - 1]) rotate([0, 0, i * 360 / BAY_LUGS])
            translate([0, 0, LEN - LUG_T - 2])
                rotate_extrude(angle = LUG_W / (PI * CART_OD/2) * 180)
                    translate([CART_OD/2 - 0.1, 0]) square([LUG_H, LUG_T]);
    }
    // brass core bore - core is bonded in with the cue on a scale
    translate([0, 0, 3]) cylinder(h = LEN - 6, d = CORE_D + FIT);
    // trim pockets: drop 2 g grub screws in to fine-match
    for (z = [12, 28, 44]) translate([0, 0, z])
        rotate([90, 0, 0]) cylinder(h = CART_OD, d = 3.2, center = true);
}
