// ===========================================================================
// Split TPU grip sleeve. Springs over the butt, trapped by the butt-cap
// shoulder. Print in three durometers and decide with the cue in your hand.
// The index rib runs along the same clock position as the lens.
// ===========================================================================
include <lib.scad>;

D_AT_TOP = 25.6;   // butt diameter where the grip starts
D_AT_BOT = 29.0;

difference() {
    union() {
        cylinder(h = GRIP_LEN, d1 = D_AT_TOP + 2*GRIP_WALL,
                               d2 = D_AT_BOT + 2*GRIP_WALL);
        // index rib - tells your hand which way the lens is pointing
        translate([0, 0, 0]) rotate([0, 0, 0])
            translate([-INDEX_RIB_W/2, D_AT_TOP/2, 0])
                cube([INDEX_RIB_W, GRIP_WALL + 1.0, GRIP_LEN]);
    }
    translate([0, 0, -1]) cylinder(h = GRIP_LEN + 2, d1 = D_AT_TOP + FIT,
                                                     d2 = D_AT_BOT + FIT);
    // the split, opposite the index rib
    translate([-GRIP_SPLIT/2, -D_AT_BOT, -1])
        cube([GRIP_SPLIT, D_AT_BOT, GRIP_LEN + 2]);
}
