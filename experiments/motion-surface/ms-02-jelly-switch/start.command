#!/bin/zsh
cd "$(dirname "$0")"
PORT="${PORT:-4197}"
# Never attach this build to a stale Jelly Switch server from an older ZIP.
while command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:$PORT -sTCP:LISTEN -t >/dev/null 2>&1; do
  PORT=$((PORT+1))
done
export PORT
echo "GUANYU LAB Jelly Switch R7.1 -> http://127.0.0.1:$PORT/?build=ms02-r7-1-framing-restore"
node server.mjs &
PID=$!
sleep 1
if ! kill -0 "$PID" >/dev/null 2>&1; then
  echo "Server failed to start."
  exit 1
fi
open "http://127.0.0.1:$PORT/?build=ms02-r7-1-framing-restore"
wait "$PID"
