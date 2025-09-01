import type { ResourceNode, MissionType, DrifterProfile, Vehicle } from './models';

// Type alias for drifter stats to avoid circular imports
export type DrifterStats = Pick<DrifterProfile, 'combat' | 'scavenging' | 'tech' | 'speed'>;

// Town coordinates (center of the map area)
export const TOWN_COORDINATES = { x: 500, y: 350 };

// Base speed value (in the same units as Drifter/Vehicle speed) for mission duration calculations
// Choose 6 so that a drifter with speed 6 is the baseline (factor = 1.0)
export const BASE_SPEED = 6;

// Maximum slowdown factor cap for very slow teams
export const MAX_SPEED_FACTOR = 5.0; // Max 5x slower than base speed

// Drifter stat multiplier constants
export const SCAVENGING_MULTIPLIER = 0.005; // 0.5% per point
export const TECH_MULTIPLIER = 0.003; // 0.3% per point

/**
 * Calculate mission duration based on distance from town to target node
 */
export function calculateMissionDuration(targetNode: ResourceNode, drifters: DrifterStats[] = [], vehicle?: Vehicle): number {
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

	let totalMinutes = baseDurationMinutes + additionalMinutes;

	// Apply speed modifier
	let teamSpeed = BASE_SPEED;
	if (vehicle) {
		// Vehicle speed uses the same unit as drifters
		teamSpeed = vehicle.speed;
	} else if (drifters.length > 0) {
		// Team speed is determined by the slowest drifter if no vehicle
		teamSpeed = Math.min(...drifters.map((d) => d.speed)) || BASE_SPEED;
	}

	// Faster vehicles/drifters = less time (speed of 200 = half the time)
	// Cap maximum speed factor to prevent extremely long missions
	const speedFactor = Math.min(BASE_SPEED / teamSpeed, MAX_SPEED_FACTOR);
	totalMinutes *= speedFactor;

	const durationMs = Math.round(totalMinutes * 60 * 1000); // Convert to milliseconds

	return durationMs;
}

/**
 * Calculate mission rewards based on node properties, mission type, and duration
 */
export function calculateMissionRewards(
	targetNode: ResourceNode,
	missionType: MissionType,
	durationMs: number,
	drifters: DrifterStats[] = [],
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
		legendary: 3.0,
	};

	// Mission type multipliers (risk vs reward)
	const missionTypeMultipliers = {
		scavenge: { credits: 0.7, resources: 0.9, variance: 0.1 }, // Safe but modest rewards
		strip_mine: { credits: 1.0, resources: 1.5, variance: 0.05 }, // Industrial operation - better rewards, very consistent
		combat: { credits: 1.4, resources: 1.3, variance: 0.3 }, // High risk, high reward
		sabotage: { credits: 1.2, resources: 0.8, variance: 0.25 }, // Disruption focused, moderate rewards
	};

	// Get multipliers
	const rarityMult = rarityMultipliers[targetNode.rarity];
	const typeMults = missionTypeMultipliers[missionType];

	// Node yield factor (higher yield = better rewards)
	const yieldFactor = Math.max(0.5, Math.min(2.0, targetNode.currentYield / 50));

	// Distance bonus (slightly better rewards for farther nodes)
	const durationMinutes = durationMs / 1000 / 60;
	const distanceBonus = 1.0 + ((durationMinutes - 15) / 45) * 0.2; // Up to 20% bonus for max distance

	// Calculate drifter team stat bonuses
	let teamScavengingBonus = 1.0;
	let teamTechBonus = 1.0;

	if (drifters.length > 0) {
		// Sum up the team's scavenging and tech stats
		const totalScavenging = drifters.reduce((sum, d) => sum + d.scavenging, 0);
		const totalTech = drifters.reduce((sum, d) => sum + d.tech, 0);

		// Apply bonuses based on team stats
		teamScavengingBonus = 1.0 + totalScavenging * SCAVENGING_MULTIPLIER;
		teamTechBonus = 1.0 + totalTech * TECH_MULTIPLIER;
	}

	// Calculate base values with all multipliers
	const totalCreditsMultiplier = rarityMult * typeMults.credits * yieldFactor * distanceBonus * teamTechBonus;
	const totalResourcesMultiplier = rarityMult * typeMults.resources * yieldFactor * distanceBonus * teamScavengingBonus;

	// Apply some variance based on mission type
	const creditsVariance = typeMults.variance;
	const resourcesVariance = typeMults.variance;

	// Calculate final values with random variance
	const creditsMultiplier = 1.0 + (Math.random() - 0.5) * 2 * creditsVariance; // ±variance
	const resourcesMultiplier = 1.0 + (Math.random() - 0.5) * 2 * resourcesVariance; // ±variance

	const finalCredits = Math.floor(baseCredits * totalCreditsMultiplier * creditsMultiplier);
	const baseResourcesExtracted = Math.floor(baseResources * totalResourcesMultiplier * resourcesMultiplier);

	// Cap resource extraction based on team size and mission type
	const teamSize = drifters.length || 1; // Default to 1 if no team provided

	// Maximum extraction per drifter per mission (tunable values)
	const extractionLimits = {
		scavenge: 8, // Conservative extraction per drifter
		strip_mine: 12, // More efficient extraction per drifter
		combat: 10, // Moderate extraction during combat
		sabotage: 6, // Focused on disruption, less extraction
	};

	const maxTeamExtraction = teamSize * extractionLimits[missionType];
	const cappedResources = Math.min(baseResourcesExtracted, maxTeamExtraction);

	return {
		credits: Math.max(50, finalCredits), // Minimum 50 credits
		resources: {
			[targetNode.type]: Math.max(0, Math.min(cappedResources, targetNode.currentYield)),
		},
	};
}

