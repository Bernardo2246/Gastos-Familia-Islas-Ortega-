#!/bin/sh
export PATH="/Users/bernardo/.local/node-v24.18.0-darwin-arm64/bin:$PATH"
cd "$(dirname "$0")"
exec npm run dev
