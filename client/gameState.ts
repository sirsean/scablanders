import type { PlayerProfile, Mission, DrifterProfile, ResourceNode, Vehicle, GameEvent, TownState, Monster } from '@shared/models';
import type { LeaderboardsResponse } from '@shared/leaderboards';
import { auth } from './auth';
import { webSocketManager } from './websocketManager';
import type { PlayerStateUpdate, WorldStateUpdate } from '@shared/models';

export interface GameState {
	// Authentication
	isAuthenticated: boolean;
	playerAddress: string | null;

	// Player data
	profile: PlayerProfile | null;
	ownedDrifters: DrifterProfile[];
	playerMissions: Mission[]; // Player's specific missions

	// World data
	resourceNodes: ResourceNode[];
	activeMissions: Mission[]; // All active missions (for map display)
	monsters: Monster[]; // Active monsters moving/attacking
	town: TownState | null;
	worldMetrics: {
		totalActiveMissions: number;
		totalCompletedMissions: number;
		economicActivity: number;
		lastUpdate: Date;
	} | null;

	// Market data
	availableVehicles: Vehicle[];

	// Connection state
	wsConnected: boolean;
	wsAuthenticated: boolean;
	wsReconnectAttempts: number;
	connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
	realTimeMode: boolean; // Whether updates come from WebSocket or polling

	// UI state
	selectedResourceNode: string | null;
	selectedDrifterIds: number[];
	selectedMissionType: string | null;
	selectedVehicleInstanceId: string | null;
	selectedTargetMonsterId: string | null;
	drifterSortBy: 'combat' | 'scavenging' | 'tech' | 'speed';
	showMissionPanel: boolean;
	showDriftersPanel: boolean;
	showProfilePanel: boolean;
	showActiveMissionsPanel: boolean;
	showMarketPanel: boolean;
	showVehiclePanel: boolean;
	showTownPanel: boolean;
showLogPanel: boolean;
showLeaderboardsPanel: boolean;
notifications: GameNotification[];
// Logs
 eventLog: GameEvent[];

 // Leaderboards
 leaderboards: LeaderboardsResponse | null;
 leaderboardsLoadedAt: number | null;
 isLoadingLeaderboards: boolean;

 // Loading states
 isLoadingProfile: boolean;
 isLoadingWorld: boolean;
 isLoadingPlayerMissions: boolean;
 isLoadingMarket: boolean;
}

export interface GameNotification {
	id: string;
	type: 'success' | 'error' | 'info' | 'mission' | 'combat';
	title: string;
	message: string;
	timestamp: Date;
	duration?: number; // ms, defaults to 5000
}

class GameStateManager extends EventTarget {
	private state: GameState = {
		isAuthenticated: false,
		playerAddress: null,
		profile: null,
		ownedDrifters: [],
		playerMissions: [],
		resourceNodes: [],
		activeMissions: [],
		monsters: [],
		town: null,
		worldMetrics: null,
		availableVehicles: [],
		wsConnected: false,
		wsAuthenticated: false,
		wsReconnectAttempts: 0,
		connectionStatus: 'disconnected',
		realTimeMode: false,
		selectedResourceNode: null,
		selectedDrifterIds: [],
		selectedMissionType: null,
		selectedVehicleInstanceId: null,
		selectedTargetMonsterId: null,
		drifterSortBy: 'combat',
		showMissionPanel: false,
		showDriftersPanel: false,
		showProfilePanel: false,
		showActiveMissionsPanel: false,
		showMarketPanel: false,
		showVehiclePanel: false,
		showTownPanel: false,
showLogPanel: false,
	showLeaderboardsPanel: false,
	notifications: [],
	eventLog: [],
	leaderboards: null,
	leaderboardsLoadedAt: null,
	isLoadingLeaderboards: false,
	isLoadingProfile: false,
	isLoadingWorld: false,
	isLoadingPlayerMissions: false,
	isLoadingMarket: false,
	};

	constructor() {
		super();
		this.setupAuthListener();
		this.setupWebSocketListeners();
		this.startPeriodicUpdates();
	}

