# Scablanders Development Tasks

## Overview

This document tracks the development roadmap for **Scablanders**, a casual web-based multiplayer game set in The Fringe universe. The game features:

- **Shared persistent world** where all players interact
- **NFT integration** with Fringe Drifters as mercenaries-for-hire  
- **Casual "click & venture" gameplay** with asynchronous missions
- **Indirect PvP** through bandit interceptions
- **Cloudflare Workers + Durable Objects** backend
- **Phaser 3** client running in browser

---

## Phase 1: Foundation & Architecture

### 1.1 Repository Structure & Dependencies
- [ ] **Create comprehensive project structure**
  ```
  scablanders/
  ├── client/          # Phaser 3 game client
  ├── server/          # Cloudflare Worker + Durable Objects  
  ├── shared/          # Common TypeScript types/models
  ├── public/          # Static assets served by Worker
  └── scripts/         # Build/deploy utilities
  ```

- [ ] **Install core dependencies**
  ```bash
  # Production
  npm install phaser vite @cloudflare/vite-plugin
  npm install ethers siwe zod uuid
  npm install @types/uuid
  
  # Development  
  npm install -D @types/node vitest eslint prettier
  npm install -D vite-plugin-static-copy typescript
  ```

- [ ] **Update package.json scripts**
  ```json
  {
    "scripts": {
      "dev": "vite dev",
      "build": "vite build", 
      "deploy": "wrangler deploy",
      "deploy:staging": "wrangler deploy --env staging",
      "test": "vitest",
      "lint": "eslint . --ext .ts,.js",
      "format": "prettier --write ."
    }
  }
  ```

- [ ] **Verify baseline setup with hello-world page**

### 1.2 Vite + Cloudflare Integration
- [ ] **Create `vite.config.ts`**
  - Configure `@cloudflare/vite-plugin`
  - Route `/api/*` to Worker, everything else to `client/dist/index.html`
  - Enable HMR for Phaser canvas during development

- [ ] **Restructure Worker entry point**
  - Move `src/index.ts` → `server/worker.ts` 
  - Update `wrangler.jsonc` main field
  - Test `npm run dev` serves both client and API

- [ ] **Configure hot reloading for development**

### 1.3 Shared Type System
- [ ] **Create `shared/models.ts`** with core interfaces:
  ```typescript
  interface PlayerProfile {
    address: string;
    balance: number;
    ownedDrifters: number[];
    discoveredNodes: string[];
    upgrades: UpgradeType[];
  }
  
  interface DrifterProfile {
    tokenId: number;
    name: string;
    imageUrl: string;
    combat: number;
    scavenging: number;
    tech: number;
    speed: number;
    hireCost: number;
  }
  
  interface Mission {
    id: string;
    playerAddress: string;
    drifterIds: number[];
    targetNodeId: string;
    startTime: Date;
    endTime: Date;
    status: 'active' | 'completed' | 'intercepted';
  }
  
  interface ResourceNode {
    id: string;
    x: number;
    y: number;
    type: ResourceType;
    quantity: number;
    maxQuantity: number;
  }
  ```

- [ ] **Add path aliases in tsconfig.json for `@shared`, `@client`, `@server`**

---

## Phase 2: Authentication & NFT Integration

### 2.1 Sign-In-With-Ethereum (SIWE)
- [ ] **Implement auth endpoints in Worker**
  - `GET /api/auth/nonce` - Returns random nonce + SIWE message
  - `POST /api/auth/verify` - Verifies signature, returns JWT cookie

- [ ] **Create JWT middleware**
  - Validate `CF_ACCESS_TOKEN` cookie on protected routes
  - Extract `playerAddress` and attach to request context

- [ ] **Client wallet integration**
  - Lightweight SIWE helper using `window.ethereum` (MetaMask)
  - Handle wallet connection, message signing, auth flow
  - Store auth state and show login/logout UI

- [ ] **Add development fallback**
  - Guest mode with dummy address for testing without wallet

### 2.2 NFT Ownership System  
- [ ] **Implement on-chain owner lookup**
  - Hard-code Fringe Drifters contract address
  - Create `getOwner(tokenId)` utility using Cloudflare ETH gateway
  - Use ERC-721 `ownerOf` method via ethers.js

- [ ] **Add caching layer**  
  - Cache owner results in Workers KV (5 minute TTL)
  - Background refresh for frequently accessed tokens

