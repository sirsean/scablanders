# Scablanders Development Roadmap

## Overview

This document tracks the development roadmap for **Scablanders**, a casual web-based multiplayer game set in The Fringe universe. The game features:

- **Shared persistent world** where all players interact
- **NFT integration** with Fringe Drifters as mercenaries-for-hire
- **Casual "click & venture" gameplay** with asynchronous missions
- **Indirect PvP** through bandit interceptions
- **Cloudflare Workers + Durable Objects** backend
- **Phaser 3** client running in browser

---

## Development Status

- **Current Focus:** Phase 4: Phaser 3 Client
- **Next Milestone:** Implement game scenes architecture (BootScene, MapScene, UIScene).
- **Target MVP:** Completion of Phase 6 (Testing & Deployment).

---

## Completed Milestones

### ✅ Phase 1: Foundation & Architecture (Completed)

**Development Environment:**

- ✅ Vite + Cloudflare Workers integrated development server
- ✅ Hot Module Reload for client-side development
- ✅ TypeScript compilation with path aliases (`@shared`, `@client`, `@server`)
- ✅ Phaser 3 game engine loading and rendering

**Project Structure:**

- ✅ `client/` - Phaser 3 game client
- ✅ `server/` - Cloudflare Worker + Durable Objects
- ✅ `shared/` - Common TypeScript types/models
- ✅ `public/` - Static assets served by Worker
- ✅ `scripts/` - Build/deploy utilities
- ✅ `package.json`, `vite.config.ts`, `tsconfig.json`, `wrangler.jsonc`

**Client & Server:**

- ✅ Basic Phaser 3 client with map and placeholder UI.
- ✅ Basic API server with health checks and placeholder routes.
- ✅ Comprehensive shared type system in `shared/models.ts`.

### ✅ Phase 2: Authentication & NFT Integration (Completed)

**SIWE Authentication System:**

- ✅ Complete Sign-In-With-Ethereum implementation using `siwe` library.
- ✅ Nonce generation, verification, and JWT session tokens (HTTP-only cookies).
- ✅ Authentication middleware for protected endpoints.
- ✅ Client-side integration with viem/wagmi for wallet interactions.

**NFT Ownership Integration:**

- ✅ Alchemy SDK for real-time Ethereum mainnet queries.
- ✅ Fringe Drifters NFT contract integration (`0xe3B399AAb015D2C0D787ECAd40410D88f4f4cA50`).
- ✅ On-chain ownership lookup with KV caching (5-10 min TTL).
- ✅ Drifter registry with 50+ unique characters (stats, traits, hire costs).
- ✅ `/api/mercenaries` endpoint with dynamic hire costs (0 for owned NFTs).
- ✅ `/api/profile` updated with real owned Drifters data.

### ✅ Phase 3: Backend & Core Logic (Completed)

**Durable Objects Architecture:**

- ✅ `GameDO` Durable Object for global game state management.
- ✅ Persistent storage using `ctx.storage` and alarms for timed events.

**Core Gameplay Systems:**

- ✅ **Missions:** Start scavenging or intercept missions.
- ✅ **Combat:** PvP combat resolution with d20 rolls + stats.
- ✅ **Economy:** Player balances, upgrade trees (18 upgrades), and costs.
- ✅ **Resources:** 13 pre-configured resource nodes with depletion and respawn timers.
- ✅ **Notifications:** In-game notification queue for players.

**API Endpoints:**

- ✅ All core backend APIs implemented: `/api/profile`, `/api/world/*`, `/api/mission/*`, `/api/upgrade/*`.

### ✅ Hono Server Refactor (Completed)

- ✅ Migrated the entire server from custom routing to the **Hono** framework.
- ✅ Modularized all routes into `server/routes/`.
- ✅ Implemented consistent, type-safe middleware for auth and error handling.
- ✅ Reduced boilerplate code by ~60% and improved maintainability.

---

## Upcoming Roadmap

### Phase 4: Phaser 3 Client (In Progress)

#### 4.1 Game Scenes Architecture

