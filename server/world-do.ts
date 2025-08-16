import { DurableObject } from 'cloudflare:workers';
import type { 
  WorldState, 
  Mission, 
  ResourceNode, 
  StartMissionRequest,
  StartMissionResponse,
  InterceptMissionRequest,
  InterceptMissionResponse,
  MissionResult,
  ResourceType
} from '@shared/models';

/**
 * WorldDO - Global World State Durable Object
 * 
 * There is only one instance of this object (singleton with id "world").
 * It manages:
 * - Global resource nodes and their quantities
 * - All active missions across all players
 * - Town metrics (prosperity, security, etc.)
 * - Mission timers via alarms
 */
export class WorldDO extends DurableObject {
  private missions: Map<string, Mission> = new Map();
  private resources: Map<string, ResourceNode> = new Map();
  private townMetrics = {
    prosperity: 50,
    security: 50,
    population: 100,
    upgradeLevel: 1
  };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    
    // Initialize with default resource nodes if first time
    this.initializeResources();
  }

  /**
   * Initialize default resource nodes in the Scablands
   */
  private async initializeResources() {
    const stored = await this.ctx.storage.get<Map<string, ResourceNode>>('resources');
    if (stored && stored.size > 0) {
      this.resources = stored;
      return;
    }

    // Create default resource nodes scattered across the map
    const defaultNodes: ResourceNode[] = [
      // Ore nodes (high value, slower respawn)
      { id: 'ore-1', x: 200, y: 150, type: 'ore' as ResourceType, quantity: 100, maxQuantity: 100, respawnTime: 3600 },
      { id: 'ore-2', x: 600, y: 400, type: 'ore' as ResourceType, quantity: 80, maxQuantity: 100, respawnTime: 3600 },
      { id: 'ore-3', x: 300, y: 500, type: 'ore' as ResourceType, quantity: 90, maxQuantity: 100, respawnTime: 3600 },
      
      // Scrap nodes (medium value, medium respawn)
      { id: 'scrap-1', x: 150, y: 300, type: 'scrap' as ResourceType, quantity: 150, maxQuantity: 150, respawnTime: 1800 },
      { id: 'scrap-2', x: 500, y: 200, type: 'scrap' as ResourceType, quantity: 120, maxQuantity: 150, respawnTime: 1800 },
      { id: 'scrap-3', x: 400, y: 350, type: 'scrap' as ResourceType, quantity: 140, maxQuantity: 150, respawnTime: 1800 },
      { id: 'scrap-4', x: 700, y: 300, type: 'scrap' as ResourceType, quantity: 130, maxQuantity: 150, respawnTime: 1800 },
      
      // Organic nodes (lower value, faster respawn)  
      { id: 'organic-1', x: 100, y: 400, type: 'organic' as ResourceType, quantity: 200, maxQuantity: 200, respawnTime: 900 },
      { id: 'organic-2', x: 350, y: 100, type: 'organic' as ResourceType, quantity: 180, maxQuantity: 200, respawnTime: 900 },
      { id: 'organic-3', x: 550, y: 450, type: 'organic' as ResourceType, quantity: 190, maxQuantity: 200, respawnTime: 900 },
      { id: 'organic-4', x: 650, y: 150, type: 'organic' as ResourceType, quantity: 170, maxQuantity: 200, respawnTime: 900 },
      { id: 'organic-5', x: 250, y: 250, type: 'organic' as ResourceType, quantity: 200, maxQuantity: 200, respawnTime: 900 },
    ];

    for (const node of defaultNodes) {
      this.resources.set(node.id, node);
    }

    await this.ctx.storage.put('resources', this.resources);
  }

  /**
   * Start a new mission to a resource node
   */
  async startMission(request: StartMissionRequest): Promise<StartMissionResponse> {
    const { playerAddress, drifterIds, targetNodeId } = request;
    
    // Validate target node exists and has resources
    const targetNode = this.resources.get(targetNodeId);
    if (!targetNode) {
      return { success: false, error: 'Target resource node not found' };
    }
    
    if (targetNode.quantity <= 0) {
      return { success: false, error: 'Resource node is depleted' };
    }

    // Calculate mission duration based on distance and drifter stats
    const distance = Math.sqrt(targetNode.x * targetNode.x + targetNode.y * targetNode.y) / 10; // Simplified distance calc
    const baseTravelTime = Math.max(30, distance * 2); // Minimum 30 seconds, then 2 seconds per distance unit
    
    // TODO: Get actual drifter stats to calculate speed bonus
    const travelTime = baseTravelTime; // For now, no speed modifiers
    
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + travelTime * 1000);
    
    // Create mission
    const missionId = `mission-${playerAddress}-${Date.now()}`;
    const mission: Mission = {
      id: missionId,
      playerAddress,
      drifterIds,
      targetNodeId,
      startTime,
      endTime,
      status: 'active',
      type: 'scavenge'
    };
    
    this.missions.set(missionId, mission);
    await this.ctx.storage.put('missions', this.missions);
    
    // Set alarm for mission completion
    await this.ctx.storage.setAlarm(endTime.getTime());
    
    return { 
      success: true, 
      mission,
      estimatedDuration: travelTime 
    };
  }

  /**
   * Start an intercept mission against another player's active mission
   */
  async startIntercept(request: InterceptMissionRequest): Promise<InterceptMissionResponse> {
    const { attackerAddress, targetMissionId, banditIds } = request;
    
    // Validate target mission exists and is active
    const targetMission = this.missions.get(targetMissionId);
    if (!targetMission) {
      return { success: false, error: 'Target mission not found' };
    }
    
    if (targetMission.status !== 'active') {
      return { success: false, error: 'Target mission is not active' };
    }
    
    if (targetMission.playerAddress === attackerAddress) {
      return { success: false, error: 'Cannot intercept your own mission' };
    }
    
    // Create intercept mission
    const interceptId = `intercept-${attackerAddress}-${Date.now()}`;
    const interceptMission: Mission = {
      id: interceptId,
      playerAddress: attackerAddress,
      drifterIds: banditIds,
      targetNodeId: targetMission.targetNodeId,
      startTime: new Date(),
      endTime: targetMission.endTime, // Same end time as target
      status: 'active',
      type: 'intercept',
      targetMissionId
    };
    
    this.missions.set(interceptId, interceptMission);
    await this.ctx.storage.put('missions', this.missions);
    
    return { 
      success: true, 
      mission: interceptMission 
    };
  }

  /**
   * Complete a mission - called by alarm or manually
   */
  async completeMission(missionId: string): Promise<MissionResult> {
    const mission = this.missions.get(missionId);
    if (!mission || mission.status !== 'active') {
      return { success: false, error: 'Mission not found or not active' };
    }
    
    const targetNode = this.resources.get(mission.targetNodeId);
    if (!targetNode) {
      return { success: false, error: 'Target node not found' };
    }
    
    // Check if there's an intercept mission targeting this one
    const interceptMissions = Array.from(this.missions.values())
      .filter(m => m.type === 'intercept' && m.targetMissionId === missionId && m.status === 'active');
    
    let result: MissionResult;
    
    if (interceptMissions.length > 0) {
      // Combat resolution
      result = await this.resolveCombat(mission, interceptMissions[0], targetNode);
    } else {
      // Normal scavenging resolution
      result = await this.resolveScavenging(mission, targetNode);
    }
    
    // Mark missions as completed
    mission.status = 'completed';
    this.missions.set(missionId, mission);
    
    if (interceptMissions.length > 0) {
      interceptMissions[0].status = 'completed';
      this.missions.set(interceptMissions[0].id, interceptMissions[0]);
    }
    
    await this.ctx.storage.put('missions', this.missions);
    await this.ctx.storage.put('resources', this.resources);
    
    return result;
  }

  /**
   * Resolve combat between scavenger and interceptor
   */
  private async resolveCombat(scavengeMission: Mission, interceptMission: Mission, node: ResourceNode): Promise<MissionResult> {
    // TODO: Get actual drifter stats for combat calculation
    // For now, use simplified RNG-based combat
    
    const scavengerCombat = scavengeMission.drifterIds.length * 5; // Simplified: 5 combat per drifter
    const interceptorCombat = interceptMission.drifterIds.length * 5;
    
    // Add randomness (d20 roll for each side)
    const scavengerRoll = Math.floor(Math.random() * 20) + 1;
    const interceptorRoll = Math.floor(Math.random() * 20) + 1;
    
    const scavengerTotal = scavengerCombat + scavengerRoll;
    const interceptorTotal = interceptorCombat + interceptorRoll;
    
    let winner: 'scavenger' | 'interceptor';
    let loot = 0;
    
    if (scavengerTotal > interceptorTotal) {
      winner = 'scavenger';
      // Scavenger wins - gets loot but reduced due to combat
      loot = Math.min(30, node.quantity) * 0.7; // 70% of normal loot due to combat
    } else {
      winner = 'interceptor';
      // Interceptor wins - steals loot from node
      loot = Math.min(30, node.quantity) * 0.5; // 50% of what scavenger would have gotten
    }
    
    // Update resource node
    node.quantity = Math.max(0, node.quantity - Math.ceil(loot));
    
    // Schedule respawn if depleted
    if (node.quantity === 0) {
      const respawnTime = Date.now() + (node.respawnTime * 1000);
      await this.ctx.storage.setAlarm(respawnTime);
    }
    
    return {
      success: true,
      type: 'combat',
      winner: winner === 'scavenger' ? scavengeMission.playerAddress : interceptMission.playerAddress,
      loser: winner === 'scavenger' ? interceptMission.playerAddress : scavengeMission.playerAddress,
      lootAmount: loot,
      combatDetails: {
        scavengerCombat: scavengerTotal,
        interceptorCombat: interceptorTotal
      }
    };
  }

  /**
   * Resolve normal scavenging mission
   */
  private async resolveScavenging(mission: Mission, node: ResourceNode): Promise<MissionResult> {
    // TODO: Get actual drifter stats for scavenging calculation
    // For now, use simplified calculation
    
    const scavengingPower = mission.drifterIds.length * 3; // 3 scavenging per drifter
    const baseLoot = Math.min(scavengingPower * 2, node.quantity); // Max 2x scavenging power
    
    // Add randomness (10% variance)
    const variance = baseLoot * 0.1;
    const actualLoot = baseLoot + (Math.random() - 0.5) * variance;
    const finalLoot = Math.max(1, Math.floor(actualLoot));
    
    // Update resource node
    node.quantity = Math.max(0, node.quantity - finalLoot);
    
    // Schedule respawn if depleted
    if (node.quantity === 0) {
      const respawnTime = Date.now() + (node.respawnTime * 1000);
      await this.ctx.storage.setAlarm(respawnTime);
    }
    
    return {
      success: true,
      type: 'scavenge',
      winner: mission.playerAddress,
      lootAmount: finalLoot,
      nodeId: node.id,
      resourceType: node.type
    };
  }

  /**
   * Get list of active missions (filtered by player address if provided)
   */
  async listActiveMissions(playerAddress?: string): Promise<Mission[]> {
    const allMissions = Array.from(this.missions.values());
    
    if (playerAddress) {
      return allMissions.filter(m => m.playerAddress === playerAddress && m.status === 'active');
    }
    
    return allMissions.filter(m => m.status === 'active');
  }

  /**
   * Get list of resource nodes (filtered by discoveries if provided)
   */
  async listResources(discoveredNodeIds?: string[]): Promise<ResourceNode[]> {
    const allNodes = Array.from(this.resources.values());
    
    if (discoveredNodeIds && discoveredNodeIds.length > 0) {
      return allNodes.filter(node => discoveredNodeIds.includes(node.id));
    }
    
    return allNodes; // Return all nodes for now (discovery system TODO)
  }

  /**
   * Get current world state
   */
  async getWorldState(): Promise<WorldState> {
    return {
      resources: Array.from(this.resources.values()),
      activeMissions: Array.from(this.missions.values()).filter(m => m.status === 'active'),
      townMetrics: this.townMetrics,
      lastUpdate: new Date()
    };
  }

  /**
   * Alarm handler - processes mission completions and resource respawns
   */
  async alarm() {
    const now = Date.now();
    
    // Find missions that should be completed
    const missionsToComplete = Array.from(this.missions.values())
      .filter(m => m.status === 'active' && m.endTime.getTime() <= now);
    
    // Process each completed mission
    for (const mission of missionsToComplete) {
      try {
        const result = await this.completeMission(mission.id);
        
        // TODO: Credit player balance via PlayerDO
        // TODO: Send notification to player
        console.log('Mission completed:', mission.id, result);
      } catch (error) {
        console.error('Error completing mission:', mission.id, error);
      }
    }
    
    // Check for resource respawns
    const resourcesToRespawn = Array.from(this.resources.values())
      .filter(r => r.quantity === 0 && r.respawnTime);
    
    for (const resource of resourcesToRespawn) {
      // Respawn resources that are ready
      resource.quantity = resource.maxQuantity;
      this.resources.set(resource.id, resource);
    }
    
    if (resourcesToRespawn.length > 0) {
      await this.ctx.storage.put('resources', this.resources);
    }
    
    // Set next alarm if needed
    const nextMission = Array.from(this.missions.values())
      .filter(m => m.status === 'active')
      .sort((a, b) => a.endTime.getTime() - b.endTime.getTime())[0];
    
    if (nextMission) {
      await this.ctx.storage.setAlarm(nextMission.endTime.getTime());
    }
  }
}
