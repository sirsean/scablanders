export const MONSTER_KINDS = [
  'Skitterling',
  'Dust Stalker',
  'Scrap Hound',
  'Sand Wraith',
  'Dune Behemoth',
  'Rust Colossus',
] as const;

// Map display kind to filename slug
const MONSTER_KIND_TO_SLUG: Record<string, string> = {
  'Skitterling': 'skitterling',
  'Dust Stalker': 'dust-stalker',
  'Scrap Hound': 'scrap-hound',
  'Sand Wraith': 'sand-wraith',
  'Dune Behemoth': 'dune-behemoth',
  'Rust Colossus': 'rust-colossus',
};

export function getMonsterSlug(kind: string): string {
  return MONSTER_KIND_TO_SLUG[kind] || 'skitterling';
}

// Key used for Phaser textures
export function getMonsterTextureKey(kind: string): string {
  return `monster-${getMonsterSlug(kind)}`;
}

// Path to use with Phaser loader (relative to client root)
export function getMonsterAssetPath(kind: string): string {
  return `assets/images/monsters/${getMonsterSlug(kind)}.png`;
}

// Path to use in DOM <img> tags (absolute from site root)
export function getMonsterPublicPath(kind: string): string {
  return `/assets/images/monsters/${getMonsterSlug(kind)}.png`;
}
