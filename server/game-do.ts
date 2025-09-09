import { DurableObject } from 'cloudflare:workers';
import type {
	PlayerProfile,
	NotificationMessage,
	GameWebSocketMessage,
	PlayerStateUpdate,
	WorldStateUpdate,
	Mission,
	ResourceNode,
	MissionType,
	ResourceType,
	Rarity,
	GameEvent,
	DrifterProgress,
	TownState,
	TownAttributeType,
	Monster,
	MonsterKind,
} from '@shared/models';
import {
	calculateMissionDuration,
	calculateMissionRewards,
	type DrifterStats,
	BASE_SPEED,
	calculateMonsterMissionDuration,
	calculateOneWayTravelDuration,
	estimateMonsterDamage,
} from '../shared/mission-utils';
import { getDrifterStats } from './drifters';
import { getVehicle } from './vehicles';
import { calculateProsperityGain, prosperityResourceBoostMultiplier } from '../shared/prosperity-utils';
import type { LeaderboardsResponse, LeaderboardEntry } from '@shared/leaderboards';
interface WebSocketSession {
	websocket: WebSocket;
	sessionId: string;
	playerAddress?: string;
	authenticated: boolean;
	lastPing: number;
}

interface PendingNotification {
	id: string;
	type: string;
	title: string;
	message: string;
	timestamp: Date;
	data?: any;
}

interface ResourceManagementConfig {
	targetNodesPerType: Record<ResourceType, number>;
	totalTargetNodes: number;
	degradationCheckInterval: number; // minutes
	degradationRate: number; // percentage per hour (negative)
	// World is centered at (0,0); resources spawn within this radius
	spawnRadius: number; // in world units (pixels)
}

interface PlayerContributionStats {
	totalUpgradeCredits: number;
	totalProsperityFromMissions: number;
	totalCombatDamage: number;
}

interface GameState {
	players: Map<string, PlayerProfile>; // address -> profile
	notifications: Map<string, NotificationMessage[]>; // address -> notifications
	missions: Map<string, Mission>; // missionId -> mission
	resourceNodes: Map<string, ResourceNode>; // nodeId -> node
	eventLog: GameEvent[]; // FIFO global event log (max 1000)
	drifterProgress: Map<string, DrifterProgress>; // tokenId -> progress
	worldMetrics: {
		totalActiveMissions: number;
		totalCompletedMissions: number;
		economicActivity: number;
		lastUpdate: Date;
	};
	resourceConfig: ResourceManagementConfig;
}

/**
 * GameDO - Single Durable Object for entire game state
 *
 * Manages everything in one place:
 * - All player profiles and balances
 * - World state and resource nodes
 * - Active missions
 * - WebSocket connections for real-time updates
 * - Notifications
 */
export class GameDO extends DurableObject {
	/**
	 * Choose rarity based on distance from town (0,0). Farther nodes have higher rarity probability.
	 */
	private pickRarityByRadius(r: number, R: number): Rarity {
		const t = Math.min(Math.max(r / R, 0), 1); // 0 near town, 1 at outer edge
		// Base weights near town
		const near = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 };
		// Far weights at edge
		const far = { common: 20, uncommon: 30, rare: 25, epic: 15, legendary: 10 };
		const w = {
			common: near.common * (1 - t) + far.common * t,
			uncommon: near.uncommon * (1 - t) + far.uncommon * t,
			rare: near.rare * (1 - t) + far.rare * t,
			epic: near.epic * (1 - t) + far.epic * t,
			legendary: near.legendary * (1 - t) + far.legendary * t,
		};
		const total = w.common + w.uncommon + w.rare + w.epic + w.legendary;
		const roll = Math.random() * total;
		let acc = 0;
		if ((acc += w.common) >= roll) {
			return 'common';
		}
		if ((acc += w.uncommon) >= roll) {
			return 'uncommon';
		}
		if ((acc += w.rare) >= roll) {
			return 'rare';
		}
		if ((acc += w.epic) >= roll) {
			return 'epic';
		}
		return 'legendary';
	}
	private gameState: GameState;
	private webSocketSessions: Map<string, WebSocketSession>;
private pendingNotifications: Map<string, Set<string>>; // sessionId -> Set<notificationId>
private playerReplayQueues: Map<string, PendingNotification[]>; // playerAddress -> notification queue
private contributionStats: Map<string, PlayerContributionStats>; // address -> contribution totals
private env: Env;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.env = env;

		// Initialize WebSocket sessions and notification tracking
		this.webSocketSessions = new Map();
this.pendingNotifications = new Map();
this.playerReplayQueues = new Map();
this.contributionStats = new Map();

		// Initialize empty game state
		this.gameState = {
			players: new Map(),
			notifications: new Map(),
			missions: new Map(),
			resourceNodes: new Map(),
			eventLog: [],
			drifterProgress: new Map(),
			worldMetrics: {
				totalActiveMissions: 0,
				totalCompletedMissions: 0,
				economicActivity: 0,
				lastUpdate: new Date(),
			},
			resourceConfig: {
				targetNodesPerType: {
					ore: 3,
					scrap: 3,
					organic: 2,
				},
				totalTargetNodes: 8,
				degradationCheckInterval: 15, // Check every 15 minutes
				degradationRate: 10, // 10% per hour (negative effect)
				spawnRadius: 2000, // Arbitrary large world radius around town (0,0)
			},
		};

		// Load persisted data first
		this.initializeGameState();

		// Initialize subsystems independently
		this.initializeResourceManagement();
		this.initializeMonsterManagement();
	}

	/**
	 * Initialize game state by loading from storage and setting up defaults
	 */
	private async initializeGameState() {
		await this.loadGameState();
		await this.initializeResourceNodes();
	}

	/**
	 * Load game state from storage
	 */
	private async loadGameState() {
		try {
			// Load players
			const playersData = await this.ctx.storage.get<Record<string, PlayerProfile>>('players');
			if (playersData) {
				this.gameState.players = new Map(Object.entries(playersData));
			}

			// Load notifications
			const notificationsData = await this.ctx.storage.get<Record<string, NotificationMessage[]>>('notifications');
			if (notificationsData) {
				this.gameState.notifications = new Map(Object.entries(notificationsData));
			}

			// Load global event log
			const eventLogData = await this.ctx.storage.get<GameEvent[]>('eventLog');
			if (eventLogData) {
				this.gameState.eventLog = eventLogData;
			}

			// Load missions
			const missionsData = await this.ctx.storage.get<Record<string, Mission>>('missions');
			console.log(`[GameDO] Loading missions from storage:`, missionsData ? Object.keys(missionsData) : 'null');
			if (missionsData) {
				this.gameState.missions = new Map(Object.entries(missionsData));
				console.log(`[GameDO] Loaded ${this.gameState.missions.size} missions into memory`);
			} else {
				console.log('[GameDO] No missions found in storage');
			}

			// Load resource nodes
			const nodesData = await this.ctx.storage.get<Record<string, ResourceNode>>('resourceNodes');
			if (nodesData) {
				this.gameState.resourceNodes = new Map(Object.entries(nodesData));
			}

// Load world metrics
			const worldMetrics = await this.ctx.storage.get<typeof this.gameState.worldMetrics>('worldMetrics');
			if (worldMetrics) {
				this.gameState.worldMetrics = worldMetrics;
			}

			// Load contribution stats
			const contribData = await this.ctx.storage.get<Record<string, PlayerContributionStats>>('contributionStats');
			if (contribData) {
				this.contributionStats = new Map(Object.entries(contribData));
			}

			// Load drifter progress
			const drifterProgressData = await this.ctx.storage.get<Record<string, DrifterProgress>>('drifterProgress');
			if (drifterProgressData) {
				this.gameState.drifterProgress = new Map(Object.entries(drifterProgressData));
			}

			console.log('[GameDO] Loaded game state:', {
				players: this.gameState.players.size,
				missions: this.gameState.missions.size,
				resourceNodes: this.gameState.resourceNodes.size,
			});

			// Log detailed mission state
			if (this.gameState.missions.size > 0) {
				console.log(
					'[GameDO] Loaded missions:',
					Array.from(this.gameState.missions.entries()).map(([id, mission]) => ({
						id,
						status: mission.status,
						playerAddress: mission.playerAddress,
					})),
				);
			}

			// Log player active missions
			for (const [address, player] of this.gameState.players) {
				if (player.activeMissions.length > 0) {
					console.log(`[GameDO] Player ${address} has active missions: ${player.activeMissions}`);
				}
			}
		} catch (error) {
			console.error('[GameDO] Error loading game state:', error);
		}
	}

	/**
	 * Save game state to storage
	 */
	private async saveGameState() {
		try {
			const missionsToSave = Object.fromEntries(this.gameState.missions);
			console.log(`[GameDO] Saving game state - missions count: ${this.gameState.missions.size}`);
			console.log(`[GameDO] Missions being saved:`, Object.keys(missionsToSave));

await Promise.all([
				this.ctx.storage.put('players', Object.fromEntries(this.gameState.players)),
				this.ctx.storage.put('notifications', Object.fromEntries(this.gameState.notifications)),
				this.ctx.storage.put('missions', missionsToSave),
				this.ctx.storage.put('resourceNodes', Object.fromEntries(this.gameState.resourceNodes)),
				this.ctx.storage.put('worldMetrics', this.gameState.worldMetrics),
				this.ctx.storage.put('eventLog', this.gameState.eventLog),
				this.ctx.storage.put('drifterProgress', Object.fromEntries(this.gameState.drifterProgress)),
				this.ctx.storage.put('contributionStats', Object.fromEntries(this.contributionStats)),
			]);

			console.log('[GameDO] Game state saved successfully');
		} catch (error) {
			console.error('[GameDO] Error saving game state:', error);
		}
	}

	/**
	 * Initialize resource nodes if they don't exist
	 */
	private async initializeResourceNodes() {
		// Migration: if existing nodes are present but coordinate system version changed, regenerate
		const storedVer = (await this.ctx.storage.get<number>('coordSystemVersion')) ?? 0;
		const CURRENT_VER = 2;
		if (storedVer !== CURRENT_VER && this.gameState.resourceNodes.size > 0) {
			console.log(`[GameDO] Coordinate system version changed (${storedVer} -> ${CURRENT_VER}). Regenerating resource nodes.`);
			this.gameState.resourceNodes.clear();
		}

		if (this.gameState.resourceNodes.size > 0) {
			return; // Already initialized with current version
		}

		console.log('[GameDO] Initializing resource nodes (no existing nodes found)');

		// Create 8 initial resource nodes matching our target distribution
		const nodesToCreate: ResourceType[] = [
			'ore',
			'ore',
			'ore', // 3 ore nodes
			'scrap',
			'scrap',
			'scrap', // 3 scrap nodes
			'organic',
			'organic', // 2 organic nodes
		];

		const nodes: ResourceNode[] = [];

		for (let i = 0; i < nodesToCreate.length; i++) {
			const type = nodesToCreate[i];
			const newNode = this.createRandomResourceNodeWithAntiOverlap(type);
			nodes.push(newNode);
		}

		for (const node of nodes) {
			this.gameState.resourceNodes.set(node.id, node);
		}

		// Only save resource nodes, don't overwrite entire game state
		console.log(`[GameDO] Saving resource nodes only (preserving existing missions: ${this.gameState.missions.size})`);
		await this.ctx.storage.put('resourceNodes', Object.fromEntries(this.gameState.resourceNodes));
		await this.ctx.storage.put('coordSystemVersion', CURRENT_VER);
		console.log('[GameDO] Initialized', nodes.length, 'resource nodes');
	}

	// =============================================================================
	// WebSocket Management
	// =============================================================================

	/**
	 * Send message to specific session directly via WebSocket
	 */
	private sendToSession(sessionId: string, message: GameWebSocketMessage) {
		console.log(`[GameDO] Sending message to session ${sessionId}:`, message.type);
		const session = this.webSocketSessions.get(sessionId);
		if (session && session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
			session.websocket.send(JSON.stringify(message));
			console.log(`[GameDO] Message sent successfully to session ${sessionId}`);
		} else {
			console.log(`[GameDO] Session ${sessionId} not found or WebSocket not open`);
		}
	}

	/**
	 * Send player state update to specific session
	 */
	private buildProfileWithProgress(player: PlayerProfile): PlayerProfile {
		// Attach drifterProgress for owned drifters only
		const progress: Record<string, DrifterProgress> = {};
		for (const d of player.ownedDrifters || []) {
			const key = String(d.tokenId);
			const dp = this.gameState.drifterProgress.get(key);
			if (dp) {
				progress[key] = dp;
			}
		}
		return { ...player, drifterProgress: progress };
	}

	private async sendPlayerStateUpdate(sessionId: string, playerAddress: string) {
		console.log(`[GameDO] send playerStateUpdate ${sessionId}`);
		const player = this.gameState.players.get(playerAddress);
		const notifications = this.gameState.notifications.get(playerAddress) || [];

		if (!player) {
			return;
		}

		const profileWithProgress = this.buildProfileWithProgress(player);
		const message: PlayerStateUpdate = {
			type: 'player_state',
			timestamp: new Date(),
			data: {
				profile: profileWithProgress,
				balance: player.balance,
				activeMissions: player.activeMissions,
				discoveredNodes: player.discoveredNodes,
				notifications: notifications.slice(-5), // Latest 5 notifications
			},
		};

		this.sendToSession(sessionId, message);
	}

	/**
	 * Send world state update to specific session
	 */
	private async sendWorldStateUpdate(sessionId: string) {
		console.log(`[GameDO] send worldStateUpdate ${sessionId}`);
		// Only send active nodes with yield > 0
		const activeNodes = Array.from(this.gameState.resourceNodes.values()).filter((node) => node.isActive && node.currentYield > 0);

		const town = await this.getTownState();
		const monsters = await this.getMonsters();

		const message: WorldStateUpdate = {
			type: 'world_state',
			timestamp: new Date(),
			data: {
				resourceNodes: activeNodes,
				missions: Array.from(this.gameState.missions.values()),
				monsters,
				town,
				worldMetrics: this.gameState.worldMetrics,
			},
		};

		this.sendToSession(sessionId, message);
	}

	/**
	 * Broadcast player state to all sessions for this player
	 */
	private async broadcastPlayerStateUpdate(playerAddress: string) {
		const player = this.gameState.players.get(playerAddress);
		const notifications = this.gameState.notifications.get(playerAddress) || [];

		if (!player) {
			return;
		}

		const profileWithProgress = this.buildProfileWithProgress(player);
		const message: PlayerStateUpdate = {
			type: 'player_state',
			timestamp: new Date(),
			data: {
				profile: profileWithProgress,
				balance: player.balance,
				activeMissions: player.activeMissions,
				discoveredNodes: player.discoveredNodes,
				notifications: notifications.slice(-5), // Latest 5 notifications
			},
		};

		console.log(`[GameDO] Broadcasting player state update to player ${playerAddress}, ${this.webSocketSessions.size} sessions`);

		// Send to all sessions for this player
		for (const [sessionId, session] of this.webSocketSessions) {
			console.log(sessionId, session.playerAddress, session.authenticated, session.websocket.readyState);
			if (session.playerAddress === playerAddress && session.authenticated && session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
				session.websocket.send(JSON.stringify(message));
				console.log(`[GameDO] Sent player state update to session ${sessionId}`);
			}
		}
	}

	/**
	 * Broadcast world state to all authenticated sessions
	 */
	private async broadcastWorldStateUpdate() {
		// Only send active nodes with yield > 0
		const activeNodes = Array.from(this.gameState.resourceNodes.values()).filter((node) => node.isActive && node.currentYield > 0);

		const town = await this.getTownState();
		const monsters = await this.getMonsters();

		const message: WorldStateUpdate = {
			type: 'world_state',
			timestamp: new Date(),
			data: {
				resourceNodes: activeNodes,
				missions: Array.from(this.gameState.missions.values()),
				monsters,
				town,
				worldMetrics: this.gameState.worldMetrics,
			},
		};

		console.log(`[GameDO] Broadcasting world state update to all clients (${activeNodes.length} active nodes)`);

		// Send to all authenticated sessions
		for (const [sessionId, session] of this.webSocketSessions) {
			if (session.authenticated && session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
				session.websocket.send(JSON.stringify(message));
				console.log(`[GameDO] Sent world state update to session ${sessionId}`);
			}
		}
	}

	/**
	 * Broadcast mission update to all authenticated sessions
	 */
	private async broadcastMissionUpdate(update: any) {
		const message = {
			type: 'mission_update',
			timestamp: new Date(),
			data: update,
		};

		console.log('[GameDO] Broadcasting mission update to all clients');

		// Send to all authenticated sessions
		for (const [sessionId, session] of this.webSocketSessions) {
			if (session.authenticated && session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
				session.websocket.send(JSON.stringify(message));
				console.log(`[GameDO] Sent mission update to session ${sessionId}`);
			}
		}
	}

	/**
	 * Broadcast leaderboards update to all authenticated sessions
	 */
	private async broadcastLeaderboardsUpdate() {
		try {
			const boards = await this.getLeaderboards();
			const message = {
				type: 'leaderboards_update',
				timestamp: new Date(),
				data: boards,
			};
			for (const [_sessionId, session] of this.webSocketSessions) {
				if (session.authenticated && session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
					session.websocket.send(JSON.stringify(message));
				}
			}
		} catch (e) {
			console.warn('[GameDO] Failed broadcasting leaderboards update', e);
		}
	}

	/**
	 * Broadcast a single appended event to all authenticated sessions
	 */
	private async broadcastEventAppend(event: GameEvent) {
		const message = {
			type: 'event_log_append',
			timestamp: new Date(),
			data: { event },
		};

		for (const [_sessionId, session] of this.webSocketSessions) {
			if (session.authenticated && session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
				session.websocket.send(JSON.stringify(message));
			}
		}
	}

	/**
	 * Add an event to the global event log (FIFO, max 1000), persist and broadcast
	 */
	private async addEvent(partial: Omit<GameEvent, 'id' | 'timestamp'> & { timestamp?: Date }) {
		const event: GameEvent = {
			id: crypto.randomUUID(),
			timestamp: partial.timestamp ?? new Date(),
			...partial,
		};
		this.gameState.eventLog.push(event);
		if (this.gameState.eventLog.length > 1000) {
			this.gameState.eventLog = this.gameState.eventLog.slice(-1000);
		}
		await this.ctx.storage.put('eventLog', this.gameState.eventLog);
		await this.broadcastEventAppend(event);
	}