- [x] **BootScene** - Asset loading and initialization
- [x] **GameScene (MapScene)** - Scablands map with interactive elements
  - [x] Background image of desert landscape
  - [ ] Fog-of-war overlay for unexplored areas
  - [x] Resource node icons (appear when discovered)
  - [x] Mission markers showing active expeditions
- [x] **UIManager (UIScene)** - HTML overlay for complex interfaces
  - [x] Login button and wallet connection
  - [x] Credits balance counter
  - [x] Navigation to Mercenary Hall, Profile, and Active Missions panels
  - [x] Notification log panel (via toast notifications)

#### 4.2 Map Interactions

- [x] **Resource node clicking**
  - [x] Open "Send Mission" modal
  - [x] Show drifter selection with hire costs
  - [x] Submit mission and update UI immediately
- [ ] **Mission marker interactions**
  - [x] Show mission details on hover
  - [ ] "Ambush" option for other players' missions
  - [x] Track progress with moving markers
- [x] **Real-time updates**
  - [x] WebSocket connection to `/ws` for live events
  - [ ] Fallback to polling every 20 seconds
  - [x] Update resource availability and mission status

#### 4.3 UI Panels

- [x] **Mercenary Hall**
  - [x] Paginated grid of available drifters
  - [x] Show stats, hire cost, availability status
  - [x] "Owned" badge for player's NFTs
- [ ] **Market & Upgrades**
  - [ ] List available upgrades with costs
  - [ ] Purchase confirmation and balance updates
- [ ] **Black Market**
  - [ ] List active missions available to intercept
  - [ ] Cost calculator for bandit hiring
  - [ ] Anonymous ambush interface
- [x] **Active Missions Panel**
  - [x] List of active missions with progress bars
  - [x] Live countdown timers
  - [x] "Collect Rewards" button for completed missions

### Phase 5: Notifications & Polish (Upcoming)

#### 5.1 Notification System

- [ ] **Client notification display**
  - [ ] Toast notifications for real-time events
  - [ ] Persistent log panel for message history
  - [ ] Sound effects for important events (optional)

#### 5.2 Quality of Life Features

- [ ] **Mission progress indicators**
- [ ] **Resource respawn timers**
- [ ] **Player statistics dashboard**
- [ ] **Recent activity log**

### Phase 6: Testing & Deployment (Upcoming)

#### 6.1 Testing Strategy

- [ ] **Unit tests with Vitest**
  - [ ] Auth verification logic
  - [ ] Mission resolution algorithms
  - [ ] Economy calculations
  - [ ] NFT owner lookup caching
- [ ] **Integration tests**
  - [ ] Full mission flow (start → complete → payout)
  - [ ] Multi-player scenarios (intercepts, resource competition)
  - [ ] Durable Object persistence across restarts
- [ ] **Manual testing checklist**
  - [ ] Wallet connection & authentication
  - [ ] Mercenary hiring (owned vs non-owned NFTs)
  - [ ] Mission launch and completion
  - [ ] Bandit intercepts and combat resolution
  - [ ] Resource depletion and respawn
  - [ ] Upgrade purchases and effects
  - [ ] Cross-player visibility of world state

#### 6.2 Deployment Pipeline

- [ ] **Staging environment**
  - [ ] Separate Durable Objects namespace in `wrangler.jsonc`
  - [ ] `npm run deploy:staging` command
- [ ] **Production deployment**
  - [ ] GitHub Actions workflow
  - [ ] Automated testing before deploy
  - [ ] Custom domain configuration
- [ ] **Monitoring & Analytics**
  - [ ] Player engagement metrics
  - [ ] Mission success rates
  - [ ] Economic balance monitoring

### Phase 7: Post-Launch Enhancements (Upcoming)

#### 7.1 Planned Features (Future Iterations)

- [ ] **Direct PvP modes** - Real-time combat in contested areas
- [ ] **Guild/Alliance system** - Cooperative missions and town development
- [ ] **Expanded world map** - New regions beyond the Scablands
- [ ] **Seasonal events** - Limited-time content and rewards
- [ ] **Enhanced NFT integration** - Drifter progression and customization

#### 7.2 Community Features

- [ ] **Leaderboards** - Top earners, most successful missions
- [ ] **Player profiles** - Mission history and achievements
- [ ] **Communication system** - Basic messaging for coordination
