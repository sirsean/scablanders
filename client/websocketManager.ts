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

      console.log('Connecting to WebSocket server...');
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
          console.log('[WS Client] WebSocket connected successfully');
          
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
          
          console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
          
          // Send connection status event
          this.dispatchEvent(new CustomEvent('connectionStatus', {
            detail: { status: 'disconnected' }
          }));
          
          this.emit('connection_status', {
            type: 'connection_status',
            timestamp: new Date(),
            data: {
              status: 'disconnected',
              authenticated: false
            }
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
      console.warn('Cannot authenticate: WebSocket not connected');
      return;
    }

    console.log('[WS Client] Authenticating with player address:', playerAddress);
    this.send({
      type: 'authenticate',
      playerAddress
    });
  }

  /**
   * Subscribe to specific event types
   */
  subscribe(events: string[]): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return;
    }

    this.send({
      type: 'subscribe',
      events
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
      console.warn('Cannot send message: WebSocket not connected');
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
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    try {
      const message: GameWebSocketMessage = JSON.parse(data);
      console.log('[WS Client] Received message:', message.type, message);
      
      // Handle specific message types
      switch (message.type) {
        case 'connection_status':
          const statusMsg = message as ConnectionStatusUpdate;
          this.isAuthenticated = statusMsg.data.authenticated;
          console.log('[WS Client] Connection status update:', statusMsg.data);
          
          // Dispatch custom event for GameStateManager
          this.dispatchEvent(new CustomEvent('connectionStatus', {
            detail: { 
              status: statusMsg.data.status,
              authenticated: statusMsg.data.authenticated 
            }
          }));
          break;
        
        case 'player_state':
          const playerMsg = message as PlayerStateUpdate;
          console.log('[WS Client] Player state update:', playerMsg.data);
          // Dispatch custom event for GameStateManager
          this.dispatchEvent(new CustomEvent('playerStateUpdate', {
            detail: playerMsg.data
          }));
          break;
          
        case 'world_state':
          const worldMsg = message as WorldStateUpdate;
          console.log('[WS Client] World state update:', worldMsg.data);
          // Dispatch custom event for GameStateManager
          this.dispatchEvent(new CustomEvent('worldStateUpdate', {
            detail: worldMsg.data
          }));
          break;
          
        case 'mission_update':
          const missionMsg = message as MissionUpdate;
          console.log('[WS Client] Mission update:', missionMsg.data);
          // Dispatch custom event for GameStateManager
          this.dispatchEvent(new CustomEvent('missionUpdate', {
            detail: missionMsg.data
          }));
          break;
          
        case 'event_log_append':
          console.log('[WS Client] Event log append:', message.data);
          this.dispatchEvent(new CustomEvent('eventLogAppend', {
            detail: message.data
          }));
          break;

        case 'event_log_snapshot':
          console.log('[WS Client] Event log snapshot:', message.data);
          this.dispatchEvent(new CustomEvent('eventLogSnapshot', {
            detail: message.data
          }));
          break;
          
        case 'notification':
          console.log('[WS Client] Received notification:', message.data);
          // Dispatch custom event for GameStateManager
          this.dispatchEvent(new CustomEvent('notification', {
            detail: message.data
          }));
          break;
        
        case 'pong':
          console.log('[WS Client] Received pong');
          break;
          
        case 'subscription_confirmed':
          console.log('[WS Client] Subscription confirmed:', message.data);
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
    
    console.log(`Scheduling WebSocket reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    // Send reconnecting status
    this.dispatchEvent(new CustomEvent('connectionStatus', {
      detail: { 
        status: 'reconnecting',
        authenticated: false
      }
    }));
    
    this.emit('connection_status', {
      type: 'connection_status',
      timestamp: new Date(),
      data: {
        status: 'reconnecting',
        authenticated: false
      }
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
      handlers.forEach(handler => {
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
      reconnectAttempts: this.reconnectAttempts
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

// Export singleton instance
export const webSocketManager = new WebSocketManager({
  url: 'ws://localhost:5173/ws', // Dev server port
  reconnectInterval: 5000,
  maxReconnectAttempts: 5
});
