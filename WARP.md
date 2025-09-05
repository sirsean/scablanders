# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

- Project type: TypeScript monorepo-style layout for a browser game client and a Cloudflare Worker backend (Hono) with a single Durable Object for game state.

Quick commands

- Install deps: npm ci
- Dev (Vite + Worker): npm run dev
- Build client + worker: npm run build
- Deploy (prod): npm run deploy
- Deploy (staging env): npm run deploy:staging
- Lint: npm run lint
- Format: npm run format
- Tests (Vitest): npm test
- Run a single test: npx vitest -t "pattern" or npx vitest path/to/file.test.ts -t "pattern"
- Cloudflare typegen (keeps Env types current): npm run cf-typegen

Agent workflow and version control

- Do NOT run `git commit` or `git push` unless explicitly instructed by the user.
- Prefer to wait for explicit approval before staging/committing. If staging is necessary for a task (e.g., to run a staged-only tool), announce it and confirm.
- Avoid pager output in the terminal; use `--no-pager` for all git commands.

Notes

- The Vite dev server serves the client from client/ at http://localhost:5173.
- Wrangler (Cloudflare) serves the API under /api/\* and WebSocket upgrade at /ws through server/worker.ts. Static assets are built to public/ and served by the Worker via wrangler assets binding.
- Path aliases in TS/Vite: @shared/_ → ./shared/_, @client/_ → ./client/_, @server/_ → ./server/_.

Architecture overview

- Client (client/)
  - Vite entry is client/main.ts. Phaser game scenes (e.g., BootScene, GameScene) run in the browser. UI is handled via DOM and a UIManager.
  - Authentication is Sign-In with Ethereum (SIWE) via Wagmi/Viem (client/auth.ts). It hits /api/auth/nonce and /api/auth/verify; on success a secure cookie (CF_ACCESS_TOKEN) is set.
  - Game state is orchestrated by client/gameState.ts. It:
    - Tracks player profile, world state, missions, and UI panel toggles.
    - Calls REST endpoints: /api/profile, /api/world/state, /api/mercenaries, /api/missions/\*.
    - Manages a WebSocket connection to /ws for real-time updates (player_state, world_state, mission_update, notification). Falls back to periodic polling if disconnected.
- Shared (shared/)
  - Canonical game models, enums, and WebSocket message contracts (shared/models.ts).
  - Broadcast envelope types (shared/broadcast.ts) and mission helper utilities (shared/mission-utils.ts).
- Server (server/)
  - server/worker.ts wires a Hono app (CORS, health check, dev debug routes) and mounts route modules under /api/\*: auth, profile, world, missions, mercenaries. It also exports the Durable Object class.
  - Durable Object: server/game-do.ts holds the entire authoritative game state (players, missions, resource nodes, world metrics). It persists via ctx.storage and sends real-time updates to connected sessions. It also manages resource node initialization and periodic management.
  - WebSocket: server/websocket.ts handles the Upgrade to /ws, session tracking, optional cookie-based auth using CF_ACCESS_TOKEN, and basic message types (authenticate, subscribe, ping). Messages are JSON matching shared models.
  - Auth: server/routes/auth.ts implements SIWE nonce and verify, issuing the CF_ACCESS_TOKEN cookie (base64 session token). Other routes apply a lightweight auth middleware (see server/middleware/auth).\*
  - World/profile/missions/mercenaries routes call into the GameDO (via env.GAME_DO.idFromName('game')) for data and mutations. Missions include dev helpers for completing or triggering resource management.
- Build & deploy
  - Vite config (vite.config.ts) sets root=./client and builds to ../public. It uses @cloudflare/vite-plugin to integrate Worker entry at server/worker.ts and wrangler.jsonc config.
  - wrangler.jsonc declares Durable Object binding GAME_DO and KV namespaces AUTH_KV and KV. Static assets directory is ./public.

Environment and bindings

- Cloudflare bindings (wrangler.jsonc)
  - Durable Object: GAME_DO → class GameDO (authoritative game state and WebSockets to clients)
  - KV: AUTH_KV (stores SIWE nonces), KV (general use; used by mercenary/NFT helpers)
  - assets.directory: ./public (client build output served at /)
- Environment variables seen in code
  - ALCHEMY_API_KEY: used by scripts/build-drifters.js and server NFT ownership lookups (nft.ts). Provide via wrangler secret for deployed environments, and .dev.vars locally.

Local development

- Run npm run dev to start Vite (5173) and the Worker. The Hono app has CORS configured to allow http://localhost:5173.
- The client attempts SIWE flows; without a wallet installed, auth.connect() will set an error in state. For development against API without auth, profile returns a mock profile if unauthenticated.
- WebSocket connects to /ws. If the CF_ACCESS_TOKEN cookie is present, the socket is considered authenticated; otherwise it downgrades to polling.

Testing

- Vitest is configured via package.json. If no tests exist yet, the command will be a no-op. To target a specific test: npx vitest -t "mission" or npx vitest path/to/file.test.ts -t "case".

Data scripts

- scripts/build-drifters.js builds server/data/drifters.json and processes images for mercenaries:
  - Requires ALCHEMY_API_KEY (env or --key flag). Fetches NFT metadata from the Fringe Drifters API and optionally downloads/resizes images to public/images/drifters.
  - Example invocations:
    - node scripts/build-drifters.js --limit 100 --refresh-metadata
    - node scripts/build-drifters.js --download-images --resize-images --batch-size 20 --delay 200

Deploy

- Ensure wrangler is authenticated (wrangler login) and required secrets (ALCHEMY_API_KEY) are set: wrangler secret put ALCHEMY_API_KEY
- Deploy prod: npm run deploy
- Deploy staging (if wrangler env configured): npm run deploy:staging

Troubleshooting

- Health check: curl -s https://<your-worker>/api/health
- Local health: curl -s http://127.0.0.1:8787/api/health (when running wrangler dev)
- Debug missions (dev only routes in worker):
  - List: GET /api/debug/missions or /api/debug/missions/:address
  - Cleanup: POST /api/debug/cleanup-missions
