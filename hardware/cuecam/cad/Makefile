# Export every printable part to STL.
#   make            - all parts
#   make collar.stl - one part
# Needs OpenSCAD on PATH (https://openscad.org). Nothing here is machine
# specific; slice the STLs in Bambu Studio with the profiles in
# ../docs/print-settings.md.

OPENSCAD ?= openscad
PARTS := collar cartridge shock_boot butt_cap grip_sleeve blank_slug tip_spanner
STLS  := $(addprefix stl/,$(addsuffix .stl,$(PARTS)))

all: $(STLS)

stl/%.stl: %.scad params.scad lib.scad
	@mkdir -p stl
	$(OPENSCAD) -o $@ $<

clean:
	rm -rf stl

.PHONY: all clean
