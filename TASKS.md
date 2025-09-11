# Scablanders Development Roadmap

Last updated: 2025-09-11

## Overview

This document tracks the development roadmap for **Scablanders**, a casual web-based multiplayer game set in The Fringe universe. The game features:

- Shared persistent world where all players interact
- NFT integration with Fringe Drifters as mercenaries-for-hire
- Casual "click & venture" gameplay with asynchronous missions
- Indirect PvP through bandit interceptions (planned)
- Cloudflare Workers + Durable Objects backend
- Phaser 3 client running in browser

---

## Development Status

- Current Focus: Phase 4 (Phaser 3 Client polish) and newly added systems (Monsters, Town, Vehicles)
- Next Milestone: Finish Phase 4 polish and UI panels; begin Phase 5 notifications polish and Phase 6 tests
- Target MVP: Completion of Phase 6 (Testing & Deployment)

---

## Completed Milestones

### ✅ Phase 1: Foundation & Architecture

Development Environment:

- ✅ Vite + Cloudflare Workers integrated development server
- ✅ Hot Module Reload for client-side development
- ✅ TypeScript compilation with path aliases (`@shared`, `@client`, `@server`)
- ✅ Phaser 3 engine loading and rendering

Project Structure:

- ✅ `client/` - Phaser 3 game client
- ✅ `server/` - Cloudflare Worker + Durable Objects
- ✅ `shared/` - Common TypeScript types/models
- ✅ `public/` - Static assets served by Worker
- ✅ `scripts/` - Build/deploy utilities
- ✅ `package.json`, `vite.config.ts`, `tsconfig.json`, `wrangler.jsonc`

Client & Server:

- ✅ Basic Phaser 3 client with map and UI bootstrap
- ✅ API server with health checks and modular routes
- ✅ Comprehensive shared type system in `shared/models.ts`

### ✅ Phase 2: Authentication & NFT Integration

SIWE Authentication System:

- ✅ Sign-In-With-Ethereum (siwe) with nonces (KV), verification, and secure cookie session
- ✅ Auth middleware for protected endpoints (Hono)
- ✅ Client integration with viem/wagmi

NFT Ownership Integration:

- ✅ Alchemy SDK ownership queries with KV caching
- ✅ Fringe Drifters contract integration (`0xe3B399AAb015D2C0D787ECAd40410D88f4f4cA50`)
- ✅ `/api/profile` includes real owned Drifters; registry-backed stats

### ✅ Phase 3: Backend & Core Logic

Durable Objects Architecture:

- ✅ `GameDO` for global game state, storage, and scheduled alarms

Core Gameplay Systems:

- ✅ Missions: scavenge/strip-mine; combat vs monsters (PvE)
- ✅ Economy: player balances; vehicle purchases; prosperity gains from resource missions
- ✅ Resources: spawn/degrade with a hard cap and pruning
- ✅ Notifications: server-queued and real-time toasts to clients
- ✅ Event Log: persistent global event feed (WS live append)

API Endpoints (selected):

- ✅ `/api/profile`
- ✅ `/api/world/*` (state, missions, debug resource management)
- ✅ `/api/missions/*` (start, complete, reconcile-vehicles, player missions, get by id)
- ✅ `/api/market/*` (vehicles list, purchase with town gating)
- ✅ `/api/drifters/*` (progress, allocate-point)
- ✅ `/api/town/*` (state, contribute)
- ✅ `/api/leaderboards` (global contribution boards)
- ✅ `/api/logs` (global event log)

### ✅ Phase 3.5: New Game Systems

- ✅ Monsters (PvE): server-controlled monsters; combat missions; engagement and XP/leveling for drifters
- ✅ Town & Prosperity: town attributes (vehicle_market, perimeter_walls); contributions and prosperity gains from missions
- ✅ Vehicles: market gating, purchase flow, and mission integration (capacity/speed)
- ✅ Leaderboards: upgrades/prosperity/combat damage boards with WS updates
- ✅ WebSocket: real-time player_state/world_state/mission_update/leaderboards_update + event log append; client fallback to polling when disconnected

### ✅ Hono Server Refactor

