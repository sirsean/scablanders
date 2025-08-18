import { DurableObject } from 'cloudflare:workers';
import type { 
  PlayerProfile,
  UpgradeType,
  NotificationMessage,
  GameWebSocketMessage,
  PlayerStateUpdate,
  WorldStateUpdate,
  Mission,
  ResourceNode,
  MissionType,
  ResourceType,
  Rarity
} from '@shared/models';

interface WebSocketSession {
  sessionId: string;
  playerAddress?: string;
  authenticated: boolean;
  lastPing: number;
}

interface GameState {
  players: Map<string, PlayerProfile>; // address -> profile
  notifications: Map<string, NotificationMessage[]>; // address -> notifications
  missions: Map<string, Mission>; // missionId -> mission
  resourceNodes: Map<string, ResourceNode>; // nodeId -> node
  worldMetrics: {
    totalActiveMissions: number;
    totalCompletedMissions: number;
    economicActivity: number;
    lastUpdate: Date;
  };
}

/**
 * GameDO - Single Durable Object for entire game state
 * 
 * Manages everything in one place:
 * - All player profiles and balances
 * - World state and resource nodes
 * - Active missions
 * - WebSocket connections for real-time updates
 * - Notifications
 */
export class GameDO extends DurableObject {
  private gameState: GameState;
  private webSocketSessions: Map<string, WebSocketSession> = new Map();
  private env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.env = env;
    
    // Initialize empty game state
    this.gameState = {
      players: new Map(),
      notifications: new Map(),
      missions: new Map(),
      resourceNodes: new Map(),
      worldMetrics: {
        totalActiveMissions: 0,
        totalCompletedMissions: 0,
        economicActivity: 0,
        lastUpdate: new Date()
      }
    };
    
