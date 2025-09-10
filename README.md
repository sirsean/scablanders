# Scablanders

Game client + Cloudflare Worker backend for Scablanders.

## Resource Nodes: Hard Cap and Pruning

To keep the client performant, the server enforces a global hard cap on stored resource nodes.

- Hard cap: 80 total nodes (across all types)
- Selection when pruning: keep
  - All nodes targeted by active missions (protected), and then
  - The remaining highest-currentYield nodes until the cap is reached
- Enforcement points:
  - On startup (after loading state)
  - After the initial resource management pass
  - On every scheduled resource management cycle (via Durable Object alarms)
  - All spawn paths respect the remaining capacity and never add nodes above the cap

Note: In the rare case that active-mission-target nodes alone exceed the cap, no protected nodes are removed. New spawns will be blocked until the total drops below the cap (e.g., when missions complete). API responses still trim to the cap for safety.

### Manually Trigger Pruning (Debug)

When running locally (Vite dev on 5173):

- Trigger pruning now:
  - curl -X POST -s http://localhost:5173/api/world/debug/prune-resource-nodes | jq .
- Check current counts:
  - curl -s http://localhost:5173/api/world/state | jq '.resourceNodes | length'
  - curl -s http://localhost:5173/api/world/state | jq '[.resourceNodes[] | select(.isActive == true and (.currentYield // 0) > 0)] | length'
  - curl -s http://localhost:5173/api/world/state | jq '[.resourceNodes[] | .type] | group_by(.) | map({type: .[0], count: length})'

API safety: /api/world/state trims the resourceNodes array to at most 80 entries for clients (favoring active nodes with highest currentYield). WebSocket world_state updates naturally stay small once the storage is pruned.

## Quick Commands

- Install deps: npm ci
- Dev (Vite + Worker): npm run dev
- Build client + worker: npm run build
- Deploy (prod): npm run deploy
- Deploy (staging env): npm run deploy:staging
- Lint: npm run lint
- Format: npm run format
- Tests (Vitest): npm test

