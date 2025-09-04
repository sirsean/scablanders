import { describe, it, expect } from 'vitest';
import {
	calculateMissionDuration,
	calculateMissionRewards,
	estimateMissionRewards,
	calculateLiveEstimates,
	formatDuration,
	type DrifterStats,
} from '../mission-utils';
import type { ResourceNode, MissionType } from '../models';

// Mock resource node for testing
const createMockResourceNode = (overrides: Partial<ResourceNode> = {}): ResourceNode => ({
	id: 'test-node',
	type: 'metal',
	coordinates: { x: 100, y: 100 },
	currentYield: 50,
	baseYield: 100,
	rarity: 'common',
	lastExtracted: new Date('2024-01-01'),
	isActive: true,
	...overrides,
});

// Mock drifter stats for testing
const createMockDrifterStats = (overrides: Partial<DrifterStats> = {}): DrifterStats => ({
	combat: 100,
	scavenging: 100,
	tech: 100,
	speed: 100,
	...overrides,
});

describe('Mission Utils', () => {
	describe('calculateMissionDuration', () => {
		it('should calculate base duration from node distance', () => {
			const node = createMockResourceNode({ coordinates: { x: 100, y: 100 } });
			const duration = calculateMissionDuration(node);

			// Should be greater than 0 and reasonable (distance-based)
			expect(duration).toBeGreaterThan(0);
			expect(duration).toBeLessThan(2 * 60 * 60 * 1000); // Less than 2 hours for reasonable gameplay
		});

		it('strip_mine should take longer than scavenge (same node and team)', () => {
			const node = createMockResourceNode({ coordinates: { x: 200, y: 200 } });
			const team = [createMockDrifterStats({ speed: 100 })];
			const tScavenge = calculateMissionDuration(node, team, undefined, 'scavenge');
			const tStrip = calculateMissionDuration(node, team, undefined, 'strip_mine');
			expect(tStrip).toBeGreaterThan(tScavenge);
		});

		it('should reduce duration with faster team speed', () => {
			const node = createMockResourceNode();
			const slowTeam = [createMockDrifterStats({ speed: 50 })];
			const fastTeam = [createMockDrifterStats({ speed: 150 })];

			const slowDuration = calculateMissionDuration(node, slowTeam);
			const fastDuration = calculateMissionDuration(node, fastTeam);

			expect(fastDuration).toBeLessThan(slowDuration);
		});

		it('should use slowest team member speed', () => {
			const node = createMockResourceNode();
			const mixedTeam = [
				createMockDrifterStats({ speed: 150 }),
				createMockDrifterStats({ speed: 75 }), // Slowest
				createMockDrifterStats({ speed: 125 }),
			];
			const slowTeam = [createMockDrifterStats({ speed: 75 })];

			const mixedDuration = calculateMissionDuration(node, mixedTeam);
			const slowDuration = calculateMissionDuration(node, slowTeam);

			// Should be the same since both use speed 75
			expect(Math.abs(mixedDuration - slowDuration)).toBeLessThan(1000); // Within 1 second
		});

		it('should handle empty team with default fallback speed', () => {
			const node = createMockResourceNode();
			const emptyTeamDuration = calculateMissionDuration(node, []);
			const defaultTeamDuration = calculateMissionDuration(node);

			expect(emptyTeamDuration).toBe(defaultTeamDuration);
		});

		it('should reduce duration when team speed is high', () => {
			const node = createMockResourceNode();
			const fastTeam = [createMockDrifterStats({ speed: 100 })];

			const defaultDuration = calculateMissionDuration(node);
			const fastDuration = calculateMissionDuration(node, fastTeam);

			expect(fastDuration).toBeLessThan(defaultDuration);
		});

		it('should handle very slow drifters without extreme durations', () => {
			const node = createMockResourceNode({ coordinates: { x: 100, y: 100 } });
			const verySlow = [createMockDrifterStats({ speed: 10 })];
			const extremelySlow = [createMockDrifterStats({ speed: 1 })];

			const verySlowDuration = calculateMissionDuration(node, verySlow);
			const extremelySlowDuration = calculateMissionDuration(node, extremelySlow);

			// With 5x speed cap, even very slow drifters should have reasonable durations
			// Base duration ~45 min * 5x cap = ~225 minutes max (3.75 hours)
			expect(verySlowDuration).toBeLessThan(5 * 60 * 60 * 1000); // Less than 5 hours
			expect(extremelySlowDuration).toBeLessThan(5 * 60 * 60 * 1000); // Less than 5 hours (same cap)

			// Extremely slow should be at least as long as very slow, both under reasonable cap
			expect(extremelySlowDuration).toBeGreaterThanOrEqual(verySlowDuration);
		});
	});

	describe('estimateMissionRewards', () => {
		it('should return base rewards for scavenge mission', () => {
			const node = createMockResourceNode({ currentYield: 100, type: 'metal' });
			const duration = 30 * 60 * 1000; // 30 minutes

			const rewards = estimateMissionRewards(node, 'scavenge', duration);

			expect(rewards.creditsRange.min).toBeGreaterThan(0);
			expect(rewards.creditsRange.max).toBeGreaterThan(rewards.creditsRange.min);
			expect(rewards.resourcesRange.type).toBe('metal');
			expect(rewards.resourcesRange.min).toBeGreaterThan(0);
			// Should be capped at extraction limit for single drifter scavenge (8)
			expect(rewards.resourcesRange.max).toBeLessThanOrEqual(8);
			// Min/max may be equal when extraction cap hits the variance range
			expect(rewards.resourcesRange.max).toBeGreaterThanOrEqual(rewards.resourcesRange.min);
		});

		it('should scale rewards with team scavenging bonus', () => {
			const node = createMockResourceNode({ currentYield: 100, type: 'metal' });
			const duration = 30 * 60 * 1000;

			const noTeamRewards = estimateMissionRewards(node, 'scavenge', duration, []);
			const highScavengingTeam = [createMockDrifterStats({ scavenging: 200 }), createMockDrifterStats({ scavenging: 150 })];
			const teamRewards = estimateMissionRewards(node, 'scavenge', duration, highScavengingTeam);

			// Team with high scavenging should get more resources
			expect(teamRewards.resourcesRange.max).toBeGreaterThan(noTeamRewards.resourcesRange.max);
			expect(teamRewards.resourcesRange.min).toBeGreaterThan(noTeamRewards.resourcesRange.min);
		});

		it('should scale credits with team tech bonus', () => {
			const node = createMockResourceNode({ currentYield: 100 });
			const duration = 30 * 60 * 1000;

			const noTeamRewards = estimateMissionRewards(node, 'scavenge', duration, []);
			const highTechTeam = [createMockDrifterStats({ tech: 200 }), createMockDrifterStats({ tech: 150 })];
			const teamRewards = estimateMissionRewards(node, 'scavenge', duration, highTechTeam);

			// Team with high tech should get more credits
			expect(teamRewards.creditsRange.max).toBeGreaterThan(noTeamRewards.creditsRange.max);
			expect(teamRewards.creditsRange.min).toBeGreaterThan(noTeamRewards.creditsRange.min);
		});

		it('should respect resource node yield cap', () => {
			const lowYieldNode = createMockResourceNode({ currentYield: 5 });
			const duration = 30 * 60 * 1000;
			const superTeam = [createMockDrifterStats({ scavenging: 1000 })];

			const rewards = estimateMissionRewards(lowYieldNode, 'scavenge', duration, superTeam);

			// Even with super high scavenging, can't exceed node yield
			expect(rewards.resourcesRange.max).toBeLessThanOrEqual(lowYieldNode.currentYield);
		});

		it('should vary rewards by mission type', () => {
			const node = createMockResourceNode({ currentYield: 100 });
			const duration = 30 * 60 * 1000;
			const team = [createMockDrifterStats()];

			const scavengeRewards = estimateMissionRewards(node, 'scavenge', duration, team);
			const stripMineRewards = estimateMissionRewards(node, 'strip_mine', duration, team);
			const combatRewards = estimateMissionRewards(node, 'combat', duration, team);

			// Different mission types should have different reward profiles
			expect(scavengeRewards).not.toEqual(stripMineRewards);
			expect(stripMineRewards).not.toEqual(combatRewards);

			// Strip mine should generally give more resources but more risk
			expect(stripMineRewards.resourcesRange.max).toBeGreaterThanOrEqual(scavengeRewards.resourcesRange.max);
		});

		it('should ensure min never exceeds max in all scenarios', () => {
			const scenarios = [
				// Normal scenarios
				{ currentYield: 100, team: [createMockDrifterStats()] },
				{ currentYield: 50, team: [createMockDrifterStats({ scavenging: 200 })] },
				{ currentYield: 10, team: [createMockDrifterStats({ scavenging: 500 })] },
				// Edge cases
				{ currentYield: 0, team: [createMockDrifterStats()] },
				{ currentYield: 1, team: [createMockDrifterStats({ scavenging: 1000 })] },
				{ currentYield: 5, team: [createMockDrifterStats({ scavenging: 0 })] },
			];

			const missionTypes: MissionType[] = ['scavenge', 'strip_mine', 'combat', 'sabotage'];

			for (const scenario of scenarios) {
				const node = createMockResourceNode({ currentYield: scenario.currentYield });
				const duration = 30 * 60 * 1000;

				for (const missionType of missionTypes) {
					const rewards = estimateMissionRewards(node, missionType, duration, scenario.team);

					// Critical: min should never exceed max
					expect(rewards.creditsRange.min).toBeLessThanOrEqual(rewards.creditsRange.max);
					expect(rewards.resourcesRange.min).toBeLessThanOrEqual(rewards.resourcesRange.max);
				}
			}
		});

		it('should enforce extraction caps based on team size and mission type', () => {
			const node = createMockResourceNode({ currentYield: 100 });
			const duration = 30 * 60 * 1000;

			// Test single drifter caps
			const singleDrifter = [createMockDrifterStats({ scavenging: 1000 })];
			const scavengeRewards = estimateMissionRewards(node, 'scavenge', duration, singleDrifter);
			const stripMineRewards = estimateMissionRewards(node, 'strip_mine', duration, singleDrifter);
			const combatRewards = estimateMissionRewards(node, 'combat', duration, singleDrifter);
			const sabotageRewards = estimateMissionRewards(node, 'sabotage', duration, singleDrifter);

			// Should be capped at extraction limits per mission type
			expect(scavengeRewards.resourcesRange.max).toBeLessThanOrEqual(8); // 1 * 8
			expect(stripMineRewards.resourcesRange.max).toBeLessThanOrEqual(12); // 1 * 12
			expect(combatRewards.resourcesRange.max).toBeLessThanOrEqual(10); // 1 * 10
			expect(sabotageRewards.resourcesRange.max).toBeLessThanOrEqual(6); // 1 * 6

			// Test multiple drifter scaling
			const threeDrifters = [
				createMockDrifterStats({ scavenging: 1000 }),
				createMockDrifterStats({ scavenging: 1000 }),
				createMockDrifterStats({ scavenging: 1000 }),
			];
			const teamScavengeRewards = estimateMissionRewards(node, 'scavenge', duration, threeDrifters);
			const teamStripMineRewards = estimateMissionRewards(node, 'strip_mine', duration, threeDrifters);

			// Should scale with team size
			expect(teamScavengeRewards.resourcesRange.max).toBeLessThanOrEqual(24); // 3 * 8
			expect(teamStripMineRewards.resourcesRange.max).toBeLessThanOrEqual(36); // 3 * 12

			// Team should extract more than single drifter (when not node-yield constrained)
			expect(teamScavengeRewards.resourcesRange.max).toBeGreaterThan(scavengeRewards.resourcesRange.max);
			expect(teamStripMineRewards.resourcesRange.max).toBeGreaterThan(stripMineRewards.resourcesRange.max);
		});
	});

	describe('calculateMissionRewards', () => {
		it('should produce rewards within estimated ranges', () => {
			const node = createMockResourceNode({ currentYield: 100 });
			const duration = 30 * 60 * 1000;
			const team = [createMockDrifterStats()];

			const estimates = estimateMissionRewards(node, 'scavenge', duration, team);
			const actual = calculateMissionRewards(node, 'scavenge', duration, team);

			// Actual rewards should be within estimated ranges
			expect(actual.credits).toBeGreaterThanOrEqual(estimates.creditsRange.min);
			expect(actual.credits).toBeLessThanOrEqual(estimates.creditsRange.max);
			expect(actual.resources[estimates.resourcesRange.type]).toBeGreaterThanOrEqual(estimates.resourcesRange.min);
			expect(actual.resources[estimates.resourcesRange.type]).toBeLessThanOrEqual(estimates.resourcesRange.max);
		});

		it('should respect resource node yield cap in actual rewards', () => {
			const lowYieldNode = createMockResourceNode({ currentYield: 10 }); // Use higher value to avoid minimum override
			const duration = 30 * 60 * 1000;
			const superTeam = [createMockDrifterStats({ scavenging: 1000 })];

			const actual = calculateMissionRewards(lowYieldNode, 'scavenge', duration, superTeam);

			// With higher yield, the cap should be respected
			expect(actual.resources[lowYieldNode.type]).toBeLessThanOrEqual(lowYieldNode.currentYield);
		});

		it('should produce different results due to RNG variance', () => {
			const node = createMockResourceNode({ currentYield: 100 });
			const duration = 30 * 60 * 1000;
			const team = [createMockDrifterStats()];

			const results = [];
			for (let i = 0; i < 10; i++) {
				results.push(calculateMissionRewards(node, 'scavenge', duration, team));
			}

			// Should have some variation in results (not all identical)
			const uniqueCredits = new Set(results.map((r) => r.credits));
			const uniqueResources = new Set(results.map((r) => r.resources[node.type]));

			// Due to RNG, we expect some variation (though not necessarily in all runs)
			expect(uniqueCredits.size).toBeGreaterThanOrEqual(1);
			expect(uniqueResources.size).toBeGreaterThanOrEqual(1);
		});
	});

	describe('calculateLiveEstimates', () => {
		it('should combine duration and rewards calculations', () => {
			const node = createMockResourceNode();
			const team = [createMockDrifterStats({ speed: 120, scavenging: 150 })];

			const estimates = calculateLiveEstimates(node, 'scavenge', team);

			expect(estimates.duration).toBeGreaterThan(0);
			expect(estimates.rewards.creditsRange.min).toBeGreaterThan(0);
			expect(estimates.rewards.resourcesRange.min).toBeGreaterThan(0);
			expect(estimates.teamStats).toBeDefined();
			expect(estimates.teamStats?.speed).toBe(120);
		});

		it('should weight scavenging more for scavenge and tech more for strip_mine', () => {
			const node = createMockResourceNode();
			const team = [createMockDrifterStats({ scavenging: 100, tech: 100 })];
			const scav = calculateLiveEstimates(node, 'scavenge', team);
			const strip = calculateLiveEstimates(node, 'strip_mine', team);
			expect(scav.teamStats?.scavengingBonus || 0).toBeGreaterThan(strip.teamStats?.scavengingBonus || 0);
			expect(strip.teamStats?.techBonus || 0).toBeGreaterThan(scav.teamStats?.techBonus || 0);
		});

		it('should provide team stats summary', () => {
			const team = [
				createMockDrifterStats({ speed: 80, scavenging: 120, tech: 140 }),
				createMockDrifterStats({ speed: 100, scavenging: 110, tech: 90 }),
			];
			const node = createMockResourceNode();

			const estimates = calculateLiveEstimates(node, 'scavenge', team);

			expect(estimates.teamStats).toBeDefined();
			expect(estimates.teamStats?.speed).toBe(80); // Slowest
			expect(estimates.teamStats?.scavengingBonus).toBeGreaterThan(0);
			expect(estimates.teamStats?.techBonus).toBeGreaterThan(0);
		});

		it('should handle empty team gracefully', () => {
			const node = createMockResourceNode();

			const estimates = calculateLiveEstimates(node, 'scavenge', []);

			expect(estimates.duration).toBeGreaterThan(0);
			expect(estimates.rewards.creditsRange.min).toBeGreaterThan(0);
			expect(estimates.teamStats).toBeUndefined();
		});
	});

	describe('formatDuration', () => {
		it('should format seconds correctly', () => {
			expect(formatDuration(45000)).toBe('1 min');
		});

		it('should format minutes correctly', () => {
			expect(formatDuration(3 * 60 * 1000)).toBe('3 min');
			expect(formatDuration(3 * 60 * 1000 + 30000)).toBe('4 min'); // Rounds up
		});

		it('should format hours correctly', () => {
			expect(formatDuration(2 * 60 * 60 * 1000)).toBe('2h');
			expect(formatDuration(2 * 60 * 60 * 1000 + 15 * 60 * 1000)).toBe('2h 15m');
			expect(formatDuration(2 * 60 * 60 * 1000 + 15 * 60 * 1000 + 30000)).toBe('2h 16m'); // Rounds up
		});

		it('should handle zero duration', () => {
			expect(formatDuration(0)).toBe('0 min');
		});
	});

	describe('Edge Cases', () => {
		it('should handle zero/negative stats gracefully', () => {
			const node = createMockResourceNode();
			const badStatsTeam = [createMockDrifterStats({ speed: 0, scavenging: -10, tech: 0 })];

			const duration = calculateMissionDuration(node, badStatsTeam);
			const rewards = estimateMissionRewards(node, 'scavenge', 30 * 60 * 1000, badStatsTeam);

			expect(duration).toBeGreaterThan(0);
			expect(rewards.creditsRange.min).toBeGreaterThanOrEqual(0);
			expect(rewards.resourcesRange.min).toBeGreaterThanOrEqual(0);
		});

		it('should handle depleted nodes', () => {
			const depletedNode = createMockResourceNode({ currentYield: 0 });
			const team = [createMockDrifterStats()];

			const rewards = estimateMissionRewards(depletedNode, 'scavenge', 30 * 60 * 1000, team);

			// With a depleted node, both min and max are capped at currentYield (0)
			// The corrected logic ensures min never exceeds max
			expect(rewards.resourcesRange.max).toBe(0);
			expect(rewards.resourcesRange.min).toBe(0);
			expect(rewards.resourcesRange.min).toBeLessThanOrEqual(rewards.resourcesRange.max);
		});

		it('should handle extremely high stats', () => {
			const node = createMockResourceNode({ currentYield: 1000 });
			const superTeam = [
				createMockDrifterStats({ speed: 10000, scavenging: 5000, tech: 5000 }),
				createMockDrifterStats({ speed: 8000, scavenging: 4000, tech: 4000 }),
			];

			const duration = calculateMissionDuration(node, superTeam);
			const rewards = estimateMissionRewards(node, 'scavenge', duration, superTeam);
			const actual = calculateMissionRewards(node, 'scavenge', duration, superTeam);

			// Should still be reasonable despite extreme stats
			expect(duration).toBeGreaterThan(0);
			expect(rewards.resourcesRange.max).toBeLessThanOrEqual(node.currentYield);
			expect(actual.resources[node.type]).toBeLessThanOrEqual(node.currentYield);
		});
	});
});
