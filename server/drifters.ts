/**
 * Drifter Registry and Mercenary System
 */

import { DrifterProfile } from '@shared/models';
import driftersData from './data/drifters.json';
import { getPlayerOwnedDrifters, playerOwnsDrifter } from './nft';

// Type-safe access to drifters data
const driftersRegistry: Record<string, DrifterProfile> = driftersData as any;

/**
 * Get Drifter stats by token ID
 */
export function getDrifterStats(tokenId: number): DrifterProfile | null {
	const drifter = driftersRegistry[tokenId.toString()];
	return drifter || null;
}

/**
 * Get all registered Drifters
 */
export function getAllDrifters(): DrifterProfile[] {
	return Object.values(driftersRegistry);
}

/**
 * Get the Drifter registry as a record
 */
export function getDrifterRegistry(): Record<string, DrifterProfile> {
	return driftersRegistry;
}

/**
 * Get available mercenaries for a specific player
 * Returns all Drifters with hire costs (0 for owned, base cost for others)
 */
export async function getAvailableMercenaries(playerAddress: string, env: any): Promise<DrifterProfile[]> {
	const ownedTokenIds = await getPlayerOwnedDrifters(playerAddress, env);
	const ownedSet = new Set(ownedTokenIds);

	// Get all registered Drifters and adjust hire costs
	const mercenaries = getAllDrifters().map((drifter) => {
		const isOwned = ownedSet.has(drifter.tokenId);
		return {
			...drifter,
			hireCost: isOwned ? 0 : drifter.hireCost, // Free to hire own NFTs
			owned: isOwned,
		} as DrifterProfile & { owned: boolean };
	});

	// Sort by owned first, then by rarity/hire cost
	return mercenaries.sort((a, b) => {
		// Owned drifters first
		if (a.owned && !b.owned) {
			return -1;
		}
		if (!a.owned && b.owned) {
			return 1;
		}

		// Then by hire cost (lower first for non-owned)
		return a.hireCost - b.hireCost;
	});
}

/**
 * Calculate hire cost for a mission
 */
export async function calculateHireCost(
	playerAddress: string,
	drifterIds: number[],
	env: any,
): Promise<{ totalCost: number; breakdown: { tokenId: number; cost: number; owned: boolean }[] }> {
	const breakdown = [];
	let totalCost = 0;

	for (const tokenId of drifterIds) {
		const drifter = getDrifterStats(tokenId);
		if (!drifter) {
			throw new Error(`Unknown Drifter token ID: ${tokenId}`);
		}

		const isOwned = await playerOwnsDrifter(playerAddress, tokenId, env);
		const cost = isOwned ? 0 : drifter.hireCost;

		breakdown.push({
			tokenId,
			cost,
			owned: isOwned,
		});

		totalCost += cost;
	}

	return { totalCost, breakdown };
}

/**
 * Validate that a player can hire the specified Drifters
 */
export async function validateDrifterHiring(
	playerAddress: string,
	drifterIds: number[],
	playerBalance: number,
	env: any,
): Promise<{ valid: boolean; error?: string; cost: number }> {
	// Check that all Drifters exist in registry
	for (const tokenId of drifterIds) {
		if (!getDrifterStats(tokenId)) {
			return {
				valid: false,
				error: `Drifter ${tokenId} not found in registry`,
				cost: 0,
			};
		}
	}

	// Calculate total hire cost
	const { totalCost } = await calculateHireCost(playerAddress, drifterIds, env);

	// Check player has sufficient balance
	if (playerBalance < totalCost) {
		return {
			valid: false,
			error: `Insufficient balance. Required: ${totalCost}, Available: ${playerBalance}`,
			cost: totalCost,
		};
	}

	return {
		valid: true,
		cost: totalCost,
	};
}

/**
 * Get Drifter stats for mission calculations
 */
export function calculateTeamStats(drifterIds: number[]): {
	totalCombat: number;
	totalScavenging: number;
	totalTech: number;
	averageSpeed: number;
} {
	let totalCombat = 0;
	let totalScavenging = 0;
	let totalTech = 0;
	let totalSpeed = 0;
	let validDrifters = 0;

	for (const tokenId of drifterIds) {
		const drifter = getDrifterStats(tokenId);
		if (drifter) {
			totalCombat += drifter.combat;
			totalScavenging += drifter.scavenging;
			totalTech += drifter.tech;
			totalSpeed += drifter.speed;
			validDrifters++;
		}
	}

	return {
		totalCombat,
		totalScavenging,
		totalTech,
		averageSpeed: validDrifters > 0 ? totalSpeed / validDrifters : 0,
	};
}