- [ ] **Bootstrap Drifter registry**
  - Create `server/data/drifters.json` with tokenId → stats mapping
  - Start with ~50 sample Drifters, expand gradually
  - Include combat, scavenging, tech, speed attributes

- [ ] **Mercenary hiring system**
  - `/api/mercs` endpoint returns available Drifters
  - Mark hire cost as 0 for caller's owned NFTs
  - Credit hire fees to current NFT owner's balance

---

## Phase 3: Durable Objects Backend

### 3.1 WorldDO (Global Game State)
- [ ] **Create WorldDO class with methods:**
  - `startMission(playerAddr, drifterIds, targetNodeId)`
  - `startIntercept(attackerAddr, targetMissionId, banditIds)`  
  - `completeMission(missionId)` - alarm handler
  - `listActiveMissions()` 
  - `listResources(playerAddr)` - filter by discoveries
  - `purchaseUpgrade(playerAddr, upgradeId)`

- [ ] **Implement mission timers**
  - Use `this.state.setAlarm()` for mission completion
  - Calculate travel time based on distance + player speed upgrades
  - Handle mission resolution in `alarm()` method

- [ ] **Add resource management** 
  - Track resource node quantities
  - Mark nodes as depleted when quantity reaches 0
  - Schedule respawn with `setAlarm()` for depleted nodes

### 3.2 PlayerDO (Per-Player State)
- [ ] **Create PlayerDO class with methods:**
  - `credit(amount)` - add to balance
  - `debit(amount)` - subtract from balance (with validation)
  - `addUpgrade(upgradeType)` - track purchased upgrades
  - `addDiscovery(nodeId)` - track scouted locations

- [ ] **Ensure balance isolation**
  - All balance mutations go through PlayerDO to avoid race conditions
  - WorldDO calls PlayerDO methods for credits/debits

### 3.3 Durable Object Configuration
- [ ] **Update `wrangler.jsonc` bindings**
  ```json
  {
    "durable_objects": {
      "bindings": [
        {"class_name": "WorldDO", "name": "WORLD_DO"},
        {"class_name": "PlayerDO", "name": "PLAYER_DO"}
      ]
    }
  }
  ```

- [ ] **Add persistence via `this.state.storage`**
  - Periodic snapshots of WorldDO state
  - PlayerDO state persistence on balance changes

---

## Phase 4: Core Game Logic

### 4.1 Mission System
- [ ] **Mission creation & validation**
  - Validate drifter availability and player balance
  - Reserve drifters for mission duration  
  - Calculate and deduct hiring costs

- [ ] **Mission resolution algorithm**
  - RNG + drifter stats determine loot and hazards
  - Different drifter traits yield different loot types
  - Resource nodes depleted based on extraction amount

- [ ] **Combat simulation for intercepts**
  - Sum combat stats of defending vs attacking teams
  - Add d20 roll for randomness
  - Winner takes all loot, loser gets small penalties

### 4.2 Economy & Progression
- [ ] **Define economic constants in `server/data/economy.ts`**
  - Base hire costs per drifter rarity
  - Resource values (auto-sell prices)
  - Upgrade costs and effects

- [ ] **Implement upgrade system**
  - Speed upgrades reduce travel time
  - Yield upgrades increase loot from successful missions
  - Capacity upgrades allow more concurrent missions

- [ ] **Money sinks and sources**
  - Sources: mission loot, passive NFT hire income
  - Sinks: hiring fees, upgrades, intercept costs

---

## Phase 5: API Layer

### 5.1 Core Endpoints
- [ ] **`GET /api/profile`** - Player balance, owned drifters, upgrades
- [ ] **`GET /api/mercs`** - Available mercenaries with hire costs  
- [ ] **`POST /api/mission/start`** - Launch expedition
- [ ] **`POST /api/mission/intercept`** - Ambush another player's mission
- [ ] **`GET /api/world/active`** - All ongoing missions (for map display)
- [ ] **`GET /api/world/resources`** - Resource nodes (filtered by discoveries)
- [ ] **`POST /api/upgrade/buy`** - Purchase player upgrades

### 5.2 Input Validation & Error Handling
- [ ] **Add Zod schemas for request validation**
- [ ] **Standardized error response format**
- [ ] **Rate limiting on expensive operations**

---

## Phase 6: Phaser 3 Client

