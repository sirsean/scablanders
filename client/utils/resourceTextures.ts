import type { ResourceType, Rarity } from '@shared/models';

// Resource types that have dedicated texture assets
export const RESOURCE_TYPES = ['ore', 'scrap', 'organic'] as const;

// Rarity levels that have dedicated texture assets
export const RARITIES_WITH_TEXTURE = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

export type ResourceTextureRarity = (typeof RARITIES_WITH_TEXTURE)[number];

/**
 * Maps a resource type and rarity to a Phaser texture key.
 *
 * @param type - Resource type (ore, scrap, organic)
 * @param rarity - Resource rarity (common, uncommon, rare, epic, legendary)
 * @returns Texture key for use with Phaser (e.g., 'ore-rare')
 */
export function getResourceTextureKey(type: ResourceType, rarity: Rarity): string {
	return `${type}-${rarity}`;
}

/**
 * Checks if a resource type and rarity combination has a dedicated texture asset.
 */
export function hasResourceTexture(type: string, rarity: string): boolean {
	return RESOURCE_TYPES.includes(type as any) && RARITIES_WITH_TEXTURE.includes(rarity as any);
}