	getState(): GameState {
		return { ...this.state };
	}

	private setState(updates: Partial<GameState>) {
		const oldState = { ...this.state };
		this.state = { ...this.state, ...updates };

		// Emit state change event
		this.dispatchEvent(
			new CustomEvent('statechange', {
				detail: { oldState, newState: this.state },
			}),
		);
	}

	private setupAuthListener() {
		auth.onStateChange((authState) => {
			this.setState({
				isAuthenticated: authState.isAuthenticated,
				playerAddress: authState.address,
			});

			if (authState.isAuthenticated && authState.address) {
				// Load player data when authenticated
				this.loadPlayerProfile();
				this.loadWorldState();
				this.loadPlayerMissions();
				this.loadMarketVehicles();

				// Connect WebSocket for real-time updates
				this.connectWebSocket();
			} else {
				// Clear data when not authenticated
				this.setState({
					profile: null,
					ownedDrifters: [],
					activeMissions: [],
					playerMissions: [],
				});

				// Disconnect WebSocket
				this.disconnectWebSocket();
			}
		});
	}

	private setupWebSocketListeners() {
		console.log('[GameState] Setting up WebSocket listeners');

		// Listen for connection status changes
		webSocketManager.addEventListener('connectionStatus', (event) => {
			const { status, authenticated } = event.detail;
			console.log('[GameState] WebSocket connection status changed:', { status, authenticated });

			// Capture previous WS auth state to detect downgrades
			const prevWsConnected = this.state.wsConnected;
			const prevWsAuthenticated = this.state.wsAuthenticated;
			const prevConnectionStatus = this.state.connectionStatus;

			this.setState({
				connectionStatus: status,
				wsConnected: status === 'connected',
				wsAuthenticated: authenticated || false,
			});

			// Only force logout if the socket was previously authenticated while connected
			// and then reports connected but unauthenticated (auth downgrade).
			const downgradedAuth =
				prevConnectionStatus === 'connected' && prevWsConnected && prevWsAuthenticated && status === 'connected' && !authenticated;
			if (this.state.isAuthenticated && downgradedAuth) {
				this.addNotification({
					type: 'info',
					title: 'Session Expired',
					message: 'Please reconnect to continue.',
				});
				// Best-effort disconnect; listeners will cascade UI changes and data clears
				auth.disconnect();
			}

			if (status === 'connected') {
				this.setState({
					realTimeMode: true,
					wsReconnectAttempts: 0,
				});

				// Authenticate the WebSocket if we have a player address and aren't already authenticated
				if (!authenticated && this.state.playerAddress) {
					console.log('[GameState] Authenticating WebSocket with player address:', this.state.playerAddress);
					webSocketManager.authenticate(this.state.playerAddress);
				}

				// Subscribe to events once authenticated
				if (authenticated) {
					console.log('[GameState] WebSocket authenticated, subscribing to events');
webSocketManager.subscribe([
						'player_state',
						'world_state',
						'mission_update',
						'event_log_append',
						'event_log_snapshot',
						'notification',
						'leaderboards_update',
					]);
					// Initial sync of event log
					this.syncEventLog();
				}

				this.addNotification({
					type: 'success',
					title: 'Real-time Connected',
					message: authenticated ? 'WebSocket authenticated' : 'WebSocket connected',
					duration: 3000,
				});
			} else if (status === 'reconnecting') {
				this.setState({
					wsReconnectAttempts: this.state.wsReconnectAttempts + 1,
				});
			} else if (status === 'disconnected') {
				this.setState({
					realTimeMode: false,
				});
				this.addNotification({
					type: 'info',
					title: 'Connection Lost',
					message: 'Switched to periodic updates',
					duration: 3000,
				});
			}
		});

		// Listen for player state updates
		webSocketManager.addEventListener('playerStateUpdate', (event) => {
			const update = event.detail as PlayerStateUpdate['data'];
			console.log('[GameState] Received player state update:', update);

			if (update.profile) {
				console.log('[GameState] Updating profile from WebSocket:', update.profile);
				this.setState({ profile: update.profile });
			}

			// NOTE: Persistent notifications are handled separately and should NOT be displayed as toast notifications
			// The real-time notification system (WebSocket 'notification' events) handles toast notifications
			// Persistent notifications in update.notifications are for historical/UI purposes only
		});

		// Listen for world state updates
		webSocketManager.addEventListener('worldStateUpdate', (event) => {
			const update = event.detail as WorldStateUpdate['data'];
			console.log('[GameState] Received world state update:', update);

			if (update.resourceNodes) {
				console.log('[GameState] Updating resource nodes from WebSocket:', update.resourceNodes);
				this.setState({ resourceNodes: update.resourceNodes });
			}

			if (update.monsters) {
				console.log('[GameState] Updating monsters from WebSocket:', update.monsters);
				const filtered = (update.monsters || []).filter((m: any) => m && m.state !== 'dead');
				this.setState({ monsters: filtered });
			}

			if (update.town) {
				console.log('[GameState] Updating town from WebSocket:', update.town);
				this.setState({ town: update.town });
			}

			if (update.missions) {
				console.log('[GameState] Updating missions from WebSocket:', update.missions);
				this.setState({ activeMissions: update.missions });
			}

			if (update.worldMetrics) {
				console.log('[GameState] Updating world metrics from WebSocket:', update.worldMetrics);
				this.setState({ worldMetrics: update.worldMetrics });
			}
		});

		// Listen for mission updates
		webSocketManager.addEventListener('missionUpdate', (event) => {
			const update = event.detail; // This is the data field from the WebSocket message
			console.log('[GameState] Received mission update:', update);

			// Update specific mission in player missions
			if (update.mission && this.state.playerMissions) {
				const updatedPlayerMissions = this.state.playerMissions.map((mission) =>
					mission.id === update.mission.id ? update.mission : mission,
				);
				this.setState({ playerMissions: updatedPlayerMissions });
			}

			// Update specific mission in active missions
			if (update.mission && this.state.activeMissions) {
				const updatedActiveMissions = this.state.activeMissions.map((mission) =>
					mission.id === update.mission.id ? update.mission : mission,
				);
				this.setState({ activeMissions: updatedActiveMissions });
			}

			if (update.notification) {
				// Use new notification system with ACK
				this.handleServerNotification({
					id: crypto.randomUUID(),
					type: update.notification.type as any,
					title: update.notification.title,
					message: update.notification.message,
				});
			}
		});

// Listen for leaderboards updates
		webSocketManager.addEventListener('leaderboardsUpdate', (event: any) => {
			try {
				const boards = event.detail;
				this.setState({ leaderboards: boards, leaderboardsLoadedAt: Date.now(), isLoadingLeaderboards: false });
			} catch (e) {
				console.warn('[GameState] Failed processing leaderboardsUpdate', e);
			}
		});

		// Listen for event log append messages
		webSocketManager.addEventListener('eventLogAppend', (event: any) => {
			const data = event.detail as { event: GameEvent };
			const ev = { ...data.event, timestamp: new Date(data.event.timestamp) } as GameEvent;
			const updated = [ev, ...this.state.eventLog].slice(0, 1000);
			this.setState({ eventLog: updated });
		});

		// Listen for event log snapshot messages (if server emits them)
		webSocketManager.addEventListener('eventLogSnapshot', (event: any) => {
			try {
				const data = event.detail as { events?: GameEvent[] };
				const events = (data?.events || []).map((e: any) => ({ ...e, timestamp: new Date(e.timestamp) }) as GameEvent);
				this.setState({ eventLog: events });
			} catch (e) {
				console.error('[GameState] Failed to process eventLogSnapshot:', e);
			}
		});

		// Listen for direct notifications from server
		webSocketManager.addEventListener('notification', (event) => {
			const notification = event.detail; // This is the notification data from the server
			console.log('[GameState] Received server notification:', notification);

			// Use server notification system with ACK
			this.handleServerNotification({
				id: notification.id,
				type: notification.type as any,
				title: notification.title,
				message: notification.message,
			});
		});
	}

