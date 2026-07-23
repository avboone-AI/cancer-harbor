#!/bin/zsh

set -u

SITE_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT="${CANCER_HARBOR_PORT:-8080}"
URL="http://127.0.0.1:${PORT}/"
LOG_FILE="$SITE_DIR/.cancer-harbor-server.log"

if /usr/bin/curl --silent --fail --max-time 1 "$URL" >/dev/null 2>&1; then
  /usr/bin/open "$URL"
  exit 0
fi

cd "$SITE_DIR" || exit 1
/usr/bin/nohup /usr/bin/python3 -m http.server "$PORT" --bind 127.0.0.1 >"$LOG_FILE" 2>&1 &

for attempt in {1..40}; do
  if /usr/bin/curl --silent --fail --max-time 1 "$URL" >/dev/null 2>&1; then
    /usr/bin/open "$URL"
    exit 0
  fi
  /bin/sleep 0.25
done

/usr/bin/osascript -e 'display dialog "Cancer Harbor could not start. Please send the .cancer-harbor-server.log file to Codex for review." buttons {"OK"} default button "OK" with icon stop'
exit 1
