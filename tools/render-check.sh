#!/bin/bash
# Renders pages in headless Chrome and reports diagrams/widgets that failed.
# Needs the site served locally:  python3 -m http.server 8765
# Usage: tools/render-check.sh caching url-shortener ...
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT="${PORT:-8765}"
OUT="$(mktemp -d)"
status=0
for id in "$@"; do
  f="$OUT/$id.html"
  "$CH" --headless=new --disable-gpu --virtual-time-budget=15000 --dump-dom "http://localhost:$PORT/#/p/$id" > "$f" 2>/dev/null
  figs=$(grep -o 'class="figure"' "$f" | wc -l | tr -d ' ')
  done_=$(grep -o 'data-done="1"' "$f" | wc -l | tr -d ' ')
  bad=$(grep -c 'could not be drawn\|Syntax error in text\|Widget failed\|Couldn.t load this page' "$f")
  code=$(grep -o 'class="code-block"' "$f" | wc -l | tr -d ' ')
  wid=$(grep -o 'class="widget"' "$f" | wc -l | tr -d ' ')
  mark="✓"; [ "$bad" != "0" ] && { mark="✗"; status=1; }
  if ! grep -q 'class="takeaways"\|class="quiz"' "$f"; then mark="✗ (page did not load — is the server running on :$PORT?)"; status=1; fi
  echo "$mark $id: diagrams $done_/$figs drawn (rest are in unopened tabs), code blocks $code, widgets $wid, errors $bad"
done
rm -rf "$OUT"
exit $status
