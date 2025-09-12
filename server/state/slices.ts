import type {
	PlayerProfile,
	NotificationMessage,
	Mission,
	ResourceNode,
	GameEvent,
	DrifterProgress,
	TownState,
	Monster,
} from '@shared/models';

// Keep storage key layout exactly as-is
export type SliceKey =
	| 'players'
	| 'notifications'
	| 'missions'
	| 'resourceNodes'
	| 'worldMetrics'
	| 'eventLog'
	| 'drifterProgress'
	| 'contributionStats'
	| 'town'
	| 'monsters';

// Local mirror of PlayerContributionStats shape used in GameDO
export interface PlayerContributionStats {
	totalUpgradeCredits: number;
	totalProsperityFromMissions: number;
	totalCombatDamage: number;
}

export interface SliceMap {
	players: Record<string, PlayerProfile>;
	notifications: Record<string, NotificationMessage[]>;
	missions: Record<string, Mission>;
	resourceNodes: Record<string, ResourceNode>;
	worldMetrics: {
		totalActiveMissions: number;
		totalCompletedMissions: number;
		economicActivity: number;
		lastUpdate: Date;
	};
	eventLog: GameEvent[];
	drifterProgress: Record<string, DrifterProgress>;
	contributionStats: Record<string, PlayerContributionStats>;
	town: TownState;
	monsters: Monster[];
}

export const SLICE_KEYS: readonly SliceKey[] = [
	'players',
	'notifications',
	'missions',
	'resourceNodes',
	'worldMetrics',
	'eventLog',
	'drifterProgress',
	'contributionStats',
	'town',
	'monsters',
] as const;

// Defaults – compatible with existing code paths
export function defaultPlayers(): SliceMap['players'] {
	return {};
}
export function defaultNotifications(): SliceMap['notifications'] {
	return {};
}
export function defaultMissions(): SliceMap['missions'] {
	return {};
}
export function defaultResourceNodes(): SliceMap['resourceNodes'] {
	return {} as Record<string, ResourceNode>;
}
export function defaultWorldMetrics(): SliceMap['worldMetrics'] {
	return {
		totalActiveMissions: 0,
		totalCompletedMissions: 0,
		economicActivity: 0,
		lastUpdate: new Date(),
	};
}
export function defaultEventLog(): SliceMap['eventLog'] {
	return [];
}
export function defaultDrifterProgress(): SliceMap['drifterProgress'] {
	return {};
}
export function defaultContributionStats(): SliceMap['contributionStats'] {
	return {};
}
export function defaultTown(): SliceMap['town'] {
	// Keep minimal viable defaults; GameDO has richer initialization logic
	return {
		prosperity: 0,
		attributes: {
			vehicle_market: { level: 0, progress: 0, nextLevelCost: 1000 },
			perimeter_walls: { level: 0, progress: 0, nextLevelCost: 1000, hp: 0, maxHp: 0 },
		},
	} as TownState;
}
export function defaultMonsters(): SliceMap['monsters'] {
	return [];
}

export function defaultForSlice<K extends SliceKey>(key: K): SliceMap[K] {
	switch (key) {
		case 'players':
			return defaultPlayers() as SliceMap[K];
		case 'notifications':
			return defaultNotifications() as SliceMap[K];
		case 'missions':
			return defaultMissions() as SliceMap[K];
		case 'resourceNodes':
			return defaultResourceNodes() as SliceMap[K];
		case 'worldMetrics':
			return defaultWorldMetrics() as SliceMap[K];
		case 'eventLog':
			return defaultEventLog() as SliceMap[K];
		case 'drifterProgress':
			return defaultDrifterProgress() as SliceMap[K];
		case 'contributionStats':
			return defaultContributionStats() as SliceMap[K];
		case 'town':
			return defaultTown() as SliceMap[K];
		case 'monsters':
			return defaultMonsters() as SliceMap[K];
		default:
			// Exhaustiveness
			// @ts-expect-error
			return {} as SliceMap[K];
	}
}

export function isWorldSlice(key: SliceKey): boolean {
	return key === 'resourceNodes' || key === 'worldMetrics' || key === 'town' || key === 'monsters';
}
