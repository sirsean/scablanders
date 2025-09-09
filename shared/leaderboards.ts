export type LeaderboardEntry = {
	address: string;
	value: number;
	rank: number;
};

export interface LeaderboardsResponse {
	upgradeContributions: LeaderboardEntry[];
	resourceProsperity: LeaderboardEntry[];
	combatDamage: LeaderboardEntry[];
}
