import type { ResourceNode, MissionType } from './models';

// Town coordinates (center of the map area)
export const TOWN_COORDINATES = { x: 500, y: 350 };

/**
 * Calculate mission duration based on distance from town to target node
 */
export function calculateMissionDuration(targetNode: ResourceNode): number {
  // Calculate distance from town to target node
  const dx = targetNode.coordinates.x - TOWN_COORDINATES.x;
  const dy = targetNode.coordinates.y - TOWN_COORDINATES.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Base mission time: 15 minutes for very close nodes
  const baseDurationMinutes = 15;
  
  // Distance factor: add time based on distance
  // Assuming map coordinates range roughly 50-650 for X and 50-450 for Y
  // Maximum distance would be roughly sqrt((650-50)^2 + (450-50)^2) ≈ 715
  // So we'll normalize distance to 0-1 range and add up to 45 additional minutes
  const maxExpectedDistance = 715;
  const normalizedDistance = Math.min(distance / maxExpectedDistance, 1.0);
  const additionalMinutes = normalizedDistance * 45; // 0-45 additional minutes
  
  const totalMinutes = baseDurationMinutes + additionalMinutes;
  const durationMs = Math.round(totalMinutes * 60 * 1000); // Convert to milliseconds
  
  return durationMs;
}

/**
 * Calculate mission rewards based on node properties, mission type, and duration
 */
export function calculateMissionRewards(
  targetNode: ResourceNode, 
  missionType: MissionType, 
  durationMs: number
): { credits: number; resources: Record<string, number> } {
  
  // Base rewards
  let baseCredits = 150;
  let baseResources = 20;
  
  // Rarity multipliers
  const rarityMultipliers = {
    common: 1.0,
    uncommon: 1.3,
    rare: 1.7,
    epic: 2.2,
    legendary: 3.0
  };
  
  // Mission type multipliers (risk vs reward)
  const missionTypeMultipliers = {
    scavenge: { credits: 0.8, resources: 1.0, variance: 0.1 }, // Safe, consistent
    strip_mine: { credits: 0.6, resources: 1.4, variance: 0.05 }, // Lower credits, high resources, very consistent
    combat: { credits: 1.4, resources: 1.3, variance: 0.3 }, // High risk, high reward
    sabotage: { credits: 1.2, resources: 0.8, variance: 0.25 } // Disruption focused, moderate rewards
  };
  
  // Get multipliers
  const rarityMult = rarityMultipliers[targetNode.rarity];
  const typeMults = missionTypeMultipliers[missionType];
  
  // Node yield factor (higher yield = better rewards)
  const yieldFactor = Math.max(0.5, Math.min(2.0, targetNode.currentYield / 50));
  
  // Distance bonus (slightly better rewards for farther nodes)
  const durationMinutes = durationMs / 1000 / 60;
  const distanceBonus = 1.0 + ((durationMinutes - 15) / 45) * 0.2; // Up to 20% bonus for max distance
  
  // Calculate base values with all multipliers
  const totalCreditsMultiplier = rarityMult * typeMults.credits * yieldFactor * distanceBonus;
  const totalResourcesMultiplier = rarityMult * typeMults.resources * yieldFactor * distanceBonus;
  
  // Apply some variance based on mission type
  const creditsVariance = typeMults.variance;
  const resourcesVariance = typeMults.variance;
  
  // Calculate final values with random variance
  const creditsMultiplier = 1.0 + (Math.random() - 0.5) * 2 * creditsVariance; // ±variance
  const resourcesMultiplier = 1.0 + (Math.random() - 0.5) * 2 * resourcesVariance; // ±variance
  
  const finalCredits = Math.floor(baseCredits * totalCreditsMultiplier * creditsMultiplier);
  const finalResources = Math.floor(baseResources * totalResourcesMultiplier * resourcesMultiplier);
  
  return {
    credits: Math.max(50, finalCredits), // Minimum 50 credits
    resources: {
      [targetNode.type]: Math.max(5, Math.min(finalResources, targetNode.currentYield)) // Can't extract more than available
    }
  };
}

/**
 * Calculate estimated mission rewards (without randomness for UI display)
 */