    // Load persisted data first, then initialize resources
    this.initializeGameState();
  }

  /**
   * Initialize game state by loading from storage and setting up defaults
   */
  private async initializeGameState() {
    await this.loadGameState();
    await this.initializeResourceNodes();
  }

  /**
   * Load game state from storage
   */
  private async loadGameState() {
    try {
      // Load players
      const playersData = await this.ctx.storage.get<Record<string, PlayerProfile>>('players');
      if (playersData) {
        this.gameState.players = new Map(Object.entries(playersData));
      }
      
      // Load notifications
      const notificationsData = await this.ctx.storage.get<Record<string, NotificationMessage[]>>('notifications');
      if (notificationsData) {
        this.gameState.notifications = new Map(Object.entries(notificationsData));
      }
      
      // Load missions
      const missionsData = await this.ctx.storage.get<Record<string, Mission>>('missions');
      console.log(`[GameDO] Loading missions from storage:`, missionsData ? Object.keys(missionsData) : 'null');
      if (missionsData) {
        this.gameState.missions = new Map(Object.entries(missionsData));
        console.log(`[GameDO] Loaded ${this.gameState.missions.size} missions into memory`);
      } else {
        console.log('[GameDO] No missions found in storage');
      }
      
      // Load resource nodes
      const nodesData = await this.ctx.storage.get<Record<string, ResourceNode>>('resourceNodes');
      if (nodesData) {
        this.gameState.resourceNodes = new Map(Object.entries(nodesData));
      }
      
      // Load world metrics
      const worldMetrics = await this.ctx.storage.get<typeof this.gameState.worldMetrics>('worldMetrics');
      if (worldMetrics) {
        this.gameState.worldMetrics = worldMetrics;
      }
      
      console.log('[GameDO] Loaded game state:', {
        players: this.gameState.players.size,
        missions: this.gameState.missions.size,
        resourceNodes: this.gameState.resourceNodes.size
      });
      
      // Log detailed mission state
      if (this.gameState.missions.size > 0) {
        console.log('[GameDO] Loaded missions:', Array.from(this.gameState.missions.entries()).map(([id, mission]) => ({
          id,
          status: mission.status,
          playerAddress: mission.playerAddress
        })));
      }
      
      // Log player active missions
      for (const [address, player] of this.gameState.players) {
        if (player.activeMissions.length > 0) {
          console.log(`[GameDO] Player ${address} has active missions: ${player.activeMissions}`);
        }
      }
      
    } catch (error) {
      console.error('[GameDO] Error loading game state:', error);
    }
  }

  /**
   * Save game state to storage
   */
  private async saveGameState() {
    try {
      const missionsToSave = Object.fromEntries(this.gameState.missions);
      console.log(`[GameDO] Saving game state - missions count: ${this.gameState.missions.size}`);
      console.log(`[GameDO] Missions being saved:`, Object.keys(missionsToSave));
      
      await Promise.all([
        this.ctx.storage.put('players', Object.fromEntries(this.gameState.players)),
        this.ctx.storage.put('notifications', Object.fromEntries(this.gameState.notifications)),
        this.ctx.storage.put('missions', missionsToSave),
        this.ctx.storage.put('resourceNodes', Object.fromEntries(this.gameState.resourceNodes)),
        this.ctx.storage.put('worldMetrics', this.gameState.worldMetrics)
      ]);
      
      console.log('[GameDO] Game state saved successfully');
    } catch (error) {
      console.error('[GameDO] Error saving game state:', error);
    }
  }

  /**
   * Initialize resource nodes if they don't exist
   */
  private async initializeResourceNodes() {
    if (this.gameState.resourceNodes.size > 0) {
      return; // Already initialized
    }

    console.log('[GameDO] Initializing resource nodes (no existing nodes found)');
    
    // Create some sample resource nodes
    const nodes: ResourceNode[] = [
      {
        id: 'ore-1',
        type: 'ore' as ResourceType,
        coordinates: { x: 100, y: 150 },
        baseYield: 50,
        currentYield: 50,
        depletion: 0,
        rarity: 'common' as Rarity,
        discoveredBy: [],
        lastHarvested: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        isActive: true
      },
      {
        id: 'scrap-1',
        type: 'scrap' as ResourceType,
        coordinates: { x: 300, y: 200 },
        baseYield: 75,
        currentYield: 75,
        depletion: 0,
        rarity: 'uncommon' as Rarity,
        discoveredBy: [],
        lastHarvested: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        isActive: true
      },
      {
        id: 'organic-1',
        type: 'organic' as ResourceType,
        coordinates: { x: 500, y: 100 },
        baseYield: 30,
        currentYield: 30,
        depletion: 0,
        rarity: 'rare' as Rarity,
        discoveredBy: [],
        lastHarvested: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
        isActive: true
      }
    ];

    for (const node of nodes) {
      this.gameState.resourceNodes.set(node.id, node);
    }

    // Only save resource nodes, don't overwrite entire game state
    console.log(`[GameDO] Saving resource nodes only (preserving existing missions: ${this.gameState.missions.size})`);
    await this.ctx.storage.put('resourceNodes', Object.fromEntries(this.gameState.resourceNodes));
    console.log('[GameDO] Initialized', nodes.length, 'resource nodes');
  }

  // =============================================================================
  // WebSocket Management
  // =============================================================================

  /**
   * Add WebSocket session (without storing WebSocket object)
   */
  async addWebSocketSession(sessionId: string, playerAddress?: string, authenticated: boolean = false): Promise<{ success: boolean; error?: string }> {
    console.log(`[GameDO] Adding WebSocket session ${sessionId}, authenticated: ${authenticated}, player: ${playerAddress}`);
    
    const session: WebSocketSession = {
      sessionId,
      playerAddress,
      authenticated,
      lastPing: Date.now()
    };
    
    this.webSocketSessions.set(sessionId, session);
    
    // Send initial state if authenticated
    if (authenticated && playerAddress) {
      await this.sendPlayerStateUpdate(sessionId, playerAddress);
      await this.sendWorldStateUpdate(sessionId);
    }
    
    return { success: true };
  }

  /**
   * Remove WebSocket session
   */
  async removeWebSocketConnection(sessionId: string): Promise<{ success: boolean; error?: string }> {
    this.webSocketSessions.delete(sessionId);
    console.log(`[GameDO] Removed WebSocket session ${sessionId}`);
    return { success: true };
  }

  /**
   * Send message to specific session via global sendToSession function
   */
  private async sendToSession(sessionId: string, message: GameWebSocketMessage) {
    // Import and use the global sendToSession function from websocket.ts
    const { sendToSession } = await import('./websocket');
    sendToSession(sessionId, message);
  }

  /**
   * Send player state update to specific session
   */
  private async sendPlayerStateUpdate(sessionId: string, playerAddress: string) {
    const player = this.gameState.players.get(playerAddress);
    const notifications = this.gameState.notifications.get(playerAddress) || [];
    
    if (!player) return;

    const message: PlayerStateUpdate = {
      type: 'player_state',
      timestamp: new Date(),
      data: {
        profile: player,
        balance: player.balance,
        activeMissions: player.activeMissions,
        discoveredNodes: player.discoveredNodes,
        notifications: notifications.slice(-5) // Latest 5 notifications
      }
    };

    this.sendToSession(sessionId, message);
  }

  /**
   * Send world state update to specific session
   */
  private async sendWorldStateUpdate(sessionId: string) {
    const message: WorldStateUpdate = {
      type: 'world_state',
      timestamp: new Date(),
      data: {
        resourceNodes: Array.from(this.gameState.resourceNodes.values()),
        missions: Array.from(this.gameState.missions.values()),
        worldMetrics: this.gameState.worldMetrics
      }
    };

    this.sendToSession(sessionId, message);
  }

  /**
   * Broadcast player state to all sessions for this player
   */
  private async broadcastPlayerStateUpdate(playerAddress: string) {
    for (const [sessionId, session] of this.webSocketSessions) {
      if (session.authenticated && session.playerAddress === playerAddress) {
        await this.sendPlayerStateUpdate(sessionId, playerAddress);
      }
    }
  }

  /**
   * Broadcast world state to all authenticated sessions
   */
  private async broadcastWorldStateUpdate() {
    for (const [sessionId, session] of this.webSocketSessions) {
      if (session.authenticated) {
        await this.sendWorldStateUpdate(sessionId);
      }
    }
  }

  // =============================================================================
  // Player Management
  // =============================================================================

  /**
   * Get or create player profile
   */
  async getProfile(address: string): Promise<PlayerProfile> {
    let player = this.gameState.players.get(address);
    
    if (!player) {
      // Create new player
      player = {
        address,
        balance: 1000, // Starting balance
        ownedDrifters: [], // Will be populated from NFT lookup
        discoveredNodes: [], // Empty initially
        upgrades: [], // No upgrades initially
        activeMissions: [], // No active missions initially
        lastLogin: new Date()
      };
      
      this.gameState.players.set(address, player);
      await this.saveGameState();
      console.log(`[GameDO] Created new player profile for ${address}`);
    } else {
      // Update last login
      player.lastLogin = new Date();
      await this.saveGameState();
    }
    
    return player;
  }

  /**
   * Credit player balance
   */
  async credit(address: string, amount: number): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const player = this.gameState.players.get(address);
    if (!player) {
      return { success: false, newBalance: 0, error: 'Player not found' };
    }
    
    if (amount <= 0) {
      return { success: false, newBalance: player.balance, error: 'Amount must be positive' };
    }
    
    player.balance += amount;
    await this.saveGameState();
    
    // Broadcast update
    await this.broadcastPlayerStateUpdate(address);
    
    return { success: true, newBalance: player.balance };
  }

  /**
   * Debit player balance
   */
  async debit(address: string, amount: number): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const player = this.gameState.players.get(address);
    if (!player) {
      return { success: false, newBalance: 0, error: 'Player not found' };
    }
    
    if (amount <= 0) {
      return { success: false, newBalance: player.balance, error: 'Amount must be positive' };
    }
    
    if (player.balance < amount) {
      return { success: false, newBalance: player.balance, error: 'Insufficient funds' };
    }
    
    player.balance -= amount;
    await this.saveGameState();
    
    // Broadcast update
    await this.broadcastPlayerStateUpdate(address);
    
    return { success: true, newBalance: player.balance };
  }

  /**
   * Update player's owned Drifters
   */
  async updateOwnedDrifters(address: string, drifterIds: number[]): Promise<{ success: boolean; error?: string }> {
    const player = this.gameState.players.get(address);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }
    
    player.ownedDrifters = drifterIds;
    await this.saveGameState();
    
    // Broadcast update
    await this.broadcastPlayerStateUpdate(address);
    
    return { success: true };
  }

  // =============================================================================
  // Mission Management
  // =============================================================================

  /**
   * Start a mission
   */
  async startMission(
    playerAddress: string,
    missionType: MissionType,
    drifterIds: number[],
    targetNodeId: string
  ): Promise<{ success: boolean; missionId?: string; error?: string }> {
    console.log(`[GameDO] Starting mission - Player: ${playerAddress}, Type: ${missionType}, Target: ${targetNodeId}`);
    
    const player = this.gameState.players.get(playerAddress);
    if (!player) {
      console.error(`[GameDO] Player not found: ${playerAddress}`);
      return { success: false, error: 'Player not found' };
    }

    // Validate target node exists
    const targetNode = this.gameState.resourceNodes.get(targetNodeId);
    if (!targetNode) {
      return { success: false, error: 'Target node not found' };
    }

    // Create mission
    const missionId = crypto.randomUUID();
    const now = new Date();
    const duration = 30 * 60 * 1000; // 30 minutes in milliseconds

    const mission: Mission = {
      id: missionId,
      type: missionType,
      playerAddress,
      drifterIds,
      targetNodeId,
      startTime: now,
      completionTime: new Date(now.getTime() + duration),
      status: 'active',
      rewards: {
        credits: Math.floor(Math.random() * 500) + 200,
        resources: {
          [targetNode.type]: Math.floor(Math.random() * 50) + 25
        }
      }
    };

    // Add to game state
    this.gameState.missions.set(missionId, mission);
    player.activeMissions.push(missionId);
    
    console.log(`[GameDO] Mission ${missionId} created and added to player ${playerAddress}`);
    console.log(`[GameDO] Player now has ${player.activeMissions.length} active missions: ${player.activeMissions}`);
    console.log(`[GameDO] Global missions count: ${this.gameState.missions.size}`);
    
    // Update world metrics
    this.gameState.worldMetrics.totalActiveMissions++;
    this.gameState.worldMetrics.lastUpdate = new Date();

    await this.saveGameState();
    console.log(`[GameDO] Game state saved after mission creation`);

    // Broadcast updates
    await this.broadcastPlayerStateUpdate(playerAddress);
    await this.broadcastWorldStateUpdate();

    return { success: true, missionId };
  }

  /**
   * Complete a mission
   */
  async completeMission(missionId: string): Promise<{ success: boolean; rewards?: any; error?: string }> {
    const mission = this.gameState.missions.get(missionId);
    if (!mission) {
      return { success: false, error: 'Mission not found' };
    }

    if (mission.status !== 'active') {
      return { success: false, error: 'Mission not active' };
    }

    if (new Date() < mission.completionTime) {
      return { success: false, error: 'Mission not yet complete' };
    }

    const player = this.gameState.players.get(mission.playerAddress);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Award rewards
    player.balance += mission.rewards.credits;
    
    // Remove from active missions
    const missionIndex = player.activeMissions.indexOf(missionId);
    if (missionIndex > -1) {
      player.activeMissions.splice(missionIndex, 1);
    }

    // Mark mission as completed
    mission.status = 'completed';

    // Update world metrics
    this.gameState.worldMetrics.totalActiveMissions--;
    this.gameState.worldMetrics.totalCompletedMissions++;
    this.gameState.worldMetrics.economicActivity += mission.rewards.credits;
    this.gameState.worldMetrics.lastUpdate = new Date();

    await this.saveGameState();

    // Add notification
    await this.addNotification(mission.playerAddress, {
      id: crypto.randomUUID(),
      type: 'mission_complete',
      message: `Mission completed! Earned ${mission.rewards.credits} credits.`,
      timestamp: new Date(),
      read: false
    });

    // Broadcast updates
    await this.broadcastPlayerStateUpdate(mission.playerAddress);
    await this.broadcastWorldStateUpdate();

    return { success: true, rewards: mission.rewards };
  }

  /**
   * Get mission by ID
   */
  async getMission(missionId: string): Promise<Mission | null> {
    return this.gameState.missions.get(missionId) || null;
  }

  /**
   * Get player's active missions
   */
  async getPlayerMissions(address: string): Promise<Mission[]> {
    console.log(`[GameDO] Getting player missions for ${address}`);
    
    const player = this.gameState.players.get(address);
    if (!player) {
      console.log(`[GameDO] Player ${address} not found`);
      return [];
    }

    console.log(`[GameDO] Player ${address} has ${player.activeMissions.length} mission IDs: ${player.activeMissions}`);
    console.log(`[GameDO] Global missions count: ${this.gameState.missions.size}`);
    console.log(`[GameDO] Global mission IDs: ${Array.from(this.gameState.missions.keys())}`);

    const missions: Mission[] = [];
    const orphanedMissionIds: string[] = [];
    
    for (const missionId of player.activeMissions) {
      const mission = this.gameState.missions.get(missionId);
      if (mission) {
        console.log(`[GameDO] Found mission ${missionId} for player ${address}:`, mission.status);
        missions.push(mission);
      } else {
        console.error(`[GameDO] Mission ${missionId} not found in global missions for player ${address}`);
        orphanedMissionIds.push(missionId);
      }
    }

    // Clean up orphaned mission IDs from player profile
    if (orphanedMissionIds.length > 0) {
      console.log(`[GameDO] Cleaning up ${orphanedMissionIds.length} orphaned missions from player ${address}`);
      player.activeMissions = player.activeMissions.filter(id => !orphanedMissionIds.includes(id));
      await this.saveGameState();
    }

    console.log(`[GameDO] Returning ${missions.length} missions for player ${address}`);
    return missions;
  }

  // =============================================================================
  // Notification Management
  // =============================================================================

  /**
   * Add notification for player
   */
  async addNotification(address: string, notification: NotificationMessage): Promise<{ success: boolean; error?: string }> {
    let notifications = this.gameState.notifications.get(address) || [];
    
    // Add timestamp if not provided
    if (!notification.timestamp) {
      notification.timestamp = new Date();
    }
    
    notifications.push(notification);
    
    // Keep only latest 50 notifications
    if (notifications.length > 50) {
      notifications = notifications.slice(-50);
    }
    
    this.gameState.notifications.set(address, notifications);
    await this.saveGameState();
    
    // Broadcast update
    await this.broadcastPlayerStateUpdate(address);
    
    return { success: true };
  }

  /**
   * Get player notifications
   */
  async getNotifications(address: string, limit: number = 20): Promise<NotificationMessage[]> {
    const notifications = this.gameState.notifications.get(address) || [];
    return notifications.slice(-limit).reverse();
  }

  // =============================================================================
  // World State Management
  // =============================================================================

  /**
   * Get all resource nodes
   */
  async getResourceNodes(): Promise<ResourceNode[]> {
    return Array.from(this.gameState.resourceNodes.values());
  }

  /**
   * Get world metrics
   */
  async getWorldMetrics() {
    return this.gameState.worldMetrics;
  }

  /**
   * Get all active missions
   */
  async getActiveMissions(): Promise<Mission[]> {
    return Array.from(this.gameState.missions.values()).filter(m => m.status === 'active');
  }

  // =============================================================================
  // Development/Testing
  // =============================================================================

  /**
   * Reset all game data
   */
  async reset(): Promise<{ success: boolean; error?: string }> {
    this.gameState.players.clear();
    this.gameState.notifications.clear();
    this.gameState.missions.clear();
    this.gameState.resourceNodes.clear();
    this.gameState.worldMetrics = {
      totalActiveMissions: 0,
      totalCompletedMissions: 0,
      economicActivity: 0,
      lastUpdate: new Date()
    };
    
    await this.ctx.storage.deleteAll();
    await this.initializeResourceNodes();
    
    return { success: true };
  }

  /**
   * Clean up orphaned missions from all players
   */
  async cleanupOrphanedMissions(): Promise<{ cleaned: number; playersAffected: string[] }> {
    console.log('[GameDO] Starting orphaned mission cleanup');
    let totalCleaned = 0;
    const playersAffected: string[] = [];
    
    for (const [address, player] of this.gameState.players) {
      const initialCount = player.activeMissions.length;
      const validMissions = player.activeMissions.filter(missionId => 
        this.gameState.missions.has(missionId)
      );
      
      if (validMissions.length !== initialCount) {
        const cleaned = initialCount - validMissions.length;
        totalCleaned += cleaned;
        playersAffected.push(address);
        player.activeMissions = validMissions;
        console.log(`[GameDO] Cleaned ${cleaned} orphaned missions from player ${address}`);
      }
    }
    
    if (totalCleaned > 0) {
      await this.saveGameState();
      console.log(`[GameDO] Cleanup complete: removed ${totalCleaned} orphaned missions from ${playersAffected.length} players`);
    }
    
    return { cleaned: totalCleaned, playersAffected };
  }

  /**
   * Get stats for debugging
   */
  async getStats() {
    return {
      players: this.gameState.players.size,
      missions: this.gameState.missions.size,
      resourceNodes: this.gameState.resourceNodes.size,
      activeSessions: this.webSocketSessions.size,
      worldMetrics: this.gameState.worldMetrics
    };
  }
}