### 6.1 Game Scenes Architecture
- [ ] **BootScene** - Asset loading and initialization
- [ ] **MapScene** - Scablands map with interactive elements
  - Background image of desert landscape
  - Fog-of-war overlay for unexplored areas
  - Resource node icons (appear when discovered)
  - Mission markers showing active expeditions

- [ ] **UIScene** - HTML overlay for complex interfaces
  - Login button and wallet connection
  - Credits balance counter  
  - Navigation to Mercenary Hall, Market, Black Market
  - Notification log panel

### 6.2 Map Interactions
- [ ] **Resource node clicking**
  - Open "Send Mission" modal
  - Show drifter selection with hire costs
  - Submit mission and update UI immediately

- [ ] **Mission marker interactions**  
  - Show mission details on hover
  - "Ambush" option for other players' missions
  - Track progress with moving markers

- [ ] **Real-time updates**
  - WebSocket connection to `/api/ws` for live events
  - Fallback to polling every 20 seconds
  - Update resource availability and mission status

### 6.3 Town Interface
- [ ] **Mercenary Hall**
  - Paginated grid of available drifters
  - Show stats, hire cost, availability status
  - "Owned" badge for player's NFTs

- [ ] **Market & Upgrades**
  - List available upgrades with costs
  - Purchase confirmation and balance updates

- [ ] **Black Market**
  - List active missions available to intercept
  - Cost calculator for bandit hiring
  - Anonymous ambush interface

---

## Phase 7: Notifications & Polish

### 7.1 Notification System  
- [ ] **Server-side message queue**
  - Store notifications in PlayerDO
  - Types: mission completion, intercept results, global events

- [ ] **Client notification display**
  - Toast notifications for real-time events
  - Persistent log panel for message history
  - Sound effects for important events (optional)

### 7.2 Quality of Life Features
- [ ] **Mission progress indicators**
- [ ] **Resource respawn timers**
- [ ] **Player statistics dashboard** 
- [ ] **Recent activity log**

---

## Phase 8: Testing & Deployment

### 8.1 Testing Strategy
- [ ] **Unit tests with Vitest**
  - Auth verification logic
  - Mission resolution algorithms
  - Economy calculations
  - NFT owner lookup caching

- [ ] **Integration tests**
  - Full mission flow (start → complete → payout)
  - Multi-player scenarios (intercepts, resource competition)
  - Durable Object persistence across restarts

- [ ] **Manual testing checklist**
  - [ ] Wallet connection & authentication  
  - [ ] Mercenary hiring (owned vs non-owned NFTs)
  - [ ] Mission launch and completion
  - [ ] Bandit intercepts and combat resolution
  - [ ] Resource depletion and respawn
  - [ ] Upgrade purchases and effects
  - [ ] Cross-player visibility of world state

### 8.2 Deployment Pipeline
- [ ] **Staging environment**
  - Separate Durable Objects namespace in `wrangler.jsonc`
  - `npm run deploy:staging` command

- [ ] **Production deployment**
  - GitHub Actions workflow
  - Automated testing before deploy
  - Custom domain configuration

- [ ] **Monitoring & Analytics**  
  - Player engagement metrics
  - Mission success rates
  - Economic balance monitoring

---

## Phase 9: Post-Launch Enhancements

### 9.1 Planned Features (Future Iterations)
- [ ] **Direct PvP modes** - Real-time combat in contested areas
- [ ] **Guild/Alliance system** - Cooperative missions and town development
- [ ] **Expanded world map** - New regions beyond the Scablands
- [ ] **Seasonal events** - Limited-time content and rewards
- [ ] **Enhanced NFT integration** - Drifter progression and customization

### 9.2 Community Features
- [ ] **Leaderboards** - Top earners, most successful missions
- [ ] **Player profiles** - Mission history and achievements
- [ ] **Communication system** - Basic messaging for coordination

---

## Development Status

**Current Phase:** Phase 1 (Foundation & Architecture)  
**Next Milestone:** Complete repository setup and Vite configuration  
**Target MVP:** End of Phase 6 (Basic playable game)

---

## Notes

- This roadmap prioritizes a **working MVP** over feature completeness
- Each phase builds incrementally - earlier phases must be stable before proceeding
- Testing is integrated throughout development, not saved for the end  
- The shared world and NFT integration are core differentiators - these cannot be compromised
- Performance and scalability considerations are built into the Durable Objects architecture from the start

---

*Last Updated: 2024-08-16*
