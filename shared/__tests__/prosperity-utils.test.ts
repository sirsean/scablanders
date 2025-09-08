import { describe, it, expect } from 'vitest';
import {
	calculateProsperityGain,
	prosperityBaseFromCredits,
	prosperityMissionTypeMultiplier,
	prosperityUpgradeMultiplier,
	prosperityDeltaFromMonsterDamage,
	prosperityResourceBoostMultiplier,
} from '../prosperity-utils';

describe('prosperity-utils', () => {
	it('prosperityBaseFromCredits uses 5.0 * ln(1 + c/100) and returns 0 for non-positive', () => {
		expect(prosperityBaseFromCredits(0)).toBe(0);
		expect(prosperityBaseFromCredits(-50)).toBe(0);
		const c100 = prosperityBaseFromCredits(100);
		// Approximately 5 * ln(1 + 1) = 5 * ln(2) ~ 3.4657
		expect(c100).toBeGreaterThan(3.46);
		expect(c100).toBeLessThan(3.47);
	});

	it('mission-type multiplier: scavenge=1.0, strip_mine=0.75, others=0', () => {
		expect(prosperityMissionTypeMultiplier('scavenge')).toBeCloseTo(1.0);
		expect(prosperityMissionTypeMultiplier('strip_mine')).toBeCloseTo(0.75);
		expect(prosperityMissionTypeMultiplier('combat' as any)).toBeCloseTo(0.0);
		expect(prosperityMissionTypeMultiplier('sabotage' as any)).toBeCloseTo(0.0);
	});

	it('upgrade multiplier scales by 0.1 per level and caps at 2.0', () => {
		expect(prosperityUpgradeMultiplier(0, 0)).toBeCloseTo(1.0);
		expect(prosperityUpgradeMultiplier(3, 2)).toBeCloseTo(1.5);
		// Excessive levels should cap
		expect(prosperityUpgradeMultiplier(10, 10)).toBeCloseTo(2.0);
	});

	it('calculateProsperityGain combines base, mission, and upgrades', () => {
		const credits = 1000; // base ~ 5*ln(1+10) = 5*~2.3979 = ~11.989
		const base = prosperityBaseFromCredits(credits);
		expect(base).toBeGreaterThan(11.9);
		expect(base).toBeLessThan(12.1);

		// scavenge with VM=3, Walls=2 -> upgradeMult=1.5, missionTypeMult=1.0
		const out1 = calculateProsperityGain(credits, 'scavenge', 3, 2);
		expect(out1.base).toBeCloseTo(base, 3);
		expect(out1.missionTypeMult).toBeCloseTo(1.0);
		expect(out1.upgradeMult).toBeCloseTo(1.5);
		expect(out1.delta).toBeCloseTo(base * 1.0 * 1.5, 3);

		// strip_mine with VM=0, Walls=0 -> mult=1.0, missionTypeMult=0.75
		const out2 = calculateProsperityGain(credits, 'strip_mine', 0, 0);
		expect(out2.upgradeMult).toBeCloseTo(1.0);
		expect(out2.missionTypeMult).toBeCloseTo(0.75);
		expect(out2.delta).toBeCloseTo(base * 0.75, 3);

		// combat should yield 0 delta
		const out3 = calculateProsperityGain(credits, 'combat' as any, 3, 3);
		expect(out3.delta).toBeCloseTo(0);
	});
	it('prosperityDeltaFromMonsterDamage uses 1.0 * ln(1 + d/100)', () => {
		expect(prosperityDeltaFromMonsterDamage(0)).toBeCloseTo(0);
		const d100 = prosperityDeltaFromMonsterDamage(100);
		// ln(2) ~ 0.6931
		expect(d100).toBeGreaterThan(0.693);
		expect(d100).toBeLessThan(0.694);

		const d1000 = prosperityDeltaFromMonsterDamage(1000);
		// ln(11) ~ 2.3979
		expect(d1000).toBeGreaterThan(2.397);
		expect(d1000).toBeLessThan(2.399);
	});

	it('prosperityResourceBoostMultiplier clamps to [1.0, 1.5] and follows 1 + 0.15*log10(1+P)', () => {
		expect(prosperityResourceBoostMultiplier(0)).toBeCloseTo(1.0);
		const p1k = prosperityResourceBoostMultiplier(1000);
		// 1 + 0.15 * log10(1001) ≈ 1 + 0.15 * ~3.0004 ≈ ~1.4501
		expect(p1k).toBeGreaterThan(1.44);
		expect(p1k).toBeLessThan(1.46);

		// Very large P should cap at 1.5
		const pHuge = prosperityResourceBoostMultiplier(1e12);
		expect(pHuge).toBeCloseTo(1.5);
	});
});
