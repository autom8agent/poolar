#!/bin/sh
# Stamp every pool page with a new build id so open pages update themselves (see build.js).
b=$(date -u +%Y%m%d%H%M%S)
for f in deck.html phonecam.html hall.html glasses.html wait.html profile.html tournament.html admin.html broadcast.html join.html night.html snooker.html; do
  sed -i '' -E "s#<meta name=\"build\" content=\"[^\"]*\">#<meta name=\"build\" content=\"$b\">#" "$f"
  # new script/style addresses every release, so no browser keeps running an old copy
  sed -i '' -E "s#\.(js|css)\?v=[0-9]+\"#.\1?v=$b\"#g" "$f"
done
echo "build $b"
