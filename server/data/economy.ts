import type { UpgradeType } from '@shared/models';

/**
 * Economy Configuration
 *
 * Defines all upgrade prices, mission costs, and economic balance
 */

export interface UpgradeConfig {
	type: UpgradeType;
	name: string;
	description: string;
	price: number;
	prerequisites?: UpgradeType[];
}

export const UPGRADE_CONFIGS: Record<UpgradeType, UpgradeConfig> = {
	// Speed Upgrades
	'speed-boost-1': {
		type: 'speed-boost-1',
		name: 'Speed Boost I',
		description: 'Increases movement speed by 20%',
		price: 500,
	},
	'speed-boost-2': {
		type: 'speed-boost-2',
		name: 'Speed Boost II',
		description: 'Increases movement speed by 30%',
		price: 1200,
		prerequisites: ['speed-boost-1'],
	},
	'speed-boost-3': {
		type: 'speed-boost-3',
		name: 'Speed Boost III',
		description: 'Increases movement speed by 50%',
		price: 2500,
		prerequisites: ['speed-boost-2'],
	},

	// Yield Upgrades
	'yield-boost-1': {
		type: 'yield-boost-1',
		name: 'Yield Enhancement I',
		description: 'Increases resource yield by 15%',
		price: 750,
	},
	'yield-boost-2': {
		type: 'yield-boost-2',
		name: 'Yield Enhancement II',
		description: 'Increases resource yield by 25%',
		price: 1800,
		prerequisites: ['yield-boost-1'],
	},
	'yield-boost-3': {
		type: 'yield-boost-3',
		name: 'Yield Enhancement III',
		description: 'Increases resource yield by 40%',
		price: 3500,
		prerequisites: ['yield-boost-2'],
	},

	// Capacity Upgrades
	'capacity-boost-1': {
		type: 'capacity-boost-1',
		name: 'Cargo Expansion I',
		description: 'Increases carrying capacity by 25%',
		price: 600,
	},
	'capacity-boost-2': {
		type: 'capacity-boost-2',
		name: 'Cargo Expansion II',
		description: 'Increases carrying capacity by 50%',
		price: 1400,
		prerequisites: ['capacity-boost-1'],
	},
	'capacity-boost-3': {
		type: 'capacity-boost-3',
		name: 'Cargo Expansion III',
		description: 'Doubles carrying capacity',
		price: 3000,
		prerequisites: ['capacity-boost-2'],
	},

	// Combat Upgrades
	'combat-training-1': {
		type: 'combat-training-1',
		name: 'Combat Training I',
		description: 'All Drifters gain +2 combat skill',
		price: 800,
	},
	'combat-training-2': {
		type: 'combat-training-2',
		name: 'Combat Training II',
		description: 'All Drifters gain +3 combat skill',
		price: 2000,
		prerequisites: ['combat-training-1'],
	},
	'combat-training-3': {
		type: 'combat-training-3',
		name: 'Combat Training III',
		description: 'All Drifters gain +5 combat skill',
		price: 4000,
		prerequisites: ['combat-training-2'],
	},

	// Scavenging Upgrades
	'scavenging-expertise-1': {
		type: 'scavenging-expertise-1',
		name: 'Scavenging Expertise I',
		description: 'All Drifters gain +1 scavenging skill',
		price: 650,
	},
	'scavenging-expertise-2': {
		type: 'scavenging-expertise-2',
		name: 'Scavenging Expertise II',
		description: 'All Drifters gain +2 scavenging skill',
		price: 1600,
		prerequisites: ['scavenging-expertise-1'],
	},
	'scavenging-expertise-3': {
		type: 'scavenging-expertise-3',
		name: 'Scavenging Expertise III',
		description: 'All Drifters gain +3 scavenging skill',
		price: 3200,
		prerequisites: ['scavenging-expertise-2'],
	},

	// Tech Upgrades
	'tech-upgrade-1': {
		type: 'tech-upgrade-1',
		name: 'Tech Advancement I',
		description: 'All Drifters gain +1 tech skill',
		price: 700,
	},
	'tech-upgrade-2': {
		type: 'tech-upgrade-2',
		name: 'Tech Advancement II',
		description: 'All Drifters gain +2 tech skill',
		price: 1750,
		prerequisites: ['tech-upgrade-1'],
	},
	'tech-upgrade-3': {
		type: 'tech-upgrade-3',
		name: 'Tech Advancement III',
		description: 'All Drifters gain +3 tech skill',
		price: 3500,
		prerequisites: ['tech-upgrade-2'],
	},
};

/**
 * Mission and gameplay costs
 */
export const ECONOMY_CONFIG = {
	// Starting balance for new players
	STARTING_BALANCE: 1000,

	// Mission costs
	INTERCEPT_BASE_COST: 100, // Base cost to intercept another mission

	// Resource values (credits per unit)
	RESOURCE_VALUES: {
		ore: 8, // High value, rare
		scrap: 5, // Medium value, common
		organic: 3, // Low value, very common
	},

	// Auto-sell thresholds (resources auto-sell above these amounts)
	AUTO_SELL_THRESHOLDS: {
		scrap: 50, // Auto-sell scrap above 50 units
		organic: 100, // Auto-sell organic above 100 units
		// Ore is never auto-sold (artifact tier)
	},

	// Discovery rewards
	DISCOVERY_REWARD: 50, // Credits for discovering a new resource node

	// Time multipliers (in seconds)
	BASE_TRAVEL_TIME: 60, // 1 minute base travel time
	DISTANCE_MULTIPLIER: 2, // 2 seconds per distance unit
	MIN_TRAVEL_TIME: 30, // Minimum 30 seconds for any mission
};

/**
 * Get available upgrades for a player
 */
export function getAvailableUpgrades(ownedUpgrades: UpgradeType[]): UpgradeConfig[] {
	const available: UpgradeConfig[] = [];

	for (const upgrade of Object.values(UPGRADE_CONFIGS)) {
		// Skip if already owned
		if (ownedUpgrades.includes(upgrade.type)) {
			continue;
		}

		// Check prerequisites
		if (upgrade.prerequisites) {
			const hasPrereqs = upgrade.prerequisites.every((prereq) => ownedUpgrades.includes(prereq));
			if (!hasPrereqs) {
				continue;
			}
		}

		available.push(upgrade);
	}

	// Sort by price (cheapest first)
	return available.sort((a, b) => a.price - b.price);
}

/**
 * Calculate total hiring cost for drifters
 */
export function calculateHiringCost(drifterIds: number[], ownedDrifters: number[], drifterRegistry: Record<string, any>): number {
	let totalCost = 0;

	for (const drifterId of drifterIds) {
		// Free if player owns the NFT
		if (ownedDrifters.includes(drifterId)) {
			continue;
		}

		// Get hire cost from registry
		const drifter = drifterRegistry[drifterId.toString()];
		if (drifter && drifter.hireCost) {
			totalCost += drifter.hireCost;
		} else {
			// Default hire cost if not in registry
			totalCost += 50;
		}
	}

	return totalCost;
}

/**
 * Calculate resource sell value
 */
export function calculateResourceValue(resourceType: 'ore' | 'scrap' | 'organic', quantity: number): number {
	const unitValue = ECONOMY_CONFIG.RESOURCE_VALUES[resourceType];
	return quantity * unitValue;
}

/**
 * Check if player can afford an upgrade
 */
export function canAffordUpgrade(playerBalance: number, upgradeType: UpgradeType): boolean {
	const upgradeConfig = UPGRADE_CONFIGS[upgradeType];
	return playerBalance >= upgradeConfig.price;
}
