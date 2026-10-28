#!/usr/bin/env bash
# Starts a local MongoDB-compatible database for the test suite (FerretDB + SQLite).
# Download once from https://github.com/FerretDB/FerretDB/releases (v1.24.x, ferretdb-linux-amd64).
# Alternatively point TEST_MONGO_URI at any MongoDB you can throw data away on.
set -e
DIR="${FERRET_DIR:-/tmp/claude-0/-home-claude/b95fe89b-096e-565f-bd36-2b485933ec26/scratchpad/ferret}"
(echo > /dev/tcp/127.0.0.1/27017) 2>/dev/null && exit 0
mkdir -p "$DIR/data"
nohup "$DIR/ferretdb" --handler=sqlite --sqlite-url=file:$DIR/data/ --listen-addr=127.0.0.1:27017 --telemetry=disable > "$DIR/ferret.log" 2>&1 &
sleep 3
