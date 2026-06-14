#!/bin/bash
# PlayNexa Dev Server Keeper - auto-restarts if process dies
cd /home/z/my-project
while true; do
  echo "Starting Next.js dev server at $(date)" >> dev-keeper.log
  npx next dev -p 3000 >> dev.log 2>&1
  EXIT_CODE=$?
  echo "Server stopped (exit: $EXIT_CODE) at $(date), restarting in 5s..." >> dev-keeper.log
  sleep 5
done
