#!/bin/zsh
set -e
cd "$(dirname "$0")"
PORT=4199
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT+1))
done
printf "\nGUANYU LAB R22.2 -> http://127.0.0.1:%s\n\n" "$PORT"
PORT=$PORT node server.mjs &
PID=$!
trap 'kill $PID >/dev/null 2>&1 || true' EXIT INT TERM
sleep 0.8
open "http://127.0.0.1:$PORT/?build=v45-r22-2-launchfix"
wait $PID
