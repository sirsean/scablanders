/**
 * NFT Ownership and Drifter Integration using Alchemy SDK
 */

import { Alchemy, Network } from 'alchemy-sdk';

// Fringe Drifters contract address on Ethereum mainnet
export const FRINGE_DRIFTERS_CONTRACT = '0xe3B399AAb015D2C0D787ECAd40410D88f4f4cA50';

export interface DrifterOwnershipCache {
	tokenId: number;
	owner: string;
	cachedAt: number;
	ttl: number;
}

/**
 * Initialize Alchemy SDK with API key from environment
 */
function createAlchemyInstance(apiKey: string): Alchemy {
	const config = {
		apiKey,
		network: Network.ETH_MAINNET,
	};
	return new Alchemy(config);
}

/**
 * Check NFT ownership using Alchemy API
 */
export async function getTokenOwner(tokenId: number, env: any): Promise<string> {
	const cacheKey = `drifter_owner_${tokenId}`;
	const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

	try {
		// Check cache first
		const cached = (await env.KV.get(cacheKey, 'json')) as DrifterOwnershipCache | null;

		if (cached && Date.now() - cached.cachedAt < cached.ttl) {
			console.log(`Cache hit for Drifter ${tokenId}: ${cached.owner}`);
			return cached.owner;
		}

		// Cache miss - query via Alchemy
		console.log(`Cache miss for Drifter ${tokenId}, querying Alchemy...`);

		const alchemy = createAlchemyInstance(env.ALCHEMY_API_KEY);

		// Get the owner of the specific token
		const response = await alchemy.nft.getOwnersForNft(FRINGE_DRIFTERS_CONTRACT, tokenId);

		if (!response.owners || response.owners.length === 0) {
			throw new Error(`No owner found for token ${tokenId}`);
		}

		const owner = response.owners[0]; // ERC-721 tokens have exactly one owner
		console.log(`Alchemy query result for Drifter ${tokenId}: ${owner}`);

		// Cache the result
		const cacheData: DrifterOwnershipCache = {
			tokenId,
			owner: owner.toLowerCase(), // Normalize to lowercase
			cachedAt: Date.now(),
			ttl: CACHE_TTL,
		};

		await env.KV.put(cacheKey, JSON.stringify(cacheData), {
			expirationTtl: CACHE_TTL / 1000, // KV TTL is in seconds
		});

		return owner.toLowerCase();
	} catch (error) {
		console.error(`Failed to get owner for Drifter ${tokenId}:`, error);

		// Try to return stale cache data if available
		const staleCache = (await env.KV.get(cacheKey, 'json')) as DrifterOwnershipCache | null;
		if (staleCache) {
			console.log(`Returning stale cache data for Drifter ${tokenId}`);
			return staleCache.owner;
		}

		// Fallback to zero address if all else fails
		return '0x0000000000000000000000000000000000000000';
	}
}

/**
 * Check if a player owns a specific Drifter NFT
 */
export async function playerOwnsDrifter(playerAddress: string, tokenId: number, env: any): Promise<boolean> {
	const owner = await getTokenOwner(tokenId, env);
	return owner.toLowerCase() === playerAddress.toLowerCase();
}

/**
 * Get all NFTs owned by a specific player using Alchemy's bulk API
 */
export async function getPlayerOwnedDrifters(playerAddress: string, env: any): Promise<number[]> {
	const cacheKey = `player_drifters_${playerAddress.toLowerCase()}`;
	const CACHE_TTL = 10 * 60 * 1000; // 10 minutes for bulk queries

	try {
		// Check cache first
		const cached = (await env.KV.get(cacheKey, 'json')) as { tokenIds: number[]; cachedAt: number; ttl: number } | null;

		if (cached && Date.now() - cached.cachedAt < cached.ttl) {
			console.log(`Cache hit for player ${playerAddress} owned Drifters:`, cached.tokenIds);
			return cached.tokenIds;
		}

		// Cache miss - query via Alchemy
		console.log(`Cache miss for player ${playerAddress}, querying Alchemy...`);

		const alchemy = createAlchemyInstance(env.ALCHEMY_API_KEY);

		// Get all NFTs owned by the player for the Fringe Drifters contract
		const response = await alchemy.nft.getNftsForOwner(playerAddress, {
			contractAddresses: [FRINGE_DRIFTERS_CONTRACT],
			omitMetadata: true, // We only need token IDs for now
		});

		const tokenIds = response.ownedNfts.map((nft) => parseInt(nft.tokenId, 10));
		console.log(`Alchemy query result for player ${playerAddress}:`, tokenIds);

		// Cache the result
		const cacheData = {
			tokenIds,
			cachedAt: Date.now(),
			ttl: CACHE_TTL,
		};

		await env.KV.put(cacheKey, JSON.stringify(cacheData), {
			expirationTtl: CACHE_TTL / 1000, // KV TTL is in seconds
		});

		return tokenIds;
	} catch (error) {
		console.error(`Failed to get owned Drifters for player ${playerAddress}:`, error);

		// Try to return stale cache data if available
		const staleCache = (await env.KV.get(cacheKey, 'json')) as { tokenIds: number[] } | null;
		if (staleCache) {
			console.log(`Returning stale cache data for player ${playerAddress}`);
			return staleCache.tokenIds;
		}

		// Fallback to empty array if all else fails
		return [];
	}
}

/**
 * Invalidate ownership cache for a specific token (useful for testing or manual refresh)
 */
export async function invalidateTokenCache(tokenId: number, env: any): Promise<void> {
	const cacheKey = `drifter_owner_${tokenId}`;
	await env.KV.delete(cacheKey);
	console.log(`Invalidated cache for Drifter ${tokenId}`);
}

/**
 * Invalidate player ownership cache (useful for testing or manual refresh)
 */
export async function invalidatePlayerCache(playerAddress: string, env: any): Promise<void> {
	const cacheKey = `player_drifters_${playerAddress.toLowerCase()}`;
	await env.KV.delete(cacheKey);
	console.log(`Invalidated cache for player ${playerAddress}`);
}

/**
 * Get owned Drifters using individual KV and API key parameters (for Hono compatibility)
 */
export async function getOwnedDrifters(playerAddress: string, kv: any, alchemyApiKey: string): Promise<number[]> {
	const env = { KV: kv, ALCHEMY_API_KEY: alchemyApiKey };
	return getPlayerOwnedDrifters(playerAddress, env);
}
