import { GameWebSocketMessage, PlayerStateUpdate, WorldStateUpdate, MissionUpdate, ConnectionStatusUpdate } from '@shared/models';

export type WebSocketEventHandler = (message: GameWebSocketMessage) => void;

interface WebSocketManagerOptions {
	url: string;
	reconnectInterval: number;
	maxReconnectAttempts: number;
}

/**
 * WebSocket manager for real-time communication with the game server
 */
export class WebSocketManager extends EventTarget {
	private websocket: WebSocket | null = null;
	private options: WebSocketManagerOptions;
	private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
	private reconnectAttempts: number = 0;
	private reconnectTimeout: number | null = null;
	private isConnecting: boolean = false;
	private isAuthenticated: boolean = false;
	private authToken: string | null = null;
	private pingInterval: number | null = null;

	constructor(options: WebSocketManagerOptions) {
		super();
		this.options = options;
	}

	/**
	 * Connect to the WebSocket server
	 */
	async connect(): Promise<boolean> {
		if (this.isConnecting || (this.websocket && this.websocket.readyState === WebSocket.OPEN)) {
			return true;
		}

		this.isConnecting = true;

		try {
			// Clear any existing reconnect timeout
			if (this.reconnectTimeout) {
				clearTimeout(this.reconnectTimeout);
				this.reconnectTimeout = null;
			}

			// removed verbose connect log
			this.websocket = new WebSocket(this.options.url);

			return new Promise((resolve, reject) => {
				const connectTimeout = setTimeout(() => {
					this.isConnecting = false;
					reject(new Error('WebSocket connection timeout'));
				}, 10000); // 10 second timeout

				this.websocket!.onopen = () => {
					clearTimeout(connectTimeout);
					this.isConnecting = false;
					this.reconnectAttempts = 0;
					// connected

					// Start ping interval to keep connection alive
					this.startPingInterval();

					resolve(true);
				};

				this.websocket!.onmessage = (event) => {
					this.handleMessage(event.data);
				};

				this.websocket!.onclose = (event) => {
					clearTimeout(connectTimeout);
					this.isConnecting = false;
					this.isAuthenticated = false;

					// closed

					// Send connection status event
					this.dispatchEvent(
						new CustomEvent('connectionStatus', {
							detail: { status: 'disconnected' },
						}),
					);

					this.emit('connection_status', {
						type: 'connection_status',
						timestamp: new Date(),
						data: {
							status: 'disconnected',
							authenticated: false,
						},
					});

					// Attempt to reconnect unless it was a clean close
					if (event.code !== 1000 && this.reconnectAttempts < this.options.maxReconnectAttempts) {
						this.scheduleReconnect();
					}

					resolve(false);
				};

				this.websocket!.onerror = (error) => {
					clearTimeout(connectTimeout);
					this.isConnecting = false;
					console.error('WebSocket error:', error);
					reject(error);
				};
			});
		} catch (error) {
			this.isConnecting = false;
			console.error('Failed to create WebSocket connection:', error);
			throw error;
		}
	}

	/**
	 * Disconnect from WebSocket server
	 */
	disconnect(): void {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
		if (this.websocket) {
			this.websocket.close(1000, 'Client disconnect');
			this.websocket = null;
		}

		this.isAuthenticated = false;
		this.reconnectAttempts = this.options.maxReconnectAttempts; // Prevent reconnection
	}

	/**
	 * Authenticate the WebSocket connection
	 */
	authenticate(playerAddress: string): void {
		if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
		// Cannot authenticate: WebSocket not connected
			return;
		}