- ✅ Migrated to Hono with modular routes in `server/routes/`
- ✅ Consistent auth middleware and error handling
- ✅ Reduced boilerplate and improved maintainability

---

## In Progress / Roadmap

### Phase 4: Phaser 3 Client (In Progress)

#### 4.1 Game Scenes Architecture

- [x] BootScene — Asset loading and initialization
- [x] GameScene — Map with interactive nodes and markers
  - [x] Tiled background and town marker
  - [ ] Fog-of-war overlay for unexplored areas
  - [x] Resource node icons (by type/rarity)
  - [x] Mission markers and moving drifter icons with progress
- [x] UIManager — HTML overlay and panels wiring
  - [x] Wallet connect/disconnect (SIWE)
  - [x] Credits HUD
  - [x] Navigation to Drifters, Profile, Active Missions, Market, Vehicles, Town, Log, Leaderboards

#### 4.2 Map Interactions

- [x] Resource node clicking
  - [x] Open mission planning; drifter selection; submit mission
- [ ] Mission marker interactions
  - [x] Show mission details on hover (tooltips)
  - [ ] Ambush option for other players' missions (not implemented)
  - [x] Track mission progress with moving markers
- [x] Real-time updates
  - [x] WebSocket live updates from `/ws`
  - [x] Fallback to polling every 30 seconds when disconnected
  - [x] Update resource availability and mission status

#### 4.3 UI Panels

- [x] Drifters (Mercenary Hall)
- [x] Active Missions
- [x] Market (Vehicles)
- [x] Vehicles (owned vehicles)
- [x] Town
- [x] Leaderboards
- [x] Log (Event Log)
- [x] Profile
- [x] Mission Planning
- [ ] Upgrades (UI + server purchase flow)
- [ ] Black Market (intercepts, ambush UI)

### Phase 5: Notifications & Polish (Upcoming)

#### 5.1 Notification System

- [x] Toast notifications for real-time events
- [ ] Persistent notifications history panel (separate from global Event Log)
- [ ] Sound effects for important events (optional)

#### 5.2 Quality of Life Features

- [x] Mission progress indicators on map and in panel
- [ ] Resource respawn timers (UI)
- [ ] Player statistics dashboard
- [x] Recent activity log (Global Event Log panel)

### Phase 6: Testing & Deployment (Upcoming)

#### 6.1 Testing Strategy

- [ ] Unit tests (Vitest)
  - [ ] Auth verification logic
  - [ ] Mission/monster resolution algorithms
  - [ ] Economy and prosperity calculations
  - [ ] NFT ownership cache behavior
- [ ] Integration tests
  - [ ] Full mission flow (start → complete → payout)
  - [ ] Multi-player scenarios (contested nodes)
  - [ ] Durable Object persistence across restarts
- [ ] Manual testing checklist
  - [ ] Wallet connection & authentication
  - [ ] Vehicle purchase gating
  - [ ] Mission launch and completion
  - [ ] Resource depletion and respawn
  - [ ] Upgrades purchase flow and effects
  - [ ] Cross-player visibility of world state

#### 6.2 Deployment Pipeline

- [ ] Staging environment
  - [ ] Separate Durable Object/KV namespaces in `wrangler.jsonc`
  - [ ] Confirm `npm run deploy:staging` environment config
- [ ] Production deployment
  - [ ] CI workflow (e.g., GitHub Actions)
  - [ ] Automated tests before deploy
  - [ ] Custom domain configuration
- [ ] Monitoring & Analytics
  - [ ] Player engagement metrics
  - [ ] Mission success rates
  - [ ] Economic balance monitoring

### Phase 7: Post-Launch Enhancements (Upcoming)

#### 7.1 Planned Features

- [ ] Direct PvP modes — Real-time combat in contested areas
- [ ] Guild/Alliance system — Cooperative missions and town development
- [ ] Expanded world map — New regions beyond the Scablands
- [ ] Seasonal events — Limited-time content and rewards
- [ ] Enhanced NFT integration — Drifter progression and customization

#### 7.2 Community Features

- [ ] Leaderboards (expanded sets) — Top earners, most successful missions
- [ ] Player profiles — Mission history and achievements
- [ ] Communication system — Basic messaging for coordination
