// ===========================================================================
// CueCam - shared parameters
// Every printed part in this folder is driven from here. Change a number,
// re-export, reprint. Units: mm.
// ===========================================================================

/* [Cue geometry] */
CUE_LEN        = 1473.2;   // 58 in
JOINT1_X       = 482.6;    // 19 in - the "one third from the tip" station
SHAFT_DIA_AT_J1= 14.2;     // cue diameter where the collar starts

/* [Camera collar] -------------------------------------------------------- */
// POD_OD is THE parameter. 24 suits a 16 mm-wide custom PCB; use 29 for a
// de-cased RunCam Thumb Pro. Anything over 30 is unplayable - see docs.
POD_OD         = 24.0;
COLLAR_LEN     = 117.4;
COLLAR_WALL    = 2.0;
BAY_LEN        = 70.0;     // cartridge bay
BAY_DIA        = 19.2;     // bay bore
LEAD_IN        = 29.4;     // front blend length
LEAD_OUT       = 38.0;     // rear blend length

/* [Bayonet] -------------------------------------------------------------- */
BAY_LUGS       = 2;        // lugs, equally spaced
LUG_W          = 4.0;      // circumferential width
LUG_H          = 1.8;      // radial height
LUG_T          = 3.0;      // axial thickness
BAYONET_ANGLE  = 28;       // degrees of twist to lock
DETENT_R       = 0.55;     // detent bump radius
EJECT_TRAVEL   = 9.0;      // how far the spring pushes the cartridge out

/* [Cartridge] ------------------------------------------------------------ */
CART_OD        = 18.6;     // slides in BAY_DIA with the boot around it
CART_WALL      = 1.2;
PCB_W          = 16.0;
PCB_T          = 1.6;
PCB_L          = 58.0;
CELL_W         = 20.0;     // LiPo 402040
CELL_T         = 4.0;
CELL_L         = 40.0;
SD_W           = 11.0;
SD_T           = 1.0;

/* [Optics] --------------------------------------------------------------- */
LENS_R         = 11.0;     // lens height above the cue axis
LENS_BORE      = 8.0;      // M12 lens barrel clearance
WINDOW_W       = 6.0;
WINDOW_H       = 4.0;
WINDOW_T       = 0.8;
// Max nose-down tilt before the cue's own shaft blocks the axis is 0.67 deg
// (tools/optics.py). So: zero. The lens looks straight down the cue.
LENS_TILT      = 0.0;

/* [Butt] ----------------------------------------------------------------- */
BUTT_OD        = 29.5;
BUTT_WALL      = 1.4;
BOLT_BORE_DIA  = 8.0;      // 5/16-14 clearance
BOLT_BORE_LEN  = 190.0;    // long on purpose: halves the balance swing
CAP_LEN        = 26.0;
BUMPER_THREAD  = 12.0;     // M12x1, LEFT hand

/* [Grip] ----------------------------------------------------------------- */
GRIP_LEN       = 260.0;
GRIP_WALL      = 2.6;
GRIP_SPLIT     = 1.2;      // split width so it springs over the butt
INDEX_RIB_W    = 2.0;      // tells your hand where the lens is

/* [Tip] ------------------------------------------------------------------ */
TIP_DIA        = 9.5;
FERRULE_LEN    = 13.0;
FERRULE_BORE   = 6.3;
STUD           = "4-40";   // #4-40 UNC, 2.845 mm major

/* [Print] ---------------------------------------------------------------- */
FIT            = 0.20;     // clearance on sliding fits, PA6-CF on a P1S
PRESS          = 0.05;     // interference on bonded fits
$fn            = 96;
