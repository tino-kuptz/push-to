#!/bin/sh
echo "Starting push-to"
cd /drone/src
node --no-deprecation /home/node/index.js | npx pino-pretty