	// WebSocket connection management
	async connectWebSocket() {
		if (!this.state.isAuthenticated) {
			console.warn('Cannot connect WebSocket: not authenticated');
			return;
		}

		this.setState({ connectionStatus: 'connecting' });

		try {
			await webSocketManager.connect();
		} catch (error) {
			console.error('WebSocket connection failed:', error);
			this.setState({ connectionStatus: 'disconnected' });
		}
	}

	disconnectWebSocket() {
		webSocketManager.disconnect();
		this.setState({
			wsConnected: false,
			wsAuthenticated: false,
			connectionStatus: 'disconnected',
			realTimeMode: false,
			wsReconnectAttempts: 0,
		});
	}

	// API calls with error handling
	private async apiCall(endpoint: string, options?: RequestInit): Promise<Response> {
		try {
			const response = await fetch(`/api${endpoint}`, {
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					...options?.headers,
				},
				...options,
			});

			if (!response.ok) {
				// Handle session expiry explicitly
				if (response.status === 401) {
					// Only trigger logout if we currently believe we're authenticated
					if (this.state.isAuthenticated) {
						this.addNotification({
							type: 'info',
							title: 'Session Expired',
							message: 'Please reconnect to continue.',
						});
						try {
							await auth.disconnect();
						} catch {}
						const err: any = new Error('Unauthorized');
						err.__handled = true; // skip generic error toast in catch
						throw err;
					}
					// If we already consider ourselves logged out, just throw without extra toast
					throw new Error('Unauthorized');
				}

				const error = await response.json().catch(() => ({ error: 'Network error' }));
				throw new Error(error.error || `HTTP ${response.status}`);
			}

			return response;
		} catch (error: any) {
			console.error(`API call failed for ${endpoint}:`, error);
			// Avoid duplicate toast for explicitly handled cases (e.g., 401)
			if (!error?.__handled) {
				this.addNotification({
					type: 'error',
					title: 'Network Error',
					message: `Failed to ${endpoint}: ${error.message}`,
				});
			}
			throw error;
		}
	}

	async loadPlayerProfile() {
		if (this.state.isLoadingProfile) {
			return;
		}

		this.setState({ isLoadingProfile: true });

		try {
			const response = await this.apiCall('/profile');
			const profile = await response.json();

			this.setState({
				profile,
				ownedDrifters: profile.ownedDrifters || [],
				isLoadingProfile: false,
			});
		} catch {
			this.setState({ isLoadingProfile: false });
		}
	}

	async loadWorldState() {
		if (this.state.isLoadingWorld) {
			return;
		}

		this.setState({ isLoadingWorld: true });

		try {
			const response = await this.apiCall('/world/state');
			const data = await response.json();

			this.setState({
				resourceNodes: data.resourceNodes || [],
				activeMissions: data.activeMissions || [],
				monsters: (data.monsters || []).filter((m: any) => m && m.state !== 'dead'),
				town: data.town || null,
				worldMetrics: data.worldMetrics || null,
				isLoadingWorld: false,
			});
		} catch {
			this.setState({ isLoadingWorld: false });
		}
	}

	async loadMarketVehicles() {
		if (this.state.isLoadingMarket) {
			return;
		}

		this.setState({ isLoadingMarket: true });

		try {
			const response = await this.apiCall('/market/vehicles');
			const data = await response.json();

			this.setState({
				availableVehicles: data.vehicles || [],
				isLoadingMarket: false,
			});
		} catch {
			this.setState({ isLoadingMarket: false });
		}
	}

	// Mission operations
	async startMonsterCombatMission(drifterIds: number[], monsterId: string, vehicleInstanceId?: string | null) {
		try {
			const response = await this.apiCall('/missions/start', {
				method: 'POST',
				body: JSON.stringify({
					drifterIds,
					missionType: 'combat',
					targetMonsterId: monsterId,
					vehicleInstanceId: vehicleInstanceId ?? null,
				}),
			});
			const result = await response.json();
			if (result.success) {
				this.addNotification({
					type: 'mission',
					title: 'Combat Mission Started!',
					message: `Engaging monster with ${drifterIds.length} drifter(s)`,
				});
				await this.loadWorldState();
				await this.loadPlayerProfile();
				await this.loadPlayerMissions();
			}
			return result;
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	}

	async startMission(
		drifterIds: number[],
		targetId: string,
		missionType: 'scavenge' | 'strip_mine' | 'combat' | 'sabotage',
		vehicleInstanceId?: string | null,
	) {
		try {
			const response = await this.apiCall('/missions/start', {
				method: 'POST',
				body: JSON.stringify({
					drifterIds,
					targetNodeId: targetId,
					missionType,
					vehicleInstanceId: vehicleInstanceId ?? null,
				}),
			});

			const result = await response.json();

			if (result.success) {
				const teamText = drifterIds.length === 1 ? `Drifter #${drifterIds[0]}` : `${drifterIds.length} drifters`;
				this.addNotification({
					type: 'mission',
					title: 'Mission Started!',
					message: `${missionType.toUpperCase()} mission started with ${teamText}`,
				});

				// Refresh data
				await this.loadWorldState();
				await this.loadPlayerProfile();
				await this.loadPlayerMissions();
			}

			return result;
		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	async interceptMission(missionId: string, drifterId: number) {
		try {
			const response = await this.apiCall('/missions/intercept', {
				method: 'POST',
				body: JSON.stringify({
					missionId,
					drifterId,
				}),
			});

			const result = await response.json();

			if (result.success) {
				this.addNotification({
					type: 'combat',
					title: 'Intercept Started!',
					message: `Intercepting mission with Drifter #${drifterId}`,
				});

				// Refresh data
				await this.loadWorldState();
				await this.loadPlayerProfile();
			}

			return result;
		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	async purchaseVehicle(vehicleId: string) {
		try {
			const response = await this.apiCall('/market/vehicles/purchase', {
				method: 'POST',
				body: JSON.stringify({ vehicleId }),
			});

			const result = await response.json();

			if (result.success) {
				this.addNotification({
					type: 'success',
					title: 'Vehicle Purchased',
					message: `You have successfully purchased a new vehicle!`,
				});
				await this.loadPlayerProfile();
			} else {
				this.addNotification({
					type: 'error',
					title: 'Purchase Failed',
					message: result.error || 'Failed to purchase vehicle.',
				});
			}

			return result;
		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	// Allocation API
	async allocateDrifterPoint(tokenId: number, attribute: 'combat' | 'scavenging' | 'tech' | 'speed') {
		try {
			const response = await this.apiCall('/drifters/allocate-point', {
				method: 'POST',
				body: JSON.stringify({ tokenId, attribute }),
			});
			const result = await response.json();
			if (result.success) {
				this.addNotification({
					type: 'success',
					title: 'Point Allocated',
					message: `+1 ${attribute} to Drifter #${tokenId}`,
				});
				await this.loadPlayerProfile();
				return result.progress;
			} else {
				this.addNotification({
					type: 'error',
					title: 'Allocation Failed',
					message: result.error || 'Failed to allocate point.',
				});
				return null;
			}
		} catch {
			this.addNotification({
				type: 'error',
				title: 'Network Error',
				message: 'Failed to allocate point',
			});
			return null;
		}
	}

	// Maintenance utilities
	async reconcileVehicles() {
		try {
			const response = await this.apiCall('/missions/reconcile-vehicles', {
				method: 'POST',
			});
			const result = await response.json();
			if (result.success) {
				const resetCount = result.resetCount || 0;
				this.addNotification({
					type: 'success',
					title: 'Vehicles Reconciled',
					message: resetCount > 0 ? `Reset ${resetCount} stuck vehicle${resetCount === 1 ? '' : 's'} to idle.` : 'No stuck vehicles found.',
				});
				await this.loadPlayerProfile();
				await this.loadPlayerMissions();
			} else {
				this.addNotification({
					type: 'error',
					title: 'Reconcile Failed',
					message: result.error || 'Failed to reconcile vehicles.',
				});
			}
			return result;
		} catch (error) {
			this.addNotification({
				type: 'error',
				title: 'Network Error',
				message: `Failed to /missions/reconcile-vehicles: ${error.message}`,
			});
			return { success: false, error: error.message };
		}
	}

	// UI state management
	selectResourceNode(nodeId: string | null) {
		this.setState({ selectedResourceNode: nodeId });
	}

	toggleMissionPanel() {
		this.setState({ showMissionPanel: !this.state.showMissionPanel });
	}

	showMissionPanel() {
		this.setState({ showMissionPanel: true });
	}

	hideMissionPanel() {
		this.setState({ showMissionPanel: false });
	}

	toggleDriftersPanel() {
		this.setState({ showDriftersPanel: !this.state.showDriftersPanel });
	}

	toggleProfilePanel() {
		this.setState({ showProfilePanel: !this.state.showProfilePanel });
	}

	toggleActiveMissionsPanel() {
		this.setState({ showActiveMissionsPanel: !this.state.showActiveMissionsPanel });
	}

	toggleMarketPanel() {
		this.setState({ showMarketPanel: !this.state.showMarketPanel });
	}

	toggleVehiclePanel() {
		this.setState({ showVehiclePanel: !this.state.showVehiclePanel });
	}

	toggleTownPanel() {
		this.setState({ showTownPanel: !this.state.showTownPanel });
	}

	toggleLogPanel() {
		const willShow = !this.state.showLogPanel;
		this.setState({ showLogPanel: willShow });
		// When opening the Log panel, refresh the log snapshot once
		if (willShow) {
			// Best-effort refresh; live updates will append thereafter
			this.syncEventLog().catch((e) => console.warn('[GameState] syncEventLog on open failed:', e));
		}
}

// Leaderboards
async loadLeaderboards() {
	if (this.state.isLoadingLeaderboards) return;
	this.setState({ isLoadingLeaderboards: true });
	try {
		const response = await this.apiCall('/leaderboards');
		const data = (await response.json()) as LeaderboardsResponse;
		this.setState({ leaderboards: data, leaderboardsLoadedAt: Date.now(), isLoadingLeaderboards: false });
	} catch {
		this.setState({ isLoadingLeaderboards: false });
	}
}

toggleLeaderboardsPanel() {
	const willShow = !this.state.showLeaderboardsPanel;
	this.setState({ showLeaderboardsPanel: willShow });
	if (willShow) {
		const stale = !this.state.leaderboardsLoadedAt || Date.now() - this.state.leaderboardsLoadedAt > 30_000;
		if (!this.state.leaderboards || stale) {
			this.loadLeaderboards().catch(() => {});
		}
	}
}

// Multi-drifter selection management
	toggleDrifterSelection(drifterId: number) {
		const currentSelection = [...this.state.selectedDrifterIds];
		const index = currentSelection.indexOf(drifterId);

		if (index === -1) {
			// Add to selection
			currentSelection.push(drifterId);
		} else {
			// Remove from selection
			currentSelection.splice(index, 1);
		}

		this.setState({ selectedDrifterIds: currentSelection });
	}

	clearSelectedDrifters() {
		this.setState({ selectedDrifterIds: [] });
	}

	setMissionType(missionType: string | null) {
		this.setState({ selectedMissionType: missionType });
	}

	setDrifterSortBy(sortBy: 'combat' | 'scavenging' | 'tech' | 'speed') {
		this.setState({ drifterSortBy: sortBy });
	}

	selectVehicleInstance(vehicleInstanceId: string | null) {
		this.setState({ selectedVehicleInstanceId: vehicleInstanceId });
	}

	setSelectedTargetMonster(monsterId: string | null) {
		this.setState({ selectedTargetMonsterId: monsterId });
	}

	// Helper to check if a node is contested by active missions
	isNodeContested(nodeId: string): boolean {
		return this.state.activeMissions.some((mission) => mission.targetNodeId === nodeId && mission.status === 'active');
	}

	async loadPlayerMissions() {
		if (!this.state.playerAddress || this.state.isLoadingPlayerMissions) {
			return;
		}

		this.setState({ isLoadingPlayerMissions: true });

		try {
			const response = await this.apiCall(`/missions/player/${this.state.playerAddress}`);
			const data = await response.json();

			this.setState({
				playerMissions: data.missions || [],
				isLoadingPlayerMissions: false,
			});
		} catch {
			this.setState({ isLoadingPlayerMissions: false });
		}
	}

	// Town API
	async contributeToTown(attribute: 'vehicle_market' | 'perimeter_walls', amount: number) {
		try {
			const response = await this.apiCall('/town/contribute', {
				method: 'POST',
				body: JSON.stringify({ attribute, amount }),
			});
			const result = await response.json();
			if (result.success) {
				this.addNotification({
					type: 'success',
					title: 'Contribution Applied',
					message: `Contributed ${amount} credits to ${attribute.replace('_', ' ')}`,
				});
				await this.loadWorldState();
				await this.loadPlayerProfile();
				return result;
			} else {
				this.addNotification({ type: 'error', title: 'Contribution Failed', message: result.error || 'Failed to contribute.' });
				return result;
			}
		} catch (e: any) {
			this.addNotification({ type: 'error', title: 'Network Error', message: `Failed to contribute: ${e.message}` });
			return { success: false, error: e.message };
		}
	}

	// Notification system
	addNotification(notification: Omit<GameNotification, 'id' | 'timestamp'>) {
		const newNotification: GameNotification = {
			...notification,
			id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			timestamp: new Date(),
			duration: notification.duration || 5000,
		};

		const notifications = [newNotification, ...this.state.notifications].slice(0, 10); // Keep last 10
		this.setState({ notifications });

		// Auto-remove after duration
		setTimeout(() => {
			this.removeNotification(newNotification.id);
		}, newNotification.duration);
	}

	removeNotification(id: string) {
		const notifications = this.state.notifications.filter((n) => n.id !== id);
		this.setState({ notifications });
	}

	// Handle server notifications with ACK protocol
	private handleServerNotification(notification: Omit<GameNotification, 'timestamp'>) {
		const fullNotification: GameNotification = {
			...notification,
			timestamp: new Date(),
			duration: notification.duration || 5000,
		};

		// Add to UI
		const notifications = [fullNotification, ...this.state.notifications].slice(0, 10);
		this.setState({ notifications });

		// Send ACK to server
		this.sendNotificationAck([fullNotification.id]);

		// Auto-remove after duration
		setTimeout(() => {
			this.removeNotification(fullNotification.id);
		}, fullNotification.duration);
	}

	// Send notification acknowledgment via WebSocket
	private sendNotificationAck(notificationIds: string[]) {
		if (this.state.wsConnected && webSocketManager) {
			webSocketManager.sendMessage({
				type: 'notification_ack',
				timestamp: new Date(),
				data: {
					notificationIds,
				},
			});
			console.log('[GameState] Sent ACK for notifications:', notificationIds);
		}
	}

	// Logs sync
	async syncEventLog(limit: number = 1000) {
		try {
			const response = await this.apiCall(`/logs?limit=${limit}`);
			const json = await response.json();
			const events = (json.events || []).map((e: any) => ({ ...e, timestamp: new Date(e.timestamp) }) as GameEvent);
			this.setState({ eventLog: events });
		} catch (err) {
			console.error('Failed to sync event log', err);
		}
	}

	// Periodic updates (every 30 seconds) - only when WebSocket is not connected
	private startPeriodicUpdates() {
		setInterval(() => {
			if (this.state.isAuthenticated && !this.state.realTimeMode) {
				console.log('[GameState] Periodic update (WebSocket disconnected)');
				this.loadPlayerProfile();
				this.loadWorldState();
				this.loadPlayerMissions();
			}
		}, 30000);
	}

	// Event listener helpers
	onStateChange(callback: (state: GameState) => void) {
		const handler = (event: CustomEvent) => {
			callback(event.detail.newState);
		};
		this.addEventListener('statechange', handler);

		// Call immediately with current state
		callback(this.getState());

		return () => this.removeEventListener('statechange', handler);
	}
}

// Singleton instance
export const gameState = new GameStateManager();