		// authenticating
		this.send({
			type: 'authenticate',
			playerAddress,
		});
	}

	/**
	 * Subscribe to specific event types
	 */
	subscribe(events: string[]): void {
		if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
		// Cannot subscribe: WebSocket not connected
			return;
		}

		this.send({
			type: 'subscribe',
			events,
		});
	}

	/**
	 * Send a message to the server (public method)
	 */
	sendMessage(message: any): void {
		this.send(message);
	}

	/**
	 * Send a message to the server (private method)
	 */
	private send(message: any): void {
		if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
		// Cannot send message: WebSocket not connected
			return;
		}

		try {
			this.websocket.send(JSON.stringify(message));
		} catch (error) {
			console.error('Failed to send WebSocket message:', error);
		}
	}

	/**
	 * Send periodic ping to keep connection alive
	 */
	private startPingInterval(): void {
		// Clear existing ping interval
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
		}

		this.pingInterval = setInterval(() => {
			if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
				this.send({ type: 'ping' });
			}
		}, 30000) as any; // Ping every 30 seconds
	}

	/**
	 * Handle incoming messages
	 */
	private handleMessage(data: string): void {
		try {
			const message: GameWebSocketMessage = JSON.parse(data);

			// Handle specific message types
			switch (message.type) {
				case 'connection_status':
					const statusMsg = message as ConnectionStatusUpdate;
					this.isAuthenticated = statusMsg.data.authenticated;

					// Dispatch custom event for GameStateManager
					this.dispatchEvent(
						new CustomEvent('connectionStatus', {
							detail: {
								status: statusMsg.data.status,
								authenticated: statusMsg.data.authenticated,
							},
						}),
					);
					break;

				case 'player_state':
					const playerMsg = message as PlayerStateUpdate;
					// Dispatch custom event for GameStateManager
					this.dispatchEvent(
						new CustomEvent('playerStateUpdate', {
							detail: playerMsg.data,
						}),
					);
					break;

				case 'world_state':
					const worldMsg = message as WorldStateUpdate;
					// Dispatch custom event for GameStateManager
					this.dispatchEvent(
						new CustomEvent('worldStateUpdate', {
							detail: worldMsg.data,
						}),
					);
					break;

				case 'mission_update':
					const missionMsg = message as MissionUpdate;
					// Dispatch custom event for GameStateManager
					this.dispatchEvent(
						new CustomEvent('missionUpdate', {
							detail: missionMsg.data,
						}),
					);
					break;

				case 'event_log_append':
					this.dispatchEvent(
						new CustomEvent('eventLogAppend', {
							detail: message.data,
						}),
					);
					break;

				case 'leaderboards_update':
					this.dispatchEvent(
						new CustomEvent('leaderboardsUpdate', {
							detail: (message as any).data,
						}),
					);
					break;

				case 'event_log_snapshot':
					this.dispatchEvent(
						new CustomEvent('eventLogSnapshot', {
							detail: message.data,
						}),
					);
					break;

				case 'notification':
					// Dispatch custom event for GameStateManager
					this.dispatchEvent(
						new CustomEvent('notification', {
							detail: message.data,
						}),
					);
					break;

				case 'pong':
					break;

				case 'subscription_confirmed':
					break;

				case 'error':
					console.error('[WS Client] Server error:', message.data);
					break;

				default:
					console.warn('[WS Client] Unknown message type:', message.type);
			}

			// Emit event to all registered handlers
			this.emit(message.type, message);
		} catch (error) {
			console.error('[WS Client] Failed to parse WebSocket message:', error, 'Raw data:', data);
		}
	}

	/**
	 * Schedule reconnection attempt
	 */
	private scheduleReconnect(): void {
		if (this.reconnectTimeout || this.reconnectAttempts >= this.options.maxReconnectAttempts) {
			return;
		}

		this.reconnectAttempts++;
		const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000); // Exponential backoff, max 30s

		// scheduling reconnect

		// Send reconnecting status
		this.dispatchEvent(
			new CustomEvent('connectionStatus', {
				detail: {
					status: 'reconnecting',
					authenticated: false,
				},
			}),
		);

		this.emit('connection_status', {
			type: 'connection_status',
			timestamp: new Date(),
			data: {
				status: 'reconnecting',
				authenticated: false,
			},
		});

		this.reconnectTimeout = setTimeout(async () => {
			this.reconnectTimeout = null;
			try {
				await this.connect();
			} catch (error) {
				console.error('Reconnection failed:', error);
				// Will trigger another reconnect attempt through onclose handler
			}
		}, delay);
	}

	/**
	 * Register an event handler
	 */
	on(eventType: string, handler: WebSocketEventHandler): void {
		if (!this.eventHandlers.has(eventType)) {
			this.eventHandlers.set(eventType, []);
		}
		this.eventHandlers.get(eventType)!.push(handler);
	}

	/**
	 * Unregister an event handler
	 */
	off(eventType: string, handler: WebSocketEventHandler): void {
		const handlers = this.eventHandlers.get(eventType);
		if (handlers) {
			const index = handlers.indexOf(handler);
			if (index !== -1) {
				handlers.splice(index, 1);
			}
		}
	}

	/**
	 * Emit an event to all registered handlers
	 */
	private emit(eventType: string, message: GameWebSocketMessage): void {
		const handlers = this.eventHandlers.get(eventType);
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(message);
				} catch (error) {
					console.error(`Error in WebSocket event handler for ${eventType}:`, error);
				}
			});
		}
	}

	/**
	 * Get connection status
	 */
	getStatus(): {
		connected: boolean;
		authenticated: boolean;
		reconnectAttempts: number;
	} {
		return {
			connected: this.websocket?.readyState === WebSocket.OPEN,
			authenticated: this.isAuthenticated,
			reconnectAttempts: this.reconnectAttempts,
		};
	}

	/**
	 * Check if WebSocket is connected and ready
	 */
	isConnected(): boolean {
		return this.websocket?.readyState === WebSocket.OPEN;
	}

	/**
	 * Check if WebSocket is authenticated
	 */
	isAuthenticatedConnection(): boolean {
		return this.isConnected() && this.isAuthenticated;
	}
}

// Resolve WS URL based on environment
function computeWebSocketUrl(): string {
	// 1) Explicit override via Vite env
	try {
		const envUrl = (import.meta as any)?.env?.VITE_WS_URL;
		if (envUrl && typeof envUrl === 'string' && envUrl.length > 0) {
			return envUrl;
		}
	} catch {}

	// 2) Use current origin host and scheme
	if (typeof window !== 'undefined' && window.location) {
		const isSecure = window.location.protocol === 'https:';
		const proto = isSecure ? 'wss' : 'ws';
		const host = window.location.host; // includes hostname:port if any
		return `${proto}://${host}/ws`;
	}

	// 3) Fallback to local dev default
	return 'ws://localhost:5173/ws';
}

// Export singleton instance
export const webSocketManager = new WebSocketManager({
	url: computeWebSocketUrl(),
	reconnectInterval: 5000,
	maxReconnectAttempts: 5,
});
