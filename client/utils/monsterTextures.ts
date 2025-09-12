export const MONSTER_KINDS = ['Skitterling', 'Dust Stalker', 'Scrap Hound', 'Sand Wraith', 'Dune Behemoth', 'Rust Colossus'] as const;

// Map display kind to filename slug
const MONSTER_KIND_TO_SLUG: Record<string, string> = {
	Skitterling: 'skitterling',
	'Dust Stalker': 'dust-stalker',
	'Scrap Hound': 'scrap-hound',
	'Sand Wraith': 'sand-wraith',
	'Dune Behemoth': 'dune-behemoth',
	'Rust Colossus': 'rust-colossus',
};

export function getMonsterSlug(kind: string): string {
	return MONSTER_KIND_TO_SLUG[kind] || 'skitterling';
}

// Eagerly import URLs for monster images via Vite
const MONSTER_URL_MAP = import.meta.glob('../assets/images/monsters/*.png', {
	eager: true,
	as: 'url',
}) as Record<string, string>;

function getMonsterUrlBySlug(slug: string): string {
	// Keys in the map are relative to this file
	const key = `../assets/images/monsters/${slug}.png`;
	return MONSTER_URL_MAP[key] || MONSTER_URL_MAP['../assets/images/monsters/skitterling.png'];
}

// Key used for Phaser textures
export function getMonsterTextureKey(kind: string): string {
	return `monster-${getMonsterSlug(kind)}`;
}

// URL to use with Phaser loader (resolved by Vite)
export function getMonsterAssetPath(kind: string): string {
	return getMonsterUrlBySlug(getMonsterSlug(kind));
}

// URL to use in DOM <img> tags
export function getMonsterPublicPath(kind: string): string {
	return getMonsterUrlBySlug(getMonsterSlug(kind));
}
