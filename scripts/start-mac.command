#!/bin/bash
# Doppelklick-Start für macOS: PocketBase + Vite-Dev-Server
cd "$(dirname "$0")/.."
if [ ! -d node_modules ]; then npm install; fi
npm run server &
SERVER=$!
sleep 2
npm run dev
kill $SERVER
