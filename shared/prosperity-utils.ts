import type { MissionType } from './models';

// Base prosperity delta from credits earned
// 5.0 * ln(1 + credits/100)
export function prosperityBaseFromCredits(credits: number): number {
	const c = Math.max(0, credits || 0);
	return 5.0 * Math.log(1 + c / 100);
}

// Mission-type multiplier: scavenging gives more prosperity than strip-mining.
// Non-resource missions contribute 0 for now.
export function prosperityMissionTypeMultiplier(missionType: MissionType): number {
	switch (missionType) {
		case 'scavenge':
			return 1.0;
		case 'strip_mine':
			return 0.75;
		default:
			return 0.0;
	}
}

// Upgrade multiplier from vehicle market and perimeter walls levels
// min(2.0, 1 + 0.1*vmLevel + 0.1*wallLevel)
export function prosperityUpgradeMultiplier(vehicleMarketLevel: number, perimeterWallsLevel: number): number {
	const vm = Math.max(0, Math.floor(vehicleMarketLevel || 0));
	const wl = Math.max(0, Math.floor(perimeterWallsLevel || 0));
	return Math.min(2.0, 1 + 0.1 * vm + 0.1 * wl);
}

export function calculateProsperityGain(
	credits: number,
	missionType: MissionType,
	vehicleMarketLevel: number,
	perimeterWallsLevel: number,
): { delta: number; base: number; missionTypeMult: number; upgradeMult: number } {
	const base = prosperityBaseFromCredits(credits);
	const missionTypeMult = prosperityMissionTypeMultiplier(missionType);
	const upgradeMult = prosperityUpgradeMultiplier(vehicleMarketLevel, perimeterWallsLevel);
	return {
		delta: base * missionTypeMult * upgradeMult,
		base,
		missionTypeMult,
		upgradeMult,
	};
}

// Prosperity decrease from monster damage (log-shaped)
// 1.0 * ln(1 + totalDamage/100)
export function prosperityDeltaFromMonsterDamage(totalDamage: number): number {
	const d = Math.max(0, totalDamage || 0);
	return 1.0 * Math.log(1 + d / 100);
}

// Prosperity-based resource boost multiplier used by world management
// 1 + 0.15 * log10(1 + P), clamped to [1.0, 1.5]
export function prosperityResourceBoostMultiplier(P: number): number {
	const p = Math.max(0, P || 0);
	const log10 = (Math as any).log10 ? Math.log10(1 + p) : Math.log(1 + p) / Math.LN10;
	const mult = 1 + 0.15 * log10;
	return Math.min(1.5, Math.max(1.0, mult));
}