export function estimateMissionRewards(
  targetNode: ResourceNode, 
  missionType: MissionType, 
  durationMs: number
): { 
  creditsRange: { min: number; max: number }; 
  resourcesRange: { min: number; max: number; type: string } 
} {
  
  // Base rewards
  let baseCredits = 150;
  let baseResources = 20;
  
  // Rarity multipliers
  const rarityMultipliers = {
    common: 1.0,
    uncommon: 1.3,
    rare: 1.7,
    epic: 2.2,
    legendary: 3.0
  };
  
  // Mission type multipliers
  const missionTypeMultipliers = {
    scavenge: { credits: 0.8, resources: 1.0, variance: 0.1 },
    strip_mine: { credits: 0.6, resources: 1.4, variance: 0.05 },
    combat: { credits: 1.4, resources: 1.3, variance: 0.3 },
    sabotage: { credits: 1.2, resources: 0.8, variance: 0.25 }
  };
  
  // Get multipliers
  const rarityMult = rarityMultipliers[targetNode.rarity];
  const typeMults = missionTypeMultipliers[missionType];
  
  // Node yield factor
  const yieldFactor = Math.max(0.5, Math.min(2.0, targetNode.currentYield / 50));
  
  // Distance bonus
  const durationMinutes = durationMs / 1000 / 60;
  const distanceBonus = 1.0 + ((durationMinutes - 15) / 45) * 0.2;
  
  // Calculate base values with all multipliers
  const totalCreditsMultiplier = rarityMult * typeMults.credits * yieldFactor * distanceBonus;
  const totalResourcesMultiplier = rarityMult * typeMults.resources * yieldFactor * distanceBonus;
  
  // Calculate range based on variance
  const creditsVariance = typeMults.variance;
  const resourcesVariance = typeMults.variance;
  
  const baseCreditsValue = baseCredits * totalCreditsMultiplier;
  const baseResourcesValue = baseResources * totalResourcesMultiplier;
  
  const creditsMin = Math.max(50, Math.floor(baseCreditsValue * (1 - creditsVariance)));
  const creditsMax = Math.floor(baseCreditsValue * (1 + creditsVariance));
  
  const resourcesMin = Math.max(5, Math.floor(baseResourcesValue * (1 - resourcesVariance)));
  const resourcesMax = Math.min(
    Math.floor(baseResourcesValue * (1 + resourcesVariance)), 
    targetNode.currentYield
  );
  
  return {
    creditsRange: { min: creditsMin, max: creditsMax },
    resourcesRange: { 
      min: resourcesMin, 
      max: resourcesMax, 
      type: targetNode.type 
    }
  };
}

/**
 * Format duration in milliseconds to a human-readable string
 */
export function formatDuration(durationMs: number): string {
  const totalMinutes = Math.round(durationMs / 1000 / 60);
  
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (minutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${minutes}m`;
}

/**
 * Mission type definition for UI display
 */
export interface AvailableMissionType {
  type: MissionType;
  name: string;
  description: string;
  color: string;
  borderColor: string;
  enabled: boolean;
}

/**
 * Determine available mission types based on node state
 */
export function getAvailableMissionTypes(
  targetNode: ResourceNode,
  activeMissions: any[],
  playerAddress?: string
): AvailableMissionType[] {
  const missionTypes: AvailableMissionType[] = [];
  
  // Check if node is contested (has active missions from other players)
  const contestedMissions = activeMissions.filter(m => 
    m.targetNodeId === targetNode.id && 
    m.status === 'active' && 
    m.playerAddress !== playerAddress
  );
  
  const isContested = contestedMissions.length > 0;
  
  if (isContested) {
    // CONTESTED NODE: Combat & Sabotage missions
    missionTypes.push(
      {
        type: 'combat',
        name: 'COMBAT',
        description: `Fight ${contestedMissions.length} active team${contestedMissions.length > 1 ? 's' : ''} for control`,
        color: '#5c2a2a',
        borderColor: '#7c4a4a',
        enabled: true
      },
      {
        type: 'sabotage',
        name: 'SABOTAGE',
        description: `Disrupt ${contestedMissions.length} ongoing operation${contestedMissions.length > 1 ? 's' : ''}`,
        color: '#4a2a5c',
        borderColor: '#6a4a7c',
        enabled: true
      }
    );
  } else {
    // UNCONTESTED NODE: Scavenge & Strip-mine missions
    missionTypes.push(
      {
        type: 'scavenge',
        name: 'SCAVENGE',
        description: 'Safe resource gathering with minimal risk',
        color: '#2c5530',
        borderColor: '#4a7c59',
        enabled: true
      },
      {
        type: 'strip_mine',
        name: 'STRIP-MINE',
        description: 'Maximum resource extraction, slower but efficient',
        color: '#5c4a2a',
        borderColor: '#7c6a4a',
        enabled: true
      }
    );
  }
  
  return missionTypes;
}
