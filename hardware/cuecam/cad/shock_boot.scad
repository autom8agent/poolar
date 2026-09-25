// ===========================================================================
// TPU 95A shock boot - the only thing between a 500 g axial spike and the
// camera. Print two (front and rear) from an external spool, not the AMS.
// ===========================================================================
include <lib.scad>;

BOOT_LEN = 26;
RIB_N    = 6;

difference() {
    union() {
        cylinder(h = BOOT_LEN, d = BAY_DIA - 2*FIT);
        // crush ribs: they, not the wall, set the preload
        for (i = [0 : RIB_N - 1]) rotate([0, 0, i * 360 / RIB_N])
            translate([BAY_DIA/2 - FIT - 0.2, 0, 2])
                cylinder(h = BOOT_LEN - 4, d = 1.4, $fn = 12);
    }
    translate([0, 0, -1]) cylinder(h = BOOT_LEN + 2, d = CART_OD + FIT);
    // lens window must not be covered
    translate([0, 0, 13]) rotate([90, 0, 0]) cylinder(h = BAY_DIA, d = LENS_BORE + 2);
}
