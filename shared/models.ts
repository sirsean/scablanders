// Core game enums
export type ResourceType = 'ore' | 'scrap' | 'organic';

// Deprecated enum - replaced with type for simplicity
// export enum ResourceType {
//   COE_KOPUM_ORE = 'coe_kopum_ore',
//   RANCH_MILK = 'ranch_milk',
//   SCRAP_METAL = 'scrap_metal',
//   ORGANIC_MATTER = 'organic_matter',
//   WATER = 'water',
//   TECH_COMPONENTS = 'tech_components',
// }

export enum MissionStatus {
	ACTIVE = 'active',
	COMPLETED = 'completed',
	INTERCEPTED = 'intercepted',
	FAILED = 'failed',
}

export type UpgradeType =
	| 'speed-boost-1'
	| 'speed-boost-2'
	| 'speed-boost-3'
	| 'yield-boost-1'
	| 'yield-boost-2'
	| 'yield-boost-3'
	| 'capacity-boost-1'
	| 'capacity-boost-2'
	| 'capacity-boost-3'
	| 'combat-training-1'
	| 'combat-training-2'
	| 'combat-training-3'
	| 'scavenging-expertise-1'
	| 'scavenging-expertise-2'
	| 'scavenging-expertise-3'
	| 'tech-upgrade-1'
	| 'tech-upgrade-2'
	| 'tech-upgrade-3';

// Deprecated enum - replaced with type for more flexibility
// export enum UpgradeType {
//   SPEED_BOOST_1 = 'speed_boost_1',
//   SPEED_BOOST_2 = 'speed_boost_2',
//   SPEED_BOOST_3 = 'speed_boost_3',
//   YIELD_BOOST_1 = 'yield_boost_1',
//   YIELD_BOOST_2 = 'yield_boost_2',
//   CAPACITY_BOOST_1 = 'capacity_boost_1',
//   CAPACITY_BOOST_2 = 'capacity_boost_2',
// }

// Core game interfaces
export interface DrifterBonuses {
	combat: number;
	scavenging: number;
	tech: number;
	speed: number;
}

export interface DrifterProgress {
	tokenId: number;
	xp: number;
	level: number;
	bonuses: DrifterBonuses;
	unspentPoints: number;
}

export interface PlayerProfile {
	address: string;
	balance: number;
	ownedDrifters: DrifterProfile[];
	vehicles: PlayerVehicle[];
	discoveredNodes: string[];
	upgrades: UpgradeType[];
	activeMissions: string[];
	lastLogin: Date;
	drifterProgress?: Record<string, DrifterProgress>;
}

export interface PlayerVehicle {
	instanceId: string;
	vehicleId: string;
	status: 'idle' | 'on_mission';
}

export interface Vehicle {
	id: string;
	name: string;
	description: string;
	speed: number; // Same unit as Drifter speed; higher = faster. Typical range: 10–100.
	combat: number; // Same unit scale as drifters; contributes to team combat
	scavenging: number; // Same unit scale as drifters; contributes to team scavenging
	tech: number; // Same unit scale as drifters; contributes to team tech
	maxDrifters: number;
	maxCargo: number;
	cost: number;
}

export interface DrifterProfile {
	tokenId: number;
	name: string;
	imageUrl: string;
	combat: number;
	scavenging: number;
	tech: number;
	speed: number;
	hireCost: number;
	isAvailable: boolean;
	specialTrait?: string;
}

export interface Mission {
	id: string;
	type: MissionType;
	playerAddress: string;
	drifterIds: number[];
	vehicleInstanceId: string | null;
	targetNodeId: string;
	startTime: Date;
	completionTime: Date;
	status: 'active' | 'completed' | 'intercepted' | 'failed';
	rewards: {
		credits: number;
		resources: { [resourceType: string]: number };
	};
}

export type MissionType = 'scavenge' | 'strip_mine' | 'combat' | 'sabotage';

