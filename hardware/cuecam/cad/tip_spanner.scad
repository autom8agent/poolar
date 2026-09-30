// ===========================================================================
// Tip spanner. Two flats on the ferrule, a puck seat, and a lanyard hole so
// it lives on the cue case rather than on the floor of the pub.
// ===========================================================================
include <lib.scad>;

L = 96; W = 18; T = 7;

difference() {
    hull() {
        cylinder(h = T, d = W);
        translate([L - W, 0, 0]) cylinder(h = T, d = W);
    }
    // ferrule flats
    translate([0, 0, -1]) cylinder(h = T + 2, d = TIP_DIA + FIT);
    translate([-TIP_DIA/2 - 2, -2.6, -1]) cube([TIP_DIA + 4, 5.2, T + 2]);
    // puck seat, for holding a prepared tip while the stud goes in
    translate([L - W, 0, -1]) cylinder(h = T - 2, d = TIP_DIA + 0.6);
    // lanyard
    translate([L - W, 0, -1]) cylinder(h = T + 2, d = 3.2);
    // label
    translate([W, -3, T - 0.6]) linear_extrude(1) text("9.5", size = 5);
}