// =============================================================================
// Player Management
// =============================================================================

/** Contribution stats helpers */
private getOrCreateContributionStats(address: string): PlayerContributionStats {
	const a = address.toLowerCase();
	let stats = this.contributionStats.get(a);
	if (!stats) {
		stats = { totalUpgradeCredits: 0, totalProsperityFromMissions: 0, totalCombatDamage: 0 };
		this.contributionStats.set(a, stats);
	}
	return stats;
}

private incrementUpgradeCredits(address: string, amount: number) {
	const amt = Math.floor(Number(amount) || 0);
	if (amt <= 0) {
		return;
	}
	const stats = this.getOrCreateContributionStats(address);
	stats.totalUpgradeCredits += amt;
}

private incrementProsperityFromMissions(address: string, delta: number) {
	const d = Number(delta) || 0;
	if (d <= 0) {
		return;
	}
	const stats = this.getOrCreateContributionStats(address);
	stats.totalProsperityFromMissions += d;
}

private incrementCombatDamage(address: string, dmg: number) {
	const d = Math.floor(Number(dmg) || 0);
	if (d <= 0) {
		return;
	}
	const stats = this.getOrCreateContributionStats(address);
	stats.totalCombatDamage += d;
}

public async getLeaderboards(): Promise<LeaderboardsResponse> {
	// Build arrays and sort desc, assign ranks starting at 1
	const entries = Array.from(this.contributionStats.entries());
	const build = (selector: (s: PlayerContributionStats) => number): LeaderboardEntry[] => {
		const arr = entries
			.map(([address, s]) => ({ address, value: selector(s) }))
			.filter((e) => e.value > 0)
			.sort((a, b) => b.value - a.value);
		return arr.map((e, i) => ({ address: e.address, value: e.value, rank: i + 1 }));
	};
	return {
		upgradeContributions: build((s) => s.totalUpgradeCredits),
		resourceProsperity: build((s) => s.totalProsperityFromMissions),
		combatDamage: build((s) => s.totalCombatDamage),
	};
}

	/**
	 * Get or create player profile
	 */
	async getProfile(address: string): Promise<PlayerProfile> {
		let player = this.gameState.players.get(address);

		if (!player) {
			// Create new player
			player = {
				address,
				balance: 1000, // Starting balance
				ownedDrifters: [], // Will be populated from NFT lookup
				vehicles: [], // new
				discoveredNodes: [], // Empty initially
				upgrades: [], // No upgrades initially
				activeMissions: [], // No active missions initially
				lastLogin: new Date(),
			};

			this.gameState.players.set(address, player);
			await this.saveGameState();
			console.log(`[GameDO] Created new player profile for ${address}`);
		} else {
			// Update last login
			player.lastLogin = new Date();
			await this.saveGameState();
		}

		return this.buildProfileWithProgress(player);
	}

	/**
	 * Credit player balance
	 */
	async credit(address: string, amount: number): Promise<{ success: boolean; newBalance: number; error?: string }> {
		const player = this.gameState.players.get(address);
		if (!player) {
			return { success: false, newBalance: 0, error: 'Player not found' };
		}

		if (amount <= 0) {
			return { success: false, newBalance: player.balance, error: 'Amount must be positive' };
		}

		player.balance += amount;
		await this.saveGameState();

		// Broadcast update
		await this.broadcastPlayerStateUpdate(address);

		return { success: true, newBalance: player.balance };
	}

	/**
	 * Debit player balance
	 */
	async debit(address: string, amount: number): Promise<{ success: boolean; newBalance: number; error?: string }> {
		const player = this.gameState.players.get(address);
		if (!player) {
			return { success: false, newBalance: 0, error: 'Player not found' };
		}

		if (amount <= 0) {
			return { success: false, newBalance: player.balance, error: 'Amount must be positive' };
		}

		if (player.balance < amount) {
			return { success: false, newBalance: player.balance, error: 'Insufficient funds' };
		}

		player.balance -= amount;
		await this.saveGameState();

		// Broadcast update
		await this.broadcastPlayerStateUpdate(address);

		return { success: true, newBalance: player.balance };
	}

	/**
	 * Update player's owned Drifters
	 */
	async updateOwnedDrifters(address: string, drifters: DrifterProfile[]): Promise<{ success: boolean; error?: string }> {
		const player = this.gameState.players.get(address);
		if (!player) {
			return { success: false, error: 'Player not found' };
		}

		player.ownedDrifters = drifters;
		await this.saveGameState();

		// Broadcast update
		await this.broadcastPlayerStateUpdate(address);

		return { success: true };
	}

	async purchaseVehicle(playerAddress: string, vehicle: Vehicle): Promise<{ success: boolean; newBalance?: number; error?: string }> {
		const player = this.gameState.players.get(playerAddress);
		if (!player) {
			return { success: false, error: 'Player not found' };
		}

		if (player.balance < vehicle.cost) {
			return { success: false, error: 'Insufficient credits' };
		}

		player.balance -= vehicle.cost;
		if (!player.vehicles) {
			player.vehicles = [];
		}

		const newVehicleInstance = {
			instanceId: crypto.randomUUID(),
			vehicleId: vehicle.id,
			status: 'idle' as const,
		};

		player.vehicles.push(newVehicleInstance);

		await this.saveGameState();
		await this.broadcastPlayerStateUpdate(playerAddress);

		return { success: true, newBalance: player.balance };
	}

	// =============================================================================
	// Mission Management
	// =============================================================================

	/**
	 * Start a monster combat mission targeting a specific monster.
	 * Computes a simple duration based on distance and team speed, with a 2-minute engagement window.
	 */
	async startMonsterCombatMission(
		playerAddress: string,
		drifterIds: number[],
		targetMonsterId: string,
		vehicleInstanceId?: string | null,
	): Promise<{ success: boolean; missionId?: string; error?: string }> {
		try {
			await this.ensureAlarmsInitialized();
			if (!playerAddress || !Array.isArray(drifterIds) || drifterIds.length === 0 || !targetMonsterId) {
				return { success: false, error: 'Invalid request' };
			}

			// Validate player
			const player = await this.getProfile(playerAddress);
			if (!player) {
				return { success: false, error: 'Player not found' };
			}

			// Validate monster
			const monsters = await this.getMonsters();
			const monster = monsters.find((m) => m.id === targetMonsterId);
			if (!monster) {
				return { success: false, error: 'Monster not found' };
			}
			if (monster.state === 'dead') {
				return { success: false, error: 'Monster already defeated' };
			}

			// Build effective drifter stats and compute team speed
			const dStats: DrifterStats[] = [];
			for (const id of drifterIds) {
				const base = await getDrifterStats(id, this.env);
				const eff = this.getEffectiveDrifterStats(id, base);
				dStats.push({ combat: eff.combat, scavenging: eff.scavenging, tech: eff.tech, speed: eff.speed });
			}
			let _teamSpeed = BASE_SPEED;
			let vehicleData: any = undefined;
			if (vehicleInstanceId) {
				const vInst = player.vehicles?.find((v) => v.instanceId === vehicleInstanceId) || null;
				if (!vInst) {
					return { success: false, error: 'Vehicle not available' };
				}
				vehicleData = getVehicle(vInst.vehicleId);
				_teamSpeed = vehicleData?.speed || BASE_SPEED;
				// Mark vehicle as on-mission immediately for combat missions too
				vInst.status = 'on_mission';
			} else {
				// derive from slowest drifter effective speed
				if (dStats.length > 0) {
					_teamSpeed = Math.min(...dStats.map((s) => s.speed)) || BASE_SPEED;
				}
			}

			// Duration to monster using shared helper; if monster is attacking (at town), active defense is immediate
			let durationMs = calculateMonsterMissionDuration(monster.coordinates as any, dStats, vehicleData as any);
			if (monster.state === 'attacking') {
				durationMs = 0;
			}
			const now = new Date();
			const completion = new Date(now.getTime() + durationMs);

			// Create mission
			const missionId = `mission-${crypto.randomUUID()}`;
			const mission: Mission = {
				id: missionId,
				type: 'combat',
				playerAddress,
				drifterIds,
				vehicleInstanceId: vehicleInstanceId || null,
				targetMonsterId,
				startTime: now,
				completionTime: completion,
				status: 'active',
				rewards: { credits: 0, resources: {} },
			};

			this.gameState.missions.set(missionId, mission);
			player.activeMissions = [...(player.activeMissions || []), missionId];

			await this.saveGameState();
await this.broadcastWorldStateUpdate();
			await this.broadcastMissionUpdate({ mission });
			await this.broadcastPlayerStateUpdate(playerAddress);
			await this.broadcastLeaderboardsUpdate();

			await this.addEvent({
				type: 'mission_started',
				missionId,
				playerAddress,
				message: `Combat mission started vs ${monster.kind} (${targetMonsterId})`,
			});

			return { success: true, missionId };
		} catch (e) {
			console.error('[GameDO] startMonsterCombatMission error', e);
			return { success: false, error: 'Failed to start monster combat mission' };
		}
	}

	/**
	 * Start a mission
	 */
	async startMission(
		playerAddress: string,
		missionType: MissionType,
		drifterIds: number[],
		targetNodeId: string,
		vehicleInstanceId?: string | null,
	): Promise<{ success: boolean; missionId?: string; error?: string }> {
		console.log(
			`[GameDO] Starting mission - Player: ${playerAddress}, Type: ${missionType}, Drifters: [${drifterIds.join(', ')}], Target: ${targetNodeId}, VehicleInstance: ${vehicleInstanceId}`,
		);

		const player = this.gameState.players.get(playerAddress);
		if (!player) {
			console.error(`[GameDO] Player not found: ${playerAddress}`);
			return { success: false, error: 'Player not found' };
		}

		// Validate drifter IDs
		if (!drifterIds || drifterIds.length === 0) {
			return { success: false, error: 'At least one drifter is required' };
		}

		// Check all drifters are owned by the player
		for (const drifterId of drifterIds) {
			const drifter = player.ownedDrifters.find((d) => d.tokenId === drifterId);
			if (!drifter) {
				console.error(`[GameDO] Player ${playerAddress} does not own drifter ${drifterId}`);
				return { success: false, error: `You don't own Drifter #${drifterId}` };
			}
		}

		// Check no drifters are currently on active missions
		const activeDrifters = new Set<number>();
		for (const mission of this.gameState.missions.values()) {
			if (mission.status === 'active') {
				mission.drifterIds.forEach((id) => activeDrifters.add(id));
			}
		}

		const busyDrifters = drifterIds.filter((id) => activeDrifters.has(id));
		if (busyDrifters.length > 0) {
			console.error(`[GameDO] Drifters currently on missions: [${busyDrifters.join(', ')}]`);
			const busyList = busyDrifters.map((id) => `#${id}`).join(', ');
			return {
				success: false,
				error: `Drifter${busyDrifters.length > 1 ? 's' : ''} ${busyList} ${busyDrifters.length > 1 ? 'are' : 'is'} currently on another mission`,
			};
		}

		console.log(`[GameDO] All ${drifterIds.length} drifter(s) are available for mission`);

		// Validate vehicle (optional)
		let vehicle: ReturnType<typeof getVehicle> | undefined;
		let vehicleInstance: { instanceId: string; vehicleId: string; status: 'idle' | 'on_mission' } | undefined;
		if (vehicleInstanceId) {
			vehicleInstance = player.vehicles.find((v) => v.instanceId === vehicleInstanceId);
			if (!vehicleInstance) {
				return { success: false, error: 'Vehicle not found or not owned by player' };
			}

			if (vehicleInstance.status !== 'idle') {
				return { success: false, error: 'Vehicle is currently on another mission' };
			}

			vehicle = getVehicle(vehicleInstance.vehicleId);
			if (!vehicle) {
				return { success: false, error: 'Vehicle data not found' };
			}

			if (drifterIds.length > vehicle.maxDrifters) {
				return { success: false, error: `Vehicle only has space for ${vehicle.maxDrifters} drifters` };
			}
		}

		// Validate target node exists
		const targetNode = this.gameState.resourceNodes.get(targetNodeId);
		if (!targetNode) {
			return { success: false, error: 'Target node not found' };
		}

		// Create mission
		const missionId = crypto.randomUUID();
		const now = new Date();

		// Load drifter stats for team-aware calculations
		const teamStats: DrifterStats[] = [];
		for (const drifterId of drifterIds) {
			const drifterProfile = getDrifterStats(drifterId);
			if (drifterProfile) {
				const effective = this.getEffectiveDrifterStats(drifterId, {
					combat: drifterProfile.combat,
					scavenging: drifterProfile.scavenging,
					tech: drifterProfile.tech,
					speed: drifterProfile.speed,
				});
				teamStats.push(effective);
			}
		}

		// If a vehicle is used, treat its bonuses as an additional team member for reward calculations
		if (vehicle) {
			teamStats.push({
				combat: (vehicle as any).combat ?? 0,
				scavenging: (vehicle as any).scavenging ?? 0,
				tech: (vehicle as any).tech ?? 0,
				speed: vehicle.speed,
			});
		}

		// Calculate mission duration and rewards using shared utilities with drifter stats
		const duration = calculateMissionDuration(targetNode, teamStats, vehicle || undefined, missionType);
		console.log(
			`[GameDO] duration: ${duration} (with ${teamStats.length} drifter/vehicle entries and vehicle ${vehicle ? vehicle.name : 'On Foot'})`,
		);
		const rewards = calculateMissionRewards(targetNode, missionType, duration, teamStats);
		console.log(`[GameDO] rewards: ${rewards}`);

		console.log(
			`[GameDO] Mission duration calculated: ${duration / 1000 / 60} minutes based on distance to node at (${targetNode.coordinates.x}, ${targetNode.coordinates.y})`,
		);
		console.log(
			`[GameDO] Mission rewards calculated: ${rewards.credits} credits, ${Object.values(rewards.resources)[0]} ${Object.keys(rewards.resources)[0]}`,
		);

		const mission: Mission = {
			id: missionId,
			type: missionType,
			playerAddress,
			drifterIds,
			vehicleInstanceId: vehicleInstanceId ?? null,
			targetNodeId,
			startTime: now,
			completionTime: new Date(now.getTime() + duration),
			status: 'active',
			rewards,
		};

		// Add to game state
		this.gameState.missions.set(missionId, mission);
		player.activeMissions.push(missionId);
		if (vehicleInstance) {
			vehicleInstance.status = 'on_mission';
		}

		// Log event: mission started
		await this.addEvent({
			type: 'mission_started',
			playerAddress,
			missionId,
			nodeId: targetNodeId,
			resourceType: targetNode.type,
			rarity: targetNode.rarity,
			drifterIds,
			vehicleName: vehicle ? ((vehicle as any).name ?? 'On Foot') : 'On Foot',
			message: `${playerAddress.slice(0, 6)}… started ${missionType.toUpperCase()} at ${targetNode.type.toUpperCase()} (${targetNode.rarity.toUpperCase()}) node with drifters ${drifterIds.map((id) => `#${id}`).join(', ')} ${vehicle ? `in ${(vehicle as any).name}` : 'on foot'}`,
		});

		console.log(`[GameDO] Mission ${missionId} created and added to player ${playerAddress}`);
		console.log(`[GameDO] Player now has ${player.activeMissions.length} active missions: ${player.activeMissions}`);
		console.log(`[GameDO] Global missions count: ${this.gameState.missions.size}`);

		// Update world metrics
		this.gameState.worldMetrics.totalActiveMissions++;
		this.gameState.worldMetrics.lastUpdate = new Date();

		await this.saveGameState();
		console.log(`[GameDO] Game state saved after mission creation`);

		// Broadcast updates
		await this.broadcastPlayerStateUpdate(playerAddress);
		await this.broadcastWorldStateUpdate();

		return { success: true, missionId };
	}

	/**
	 * Complete a mission
	 */
	async completeMission(missionId: string, forceComplete: boolean = false): Promise<{ success: boolean; rewards?: any; error?: string }> {
		const mission = this.gameState.missions.get(missionId);
		if (!mission) {
			return { success: false, error: 'Mission not found' };
		}

		if (mission.status !== 'active') {
			return { success: false, error: 'Mission not active' };
		}

		// Skip time check if forcing completion (for manual testing)
		if (!forceComplete && new Date() < mission.completionTime) {
			return { success: false, error: 'Mission not yet complete' };
		}

		const player = this.gameState.players.get(mission.playerAddress);
		if (!player) {
			return { success: false, error: 'Player not found' };
		}

		// Award rewards
		player.balance += mission.rewards.credits;

		let totalCombatXpAwarded = 0; // for monster missions
		let targetMonsterKind: string | undefined; // capture for completion log

		// Branch handling based on target type
		if (mission.targetMonsterId) {
			const targetMonsterId = mission.targetMonsterId as string;
			// Load monsters (read-only here unless we follow legacy path)
			let monsters = await this.getStoredMonsters();
			const monster = monsters.find((m) => m.id === targetMonsterId);
			if (monster) {
				targetMonsterKind = monster.kind;
			}

			const engaged = !!mission.engagementApplied;
			if (engaged) {
				// Damage was already applied at engagement time; award XP now based on stored damage
				const dmgStored = Math.max(0, Number(mission.combatDamageDealt) || 0);
				let xpGain = Math.max(1, Math.floor(dmgStored * 0.25));
				totalCombatXpAwarded = xpGain * (mission.drifterIds?.length || 0);
				for (const drifterId of mission.drifterIds) {
					const { leveled, levelsGained, newLevel } = this.applyXp(drifterId, xpGain);
					if (leveled) {
						await this.addEvent({
							type: 'mission_complete',
							playerAddress: mission.playerAddress,
							missionId: mission.id,
							message: `Drifter #${drifterId} leveled up ${levelsGained} level(s) to ${newLevel}`,
						});
						// Notify player's sessions
						const notif: PendingNotification = {
							id: crypto.randomUUID(),
							type: 'drifter_level_up',
							title: 'Drifter Level Up',
							message: `Drifter #${drifterId} reached level ${newLevel}! +1 bonus point available.`,
							timestamp: new Date(),
							data: { tokenId: drifterId, level: newLevel },
						};
						for (const [sessionId, session] of this.webSocketSessions) {
							if (
								session.playerAddress === mission.playerAddress &&
								session.authenticated &&
								session.websocket.readyState === WebSocket.READY_STATE_OPEN
							) {
								this.sendNotificationToSession(sessionId, notif);
							}
						}
					}
				}
			} else {
				if (!monster) {
					console.error(`[GameDO] Target monster ${targetMonsterId} not found during mission completion`);
				} else if (monster.state !== 'dead') {
					// Legacy fallback: apply damage at completion if engagement didn't happen (should be rare after v2)
					const dStats: DrifterStats[] = [];
					for (const id of mission.drifterIds) {
						const base = await getDrifterStats(id, this.env);
						const eff = this.getEffectiveDrifterStats(id, base);
						dStats.push({ combat: eff.combat, scavenging: eff.scavenging, tech: eff.tech, speed: eff.speed });
					}
					let vehicleDataForDmg: any = undefined;
					if (mission.vehicleInstanceId) {
						const vInst = player.vehicles.find((v) => v.instanceId === mission.vehicleInstanceId);
						if (vInst) {
							vehicleDataForDmg = getVehicle(vInst.vehicleId);
						}
					}
					const est = estimateMonsterDamage(dStats, vehicleDataForDmg);
					const variance = 0.15; // ±15% (keep same as client range)
const dmg = Math.max(1, Math.round(est.base * (1 + (Math.random() * 2 - 1) * variance)));
					// Track combat damage for leaderboards (legacy completion path)
					this.incrementCombatDamage(mission.playerAddress, dmg);
					const before = monster.hp;
					monster.hp = Math.max(0, monster.hp - dmg);
					const killed = monster.hp <= 0;
					if (killed) {
						// Remove the monster entirely when killed
						monsters = monsters.filter((mm) => mm.id !== monster.id);
						await this.addEvent({
							type: 'monster_killed',
							message: `${monster.kind} killed (damage ${dmg}, hp ${before}→0)`,
							data: { id: monster.id, kind: monster.kind, damage: dmg },
						});
					} else {
						await this.addEvent({
							type: 'town_damaged',
							message: `${monster.kind} damaged for ${dmg} (hp ${before}→${monster.hp})`,
							data: { id: monster.id, kind: monster.kind, damage: dmg },
						});
					}
					await this.setStoredMonsters(monsters);

					// Award combat XP at 25% of damage (per drifter)
					let xpGain = Math.max(1, Math.floor(dmg * 0.25));
					totalCombatXpAwarded = xpGain * (mission.drifterIds?.length || 0);
					for (const drifterId of mission.drifterIds) {
						const { leveled, levelsGained, newLevel } = this.applyXp(drifterId, xpGain);
						if (leveled) {
							await this.addEvent({
								type: 'mission_complete',
								playerAddress: mission.playerAddress,
								missionId: mission.id,
								message: `Drifter #${drifterId} leveled up ${levelsGained} level(s) to ${newLevel}`,
							});
							// Notify player's sessions
							const notif: PendingNotification = {
								id: crypto.randomUUID(),
								type: 'drifter_level_up',
								title: 'Drifter Level Up',
								message: `Drifter #${drifterId} reached level ${newLevel}! +1 bonus point available.`,
								timestamp: new Date(),
								data: { tokenId: drifterId, level: newLevel },
							};
							for (const [sessionId, session] of this.webSocketSessions) {
								if (
									session.playerAddress === mission.playerAddress &&
									session.authenticated &&
									session.websocket.readyState === WebSocket.READY_STATE_OPEN
								) {
									this.sendNotificationToSession(sessionId, notif);
								}
							}
						}
					}
				}
			}
		} else {
			// Deplete resources from target node (resource missions)
			const node = this.gameState.resourceNodes.get(mission.targetNodeId);
			if (node) {
				console.log(`[GameDO] Depleting resources from node ${mission.targetNodeId} (${node.type})`);
				console.log(`[GameDO] Node before depletion: currentYield=${node.currentYield}, depletion=${node.depletion}`);

				// Calculate how much resource was extracted
				const resourceType = node.type;
				const extractedRequested = mission.rewards.resources[resourceType] ?? 0;
				const extractedActual = Math.min(extractedRequested, node.currentYield);

				console.log(`[GameDO] Extracting ${extractedActual} units (requested: ${extractedRequested}, available: ${node.currentYield})`);

				// Apply depletion
				node.currentYield -= extractedActual;
				node.depletion += extractedActual;
				node.lastHarvested = new Date();

				// Mark as inactive if fully depleted
				if (node.currentYield <= 0) {
					node.currentYield = 0;
					node.isActive = false;
					console.log(`[GameDO] Node ${mission.targetNodeId} is now fully depleted and inactive`);

					// Log resource depleted
					await this.addEvent({
						type: 'resource_depleted',
						playerAddress: mission.playerAddress,
						nodeId: mission.targetNodeId,
						resourceType: resourceType,
						rarity: node.rarity,
						message: `${resourceType.toUpperCase()} (${node.rarity.toUpperCase()}) node depleted by ${mission.playerAddress.slice(0, 6)}…`,
					});

					// Add depletion notification to player
					await this.addNotification(mission.playerAddress, {
						id: crypto.randomUUID(),
						type: 'resource_depleted',
						title: 'Resource Depleted',
						message: `The ${resourceType} node you were harvesting has been fully depleted.`,
						timestamp: new Date(),
						read: false,
					});
				}

				console.log(`[GameDO] Node after depletion: currentYield=${node.currentYield}, depletion=${node.depletion}`);

				// Apply Prosperity gain for resource missions (scavenge > strip_mine)
				try {
					const mt = mission.type as MissionType;
					const isResource = mt === 'scavenge' || mt === 'strip_mine';
					const credits = Math.max(0, mission.rewards?.credits || 0);
					if (isResource && credits > 0) {
						const town = await this.getTownState();
						const vmLevel = town.attributes['vehicle_market']?.level ?? 0;
						const wallLevel = town.attributes['perimeter_walls']?.level ?? 0;
						const { delta, base, missionTypeMult, upgradeMult } = calculateProsperityGain(credits, mt, vmLevel, wallLevel);
						if (delta > 0) {
							const before = town.prosperity || 0;
							town.prosperity = Math.max(0, before + delta); // unbounded above
await this.setTownState(town);
						// Track player prosperity contribution for leaderboards
						this.incrementProsperityFromMissions(mission.playerAddress, delta);
						await this.addEvent({
								type: 'town_prosperity_changed',
								message: `Town Prosperity +${delta.toFixed(2)} → ${Math.round(town.prosperity)}`,
								data: {
									missionId: mission.id,
									missionType: mt,
									credits,
									delta: Number(delta.toFixed(3)),
									oldProsperity: before,
									newProsperity: town.prosperity,
									base: Number(base.toFixed(3)),
									multipliers: {
										missionTypeMult,
										upgradeMult,
										vehicleMarketLevel: vmLevel,
										perimeterWallsLevel: wallLevel,
									},
								},
							});
						}
					}
				} catch (e) {
					console.warn('[GameDO] Failed to apply prosperity gain:', e);
				}
			} else {
				console.error(`[GameDO] Target node ${mission.targetNodeId} not found during mission completion`);
			}
		}

		// Remove from active missions
		const missionIndex = player.activeMissions.indexOf(missionId);
		if (missionIndex > -1) {
			player.activeMissions.splice(missionIndex, 1);
		}

		// Mark mission as completed
		mission.status = 'completed';

		// Log mission completion
		await this.addEvent({
			type: 'mission_complete',
			playerAddress: mission.playerAddress,
			missionId: mission.id,
			nodeId: mission.targetMonsterId ? undefined : mission.targetNodeId,
			resourceType: undefined as any,
			rarity: undefined as any,
			drifterIds: mission.drifterIds,
			vehicleName: mission.vehicleInstanceId
				? player.vehicles.find((v) => v.instanceId === mission.vehicleInstanceId)
					? getVehicle(player.vehicles.find((v) => v.instanceId === mission.vehicleInstanceId)!.vehicleId)?.name
					: 'On Foot'
				: 'On Foot',
			message: `${mission.playerAddress.slice(0, 6)}… completed ${mission.type.toUpperCase()} ${
				mission.targetMonsterId
					? `vs ${targetMonsterKind ?? 'MONSTER'}`
					: `at ${(this.gameState.resourceNodes.get(mission.targetNodeId!)?.type ?? '').toString().toUpperCase()}`
			} with drifters ${mission.drifterIds.map((id) => `#${id}`).join(', ')} ${
				mission.vehicleInstanceId
					? `in ${(() => {
							const vi = player.vehicles.find((v) => v.instanceId === mission.vehicleInstanceId);
							return vi ? getVehicle(vi.vehicleId)?.name || 'On Foot' : 'On Foot';
						})()}`
					: 'on foot'
			} ${mission.targetMonsterId ? `(+${totalCombatXpAwarded} XP)` : `(+${mission.rewards.credits} cr)`}`,
		});

		// Award XP to participating drifters based on credits earned
		const xpGain = Math.ceil(mission.rewards.credits / 10);
		if (xpGain > 0) {
			for (const drifterId of mission.drifterIds) {
				const { leveled, levelsGained, newLevel } = this.applyXp(drifterId, xpGain);
				if (leveled) {
					// Add event log for level-up
					await this.addEvent({
						type: 'mission_complete', // reuse type category for now; message clarifies
						playerAddress: mission.playerAddress,
						missionId: mission.id,
						message: `Drifter #${drifterId} leveled up ${levelsGained} level(s) to ${newLevel}`,
					});

					// Notify player's active sessions
					const notif: PendingNotification = {
						id: crypto.randomUUID(),
						type: 'drifter_level_up',
						title: 'Drifter Level Up',
						message: `Drifter #${drifterId} reached level ${newLevel}! +1 bonus point available.`,
						timestamp: new Date(),
						data: { tokenId: drifterId, level: newLevel },
					};
					for (const [sessionId, session] of this.webSocketSessions) {
						if (
							session.playerAddress === mission.playerAddress &&
							session.authenticated &&
							session.websocket.readyState === WebSocket.READY_STATE_OPEN
						) {
							this.sendNotificationToSession(sessionId, notif);
						}
					}
				}
			}
		}

		// Update vehicle status (if any)
		if (mission.vehicleInstanceId) {
			const vehicleInstance = player.vehicles.find((v) => v.instanceId === mission.vehicleInstanceId);
			if (vehicleInstance) {
				vehicleInstance.status = 'idle';
			}
		}

		// Update world metrics
		this.gameState.worldMetrics.totalActiveMissions--;
		this.gameState.worldMetrics.totalCompletedMissions++;
		this.gameState.worldMetrics.economicActivity += mission.rewards.credits;
		this.gameState.worldMetrics.lastUpdate = new Date();

		await this.saveGameState();

		// NOTE: We don't add mission completion to persistent notifications anymore
		// since we use the real-time notification system instead

		// Broadcast updates
