// ===========================================================================
// Camera cartridge shell. Holds the PCB, the cell and the card, and nothing
// touches the collar except the TPU boot and the two bayonet lugs.
// ===========================================================================
include <lib.scad>;

LEN = BAY_LEN - 4;

module shell() {
    difference() {
        union() {
            cylinder(h = LEN, d = CART_OD);
            // bayonet lugs, printed proud; steel pins press into these for
            // the production build - printed lugs are prototype-only
            for (i = [0 : BAY_LUGS - 1]) rotate([0, 0, i * 360 / BAY_LUGS])
                translate([0, 0, LEN - LUG_T - 2])
                    rotate_extrude(angle = LUG_W / (PI * CART_OD/2) * 180)
                        translate([CART_OD/2 - 0.1, 0])
                            square([LUG_H, LUG_T]);
        }
        // main cavity
        translate([0, 0, CART_WALL])
            cylinder(h = LEN - 2*CART_WALL, d = CART_OD - 2*CART_WALL);
        // PCB slot, stood on edge so the 16 mm dimension is radial
        translate([-PCB_T/2 - FIT/2, -PCB_W/2, 4])
            cube([PCB_T + FIT, PCB_W, PCB_L]);
        // captive cell pocket
        translate([-CELL_W/2, -CELL_T/2 - 4, 20])
            cube([CELL_W, CELL_T + FIT, CELL_L]);
        // card slot + finger relief
        translate([-SD_W/2, 3, LEN - 20]) cube([SD_W, SD_T + FIT, 16]);
        // lens aperture
        translate([0, 0, 13]) rotate([90, 0, 0]) cylinder(h = CART_OD, d = LENS_BORE);
        // steel pin seats for the production lugs
        for (i = [0 : BAY_LUGS - 1]) rotate([0, 0, i * 360 / BAY_LUGS])
            translate([CART_OD/2 - 3, 0, LEN - LUG_T - 0.5])
                rotate([0, 90, 0]) cylinder(h = 4, d = 2.0 - PRESS);
    }
}

shell();