export interface ResourceNode {
	id: string;
	type: ResourceType;
	coordinates: { x: number; y: number };
	baseYield: number;
	currentYield: number;
	depletion: number;
	rarity: Rarity;
	discoveredBy: string[];
	lastHarvested: Date;
	isActive: boolean;
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface BattleResult {
	winner: 'defender' | 'attacker';
	defenderLosses: number;
	attackerLosses: number;
	lootTransferred: number;
	combatLog: string[];
}

export interface Upgrade {
	id: UpgradeType;
	name: string;
	description: string;
	cost: number;
	effect: UpgradeEffect;
}

export interface UpgradeEffect {
	speedMultiplier?: number;
	yieldMultiplier?: number;
	capacityIncrease?: number;
}

export type GameEventType =
	| 'mission_started'
	| 'mission_complete'
	| 'mission_intercepted'
	| 'mission_failed'
	| 'node_spawned'
	| 'resource_depleted'
	| 'node_removed'
	| 'town_upgrade';

export interface GameEvent {
	id: string;
	type: GameEventType;
	timestamp: Date;
	playerAddress?: string;
	missionId?: string;
	nodeId?: string;
	resourceType?: ResourceType;
	drifterIds?: number[];
	vehicleName?: string;
	rarity?: Rarity;
	message: string;
	data?: any;
}

// API Request/Response types
export interface AuthNonceResponse {
	nonce: string;
	message: string;
}

export interface AuthVerifyRequest {
	message: string;
	signature: string;
}

export interface AuthVerifyResponse {
	success: boolean;
	address?: string;
	error?: string;
}

export interface StartMissionRequest {
	playerAddress: string;
	drifterIds: number[];
	targetNodeId: string;
	vehicleInstanceId?: string | null;
}

export interface StartMissionResponse {
	success: boolean;
	mission?: Mission;
	estimatedDuration?: number;
	error?: string;
}

export interface InterceptMissionRequest {
	attackerAddress: string;
	targetMissionId: string;
	banditIds: number[];
}

export interface InterceptMissionResponse {
	success: boolean;
	mission?: Mission;
	error?: string;
}

// World state types
export interface WorldState {
	resources: ResourceNode[];
	activeMissions: Mission[];
	townMetrics: TownMetrics;
	lastUpdate: Date;
}

export interface TownMetrics {
	prosperity: number;
	security: number;
	population: number;
	upgradeLevel: number;
}

// Constants
export const FRINGE_DRIFTERS_CONTRACT = '0x1234567890123456789012345678901234567890'; // TODO: Replace with actual contract address

export const DEFAULT_HIRE_COST = 50;
export const BASE_MISSION_SPEED = 100; // pixels per minute
export const INTERCEPT_BASE_COST = 25;

// Notification system
export interface NotificationMessage {
	id: string;
	type: 'mission_complete' | 'mission_intercepted' | 'resource_depleted' | 'upgrade_purchased' | 'drifter_level_up';
	title: string;
	message: string;
	timestamp: Date;
	read?: boolean;
	data?: any;
}

// Mission results
export interface MissionResult {
	success: boolean;
	error?: string;
	type?: 'scavenge' | 'combat';
	winner?: string;
	loser?: string;
	lootAmount?: number;
	nodeId?: string;
	resourceType?: ResourceType;
	combatDetails?: {
		scavengerCombat: number;
		interceptorCombat: number;
	};
}

// Economy models
export interface UpgradePurchaseRequest {
	playerAddress: string;
	upgradeType: UpgradeType;
}

export interface UpgradePurchaseResponse {
	success: boolean;
	newBalance?: number;
	error?: string;
}

// WebSocket message types
export interface WebSocketMessage {
	type: string;
	timestamp: Date;
	data?: any;
}

export interface PlayerStateUpdate extends WebSocketMessage {
	type: 'player_state';
	data: {
		profile: PlayerProfile;
		balance: number;
		activeMissions: string[];
		discoveredNodes: string[];
		notifications: NotificationMessage[];
	};
}

export interface WorldStateUpdate extends WebSocketMessage {
	type: 'world_state';
	data: {
		resourceNodes: ResourceNode[];
		missions: Mission[];
		worldMetrics: {
			totalActiveMissions: number;
			totalCompletedMissions: number;
			economicActivity: number;
			lastUpdate: Date;
		};
	};
}

export interface EventLogAppend extends WebSocketMessage {
	type: 'event_log_append';
	data: {
		event: GameEvent;
	};
}

export interface EventLogSnapshot extends WebSocketMessage {
	type: 'event_log_snapshot';
	data: {
		events: GameEvent[];
	};
}

export interface MissionUpdate extends WebSocketMessage {
	type: 'mission_update';
	data: {
		mission: Mission;
		isComplete?: boolean;
		reward?: number;
	};
}

export interface ConnectionStatusUpdate extends WebSocketMessage {
	type: 'connection_status';
	data: {
		status: 'connected' | 'disconnected' | 'reconnecting';
		authenticated: boolean;
	};
}

export interface NotificationAck extends WebSocketMessage {
	type: 'notification_ack';
	data: {
		notificationIds: string[];
	};
}

export type GameWebSocketMessage =
	| PlayerStateUpdate
	| WorldStateUpdate
	| MissionUpdate
	| ConnectionStatusUpdate
	| NotificationAck
	| EventLogAppend
	| EventLogSnapshot;

// Utility types
export type Coordinates = {
	x: number;
	y: number;
};

export type Distance = number;

// Validation helpers (will be used with Zod)
export const isValidAddress = (address: string): boolean => {
	return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const isValidTokenId = (tokenId: number): boolean => {
	return Number.isInteger(tokenId) && tokenId >= 0 && tokenId <= 10000;
};
