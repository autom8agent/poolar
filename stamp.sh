#!/bin/sh
# Stamp every pool page with a new build id so open pages update themselves (see build.js).
b=$(date -u +%Y%m%d%H%M%S)
for f in deck.html phonecam.html hall.html glasses.html wait.html profile.html tournament.html admin.html; do
  sed -i '' -E "s#<meta name=\"build\" content=\"[^\"]*\">#<meta name=\"build\" content=\"$b\">#" "$f"
done
echo "build $b"
