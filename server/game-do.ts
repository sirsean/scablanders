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
import { calculateMissionDuration, calculateMissionRewards } from '../shared/mission-utils';
interface WebSocketSession {
  websocket: WebSocket;
  sessionId: string;
  playerAddress?: string;
  authenticated: boolean;
  lastPing: number;
}

interface PendingNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
}

interface ResourceManagementConfig {
  targetNodesPerType: Record<ResourceType, number>;
  totalTargetNodes: number;
  degradationCheckInterval: number; // minutes
  degradationRate: number; // percentage per hour (negative)
  spawnArea: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
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
  resourceConfig: ResourceManagementConfig;
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
  private webSocketSessions: Map<string, WebSocketSession>;
  private pendingNotifications: Map<string, Set<string>>; // sessionId -> Set<notificationId>
  private playerReplayQueues: Map<string, PendingNotification[]>; // playerAddress -> notification queue
  private env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.env = env;
    
    // Initialize WebSocket sessions and notification tracking
    this.webSocketSessions = new Map();
    this.pendingNotifications = new Map();
    this.playerReplayQueues = new Map();
    
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
      },
      resourceConfig: {
        targetNodesPerType: {
          ore: 3,
          scrap: 3,
          organic: 2
        },
        totalTargetNodes: 8,
        degradationCheckInterval: 15, // Check every 15 minutes
        degradationRate: 10, // 10% per hour (negative effect)
        spawnArea: {
          minX: 30,
          maxX: 1170, // 1200 - 30 margin
          minY: 80,   // Account for title area
          maxY: 770   // 800 - 30 margin
        }
      }
    };
    
    // Load persisted data first, then initialize resources
    this.initializeGameState();
    
    // Run resource management immediately on startup, then schedule recurring alarms
    this.initializeResourceManagement();
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
    
    // Create 8 initial resource nodes matching our target distribution
    const nodesToCreate: ResourceType[] = [
      'ore', 'ore', 'ore',         // 3 ore nodes
      'scrap', 'scrap', 'scrap',   // 3 scrap nodes
      'organic', 'organic'         // 2 organic nodes
    ];
    
    const nodes: ResourceNode[] = [];
    
    for (let i = 0; i < nodesToCreate.length; i++) {
      const type = nodesToCreate[i];
      const newNode = this.createRandomResourceNodeWithAntiOverlap(type);
      nodes.push(newNode);
    }

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
   * Send message to specific session directly via WebSocket
   */
  private sendToSession(sessionId: string, message: GameWebSocketMessage) {
    console.log(`[GameDO] Sending message to session ${sessionId}:`, message.type);
    const session = this.webSocketSessions.get(sessionId);
    if (session && session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
      session.websocket.send(JSON.stringify(message));
      console.log(`[GameDO] Message sent successfully to session ${sessionId}`);
    } else {
      console.log(`[GameDO] Session ${sessionId} not found or WebSocket not open`);
    }
  }

  /**
   * Send player state update to specific session
   */
  private async sendPlayerStateUpdate(sessionId: string, playerAddress: string) {
      console.log(`[GameDO] send playerStateUpdate ${sessionId}`);
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
      console.log(`[GameDO] send worldStateUpdate ${sessionId}`);
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

    console.log(`[GameDO] Broadcasting player state update to player ${playerAddress}, ${this.webSocketSessions.size} sessions`);
    
    // Send to all sessions for this player
    for (const [sessionId, session] of this.webSocketSessions) {
        console.log(sessionId, session.playerAddress, session.authenticated, session.websocket.readyState);
      if (session.playerAddress === playerAddress && session.authenticated && 
          session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
        session.websocket.send(JSON.stringify(message));
        console.log(`[GameDO] Sent player state update to session ${sessionId}`);
      }
    }
  }

  /**
   * Broadcast world state to all authenticated sessions
   */
  private async broadcastWorldStateUpdate() {
    const message: WorldStateUpdate = {
      type: 'world_state',
      timestamp: new Date(),
      data: {
        resourceNodes: Array.from(this.gameState.resourceNodes.values()),
        missions: Array.from(this.gameState.missions.values()),
        worldMetrics: this.gameState.worldMetrics
      }
    };

    console.log('[GameDO] Broadcasting world state update to all clients');
    
    // Send to all authenticated sessions
    for (const [sessionId, session] of this.webSocketSessions) {
      if (session.authenticated && session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
        session.websocket.send(JSON.stringify(message));
        console.log(`[GameDO] Sent world state update to session ${sessionId}`);
      }
    }
  }

  /**
   * Broadcast mission update to all authenticated sessions
   */
  private async broadcastMissionUpdate(update: any) {
    const message = {
      type: 'mission_update',
      timestamp: new Date(),
      data: update
    };

    console.log('[GameDO] Broadcasting mission update to all clients');
    
    // Send to all authenticated sessions
    for (const [sessionId, session] of this.webSocketSessions) {
      if (session.authenticated && session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
        session.websocket.send(JSON.stringify(message));
        console.log(`[GameDO] Sent mission update to session ${sessionId}`);
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
    console.log(`[GameDO] Starting mission - Player: ${playerAddress}, Type: ${missionType}, Drifters: [${drifterIds.join(', ')}], Target: ${targetNodeId}`);
    
    const player = this.gameState.players.get(playerAddress);
    if (!player) {
      console.error(`[GameDO] Player not found: ${playerAddress}`);
      return { success: false, error: 'Player not found' };
    }

    // Validate drifter IDs
    if (!drifterIds || drifterIds.length === 0) {
      return { success: false, error: 'At least one drifter is required' };
    }

    // Check all drifters are owned by the player
    for (const drifterId of drifterIds) {
      if (!player.ownedDrifters.includes(drifterId)) {
        console.error(`[GameDO] Player ${playerAddress} does not own drifter ${drifterId}`);
        return { success: false, error: `You don't own Drifter #${drifterId}` };
      }
    }

    // Check no drifters are currently on active missions
    const activeDrifters = new Set<number>();
    for (const mission of this.gameState.missions.values()) {
      if (mission.status === 'active') {
        mission.drifterIds.forEach(id => activeDrifters.add(id));
      }
    }

    const busyDrifters = drifterIds.filter(id => activeDrifters.has(id));
    if (busyDrifters.length > 0) {
      console.error(`[GameDO] Drifters currently on missions: [${busyDrifters.join(', ')}]`);
      const busyList = busyDrifters.map(id => `#${id}`).join(', ');
      return { 
        success: false, 
        error: `Drifter${busyDrifters.length > 1 ? 's' : ''} ${busyList} ${busyDrifters.length > 1 ? 'are' : 'is'} currently on another mission` 
      };
    }

    console.log(`[GameDO] All ${drifterIds.length} drifter(s) are available for mission`);

    // Validate target node exists
    const targetNode = this.gameState.resourceNodes.get(targetNodeId);
    if (!targetNode) {
      return { success: false, error: 'Target node not found' };
    }

    // Create mission
    const missionId = crypto.randomUUID();
    const now = new Date();
    
    // Calculate mission duration and rewards using shared utilities
    const duration = calculateMissionDuration(targetNode);
    console.log(`[GameDO] duration: ${duration}`);
    const rewards = calculateMissionRewards(targetNode, missionType, duration);
    console.log(`[GameDO] rewards: ${rewards}`);
    
    console.log(`[GameDO] Mission duration calculated: ${duration / 1000 / 60} minutes based on distance to node at (${targetNode.coordinates.x}, ${targetNode.coordinates.y})`);
    console.log(`[GameDO] Mission rewards calculated: ${rewards.credits} credits, ${Object.values(rewards.resources)[0]} ${Object.keys(rewards.resources)[0]}`);
    
    const mission: Mission = {
      id: missionId,
      type: missionType,
      playerAddress,
      drifterIds,
      targetNodeId,
      startTime: now,
      completionTime: new Date(now.getTime() + duration),
      status: 'active',
      rewards
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
  async completeMission(missionId: string, forceComplete: boolean = false): Promise<{ success: boolean; rewards?: any; error?: string }> {
    const mission = this.gameState.missions.get(missionId);
    if (!mission) {
      return { success: false, error: 'Mission not found' };
    }

    if (mission.status !== 'active') {
      return { success: false, error: 'Mission not active' };
    }

    // Skip time check if forcing completion (for manual testing)
    if (!forceComplete && new Date() < mission.completionTime) {
      return { success: false, error: 'Mission not yet complete' };
    }

    const player = this.gameState.players.get(mission.playerAddress);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Award rewards
    player.balance += mission.rewards.credits;
    
    // Deplete resources from target node
    const node = this.gameState.resourceNodes.get(mission.targetNodeId);
    if (node) {
      console.log(`[GameDO] Depleting resources from node ${mission.targetNodeId} (${node.type})`);
      console.log(`[GameDO] Node before depletion: currentYield=${node.currentYield}, depletion=${node.depletion}`);
      
      // Calculate how much resource was extracted
      const resourceType = node.type;
      const extractedRequested = mission.rewards.resources[resourceType] ?? 0;
      const extractedActual = Math.min(extractedRequested, node.currentYield);
      
      console.log(`[GameDO] Extracting ${extractedActual} units (requested: ${extractedRequested}, available: ${node.currentYield})`);
      
      // Apply depletion
      node.currentYield -= extractedActual;
      node.depletion += extractedActual;
      node.lastHarvested = new Date();
      
      // Mark as inactive if fully depleted
      if (node.currentYield <= 0) {
        node.currentYield = 0;
        node.isActive = false;
        console.log(`[GameDO] Node ${mission.targetNodeId} is now fully depleted and inactive`);
        
        // Add depletion notification to player
        await this.addNotification(mission.playerAddress, {
          id: crypto.randomUUID(),
          type: 'resource_depleted',
          title: 'Resource Depleted',
          message: `The ${resourceType} node you were harvesting has been fully depleted.`,
          timestamp: new Date(),
          read: false
        });
      }
      
      console.log(`[GameDO] Node after depletion: currentYield=${node.currentYield}, depletion=${node.depletion}`);
    } else {
      console.error(`[GameDO] Target node ${mission.targetNodeId} not found during mission completion`);
    }
    
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

    // NOTE: We don't add mission completion to persistent notifications anymore
    // since we use the real-time notification system instead

    // Broadcast updates
    await this.broadcastPlayerStateUpdate(mission.playerAddress);
    await this.broadcastWorldStateUpdate();
    
    // Send mission completion notification to player's sessions
    const notification: PendingNotification = {
      id: crypto.randomUUID(),
      type: 'mission_complete',
      title: 'Mission Complete',
      message: `Mission completed! Earned ${mission.rewards.credits} credits.`,
      timestamp: new Date()
    };
    
    // Send to all sessions for this player
    for (const [sessionId, session] of this.webSocketSessions) {
      if (session.playerAddress === mission.playerAddress && session.authenticated && 
          session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
        this.sendNotificationToSession(sessionId, notification);
      }
    }

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
  // Resource Management and Regeneration
  // =============================================================================

  /**
   * Initialize resource management: run immediately, then schedule recurring alarms
   */
  private async initializeResourceManagement() {
    console.log('[GameDO] Initializing resource management system');
    
    try {
      // Run resource management immediately on startup
      await this.performResourceManagement();
      console.log('[GameDO] Initial resource management check completed');
    } catch (error) {
      console.error('[GameDO] Error during initial resource management:', error);
    }
    
    // Schedule recurring alarms
    await this.scheduleResourceManagementAlarm();
  }

  /**
   * Schedule the next resource degradation alarm
   */
  private async scheduleResourceManagementAlarm() {
    const intervalMs = this.gameState.resourceConfig.degradationCheckInterval * 60 * 1000;
    const nextAlarmTime = new Date(Date.now() + intervalMs);
    
    console.log(`[GameDO] Scheduling resource degradation alarm for ${nextAlarmTime.toISOString()}`);
    await this.ctx.storage.setAlarm(nextAlarmTime);
  }

  /**
   * Handle alarm - resource management
   */
  async alarm() {
    console.log('[GameDO] Resource management alarm triggered');
    
    try {
      await this.performResourceManagement();
    } catch (error) {
      console.error('[GameDO] Error during resource management:', error);
    }
    
    // Schedule next alarm
    await this.scheduleResourceManagementAlarm();
  }

  /**
   * Perform resource management: degradation, cleanup, and spawning
   */
  private async performResourceManagement() {
    console.log('[GameDO] Starting resource degradation cycle');
    
    const config = this.gameState.resourceConfig;
    const now = new Date();
    let changesMade = false;
    
    // 1. Calculate hours elapsed since last update
    const lastUpdate = this.gameState.worldMetrics.lastUpdate;
    const hoursElapsed = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    console.log(`[GameDO] Hours elapsed since last degradation: ${hoursElapsed.toFixed(2)}`);
    
    // 2. Apply degradation to all active nodes
    const depleted: string[] = [];
    const hourlyDegradationRate = config.degradationRate / 100; // Convert percentage to decimal
    
    for (const [nodeId, node] of this.gameState.resourceNodes) {
      if (node.isActive && node.currentYield > 0) {
        // Calculate degradation amount (minimum 1 per cycle to ensure steady degradation)
        let degradationAmount = Math.floor(node.baseYield * hourlyDegradationRate * hoursElapsed);
        
        // Ensure at least 1 point of degradation per cycle for active nodes
        if (degradationAmount < 1) {
          degradationAmount = 1;
        }
        
        const oldYield = node.currentYield;
        node.currentYield = Math.max(0, node.currentYield - degradationAmount);
        
        console.log(`[GameDO] Node ${nodeId} degraded: ${oldYield} -> ${node.currentYield} (-${oldYield - node.currentYield})`);
        changesMade = true;
        
        // Mark as inactive if fully degraded
        if (node.currentYield <= 0) {
          node.isActive = false;
          depleted.push(nodeId);
          console.log(`[GameDO] Node ${nodeId} has been fully degraded and is now inactive`);
        }
      }
    }
    
    // 3. Remove fully degraded nodes immediately
    if (depleted.length > 0) {
      console.log(`[GameDO] Removing ${depleted.length} fully degraded nodes`);
      for (const nodeId of depleted) {
        this.gameState.resourceNodes.delete(nodeId);
      }
      changesMade = true;
    }
    
    // 4. Count current active nodes by type
    const nodeCountsByType: Record<ResourceType, number> = {
      ore: 0,
      scrap: 0,
      organic: 0
    };
    
    for (const node of this.gameState.resourceNodes.values()) {
      if (node.isActive) {
        nodeCountsByType[node.type]++;
      }
    }
    
    const totalActiveNodes = Object.values(nodeCountsByType).reduce((sum, count) => sum + count, 0);
    console.log(`[GameDO] Current active node counts: ore=${nodeCountsByType.ore}, scrap=${nodeCountsByType.scrap}, organic=${nodeCountsByType.organic}, total=${totalActiveNodes}`);
    
    // 5. Spawn replacement nodes to maintain target counts
    const nodesToSpawn: { type: ResourceType; count: number }[] = [];
    
    // Check each resource type against its target
    for (const [type, targetCount] of Object.entries(config.targetNodesPerType) as [ResourceType, number][]) {
      const currentCount = nodeCountsByType[type];
      if (currentCount < targetCount) {
        nodesToSpawn.push({ type, count: targetCount - currentCount });
      }
    }
    
    // Spawn the needed nodes
    for (const { type, count } of nodesToSpawn) {
      for (let i = 0; i < count; i++) {
        const newNode = this.createRandomResourceNodeWithAntiOverlap(type);
        this.gameState.resourceNodes.set(newNode.id, newNode);
        console.log(`[GameDO] Spawned replacement ${type} node at (${newNode.coordinates.x}, ${newNode.coordinates.y}) with ${newNode.currentYield} yield`);
        changesMade = true;
      }
    }
    
    // 6. Update world metrics and save
    this.gameState.worldMetrics.lastUpdate = now;
    
    if (changesMade) {
      await this.saveGameState();
      await this.broadcastWorldStateUpdate();
      console.log('[GameDO] Resource degradation cycle completed with changes');
    } else {
      console.log('[GameDO] Resource degradation cycle completed with no changes needed');
    }
  }

  /**
   * Create a random resource node of the specified type
   */
  private createRandomResourceNode(type: ResourceType): ResourceNode {
    const config = this.gameState.resourceConfig;
    const spawnArea = config.spawnArea;
    
    // Random coordinates within spawn area
    const x = Math.floor(Math.random() * (spawnArea.maxX - spawnArea.minX)) + spawnArea.minX;
    const y = Math.floor(Math.random() * (spawnArea.maxY - spawnArea.minY)) + spawnArea.minY;
    
    // Base yield based on type and rarity
    const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const rarityWeights = [50, 30, 15, 4, 1]; // Percentage weights
    
    let selectedRarity: Rarity = 'common';
    const roll = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < rarities.length; i++) {
      cumulative += rarityWeights[i];
      if (roll <= cumulative) {
        selectedRarity = rarities[i];
        break;
      }
    }
    
    // Base yield varies by type and rarity
    const baseYields = {
      ore: { common: 40, uncommon: 60, rare: 80, epic: 120, legendary: 200 },
      scrap: { common: 50, uncommon: 75, rare: 100, epic: 150, legendary: 250 },
      organic: { common: 25, uncommon: 40, rare: 60, epic: 90, legendary: 150 }
    };
    
    const baseYield = baseYields[type][selectedRarity];
    
    return {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      coordinates: { x, y },
      baseYield,
      currentYield: baseYield,
      depletion: 0,
      rarity: selectedRarity,
      discoveredBy: [],
      lastHarvested: new Date(0), // Never harvested
      isActive: true
    };
  }

  /**
   * Create a random resource node with overlap prevention
   */
  private createRandomResourceNodeWithAntiOverlap(type: ResourceType): ResourceNode {
    const config = this.gameState.resourceConfig;
    const spawnArea = config.spawnArea;
    const minDistance = 40; // Minimum distance between nodes in pixels
    const maxAttempts = 10; // Maximum attempts to find a non-overlapping position
    
    // Get existing node positions
    const existingPositions: { x: number; y: number }[] = [];
    for (const node of this.gameState.resourceNodes.values()) {
      if (node.isActive) {
        existingPositions.push(node.coordinates);
      }
    }
    
    let x: number, y: number;
    let attempts = 0;
    let positionIsValid = false;
    
    // Try to find a non-overlapping position
    do {
      x = Math.floor(Math.random() * (spawnArea.maxX - spawnArea.minX)) + spawnArea.minX;
      y = Math.floor(Math.random() * (spawnArea.maxY - spawnArea.minY)) + spawnArea.minY;
      
      // Check if this position is far enough from existing nodes
      positionIsValid = true;
      for (const existing of existingPositions) {
        const distance = Math.sqrt(Math.pow(x - existing.x, 2) + Math.pow(y - existing.y, 2));
        if (distance < minDistance) {
          positionIsValid = false;
          break;
        }
      }
      
      attempts++;
    } while (!positionIsValid && attempts < maxAttempts);
    
    // If we couldn't find a good position after maxAttempts, just use the last generated position
    if (!positionIsValid) {
      console.log(`[GameDO] Could not find non-overlapping position after ${maxAttempts} attempts, using position (${x}, ${y})`);
    }
    
    // Generate rarity and yield (same logic as createRandomResourceNode)
    const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const rarityWeights = [50, 30, 15, 4, 1];
    
    let selectedRarity: Rarity = 'common';
    const roll = Math.random() * 100;
    let cumulative = 0;
    
    for (let i = 0; i < rarities.length; i++) {
      cumulative += rarityWeights[i];
      if (roll <= cumulative) {
        selectedRarity = rarities[i];
        break;
      }
    }
    
    const baseYields = {
      ore: { common: 40, uncommon: 60, rare: 80, epic: 120, legendary: 200 },
      scrap: { common: 50, uncommon: 75, rare: 100, epic: 150, legendary: 250 },
      organic: { common: 25, uncommon: 40, rare: 60, epic: 90, legendary: 150 }
    };
    
    const baseYield = baseYields[type][selectedRarity];
    
    return {
      id: `${type}-${crypto.randomUUID()}`,
      type,
      coordinates: { x, y },
      baseYield,
      currentYield: baseYield,
      depletion: 0,
      rarity: selectedRarity,
      discoveredBy: [],
      lastHarvested: new Date(0),
      isActive: true
    };
  }

  /**
   * Manually trigger resource management (for testing)
   */
  async triggerResourceManagement(): Promise<{ success: boolean; summary: string }> {
    console.log('[GameDO] Manually triggering resource management');
    
    const beforeStats = {
      totalNodes: this.gameState.resourceNodes.size,
      activeNodes: Array.from(this.gameState.resourceNodes.values()).filter(n => n.isActive).length
    };
    
    await this.performResourceManagement();
    
    const afterStats = {
      totalNodes: this.gameState.resourceNodes.size,
      activeNodes: Array.from(this.gameState.resourceNodes.values()).filter(n => n.isActive).length
    };
    
    const summary = `Resource management completed. Nodes: ${beforeStats.totalNodes} -> ${afterStats.totalNodes}, Active: ${beforeStats.activeNodes} -> ${afterStats.activeNodes}`;
    
    return { success: true, summary };
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
    
    // Broadcast the reset state to all clients
    await this.broadcastWorldStateUpdate();
    
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

  // =============================================================================
  // Durable Object fetch method
  // =============================================================================

  /**
   * Handle incoming requests - WebSocket upgrades and API calls
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade requests
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }
    
    // Handle API calls based on pathname
    switch (url.pathname) {
      case '/profile':
        return this.handleProfileRequest(request);
      case '/missions':
        return this.handleMissionsRequest(request);
      case '/notifications':
        return this.handleNotificationsRequest(request);
      case '/resources':
        return this.handleResourcesRequest(request);
      case '/stats':
        return this.handleStatsRequest(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  /**
   * Handle WebSocket upgrade request
   */
  private handleWebSocketUpgrade(request: Request): Response {
    const [client, server] = Object.values(new WebSocketPair());
    const sessionId = crypto.randomUUID();
    
    // Accept the WebSocket connection
    server.accept();
    
    // Create session (initially unauthenticated)
    const session: WebSocketSession = {
      websocket: server,
      sessionId,
      authenticated: false,
      lastPing: Date.now()
    };
    
    this.webSocketSessions.set(sessionId, session);
    console.log(`[GameDO] New WebSocket session created: ${sessionId}`);
    
    // Set up event handlers
    server.addEventListener('message', (event) => {
      this.handleWebSocketMessage(sessionId, event);
    });
    
    server.addEventListener('close', () => {
      this.cleanupSession(sessionId);
      console.log(`[GameDO] WebSocket session closed: ${sessionId}`);
    });
    
    server.addEventListener('error', (error) => {
      console.error(`[GameDO] WebSocket error for session ${sessionId}:`, error);
      this.webSocketSessions.delete(sessionId);
    });
    
    // Send initial connection status
    this.sendToSession(sessionId, {
      type: 'connection_status',
      timestamp: new Date(),
      data: {
        status: 'connected',
        authenticated: false
      }
    });
    
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  /**
   * Handle WebSocket messages from clients
   */
  private async handleWebSocketMessage(sessionId: string, event: MessageEvent) {
    const session = this.webSocketSessions.get(sessionId);
    if (!session) return;
    
    try {
      const message = JSON.parse(event.data as string);
      
      switch (message.type) {
        case 'authenticate':
          await this.handleWebSocketAuth(sessionId, message.playerAddress);
          break;
          
        case 'ping':
          session.lastPing = Date.now();
          this.sendToSession(sessionId, {
            type: 'pong',
            timestamp: new Date()
          });
          break;
          
        case 'subscribe':
          if (session.authenticated && session.playerAddress) {
            // Send initial state
            await this.sendPlayerStateUpdate(sessionId, session.playerAddress);
            await this.sendWorldStateUpdate(sessionId);
            
            this.sendToSession(sessionId, {
              type: 'subscription_confirmed',
              timestamp: new Date(),
              data: { events: message.events || ['player_state', 'world_state'] }
            });
          }
          break;
          
        case 'notification_ack':
          if (session.authenticated && message.data?.notificationIds) {
            this.handleNotificationAck(sessionId, message.data.notificationIds);
          }
          break;
          
        default:
          this.sendToSession(sessionId, {
            type: 'error',
            timestamp: new Date(),
            data: { message: `Unknown message type: ${message.type}` }
          });
      }
    } catch (error) {
      console.error(`[GameDO] Error handling WebSocket message:`, error);
      this.sendToSession(sessionId, {
        type: 'error',
        timestamp: new Date(),
        data: { message: 'Invalid message format' }
      });
    }
  }

  /**
   * Handle WebSocket authentication
   */
  private async handleWebSocketAuth(sessionId: string, playerAddress: string) {
    const session = this.webSocketSessions.get(sessionId);
    if (!session) return;
    
    if (playerAddress && typeof playerAddress === 'string') {
      session.playerAddress = playerAddress;
      session.authenticated = true;
      
      console.log(`[GameDO] WebSocket session ${sessionId} authenticated for player ${playerAddress}`);
      
      // Clear any stale queued notifications (don't replay old notifications on refresh)
      if (this.playerReplayQueues.has(playerAddress)) {
        const queueSize = this.playerReplayQueues.get(playerAddress)!.length;
        console.log(`[GameDO] Clearing ${queueSize} stale notifications from replay queue for player ${playerAddress}`);
        this.playerReplayQueues.delete(playerAddress);
      }
      
      this.sendToSession(sessionId, {
        type: 'connection_status',
        timestamp: new Date(),
        data: {
          status: 'connected',
          authenticated: true
        }
      });
    } else {
      this.sendToSession(sessionId, {
        type: 'connection_status',
        timestamp: new Date(),
        data: {
          status: 'connected',
          authenticated: false,
          error: 'Invalid player address'
        }
      });
    }
  }

  /**
   * Handle API requests that were previously handled separately
   */
  private async handleProfileRequest(request: Request): Promise<Response> {
    // Implementation for profile requests
    // This would handle the same logic as the existing API routes
    return new Response('Profile API - implement as needed', { status: 200 });
  }

  private async handleMissionsRequest(request: Request): Promise<Response> {
    // Implementation for mission requests
    return new Response('Missions API - implement as needed', { status: 200 });
  }

  private async handleNotificationsRequest(request: Request): Promise<Response> {
    // Implementation for notifications requests
    return new Response('Notifications API - implement as needed', { status: 200 });
  }

  private async handleResourcesRequest(request: Request): Promise<Response> {
    // Implementation for resources requests
    return new Response('Resources API - implement as needed', { status: 200 });
  }

  private async handleStatsRequest(request: Request): Promise<Response> {
    const stats = await this.getStats();
    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // =============================================================================
  // Notification Tracking System
  // =============================================================================

  /**
   * Handle notification acknowledgment from client
   */
  private handleNotificationAck(sessionId: string, notificationIds: string[]) {
    console.log(`[GameDO] Received ACK from session ${sessionId} for notifications:`, notificationIds);
    
    const pendingSet = this.pendingNotifications.get(sessionId);
    if (!pendingSet) {
      console.log(`[GameDO] No pending notifications found for session ${sessionId}`);
      return;
    }

    // Remove acknowledged notifications from pending set
    for (const notifId of notificationIds) {
      if (pendingSet.has(notifId)) {
        pendingSet.delete(notifId);
        console.log(`[GameDO] Removed notification ${notifId} from pending for session ${sessionId}`);
      }
    }

    // Clean up empty pending set
    if (pendingSet.size === 0) {
      this.pendingNotifications.delete(sessionId);
    }
  }

  /**
   * Send notification with delivery tracking
   */
  private sendNotificationToSession(sessionId: string, notification: PendingNotification) {
    const session = this.webSocketSessions.get(sessionId);
    if (!session || session.websocket.readyState !== WebSocket.READY_STATE_OPEN) {
      console.log(`[GameDO] Session ${sessionId} not available, adding to replay queue`);
      // Add to replay queue if session not available
      if (session?.playerAddress) {
        this.addToReplayQueue(session.playerAddress, notification);
      }
      return;
    }

    // Track as pending
    if (!this.pendingNotifications.has(sessionId)) {
      this.pendingNotifications.set(sessionId, new Set());
    }
    this.pendingNotifications.get(sessionId)!.add(notification.id);

    // Send the notification
    const message = {
      type: 'notification',
      timestamp: new Date(),
      data: notification
    };

    session.websocket.send(JSON.stringify(message));
    console.log(`[GameDO] Sent notification ${notification.id} to session ${sessionId} (pending ACK)`);
  }

  /**
   * Add notification to player's replay queue for later delivery
   */
  private addToReplayQueue(playerAddress: string, notification: PendingNotification) {
    if (!this.playerReplayQueues.has(playerAddress)) {
      this.playerReplayQueues.set(playerAddress, []);
    }
    
    const queue = this.playerReplayQueues.get(playerAddress)!;
    queue.push(notification);
    
    // Keep queue size manageable
    if (queue.length > 10) {
      queue.shift(); // Remove oldest
    }
    
    console.log(`[GameDO] Added notification ${notification.id} to replay queue for player ${playerAddress}`);
  }

  /**
   * Send any queued notifications to newly connected session
   */
  private async sendQueuedNotifications(sessionId: string, playerAddress: string) {
    const queue = this.playerReplayQueues.get(playerAddress);
    if (!queue || queue.length === 0) {
      return;
    }

    console.log(`[GameDO] Replaying ${queue.length} queued notifications to session ${sessionId}`);
    
    // Send all queued notifications
    for (const notification of queue) {
      this.sendNotificationToSession(sessionId, notification);
    }
    
    // Clear the queue since we've sent them
    this.playerReplayQueues.delete(playerAddress);
  }

  /**
   * Clean up session data when WebSocket closes
   */
  private cleanupSession(sessionId: string) {
    const session = this.webSocketSessions.get(sessionId);
    if (!session) return;

    // Log pending notifications but DON'T move them back to replay queue
    // Browser refreshes and normal disconnects should not replay notifications
    const pendingSet = this.pendingNotifications.get(sessionId);
    if (pendingSet && pendingSet.size > 0) {
      console.log(`[GameDO] Session ${sessionId} closed with ${pendingSet.size} pending notifications. These will be discarded (normal for browser refresh).`);
    }

    // Clean up tracking maps
    this.pendingNotifications.delete(sessionId);
    this.webSocketSessions.delete(sessionId);
  }
}