/**
 * Calculate estimated mission rewards (without randomness for UI display)
 */
export function estimateMissionRewards(
	targetNode: ResourceNode,
	missionType: MissionType,
	durationMs: number,
	drifters: DrifterStats[] = [],
): {
	creditsRange: { min: number; max: number };
	resourcesRange: { min: number; max: number; type: string };
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
		legendary: 3.0,
	};

	// Mission type multipliers
	const missionTypeMultipliers = {
		scavenge: { credits: 0.7, resources: 0.9, variance: 0.1 },
		strip_mine: { credits: 1.0, resources: 1.5, variance: 0.05 },
		combat: { credits: 1.4, resources: 1.3, variance: 0.3 },
		sabotage: { credits: 1.2, resources: 0.8, variance: 0.25 },
	};

	// Get multipliers
	const rarityMult = rarityMultipliers[targetNode.rarity];
	const typeMults = missionTypeMultipliers[missionType];

	// Node yield factor
	const yieldFactor = Math.max(0.5, Math.min(2.0, targetNode.currentYield / 50));

	// Distance bonus
	const durationMinutes = durationMs / 1000 / 60;
	const distanceBonus = 1.0 + ((durationMinutes - 15) / 45) * 0.2;

	// Calculate drifter team stat bonuses
	let teamScavengingBonus = 1.0;
	let teamTechBonus = 1.0;

	if (drifters.length > 0) {
		// Sum up the team's scavenging and tech stats
		const totalScavenging = drifters.reduce((sum, d) => sum + d.scavenging, 0);
		const totalTech = drifters.reduce((sum, d) => sum + d.tech, 0);

		// Apply bonuses based on team stats
		teamScavengingBonus = 1.0 + totalScavenging * SCAVENGING_MULTIPLIER;
		teamTechBonus = 1.0 + totalTech * TECH_MULTIPLIER;
	}

	// Calculate base values with all multipliers
	const totalCreditsMultiplier = rarityMult * typeMults.credits * yieldFactor * distanceBonus * teamTechBonus;
	const totalResourcesMultiplier = rarityMult * typeMults.resources * yieldFactor * distanceBonus * teamScavengingBonus;

	// Calculate range based on variance
	const creditsVariance = typeMults.variance;
	const resourcesVariance = typeMults.variance;

	const baseCreditsValue = baseCredits * totalCreditsMultiplier;
	const baseResourcesValue = baseResources * totalResourcesMultiplier;

	const creditsMin = Math.max(50, Math.floor(baseCreditsValue * (1 - creditsVariance)));
	const creditsMax = Math.floor(baseCreditsValue * (1 + creditsVariance));

	const baseResourcesMin = Math.floor(baseResourcesValue * (1 - resourcesVariance));
	const baseResourcesMax = Math.floor(baseResourcesValue * (1 + resourcesVariance));

	// Cap resource extraction based on team size and mission type (for estimates)
	const teamSize = drifters.length || 1; // Default to 1 if no team provided

	// Maximum extraction per drifter per mission (same as in calculateMissionRewards)
	const extractionLimits = {
		scavenge: 8, // Conservative extraction per drifter
		strip_mine: 12, // More efficient extraction per drifter
		combat: 10, // Moderate extraction during combat
		sabotage: 6, // Focused on disruption, less extraction
	};

	const maxTeamExtraction = teamSize * extractionLimits[missionType];

	// Apply team extraction cap only to max, preserving variance for min
	const teamCappedResourcesMax = Math.min(baseResourcesMax, maxTeamExtraction);
	// Min is not capped by extraction limit, only by variance calculation
	const teamCappedResourcesMin = baseResourcesMin;

	// Then cap by currentYield and apply minimums
	const cappedResourcesMax = Math.min(teamCappedResourcesMax, targetNode.currentYield);
	const cappedResourcesMin = Math.min(teamCappedResourcesMin, targetNode.currentYield);

	// Apply minimums, but ensure min never exceeds max
	const resourcesMax = Math.max(0, cappedResourcesMax);
	const resourcesMin = Math.max(0, Math.min(cappedResourcesMin, resourcesMax));

	return {
		creditsRange: { min: creditsMin, max: creditsMax },
		resourcesRange: {
			min: resourcesMin,
			max: resourcesMax,
			type: targetNode.type,
		},
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
export function getAvailableMissionTypes(targetNode: ResourceNode, activeMissions: any[], playerAddress?: string): AvailableMissionType[] {
	const missionTypes: AvailableMissionType[] = [];

	// Check if node is contested (has active missions from other players)
	const contestedMissions = activeMissions.filter(
		(m) => m.targetNodeId === targetNode.id && m.status === 'active' && m.playerAddress !== playerAddress,
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
				enabled: true,
			},
			{
				type: 'sabotage',
				name: 'SABOTAGE',
				description: `Disrupt ${contestedMissions.length} ongoing operation${contestedMissions.length > 1 ? 's' : ''}`,
				color: '#4a2a5c',
				borderColor: '#6a4a7c',
				enabled: true,
			},
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
				enabled: true,
			},
			{
				type: 'strip_mine',
				name: 'STRIP-MINE',
				description: 'Maximum resource extraction, slower but efficient',
				color: '#5c4a2a',
				borderColor: '#7c6a4a',
				enabled: true,
			},
		);
	}

	return missionTypes;
}