await this.broadcastPlayerStateUpdate(mission.playerAddress);
			await this.broadcastWorldStateUpdate();
			await this.broadcastLeaderboardsUpdate();

		// Send mission completion notification to player's sessions
		const isMonsterMission = !!mission.targetMonsterId;
		const notifMessage = isMonsterMission
			? `Combat mission complete! Gained +${totalCombatXpAwarded} XP.`
			: `Mission completed! Earned ${mission.rewards.credits} credits.`;
		const notification: PendingNotification = {
			id: crypto.randomUUID(),
			type: 'mission_complete',
			title: isMonsterMission ? 'Combat Mission Complete' : 'Mission Complete',
			message: notifMessage,
			timestamp: new Date(),
		};

		// Send to all sessions for this player
		for (const [sessionId, session] of this.webSocketSessions) {
			if (
				session.playerAddress === mission.playerAddress &&
				session.authenticated &&
				session.websocket.readyState === WebSocket.READY_STATE_OPEN
			) {
				this.sendNotificationToSession(sessionId, notification);
			}
		}

		return { success: true, rewards: mission.rewards };
	}

	/**
	 * Get mission by ID
	 */
	async getMission(missionId: string): Promise<Mission | null> {
		return this.gameState.missions.get(missionId) || null;
	}

	/**
	 * Reconcile a player's vehicle statuses: set any vehicles marked on_mission to idle
	 * if there is no active mission referencing that vehicle instance.
	 */
	async reconcileVehicleStatusesForPlayer(
		playerAddress: string,
	): Promise<{ success: boolean; resetCount: number; stuckVehicles: string[] }> {
		const player = this.gameState.players.get(playerAddress);
		if (!player) {
			return { success: false, resetCount: 0, stuckVehicles: [] };
		}

		// Gather vehicle instance IDs referenced by this player's active missions
		const activeVehicleIds = new Set<string>();
		for (const mission of this.gameState.missions.values()) {
			if (mission.status === 'active' && mission.playerAddress === playerAddress && mission.vehicleInstanceId) {
				activeVehicleIds.add(mission.vehicleInstanceId);
			}
		}

		let resetCount = 0;
		const stuckVehicles: string[] = [];
		for (const v of player.vehicles || []) {
			if (v.status === 'on_mission' && !activeVehicleIds.has(v.instanceId)) {
				v.status = 'idle';
				resetCount++;
				stuckVehicles.push(v.instanceId);
			}
		}

		if (resetCount > 0) {
			await this.saveGameState();
			await this.broadcastPlayerStateUpdate(playerAddress);
		}

		return { success: true, resetCount, stuckVehicles };
	}

	/**
	 * Get player's active missions
	 */
	async getPlayerMissions(address: string): Promise<Mission[]> {
		console.log(`[GameDO] Getting player missions for ${address}`);

		const player = this.gameState.players.get(address);
		if (!player) {
			console.log(`[GameDO] Player ${address} not found`);
			return [];
		}

		console.log(`[GameDO] Player ${address} has ${player.activeMissions.length} mission IDs: ${player.activeMissions}`);
		console.log(`[GameDO] Global missions count: ${this.gameState.missions.size}`);
		console.log(`[GameDO] Global mission IDs: ${Array.from(this.gameState.missions.keys())}`);

		const missions: Mission[] = [];
		const orphanedMissionIds: string[] = [];

		for (const missionId of player.activeMissions) {
			const mission = this.gameState.missions.get(missionId);
			if (mission) {
				console.log(`[GameDO] Found mission ${missionId} for player ${address}:`, mission.status);
				missions.push(mission);
			} else {
				console.error(`[GameDO] Mission ${missionId} not found in global missions for player ${address}`);
				orphanedMissionIds.push(missionId);
			}
		}

		// Clean up orphaned mission IDs from player profile
		if (orphanedMissionIds.length > 0) {
			console.log(`[GameDO] Cleaning up ${orphanedMissionIds.length} orphaned missions from player ${address}`);
			player.activeMissions = player.activeMissions.filter((id) => !orphanedMissionIds.includes(id));
			await this.saveGameState();
		}

		console.log(`[GameDO] Returning ${missions.length} missions for player ${address}`);
		return missions;
	}

	// =============================================================================
	// Notification Management
	// =============================================================================

	/**
	 * Add notification for player
	 */
	async addNotification(address: string, notification: NotificationMessage): Promise<{ success: boolean; error?: string }> {
		let notifications = this.gameState.notifications.get(address) || [];

		// Add timestamp if not provided
		if (!notification.timestamp) {
			notification.timestamp = new Date();
		}

		notifications.push(notification);

		// Keep only latest 50 notifications
		if (notifications.length > 50) {
			notifications = notifications.slice(-50);
		}

		this.gameState.notifications.set(address, notifications);
		await this.saveGameState();

		// Broadcast update
		await this.broadcastPlayerStateUpdate(address);

		return { success: true };
	}

	/**
	 * Get player notifications
	 */
	async getNotifications(address: string, limit: number = 20): Promise<NotificationMessage[]> {
		const notifications = this.gameState.notifications.get(address) || [];
		return notifications.slice(-limit).reverse();
	}

	// =============================================================================
	// World State Management
	// =============================================================================

	/**
	 * Get all resource nodes
	 */
	async getResourceNodes(): Promise<ResourceNode[]> {
		await this.ensureAlarmsInitialized();
		return Array.from(this.gameState.resourceNodes.values());
	}

	/**
	 * Get world metrics
	 */
	async getWorldMetrics() {
		await this.ensureAlarmsInitialized();
		return this.gameState.worldMetrics;
	}

	/**
	 * Get all active missions
	 */
	async getActiveMissions(): Promise<Mission[]> {
		await this.ensureAlarmsInitialized();
		return Array.from(this.gameState.missions.values()).filter((m) => m.status === 'active');
	}

	/**
	 * Return a snapshot of the global event log (newest first)
	 */
	async getEventLog(limit: number = 1000): Promise<GameEvent[]> {
		await this.ensureAlarmsInitialized();
		return this.gameState.eventLog.slice(-limit).reverse();
	}

	// =============================================================================
	// Resource Management and Regeneration
	// =============================================================================

	/** Ensure alarm keys exist; if missing, initialize and schedule */
	private async ensureAlarmsInitialized() {
		const [resIso, monIso] = await Promise.all([
			this.ctx.storage.get<string>('nextResourceAlarmAt'),
			this.ctx.storage.get<string>('nextMonsterAlarmAt'),
		]);
		let changed = false;
		const now = Date.now();
		if (!resIso) {
			const resIntervalMs = this.gameState.resourceConfig.degradationCheckInterval * 60 * 1000;
			await this.ctx.storage.put('nextResourceAlarmAt', new Date(now + resIntervalMs).toISOString());
			changed = true;
		}
		if (!monIso) {
			await this.ctx.storage.put('nextMonsterAlarmAt', new Date(now + this.monsterTickIntervalMs).toISOString());
			changed = true;
		}
		if (changed) {
			console.log('[GameDO] Initialized missing alarm keys; scheduling next alarm');
			await this.scheduleNextAlarm();
		}
	}

	/**
	 * Initialize resource management: run immediately, then schedule recurring alarms
	 */
	private monsterTickIntervalMs = 60 * 1000; // 1 minute monster tick frequency

	private async initializeMonsterManagement() {
		console.log('[GameDO] Initializing monster management');
		try {
			const nowDate = new Date();
			await this.monsterMovementTick(nowDate);
			await this.monsterAttackTick(nowDate);
			console.log('[GameDO] Initial monster tick completed');
		} catch (error) {
			console.error('[GameDO] Error during initial monster tick:', error);
		}
		const now = Date.now();
		await this.ctx.storage.put('nextMonsterAlarmAt', new Date(now + this.monsterTickIntervalMs).toISOString());
		await this.scheduleNextAlarm();
	}

	private async initializeResourceManagement() {
		console.log('[GameDO] Initializing resource management');

		try {
			// Run resource management immediately on startup
			await this.performResourceManagement();
			console.log('[GameDO] Initial resource management check completed');
		} catch (error) {
			console.error('[GameDO] Error during initial resource management:', error);
		}

		// Initialize next resource alarm time
		const now = Date.now();
		const resIntervalMs = this.gameState.resourceConfig.degradationCheckInterval * 60 * 1000;
		await this.ctx.storage.put('nextResourceAlarmAt', new Date(now + resIntervalMs).toISOString());

		// Schedule earliest alarm across systems
		await this.scheduleNextAlarm();
	}

	/** Schedule the next alarm trigger based on the earliest of resource/monster needs */
	private async scheduleNextAlarm() {
		const [resIso, monIso] = await Promise.all([
			this.ctx.storage.get<string>('nextResourceAlarmAt'),
			this.ctx.storage.get<string>('nextMonsterAlarmAt'),
		]);
		const resAt = resIso ? new Date(resIso).getTime() : Date.now();
		const monAt = monIso ? new Date(monIso).getTime() : Date.now();
		const nextMs = Math.min(resAt, monAt);
		const next = new Date(Math.max(Date.now() + 1000, nextMs)); // at least 1s in future
		console.log(
			`[GameDO] Scheduling next alarm for ${next.toISOString()} (res=${new Date(resAt).toISOString()} mon=${new Date(monAt).toISOString()})`,
		);
		await this.ctx.storage.setAlarm(next);
	}

	/**
	 * Handle alarm - run whichever systems are due and reschedule
	 */
	async alarm() {
		console.log('[GameDO] Alarm triggered');

		try {
			const now = new Date();

			// Monster tick: run when due
			const monIso = await this.ctx.storage.get<string>('nextMonsterAlarmAt');
			let monAt = monIso ? new Date(monIso) : new Date(0);
			if (now >= monAt) {
				await this.monsterMovementTick(now);
				await this.monsterAttackTick(now);
				// Process any monster mission engagements that are due now
				await this.processMonsterMissionEngagements(now);
				monAt = new Date(now.getTime() + this.monsterTickIntervalMs);
				await this.ctx.storage.put('nextMonsterAlarmAt', monAt.toISOString());
			}

			// Resource degradation: run when due
			const resIso = await this.ctx.storage.get<string>('nextResourceAlarmAt');
			let resAt = resIso ? new Date(resIso) : new Date(0);
			if (now >= resAt) {
				await this.performResourceManagement();
				const resIntervalMs = this.gameState.resourceConfig.degradationCheckInterval * 60 * 1000;
				resAt = new Date(now.getTime() + resIntervalMs);
				await this.ctx.storage.put('nextResourceAlarmAt', resAt.toISOString());
			}
		} catch (error) {
			console.error('[GameDO] Error during scheduled alarm processing:', error);
		}

		// Schedule next alarm to the earliest due time
		await this.scheduleNextAlarm();
	}

	/**
	 * Perform resource management: degradation, cleanup, and spawning
	 */
	private async performResourceManagement() {
		console.log('[GameDO] Starting resource degradation cycle');

		const config = this.gameState.resourceConfig;
		const now = new Date();
		let changesMade = false;

		// Prosperity multiplier influences spawn targets and new node yields
		const town = await this.getTownState();
		const prosperityMult = prosperityResourceBoostMultiplier(town.prosperity);
		const cappedSpawnMult = Math.min(1.5, Math.max(1.0, prosperityMult));

		// 1. Calculate hours elapsed since last update
		const lastUpdate = this.gameState.worldMetrics.lastUpdate;
		const hoursElapsed = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
		console.log(`[GameDO] Hours elapsed since last degradation: ${hoursElapsed.toFixed(2)}`);

		// 2. Apply degradation to all active nodes
		const depleted: string[] = [];
		const hourlyDegradationRate = config.degradationRate / 100; // Convert percentage to decimal

		for (const [nodeId, node] of this.gameState.resourceNodes) {
			if (node.isActive && node.currentYield > 0) {
				// Calculate degradation amount (minimum 1 per cycle to ensure steady degradation)
				let degradationAmount = Math.floor(node.baseYield * hourlyDegradationRate * hoursElapsed);

				// Ensure at least 1 point of degradation per cycle for active nodes
				if (degradationAmount < 1) {
					degradationAmount = 1;
				}

				const oldYield = node.currentYield;
				node.currentYield = Math.max(0, node.currentYield - degradationAmount);

				console.log(`[GameDO] Node ${nodeId} degraded: ${oldYield} -> ${node.currentYield} (-${oldYield - node.currentYield})`);
				changesMade = true;

				// Mark as inactive if fully degraded
				if (node.currentYield <= 0) {
					node.isActive = false;
					depleted.push(nodeId);
					console.log(`[GameDO] Node ${nodeId} has been fully degraded and is now inactive`);
				}
			}
		}

		// 3. Remove fully degraded nodes immediately
		if (depleted.length > 0) {
			console.log(`[GameDO] Removing ${depleted.length} fully degraded nodes`);
			for (const nodeId of depleted) {
				const removed = this.gameState.resourceNodes.get(nodeId);
				this.gameState.resourceNodes.delete(nodeId);
				await this.addEvent({
					type: 'node_removed',
					nodeId,
					resourceType: removed?.type,
					rarity: removed?.rarity,
					message: `Fully depleted ${removed?.type?.toUpperCase() || 'resource'} (${removed?.rarity?.toUpperCase() || 'UNKNOWN'}) node removed`,
				});
			}
			changesMade = true;
		}

		// 4. Count current active nodes by type
		const nodeCountsByType: Record<ResourceType, number> = {
			ore: 0,
			scrap: 0,
			organic: 0,
		};

		for (const node of this.gameState.resourceNodes.values()) {
			if (node.isActive) {
				nodeCountsByType[node.type]++;
			}
		}

		const totalActiveNodes = Object.values(nodeCountsByType).reduce((sum, count) => sum + count, 0);
		console.log(
			`[GameDO] Current active node counts: ore=${nodeCountsByType.ore}, scrap=${nodeCountsByType.scrap}, organic=${nodeCountsByType.organic}, total=${totalActiveNodes}`,
		);

		// 5. Spawn replacement nodes to maintain target counts (influenced by Prosperity)
		const nodesToSpawn: { type: ResourceType; count: number }[] = [];

		// Check each resource type against its effective target (apply prosperity multiplier)
		for (const [type, targetCountBase] of Object.entries(config.targetNodesPerType) as [ResourceType, number][]) {
			const targetCount = Math.max(1, Math.round(targetCountBase * cappedSpawnMult));
			const currentCount = nodeCountsByType[type];
			if (currentCount < targetCount) {
				nodesToSpawn.push({ type, count: targetCount - currentCount });
			}
		}

		// Spawn the needed nodes
		for (const { type, count } of nodesToSpawn) {
			for (let i = 0; i < count; i++) {
				const newNode = this.createRandomResourceNodeWithAntiOverlap(type);
				// Scale new node yields by prosperity multiplier (cap 1.5x)
				const yieldScale = cappedSpawnMult; // same cap applied
				newNode.baseYield = Math.max(1, Math.round(newNode.baseYield * yieldScale));
				newNode.currentYield = Math.max(1, Math.round(newNode.currentYield * yieldScale));
				this.gameState.resourceNodes.set(newNode.id, newNode);
				console.log(
					`[GameDO] Spawned replacement ${type} node at (${newNode.coordinates.x}, ${newNode.coordinates.y}) with ${newNode.currentYield} yield (m=${yieldScale.toFixed(2)})`,
				);
				await this.addEvent({
					type: 'node_spawned',
					nodeId: newNode.id,
					resourceType: newNode.type,
					rarity: newNode.rarity,
					message: `New ${type.toUpperCase()} (${newNode.rarity.toUpperCase()}) node spawned (${newNode.coordinates.x}, ${newNode.coordinates.y})`,
				});
				changesMade = true;
			}
		}

		// 6. Update world metrics and save
		this.gameState.worldMetrics.lastUpdate = now;

		// 7. Attempt monster spawn based on cadence and cap (scaffold)
		const maybeSpawned = await this.maybeSpawnMonster(now, town.prosperity);
		if (maybeSpawned) {
			changesMade = true;
		}

		if (changesMade) {
			await this.saveGameState();
await this.broadcastWorldStateUpdate();
			await this.broadcastLeaderboardsUpdate();
			console.log('[GameDO] Resource degradation cycle completed with changes');
		} else {
			console.log('[GameDO] Resource degradation cycle completed with no changes needed');
		}
	}

	/**
	 * Create a random resource node of the specified type
	 */
	private createRandomResourceNode(type: ResourceType): ResourceNode {
		const config = this.gameState.resourceConfig;
		const R = config.spawnRadius;

		// Polar sampling around (0,0); bias density toward town by choosing r from a concave distribution
		// Base area-uniform would be r = R * Math.sqrt(u). To bias inward, raise u to a power > 1 before sqrt.
		const u = Math.random();
		const inwardBias = 1.8; // >1 makes nodes more likely closer to town
		const r = R * Math.sqrt(Math.pow(u, inwardBias));
		const theta = Math.random() * Math.PI * 2;
		const x = Math.round(r * Math.cos(theta));
		const y = Math.round(r * Math.sin(theta));

		// Rarity weighting increases with distance from town
		const selectedRarity = this.pickRarityByRadius(r, R);

		// Base yield varies by type and rarity
		const baseYields = {
			ore: { common: 40, uncommon: 60, rare: 80, epic: 120, legendary: 200 },
			scrap: { common: 50, uncommon: 75, rare: 100, epic: 150, legendary: 250 },
			organic: { common: 25, uncommon: 40, rare: 60, epic: 90, legendary: 150 },
		};

		const baseYield = baseYields[type][selectedRarity];

		return {
			id: `${type}-${crypto.randomUUID()}`,
			type,
			coordinates: { x, y },
			baseYield,
			currentYield: baseYield,
			depletion: 0,
			rarity: selectedRarity,
			discoveredBy: [],
			lastHarvested: new Date(0), // Never harvested
			isActive: true,
		};
	}

	/**
	 * Create a random resource node with overlap prevention
	 */
	private createRandomResourceNodeWithAntiOverlap(type: ResourceType): ResourceNode {
		const config = this.gameState.resourceConfig;
		const R = config.spawnRadius;
		const minDistance = 40; // Minimum distance between nodes in world units
		const maxAttempts = 20; // Try more times in larger world

		// Get existing node positions
		const existingPositions: { x: number; y: number }[] = [];
		for (const node of this.gameState.resourceNodes.values()) {
			if (node.isActive) {
				existingPositions.push(node.coordinates);
			}
		}

		let x = 0,
			y = 0;
		let attempts = 0;
		let positionIsValid = false;
		let chosenRarity: Rarity = 'common';

		// Try to find a non-overlapping position via polar sampling with inward bias
		do {
			const u = Math.random();
			const inwardBias = 1.8;
			const r = R * Math.sqrt(Math.pow(u, inwardBias));
			const theta = Math.random() * Math.PI * 2;
			x = Math.round(r * Math.cos(theta));
			y = Math.round(r * Math.sin(theta));

			// Check distance to existing nodes
			positionIsValid = true;
			for (const existing of existingPositions) {
				const dx = x - existing.x;
				const dy = y - existing.y;
				const distance = Math.sqrt(dx * dx + dy * dy);
				if (distance < minDistance) {
					positionIsValid = false;
					break;
				}
			}

			attempts++;
		} while (!positionIsValid && attempts < maxAttempts);

		if (!positionIsValid) {
			console.log(`[GameDO] Could not find non-overlapping position after ${maxAttempts} attempts, using position (${x}, ${y})`);
		}

		const rFromCenter = Math.sqrt(x * x + y * y);
		chosenRarity = this.pickRarityByRadius(rFromCenter, R);

		const baseYields = {
			ore: { common: 40, uncommon: 60, rare: 80, epic: 120, legendary: 200 },
			scrap: { common: 50, uncommon: 75, rare: 100, epic: 150, legendary: 250 },
			organic: { common: 25, uncommon: 40, rare: 60, epic: 90, legendary: 150 },
		};

		const baseYield = baseYields[type][chosenRarity];

		return {
			id: `${type}-${crypto.randomUUID()}`,
			type,
			coordinates: { x, y },
			baseYield,
			currentYield: baseYield,
			depletion: 0,
			rarity: chosenRarity,
			discoveredBy: [],
			lastHarvested: new Date(0),
			isActive: true,
		};
	}

	/**
	 * Manually trigger resource management (for testing)
	 */
	async triggerResourceManagement(): Promise<{ success: boolean; summary: string }> {
		console.log('[GameDO] Manually triggering resource management');

		const beforeStats = {
			totalNodes: this.gameState.resourceNodes.size,
			activeNodes: Array.from(this.gameState.resourceNodes.values()).filter((n) => n.isActive).length,
		};

		await this.performResourceManagement();

		const afterStats = {
			totalNodes: this.gameState.resourceNodes.size,
			activeNodes: Array.from(this.gameState.resourceNodes.values()).filter((n) => n.isActive).length,
		};

		const summary = `Resource management completed. Nodes: ${beforeStats.totalNodes} -> ${afterStats.totalNodes}, Active: ${beforeStats.activeNodes} -> ${afterStats.activeNodes}`;

		return { success: true, summary };
	}

	// =============================================================================
	// Drifter Progression Helpers
	// =============================================================================

	private XP_BASE = 100;
	private XP_GROWTH = 1.5;

	private xpToNext(level: number): number {
		const l = Math.max(1, level);
		return Math.ceil(this.XP_BASE * Math.pow(this.XP_GROWTH, l - 1));
	}

	private keyFor(tokenId: number): string {
		return String(tokenId);
	}

	private getOrInitDrifterProgress(tokenId: number): DrifterProgress {
		const key = this.keyFor(tokenId);
		let dp = this.gameState.drifterProgress.get(key);
		if (!dp) {
			dp = {
				tokenId,
				xp: 0,
				level: 1,
				bonuses: { combat: 0, scavenging: 0, tech: 0, speed: 0 },
				unspentPoints: 0,
			};
			this.gameState.drifterProgress.set(key, dp);
		}
		return dp;
	}

	private applyXp(tokenId: number, xpGain: number): { leveled: boolean; levelsGained: number; newLevel: number } {
		const dp = this.getOrInitDrifterProgress(tokenId);
		let leveled = false;
		let gained = 0;
		dp.xp += Math.max(0, Math.floor(xpGain));
		while (dp.xp >= this.xpToNext(dp.level)) {
			const need = this.xpToNext(dp.level);
			dp.xp -= need;
			dp.level += 1;
			dp.unspentPoints += 1;
			gained += 1;
			leveled = true;
		}
		this.gameState.drifterProgress.set(this.keyFor(tokenId), dp);
		return { leveled, levelsGained: gained, newLevel: dp.level };
	}

	private getEffectiveDrifterStats(
		tokenId: number,
		base: { combat: number; scavenging: number; tech: number; speed: number },
	): { combat: number; scavenging: number; tech: number; speed: number } {
		const dp = this.gameState.drifterProgress.get(this.keyFor(tokenId));
		if (!dp) {
			return base;
		}
		return {
			combat: base.combat + (dp.bonuses.combat || 0),
			scavenging: base.scavenging + (dp.bonuses.scavenging || 0),
			tech: base.tech + (dp.bonuses.tech || 0),
			speed: base.speed + (dp.bonuses.speed || 0),
		};
	}

	async getDrifterProgress(tokenIds?: number[]): Promise<Record<string, DrifterProgress>> {
		const out: Record<string, DrifterProgress> = {};
		if (tokenIds && tokenIds.length > 0) {
			for (const id of tokenIds) {
				const dp = this.gameState.drifterProgress.get(this.keyFor(id));
				if (dp) {
					out[this.keyFor(id)] = dp;
				}
			}
		} else {
			for (const [k, v] of this.gameState.drifterProgress.entries()) {
				out[k] = v;
			}
		}
		return out;
	}

	async allocateBonusPoint(
		requestor: string,
		tokenId: number,
		attribute: 'combat' | 'scavenging' | 'tech' | 'speed',
	): Promise<{ success: boolean; progress?: DrifterProgress; error?: string }> {
		const player = this.gameState.players.get(requestor);
		if (!player) {
			return { success: false, error: 'Player not found' };
		}
		const owns = (player.ownedDrifters || []).some((d) => d.tokenId === tokenId);
		if (!owns) {
			return { success: false, error: "You don't own this drifter" };
		}
		const dp = this.getOrInitDrifterProgress(tokenId);
		if (dp.unspentPoints <= 0) {
			return { success: false, error: 'No unspent points' };
		}
		dp.unspentPoints -= 1;
		dp.bonuses[attribute] = (dp.bonuses[attribute] || 0) + 1;
		this.gameState.drifterProgress.set(this.keyFor(tokenId), dp);
		await this.saveGameState();
		await this.broadcastPlayerStateUpdate(requestor);
		return { success: true, progress: dp };
	}

	// =============================================================================
	// Town & Monsters (initial scaffolding)

	// --- Monster archetypes and helpers ---
	private readonly MONSTER_BANDS: { kind: MonsterKind; speed: [number, number]; hp: [number, number] }[] = [
		{ kind: 'Skitterling', speed: [45, 50], hp: [400, 600] },
		{ kind: 'Dust Stalker', speed: [35, 45], hp: [700, 1000] },
		{ kind: 'Scrap Hound', speed: [28, 36], hp: [1000, 1400] },
		{ kind: 'Sand Wraith', speed: [22, 30], hp: [1200, 1700] },
		{ kind: 'Dune Behemoth', speed: [15, 22], hp: [1700, 2200] },
		{ kind: 'Rust Colossus', speed: [10, 15], hp: [2200, 2500] },
	];

	private randInt(min: number, max: number): number {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	private pickMonsterKindAndStats(): { kind: MonsterKind; speed: number; hp: number } {
		const bands = this.MONSTER_BANDS;
		const band = bands[this.randInt(0, bands.length - 1)];
		return {
			kind: band.kind,
			speed: this.randInt(band.speed[0], band.speed[1]),
			hp: this.randInt(band.hp[0], band.hp[1]),
		};
	}

	private inferKindFromSpeed(speed: number): MonsterKind {
		let best: { kind: MonsterKind; dist: number } | null = null;
		for (const b of this.MONSTER_BANDS) {
			const [min, max] = b.speed;
			const dist = speed < min ? min - speed : speed > max ? speed - max : 0;
			if (!best || dist < best.dist) {
				best = { kind: b.kind, dist };
			}
		}
		return best ? best.kind : 'Dust Stalker';
	}

	private ensureMonsterKinds(monsters: Monster[]): { updated: boolean; monsters: Monster[] } {
		let updated = false;
		for (const m of monsters as any[]) {
			if (!(m as any).kind) {
				(m as any).kind = this.inferKindFromSpeed(m.speed);
				updated = true;
			}
		}
		return { updated, monsters };
	}
	// =============================================================================

	// --- Prosperity math ---

	// --- Town configuration defaults (tunable) ---
	private TOWN_COST_BASE = 1000; // credits
	private TOWN_COST_GROWTH = 2.0; // exponential growth per level
	private TOWN_MAX_LEVEL = 5;

	private wallMaxHpForLevel(level: number): number {
		if (level <= 0) {
			return 0;
		}
		return 1000 * level * level; // 1000 * level^2
	}

	private nextLevelCost(level: number): number {
		// Cost to go from current level -> next level
		// Example: level 0 -> 1: base * growth^0 = base
		return Math.round(this.TOWN_COST_BASE * Math.pow(this.TOWN_COST_GROWTH, Math.max(0, level)));
	}

	private defaultTownState(): TownState {
		const vmCost = this.nextLevelCost(0);
		const wallCost = this.nextLevelCost(0);
		return {
			prosperity: 0,
			attributes: {
				vehicle_market: { level: 0, progress: 0, nextLevelCost: vmCost },
				perimeter_walls: { level: 0, progress: 0, nextLevelCost: wallCost, hp: 0, maxHp: 0 },
			},
		};
	}

	private async setTownState(state: TownState) {
		await this.ctx.storage.put('town', state);
	}

	async getTownState(): Promise<TownState> {
		try {
			const stored = await this.ctx.storage.get<TownState>('town');
			if (stored) {
				return stored;
			}
			const def = this.defaultTownState();
			await this.setTownState(def);
			return def;
		} catch {
			const def = this.defaultTownState();
			await this.setTownState(def);
			return def;
		}
	}

	/**
	 * Contribute credits to a Town attribute. For walls, repairs HP first (1 credit = 1 HP).
	 * Any overflow contributes toward upgrade progress; level-ups apply as needed (with HP refill for walls).
	 */
	async contributeToTown(
		playerAddress: string,
		attribute: TownAttributeType,
		amountCredits: number,
	): Promise<{ success: boolean; town?: TownState; newBalance?: number; error?: string }> {
		try {
			if (!playerAddress || amountCredits <= 0) {
				return { success: false, error: 'Invalid request' };
			}
			// Validate player and funds
			const player = this.gameState.players.get(playerAddress) || (await this.getProfile(playerAddress));
			if (!player) {
				return { success: false, error: 'Player not found' };
			}
			if (player.balance < amountCredits) {
				return { success: false, error: 'Insufficient credits' };
			}

			// Load current town state
			const town = await this.getTownState();
			const attr = town.attributes[attribute];
			if (!attr) {
				return { success: false, error: 'Unknown attribute' };
			}

			let remaining = Math.floor(amountCredits);

			// If attribute at max level, only allow walls repair; otherwise reject
			if (attr.level >= this.TOWN_MAX_LEVEL) {
				if (attribute === 'perimeter_walls') {
					// repair-only path below
				} else {
					return { success: false, error: 'Attribute at max level' };
				}
			}

			// Debit credits up-front
player.balance -= remaining;

			// Track full contribution amount toward upgrade credits leaderboard
			this.incrementUpgradeCredits(playerAddress, amountCredits);

			// Walls: repair HP first (if applicable)
			if (attribute === 'perimeter_walls') {
				const hp = attr.hp ?? 0;
				const maxHp = attr.maxHp ?? this.wallMaxHpForLevel(attr.level);
				if (maxHp > 0 && hp < maxHp) {
					const toRepair = Math.min(remaining, maxHp - hp);
					attr.hp = hp + toRepair;
					attr.maxHp = maxHp; // ensure persisted
					remaining -= toRepair;
				}
			}

			// Contribute remaining credits toward upgrade progress
			if (remaining > 0) {
				attr.progress = (attr.progress || 0) + remaining;

				// Apply level-ups while progress covers cost and not at max
				while (attr.level < this.TOWN_MAX_LEVEL && attr.progress >= attr.nextLevelCost) {
					attr.progress -= attr.nextLevelCost;
					attr.level += 1;
					attr.nextLevelCost = this.nextLevelCost(attr.level);

					if (attribute === 'perimeter_walls') {
						// Recompute walls HP and refill to max on level-up
						attr.maxHp = this.wallMaxHpForLevel(attr.level);
						attr.hp = attr.maxHp;
					}

					// Emit event for town upgrade
					await this.addEvent({
						type: 'town_upgrade_completed',
						message: `Town upgraded: ${attribute} → level ${attr.level}`,
						data: { attribute, level: attr.level },
					});
				}
			}

			// Persist and broadcast
			// Ensure walls have consistent maxHp when level 0 → allow 0
			town.attributes[attribute] = attr;
			await this.setTownState(town);
			await this.saveGameState();
			await this.broadcastWorldStateUpdate();
			await this.broadcastPlayerStateUpdate(playerAddress);

			return { success: true, town, newBalance: player.balance };
		} catch (err) {
			console.error('[GameDO] contributeToTown error:', err);
			return { success: false, error: 'Contribution failed' };
		}
	}

	private async getStoredMonsters(): Promise<Monster[]> {
		const raw = await this.ctx.storage.get<Monster[]>('monsters');
		return Array.isArray(raw) ? raw : [];
	}

	private async setStoredMonsters(list: Monster[]) {
		await this.ctx.storage.put('monsters', list);
	}

	async getMonsters(): Promise<Monster[]> {
		const list = await this.getStoredMonsters();
		let filtered = list.filter((m) => m.state !== 'dead');
		// Ensure back-compat: populate kind for legacy monsters
		const ensured = this.ensureMonsterKinds(filtered);
		if (ensured.updated || filtered.length !== list.length) {
			await this.setStoredMonsters(ensured.monsters);
		}
		return ensured.monsters;
	}

	private distanceToTown(x: number, y: number): number {
		return Math.sqrt(x * x + y * y);
	}

	private clampToTownThreshold(x: number, y: number, threshold: number): { x: number; y: number } {
		const dist = this.distanceToTown(x, y);
		if (dist <= threshold) {
			return { x, y };
		}
		const scale = threshold / dist;
		return { x: Math.round(x * scale), y: Math.round(y * scale) };
	}

	private async processMonsterMissionEngagements(now: Date): Promise<boolean> {
		try {
			let changed = false;
			// Work off stored monsters for HP mutations
			let monsters = await this.getStoredMonsters();
			const monstersById = new Map(monsters.map((m) => [m.id, m] as const));

			for (const mission of this.gameState.missions.values()) {
				const targetMonsterId = (mission as any).targetMonsterId as string | undefined;
				if (!targetMonsterId) {
					continue;
				}
				if (mission.status !== 'active') {
					continue;
				}
				if (mission.engagementApplied) {
					continue; // already engaged; waiting to return
				}

				// Gather team stats (effective) and vehicle
				const player = this.gameState.players.get(mission.playerAddress);
				const dStats: DrifterStats[] = [];
				for (const id of mission.drifterIds) {
					const base = await getDrifterStats(id, this.env);
					const eff = this.getEffectiveDrifterStats(id, base);
					dStats.push({ combat: eff.combat, scavenging: eff.scavenging, tech: eff.tech, speed: eff.speed });
				}
				let vehicleData: any = undefined;
				if (mission.vehicleInstanceId && player) {
					const vInst = player.vehicles?.find((v) => v.instanceId === mission.vehicleInstanceId) || null;
					if (vInst) {
						vehicleData = getVehicle(vInst.vehicleId);
					}
				}

				const monster = monstersById.get(targetMonsterId);
				// Determine outbound time to current monster position (0 if attacking at town)
				let outboundMs = 0;
				if (monster && monster.state !== 'attacking') {
					outboundMs = calculateOneWayTravelDuration(monster.coordinates as any, dStats, vehicleData as any);
				}

				const startTs = (mission.startTime instanceof Date ? mission.startTime : new Date(mission.startTime)).getTime();
				if (!Number.isFinite(startTs)) {
					continue;
				}
				const engageAt = startTs + outboundMs;
				if (now.getTime() < engageAt) {
					continue; // not yet time to engage
				}

				// Apply combat damage at engagement time
				let dmgApplied = 0;
				let battleCoords = { x: 0, y: 0 };
				let killed = false;
				let kind: any = undefined;
				if (monster && monster.state !== 'dead') {
					kind = (monster as any).kind;
					battleCoords = { ...monster.coordinates };
					const est = estimateMonsterDamage(dStats, vehicleData);
					const variance = 0.15; // ±15%
dmgApplied = Math.max(1, Math.round(est.base * (1 + (Math.random() * 2 - 1) * variance)));
					// Track combat damage for leaderboards (engagement path)
					this.incrementCombatDamage(mission.playerAddress, dmgApplied);
					const before = monster.hp;
					monster.hp = Math.max(0, (monster.hp || 0) - dmgApplied);
					killed = monster.hp <= 0;
					if (killed) {
						monsters = monsters.filter((mm) => mm.id !== monster.id);
						await this.addEvent({
							type: 'monster_killed',
							message: `${kind} killed (damage ${dmgApplied}, hp ${before}→0)`,
							data: { id: monster.id, kind, damage: dmgApplied },
						});
					} else {
						await this.addEvent({
							type: 'town_damaged',
							message: `${kind} damaged for ${dmgApplied} (hp ${before}→${monster.hp})`,
							data: { id: monster.id, kind, damage: dmgApplied },
						});
					}
					await this.setStoredMonsters(monsters);
				} else {
					// Monster not found or already dead: treat battle at town (instant return)
					battleCoords = { x: 0, y: 0 };
					dmgApplied = 0;
				}

				// Persist engagement state to mission and recompute return leg
				mission.engagementApplied = true;
				mission.combatDamageDealt = dmgApplied;
				mission.battleLocation = battleCoords;

				const returnMs = calculateOneWayTravelDuration(battleCoords as any, dStats, vehicleData as any);
				mission.completionTime = new Date(now.getTime() + returnMs);
				changed = true;

				// Broadcast mission update (and world after monster HP change)
				await this.broadcastMissionUpdate({ mission });
			}

if (changed) {
				await this.saveGameState();
				await this.broadcastWorldStateUpdate();
				await this.broadcastLeaderboardsUpdate();
			}

			return changed;
		} catch (e) {
			console.error('[GameDO] processMonsterMissionEngagements error', e);
			return false;
		}
	}

	private async monsterMovementTick(now: Date): Promise<boolean> {
		try {
			const lastIso = (await this.ctx.storage.get<string>('lastMonsterMoveAt')) || '';
			const last = lastIso ? new Date(lastIso) : new Date(); // if missing, initialize with now
			const minutes = (now.getTime() - last.getTime()) / 60000;
			console.log(`[Monsters] Movement tick: now=${now.toISOString()} last=${last.toISOString()} Δmin=${minutes.toFixed(2)}`);
			if (minutes <= 0) {
				console.log('[Monsters] Movement: skipping (Δmin <= 0). Seeding lastMonsterMoveAt');
				await this.ctx.storage.put('lastMonsterMoveAt', now.toISOString());
				return false;
			}

			let changed = false;
			let monsters = await this.getStoredMonsters();
			// Prune any dead monsters lingering in storage
			const beforeCount = monsters.length;
			monsters = monsters.filter((m) => m.state !== 'dead');
			if (monsters.length !== beforeCount) {
				console.log(`[Monsters] Movement: pruned ${beforeCount - monsters.length} dead monster(s)`);
				changed = true;
			}
			const arrivalThreshold = 20;
			let moved = 0;
			let arrived = 0;
			for (const m of monsters) {
				if (m.state !== 'traveling') {
					continue;
				}
				const { x, y } = m.coordinates;
				const dist = this.distanceToTown(x, y);
				const moveDist = m.speed * minutes; // units
				if (moveDist <= 0) {
					continue;
				}
				if (moveDist >= dist) {
					// Arrived to threshold
					const snapped = this.clampToTownThreshold(x, y, arrivalThreshold);
					m.coordinates = snapped;
					m.state = 'attacking';
					m.etaToTown = now;
					await this.addEvent({ type: 'monster_arrived', message: `${m.kind} arrived at town`, data: { id: m.id, kind: m.kind } });
					arrived++;
					changed = true;
				} else {
					// Move closer along vector toward (0,0)
					const ux = -x / dist;
					const uy = -y / dist;
					const nx = Math.round(x + ux * moveDist);
					const ny = Math.round(y + uy * moveDist);
					m.coordinates = { x: nx, y: ny };
					moved++;
					changed = true;
				}
			}
			if (changed) {
				// Persist monster changes
				await this.setStoredMonsters(monsters);
				await this.ctx.storage.put('lastMonsterMoveAt', now.toISOString());

				// Recalculate and potentially shrink completionTime for active combat missions targeting moved monsters
				let missionsAdjusted = 0;
				for (const mission of this.gameState.missions.values()) {
					const targetMonsterId = (mission as any).targetMonsterId as string | undefined;
					if (!targetMonsterId) {
						continue;
					}
					if (mission.status !== 'active') {
						continue;
					}
					// Do not adjust timing after engagement has already occurred
					if ((mission as any).engagementApplied) {
						continue;
					}
					const monsterNow = monsters.find((mm) => mm.id === targetMonsterId);
					if (!monsterNow) {
						continue; // Monster may have been killed
					}
					// Only adjust for traveling/attacking monsters
					if (monsterNow.state !== 'traveling' && monsterNow.state !== 'attacking') {
						continue;
					}
					try {
						// Build team stats and vehicle for speed
						const player = this.gameState.players.get(mission.playerAddress);
						let vehicleData: any = undefined;
						if (mission.vehicleInstanceId && player) {
							const vInst = player.vehicles?.find((v) => v.instanceId === mission.vehicleInstanceId) || null;
							if (vInst) {
								vehicleData = getVehicle(vInst.vehicleId);
							}
						}
						const dStats: DrifterStats[] = [];
						for (const id of mission.drifterIds) {
							const base = await getDrifterStats(id, this.env);
							const eff = this.getEffectiveDrifterStats(id, base);
							dStats.push({ combat: eff.combat, scavenging: eff.scavenging, tech: eff.tech, speed: eff.speed });
						}
						const newDuration = calculateMonsterMissionDuration(monsterNow.coordinates as any, dStats, vehicleData as any);
						const startTs = (mission.startTime instanceof Date ? mission.startTime : new Date(mission.startTime)).getTime();
						const currentPlannedEnd = (
							mission.completionTime instanceof Date ? mission.completionTime : new Date(mission.completionTime)
						).getTime();
						const newEnd = startTs + newDuration;
						if (Number.isFinite(startTs) && Number.isFinite(currentPlannedEnd) && Number.isFinite(newEnd)) {
							// Only shrink (never extend) by at least 1 second to avoid jitter
							if (newEnd + 1000 < currentPlannedEnd) {
								(mission as any).completionTime = new Date(newEnd);
								missionsAdjusted++;
								// Notify clients about the mission timing change
								await this.broadcastMissionUpdate({ mission });
							}
						}
					} catch (err) {
						console.warn('[Monsters] Failed to recompute mission time for combat mission', mission.id, err);
					}
				}

				if (missionsAdjusted > 0) {
					await this.saveGameState();
					console.log(`[Monsters] Adjusted completionTime for ${missionsAdjusted} combat mission(s) due to monster movement`);
				}

				// Broadcast world update (includes missions and monsters)
				await this.broadcastWorldStateUpdate();
				console.log(`[Monsters] Movement: updated ${moved} moved, ${arrived} arrived, total=${monsters.length}`);
			} else {
				console.log('[Monsters] Movement: no changes');
			}
			return changed;
		} catch (e) {
			console.error('[GameDO] monsterMovementTick error', e);
			return false;
		}
	}

	private async monsterAttackTick(now: Date): Promise<boolean> {
		try {
			const lastIso = (await this.ctx.storage.get<string>('lastMonsterAttackAt')) || '';
			const last = lastIso ? new Date(lastIso) : new Date();
			const seconds = Math.floor((now.getTime() - last.getTime()) / 1000);
			const ticks = Math.floor(seconds / 20);
			console.log(`[Monsters] Attack tick: now=${now.toISOString()} last=${last.toISOString()} Δsec=${seconds} ticks=${ticks}`);
			if (ticks <= 0) {
				console.log('[Monsters] Attack: skipping (ticks <= 0). Seeding lastMonsterAttackAt');
				await this.ctx.storage.put('lastMonsterAttackAt', now.toISOString());
				return false;
			}

			let changed = false;
			let monsters = await this.getStoredMonsters();
			// Clean up any dead monsters
			const beforeCount = monsters.length;
			monsters = monsters.filter((m) => m.state !== 'dead');
			if (monsters.length !== beforeCount) {
				await this.setStoredMonsters(monsters);
				console.log(`[Monsters] Attack: pruned ${beforeCount - monsters.length} dead monster(s)`);
				changed = true;
			}
			const attackers = monsters.filter((m) => m.state === 'attacking');
			if (attackers.length === 0) {
				console.log('[Monsters] Attack: no attackers at town');
				await this.ctx.storage.put('lastMonsterAttackAt', now.toISOString());
				return false;
			}

			const town = await this.getTownState();
			const DAMAGE_PER_TICK = 50;
			let townChanged = false;
			for (const m of attackers) {
				const totalDamage = DAMAGE_PER_TICK * ticks;
				const outcome = this.applyTownDamage(town, totalDamage);
				console.log(
					`[Monsters] Attack: ${m.id} dealt ${totalDamage} (walls:${outcome.wallsDamage} other:${outcome.attrDamage} prosperity:${outcome.prosperityDamage})`,
				);
				if (outcome.changed) {
					townChanged = true;
					await this.addEvent({
						type: 'town_damaged',
						message: `Town damaged by ${m.kind} for ${totalDamage} (walls:${outcome.wallsDamage} other:${outcome.attrDamage} prosperity:${outcome.prosperityDamage})`,
						data: { monsterId: m.id, kind: m.kind, ...outcome },
					});
				}
				// Self-damage equal to damage dealt (monsters wear down while attacking)
				const beforeHp = m.hp;
				m.hp = Math.max(0, (m.hp || 0) - totalDamage);
				if (m.hp !== beforeHp) {
					changed = true;
					console.log(`[Monsters] Attack: ${m.id} self-damaged ${beforeHp - m.hp}, hp ${beforeHp}→${m.hp}`);
					if (m.hp <= 0) {
						// Remove from list when defeated at the walls
						monsters = monsters.filter((mm) => mm.id !== m.id);
						await this.addEvent({
							type: 'monster_killed',
							message: `${m.kind} died while attacking the town`,
							data: { id: m.id, kind: m.kind },
						});
					}
				}
			}

			// Persist monster HP updates if any
			if (changed) {
				await this.setStoredMonsters(monsters);
			}

			if (townChanged || changed) {
				if (townChanged) {
					await this.setTownState(town);
				}
await this.broadcastWorldStateUpdate();
				await this.broadcastLeaderboardsUpdate();
				console.log(`[Monsters] Attack: ${townChanged ? 'town state updated' : ''} ${changed ? 'monsters updated' : ''}`.trim());
			} else {
				console.log('[Monsters] Attack: no town changes');
			}
			await this.ctx.storage.put('lastMonsterAttackAt', now.toISOString());
			return townChanged || changed;
		} catch (e) {
			console.error('[GameDO] monsterAttackTick error', e);
			return false;
		}
	}

	private applyTownDamage(
		town: TownState,
		amount: number,
	): { changed: boolean; wallsDamage: number; attrDamage: number; prosperityDamage: number } {
		let remaining = Math.max(0, amount);
		let changed = false;
		let wallsDamage = 0;
		let attrDamage = 0;
		let prosperityDamage = 0;

		// 1) Walls first
		const walls = town.attributes['perimeter_walls'];
		if (walls) {
			const hp = walls.hp ?? 0;
			if (hp > 0) {
				const d = Math.min(remaining, hp);
				walls.hp = hp - d;
				remaining -= d;
				wallsDamage += d;
				changed = true;
				if (walls.hp <= 0) {
					// depleted
					this.addEvent({ type: 'town_attribute_depleted', message: 'Perimeter walls depleted', data: { attribute: 'perimeter_walls' } });
				}
			}
		}

		// 2) Other attributes (currently vehicle_market) as conceptual HP buckets 500*level
		if (remaining > 0) {
			for (const key of Object.keys(town.attributes) as (keyof TownState['attributes'])[]) {
				if (key === 'perimeter_walls') {
					continue;
				}
				const attr = town.attributes[key];
				if (attr.level <= 0) {
					continue;
				}
				if (!attr.maxHp || attr.maxHp <= 0) {
					attr.maxHp = 500 * attr.level;
					attr.hp = attr.maxHp;
				}
				const aHp = attr.hp ?? 0;
				if (aHp > 0 && remaining > 0) {
					const d = Math.min(remaining, aHp);
					attr.hp = aHp - d;
					remaining -= d;
					attrDamage += d;
					changed = true;
					if (attr.hp <= 0) {
						this.addEvent({ type: 'town_attribute_depleted', message: `Town attribute depleted: ${key}`, data: { attribute: key } });
					}
				}
				if (remaining <= 0) {
					break;
				}
			}
		}

		// 3) Prosperity if still remaining
		if (remaining > 0) {
			const dP = 10 * Math.ceil(remaining / 50); // scale with remaining, keep base effect ~10 per tick
			const before = town.prosperity;
			town.prosperity = Math.max(0, before - dP);
			prosperityDamage = before - town.prosperity;
			if (prosperityDamage > 0) {
				changed = true;
			}
		}

		return { changed, wallsDamage, attrDamage, prosperityDamage };
	}

	private async maybeSpawnMonster(now: Date, _prosperity: number): Promise<boolean> {
		try {
			const monsters = await this.getStoredMonsters();
			if (monsters.length >= 3) {
				return false;
			}
			const lastSpawnIso = (await this.ctx.storage.get<string>('lastMonsterSpawnAt')) || '';
			const lastSpawn = lastSpawnIso ? new Date(lastSpawnIso) : new Date(0);
			const minsSince = (now.getTime() - lastSpawn.getTime()) / 60000;
			if (minsSince < 30) {
				return false;
			}

			// Spawn at radius [2400, 3500]
			const minR = 2400;
			const maxR = 3500;
			const theta = Math.random() * Math.PI * 2;
			const r = minR + Math.random() * (maxR - minR);
			const x = Math.round(r * Math.cos(theta));
			const y = Math.round(r * Math.sin(theta));
			const dist = this.distanceToTown(x, y);
			// Roll kind, speed, and HP from bands (no prosperity effect)
			const rolled = this.pickMonsterKindAndStats();
			const speed = rolled.speed; // units/min
			const hp = rolled.hp;
			const etaMins = dist / Math.max(1, speed);
			const eta = new Date(now.getTime() + Math.round(etaMins * 60000));

			const m: Monster = {
				id: `monster-${crypto.randomUUID()}`,
				kind: rolled.kind,
				coordinates: { x, y },
				hp,
				maxHp: hp,
				speed,
				state: 'traveling',
				spawnTime: now,
				etaToTown: eta,
			};

			monsters.push(m);
			await this.setStoredMonsters(monsters);
			await this.ctx.storage.put('lastMonsterSpawnAt', now.toISOString());

			await this.addEvent({
				type: 'monster_spawned',
				message: `${m.kind} spawned at (${x}, ${y}) with ${hp} HP`,
				data: { id: m.id, kind: m.kind, x, y, hp },
			});
			return true;
		} catch (e) {
			console.error('[GameDO] maybeSpawnMonster error', e);
			return false;
		}
	}

	// =============================================================================
	// Development/Testing
	// =============================================================================

	/**
	 * Reset all game data
	 */
	async reset(): Promise<{ success: boolean; error?: string }> {
		this.gameState.players.clear();
		this.gameState.notifications.clear();
		this.gameState.missions.clear();
		this.gameState.resourceNodes.clear();
		this.gameState.drifterProgress.clear();
		this.gameState.worldMetrics = {
			totalActiveMissions: 0,
			totalCompletedMissions: 0,
			economicActivity: 0,
			lastUpdate: new Date(),
		};

		await this.ctx.storage.deleteAll();
		await this.initializeResourceNodes();

		// Broadcast the reset state to all clients
		await this.broadcastWorldStateUpdate();

		return { success: true };
	}

	/**
	 * Clean up orphaned missions from all players
	 */
	async cleanupOrphanedMissions(): Promise<{ cleaned: number; playersAffected: string[] }> {
		console.log('[GameDO] Starting orphaned mission cleanup');
		let totalCleaned = 0;
		const playersAffected: string[] = [];

		for (const [address, player] of this.gameState.players) {
			const initialCount = player.activeMissions.length;
			const validMissions = player.activeMissions.filter((missionId) => this.gameState.missions.has(missionId));

			if (validMissions.length !== initialCount) {
				const cleaned = initialCount - validMissions.length;
				totalCleaned += cleaned;
				playersAffected.push(address);
				player.activeMissions = validMissions;
				console.log(`[GameDO] Cleaned ${cleaned} orphaned missions from player ${address}`);
			}
		}

		if (totalCleaned > 0) {
			await this.saveGameState();
			console.log(`[GameDO] Cleanup complete: removed ${totalCleaned} orphaned missions from ${playersAffected.length} players`);
		}

		return { cleaned: totalCleaned, playersAffected };
	}

	/**
	 * Get stats for debugging
	 */
	async getStats() {
		return {
			players: this.gameState.players.size,
			missions: this.gameState.missions.size,
			resourceNodes: this.gameState.resourceNodes.size,
			activeSessions: this.webSocketSessions.size,
			worldMetrics: this.gameState.worldMetrics,
		};
	}

	// =============================================================================
	// Durable Object fetch method
	// =============================================================================

	/**
	 * Handle incoming requests - WebSocket upgrades and API calls
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// Handle WebSocket upgrade requests
		if (request.headers.get('Upgrade') === 'websocket') {
			return this.handleWebSocketUpgrade(request);
		}

		// Handle API calls based on pathname
		switch (url.pathname) {
			case '/profile':
				return this.handleProfileRequest(request);
			case '/missions':
				return this.handleMissionsRequest(request);
			case '/notifications':
				return this.handleNotificationsRequest(request);
			case '/resources':
				return this.handleResourcesRequest(request);
			case '/stats':
				return this.handleStatsRequest(request);
			case '/vehicles/purchase':
				return this.handlePurchaseVehicleRequest(request);
			case '/logs':
				return this.handleLogsRequest(request);
			default:
				return new Response('Not found', { status: 404 });
		}
	}

	/**
	 * Handle WebSocket upgrade request
	 */
	private handleWebSocketUpgrade(_request: Request): Response {
		const [client, server] = Object.values(new WebSocketPair());
		const sessionId = crypto.randomUUID();

		// Accept the WebSocket connection
		server.accept();

		// Create session (initially unauthenticated)
		const session: WebSocketSession = {
			websocket: server,
			sessionId,
			authenticated: false,
			lastPing: Date.now(),
		};

		this.webSocketSessions.set(sessionId, session);
		console.log(`[GameDO] New WebSocket session created: ${sessionId}`);

		// Set up event handlers
		server.addEventListener('message', (event) => {
			this.handleWebSocketMessage(sessionId, event);
		});

		server.addEventListener('close', () => {
			this.cleanupSession(sessionId);
			console.log(`[GameDO] WebSocket session closed: ${sessionId}`);
		});

		server.addEventListener('error', (error) => {
			console.error(`[GameDO] WebSocket error for session ${sessionId}:`, error);
			this.webSocketSessions.delete(sessionId);
		});

		// Send initial connection status
		this.sendToSession(sessionId, {
			type: 'connection_status',
			timestamp: new Date(),
			data: {
				status: 'connected',
				authenticated: false,
			},
		});

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	/**
	 * Handle WebSocket messages from clients
	 */
	private async handleWebSocketMessage(sessionId: string, event: MessageEvent) {
		const session = this.webSocketSessions.get(sessionId);
		if (!session) {
			return;
		}

		try {
			const message = JSON.parse(event.data as string);

			switch (message.type) {
				case 'authenticate':
					await this.handleWebSocketAuth(sessionId, message.playerAddress);
					break;

				case 'ping':
					session.lastPing = Date.now();
					this.sendToSession(sessionId, {
						type: 'pong',
						timestamp: new Date(),
					});
					break;

				case 'subscribe':
					if (session.authenticated && session.playerAddress) {
						// Send initial state
						await this.sendPlayerStateUpdate(sessionId, session.playerAddress);
						await this.sendWorldStateUpdate(sessionId);

						this.sendToSession(sessionId, {
							type: 'subscription_confirmed',
							timestamp: new Date(),
							data: { events: message.events || ['player_state', 'world_state'] },
						});
					}
					break;

				case 'notification_ack':
					if (session.authenticated && message.data?.notificationIds) {
						this.handleNotificationAck(sessionId, message.data.notificationIds);
					}
					break;

				default:
					this.sendToSession(sessionId, {
						type: 'error',
						timestamp: new Date(),
						data: { message: `Unknown message type: ${message.type}` },
					});
			}
		} catch (error) {
			console.error(`[GameDO] Error handling WebSocket message:`, error);
			this.sendToSession(sessionId, {
				type: 'error',
				timestamp: new Date(),
				data: { message: 'Invalid message format' },
			});
		}
	}

	/**
	 * Handle WebSocket authentication
	 */
	private async handleWebSocketAuth(sessionId: string, playerAddress: string) {
		const session = this.webSocketSessions.get(sessionId);
		if (!session) {
			return;
		}

		if (playerAddress && typeof playerAddress === 'string') {
			session.playerAddress = playerAddress;
			session.authenticated = true;

			console.log(`[GameDO] WebSocket session ${sessionId} authenticated for player ${playerAddress}`);

			// Clear any stale queued notifications (don't replay old notifications on refresh)
			if (this.playerReplayQueues.has(playerAddress)) {
				const queueSize = this.playerReplayQueues.get(playerAddress)!.length;
				console.log(`[GameDO] Clearing ${queueSize} stale notifications from replay queue for player ${playerAddress}`);
				this.playerReplayQueues.delete(playerAddress);
			}

			this.sendToSession(sessionId, {
				type: 'connection_status',
				timestamp: new Date(),
				data: {
					status: 'connected',
					authenticated: true,
				},
			});
		} else {
			this.sendToSession(sessionId, {
				type: 'connection_status',
				timestamp: new Date(),
				data: {
					status: 'connected',
					authenticated: false,
					error: 'Invalid player address',
				},
			});
		}
	}

	/**
	 * Handle API requests that were previously handled separately
	 */
	private async handleProfileRequest(_request: Request): Promise<Response> {
		// Implementation for profile requests
		// This would handle the same logic as the existing API routes
		return new Response('Profile API - implement as needed', { status: 200 });
	}

	private async handleMissionsRequest(_request: Request): Promise<Response> {
		// Implementation for mission requests
		return new Response('Missions API - implement as needed', { status: 200 });
	}

	private async handleNotificationsRequest(_request: Request): Promise<Response> {
		// Implementation for notifications requests
		return new Response('Notifications API - implement as needed', { status: 200 });
	}

	private async handleResourcesRequest(_request: Request): Promise<Response> {
		// Implementation for resources requests
		return new Response('Resources API - implement as needed', { status: 200 });
	}

	private async handleStatsRequest(_request: Request): Promise<Response> {
		const stats = await this.getStats();
		return new Response(JSON.stringify(stats), {
			headers: { 'Content-Type': 'application/json' },
		});
	}

	private async handleLogsRequest(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const limitParam = url.searchParams.get('limit');
		let limit = Number(limitParam ?? 0);
		if (!Number.isFinite(limit) || limit <= 0) {
			limit = 1000;
		}
		const events = this.gameState.eventLog.slice(-limit).reverse();
		return new Response(JSON.stringify({ events }), {
			headers: { 'Content-Type': 'application/json' },
		});
	}

	private async handlePurchaseVehicleRequest(request: Request): Promise<Response> {
		const { playerAddress, vehicle } = await request.json();
		const result = await this.purchaseVehicle(playerAddress, vehicle);
		if (result.success) {
			return new Response(JSON.stringify(result), { status: 200 });
		} else {
			return new Response(JSON.stringify(result), { status: 400 });
		}
	}

	// =============================================================================
	// Notification Tracking System
	// =============================================================================

	/**
	 * Handle notification acknowledgment from client
	 */
	private handleNotificationAck(sessionId: string, notificationIds: string[]) {
		console.log(`[GameDO] Received ACK from session ${sessionId} for notifications:`, notificationIds);

		const pendingSet = this.pendingNotifications.get(sessionId);
		if (!pendingSet) {
			console.log(`[GameDO] No pending notifications found for session ${sessionId}`);
			return;
		}

		// Remove acknowledged notifications from pending set
		for (const notifId of notificationIds) {
			if (pendingSet.has(notifId)) {
				pendingSet.delete(notifId);
				console.log(`[GameDO] Removed notification ${notifId} from pending for session ${sessionId}`);
			}
		}

		// Clean up empty pending set
		if (pendingSet.size === 0) {
			this.pendingNotifications.delete(sessionId);
		}
	}

	/**
	 * Send notification with delivery tracking
	 */
	private sendNotificationToSession(sessionId: string, notification: PendingNotification) {
		const session = this.webSocketSessions.get(sessionId);
		if (!session || session.websocket.readyState !== WebSocket.READY_STATE_OPEN) {
			console.log(`[GameDO] Session ${sessionId} not available, adding to replay queue`);
			// Add to replay queue if session not available
			if (session?.playerAddress) {
				this.addToReplayQueue(session.playerAddress, notification);
			}
			return;
		}

		// Track as pending
		if (!this.pendingNotifications.has(sessionId)) {
			this.pendingNotifications.set(sessionId, new Set());
		}
		this.pendingNotifications.get(sessionId)!.add(notification.id);

		// Send the notification
		const message = {
			type: 'notification',
			timestamp: new Date(),
			data: notification,
		};

		session.websocket.send(JSON.stringify(message));
		console.log(`[GameDO] Sent notification ${notification.id} to session ${sessionId} (pending ACK)`);
	}

	/**
	 * Add notification to player's replay queue for later delivery
	 */
	private addToReplayQueue(playerAddress: string, notification: PendingNotification) {
		if (!this.playerReplayQueues.has(playerAddress)) {
			this.playerReplayQueues.set(playerAddress, []);
		}

		const queue = this.playerReplayQueues.get(playerAddress)!;
		queue.push(notification);

		// Keep queue size manageable
		if (queue.length > 10) {
			queue.shift(); // Remove oldest
		}

		console.log(`[GameDO] Added notification ${notification.id} to replay queue for player ${playerAddress}`);
	}

	/**
	 * Send any queued notifications to newly connected session
	 */
	private async sendQueuedNotifications(sessionId: string, playerAddress: string) {
		const queue = this.playerReplayQueues.get(playerAddress);
		if (!queue || queue.length === 0) {
			return;
		}

		console.log(`[GameDO] Replaying ${queue.length} queued notifications to session ${sessionId}`);

		// Send all queued notifications
		for (const notification of queue) {
			this.sendNotificationToSession(sessionId, notification);
		}

		// Clear the queue since we've sent them
		this.playerReplayQueues.delete(playerAddress);
	}

	/**
	 * Clean up session data when WebSocket closes
	 */
	private cleanupSession(sessionId: string) {
		const session = this.webSocketSessions.get(sessionId);
		if (!session) {
			return;
		}

		// Log pending notifications but DON'T move them back to replay queue
		// Browser refreshes and normal disconnects should not replay notifications
		const pendingSet = this.pendingNotifications.get(sessionId);
		if (pendingSet && pendingSet.size > 0) {
			console.log(
				`[GameDO] Session ${sessionId} closed with ${pendingSet.size} pending notifications. These will be discarded (normal for browser refresh).`,
			);
		}

		// Clean up tracking maps
		this.pendingNotifications.delete(sessionId);
		this.webSocketSessions.delete(sessionId);
	}
}