/**
 * Calculate live estimates for mission planning UI
 * Combines duration and reward calculations into a single call
 */
export function calculateLiveEstimates(
	targetNode: ResourceNode,
	missionType: MissionType,
	drifters: DrifterStats[] = [],
	vehicle?: Vehicle,
): {
	duration: number;
	rewards: {
		creditsRange: { min: number; max: number };
		resourcesRange: { min: number; max: number; type: string };
	};
	teamStats?: {
		speed: number;
		scavengingBonus: number;
		techBonus: number;
	};
} {
	// Calculate mission duration with drifter speed bonus
	const duration = calculateMissionDuration(targetNode, drifters, vehicle);

	// If a vehicle is provided, include its scavenging/tech/combat as an additional entry for reward estimates
	const driftersWithVehicle = vehicle
		? [
			...drifters,
			{ combat: (vehicle as any).combat ?? 0, scavenging: (vehicle as any).scavenging ?? 0, tech: (vehicle as any).tech ?? 0, speed: vehicle.speed },
		]
		: drifters;

	// Calculate rewards estimate with combined team bonuses
	const rewards = estimateMissionRewards(targetNode, missionType, duration, driftersWithVehicle);

	// Calculate team stats for display (include vehicle bonuses)
	let teamStats = undefined;

	const combinedForDisplay = vehicle
		? [
			...drifters,
			{ combat: (vehicle as any).combat ?? 0, scavenging: (vehicle as any).scavenging ?? 0, tech: (vehicle as any).tech ?? 0, speed: vehicle.speed },
		]
		: drifters;

	if (combinedForDisplay.length > 0) {
		const speed = vehicle ? vehicle.speed : Math.min(...drifters.map((d) => d.speed)) || BASE_SPEED;
		const totalScavenging = combinedForDisplay.reduce((sum, d) => sum + d.scavenging, 0);
		const totalTech = combinedForDisplay.reduce((sum, d) => sum + d.tech, 0);

		teamStats = {
			speed,
			scavengingBonus: totalScavenging * SCAVENGING_MULTIPLIER,
			techBonus: totalTech * TECH_MULTIPLIER,
		};
	}

	return {
		duration,
		rewards,
		teamStats,
	};
}
