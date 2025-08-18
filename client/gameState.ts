import type { PlayerProfile, Mission, DrifterProfile, ResourceNode } from '@shared/models';
import { auth } from './auth';
import { webSocketManager } from './websocketManager';
import type { PlayerStateUpdate, WorldStateUpdate, MissionUpdate, ConnectionStatusUpdate } from '@shared/models';

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
  worldMetrics: {
    totalActiveMissions: number;
    totalCompletedMissions: number;
    economicActivity: number;
    lastUpdate: Date;
  } | null;
  availableMercenaries: DrifterProfile[];
  
  // Connection state
  wsConnected: boolean;
  wsAuthenticated: boolean;
  wsReconnectAttempts: number;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  realTimeMode: boolean; // Whether updates come from WebSocket or polling
  
  // UI state
  selectedResourceNode: string | null;
  showMissionPanel: boolean;
  showMercenaryPanel: boolean;
  showProfilePanel: boolean;
  showActiveMissionsPanel: boolean;
  notifications: GameNotification[];
  
  // Loading states
  isLoadingProfile: boolean;
  isLoadingWorld: boolean;
  isLoadingMercenaries: boolean;
  isLoadingPlayerMissions: boolean;
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
    worldMetrics: null,
    availableMercenaries: [],
    wsConnected: false,
    wsAuthenticated: false,
    wsReconnectAttempts: 0,
    connectionStatus: 'disconnected',
    realTimeMode: false,
    selectedResourceNode: null,
    showMissionPanel: false,
    showMercenaryPanel: false,
    showProfilePanel: false,
    showActiveMissionsPanel: false,
    notifications: [],
    isLoadingProfile: false,
    isLoadingWorld: false,
    isLoadingMercenaries: false,
    isLoadingPlayerMissions: false,
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
    this.dispatchEvent(new CustomEvent('statechange', {
      detail: { oldState, newState: this.state }
    }));
  }

  private setupAuthListener() {
    auth.onStateChange((authState) => {
      this.setState({
        isAuthenticated: authState.isAuthenticated,
        playerAddress: authState.address
      });

      if (authState.isAuthenticated && authState.address) {
        // Load player data when authenticated
        this.loadPlayerProfile();
        this.loadWorldState();
        this.loadMercenaries();
        this.loadPlayerMissions();
        
        // Connect WebSocket for real-time updates
        this.connectWebSocket();
      } else {
        // Clear data when not authenticated
        this.setState({
          profile: null,
          ownedDrifters: [],
          activeMissions: [],
          playerMissions: []
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
      
      this.setState({
        connectionStatus: status,
        wsConnected: status === 'connected',
        wsAuthenticated: authenticated || false
      });
      
      if (status === 'connected') {
        this.setState({ 
          realTimeMode: true,
          wsReconnectAttempts: 0 
        });
        
        // Authenticate the WebSocket if we have a player address and aren't already authenticated
        if (!authenticated && this.state.playerAddress) {
          console.log('[GameState] Authenticating WebSocket with player address:', this.state.playerAddress);
          webSocketManager.authenticate(this.state.playerAddress);
        }
        
        // Subscribe to events once authenticated
        if (authenticated) {
          console.log('[GameState] WebSocket authenticated, subscribing to events');
          webSocketManager.subscribe(['player_state', 'world_state', 'mission_update']);
        }
        
        this.addNotification({
          type: 'success',
          title: 'Real-time Connected',
          message: authenticated ? 'WebSocket authenticated' : 'WebSocket connected',
          duration: 3000
        });
      } else if (status === 'reconnecting') {
        this.setState({ 
          wsReconnectAttempts: this.state.wsReconnectAttempts + 1 
        });
      } else if (status === 'disconnected') {
        this.setState({ 
          realTimeMode: false 
        });
        this.addNotification({
          type: 'info',
          title: 'Connection Lost',
          message: 'Switched to periodic updates',
          duration: 3000
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
      
      if (update.notifications) {
        console.log('[GameState] Received notifications from WebSocket:', update.notifications);
        // Convert to UI notifications format
        const uiNotifications = update.notifications.map(n => ({
          id: n.id,
          type: n.type as any,
          title: n.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          message: n.message,
          timestamp: new Date(n.timestamp)
        }));
        
        // Add new notifications to the existing list
        const existingIds = new Set(this.state.notifications.map(n => n.id));
        const newNotifications = uiNotifications.filter(n => !existingIds.has(n.id));
        
        newNotifications.forEach(notification => {
          this.addNotification({
            type: notification.type,
            title: notification.title,
            message: notification.message
          });
        });
      }
    });

    // Listen for world state updates
    webSocketManager.addEventListener('worldStateUpdate', (event) => {
      const update = event.detail as WorldStateUpdate['data'];
      console.log('[GameState] Received world state update:', update);
      
      if (update.resourceNodes) {
        console.log('[GameState] Updating resource nodes from WebSocket:', update.resourceNodes);
        this.setState({ resourceNodes: update.resourceNodes });
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
        const updatedPlayerMissions = this.state.playerMissions.map(mission =>
          mission.id === update.mission.id ? update.mission : mission
        );
        this.setState({ playerMissions: updatedPlayerMissions });
      }
      
      // Update specific mission in active missions
      if (update.mission && this.state.activeMissions) {
        const updatedActiveMissions = this.state.activeMissions.map(mission =>
          mission.id === update.mission.id ? update.mission : mission
        );
        this.setState({ activeMissions: updatedActiveMissions });
      }
      
      if (update.notification) {
        this.addNotification({
          type: update.notification.type as any,
          title: update.notification.title,
          message: update.notification.message
        });
      }
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
      wsReconnectAttempts: 0
    });
  }

  // API calls with error handling
  private async apiCall(endpoint: string, options?: RequestInit): Promise<Response> {
    try {
      const response = await fetch(`/api${endpoint}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers
        },
        ...options
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      this.addNotification({
        type: 'error',
        title: 'Network Error',
        message: `Failed to ${endpoint}: ${error.message}`,
      });
      throw error;
    }
  }

  async loadPlayerProfile() {
    if (this.state.isLoadingProfile) return;

    this.setState({ isLoadingProfile: true });

    try {
      const response = await this.apiCall('/profile');
      const profile = await response.json();
      
      this.setState({ 
        profile,
        isLoadingProfile: false
      });
    } catch (error) {
      this.setState({ isLoadingProfile: false });
    }
  }

  async loadWorldState() {
    if (this.state.isLoadingWorld) return;

    this.setState({ isLoadingWorld: true });

    try {
      const response = await this.apiCall('/world/state');
      const data = await response.json();
      
      this.setState({ 
        resourceNodes: data.resourceNodes || [],
        activeMissions: data.activeMissions || [],
        worldMetrics: data.worldMetrics || null,
        isLoadingWorld: false
      });
    } catch (error) {
      this.setState({ isLoadingWorld: false });
    }
  }

  async loadMercenaries() {
    if (this.state.isLoadingMercenaries) return;

    this.setState({ isLoadingMercenaries: true });

    try {
      const response = await this.apiCall('/mercenaries');
      const data = await response.json();
      
      // Separate owned from available mercenaries
      const owned = data.mercenaries.filter((m: any) => m.hireCost === 0);
      
      this.setState({ 
        availableMercenaries: data.mercenaries,
        ownedDrifters: owned,
        isLoadingMercenaries: false
      });
    } catch (error) {
      this.setState({ isLoadingMercenaries: false });
    }
  }

  // Mission operations
  async startMission(drifterId: number, targetId: string, missionType: 'EXPLORE' | 'SCAVENGE' | 'RAID' | 'ESCORT') {
    try {
      const response = await this.apiCall('/missions/start', {
        method: 'POST',
        body: JSON.stringify({
          drifterIds: [drifterId],
          targetNodeId: targetId
        })
      });

      const result = await response.json();
      
      if (result.success) {
        this.addNotification({
          type: 'mission',
          title: 'Mission Started!',
          message: `${missionType} mission started with Drifter #${drifterId}`,
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
          drifterId
        })
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

  toggleMercenaryPanel() {
    this.setState({ showMercenaryPanel: !this.state.showMercenaryPanel });
  }

  toggleProfilePanel() {
    this.setState({ showProfilePanel: !this.state.showProfilePanel });
  }

  toggleActiveMissionsPanel() {
    this.setState({ showActiveMissionsPanel: !this.state.showActiveMissionsPanel });
  }

  async loadPlayerMissions() {
    if (!this.state.playerAddress || this.state.isLoadingPlayerMissions) return;

    this.setState({ isLoadingPlayerMissions: true });

    try {
      const response = await this.apiCall(`/missions/player/${this.state.playerAddress}`);
      const data = await response.json();
      
      this.setState({ 
        playerMissions: data.missions || [],
        isLoadingPlayerMissions: false
      });
    } catch (error) {
      this.setState({ isLoadingPlayerMissions: false });
    }
  }

  // Notification system
  addNotification(notification: Omit<GameNotification, 'id' | 'timestamp'>) {
    const newNotification: GameNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      duration: notification.duration || 5000
    };

    const notifications = [newNotification, ...this.state.notifications].slice(0, 10); // Keep last 10
    this.setState({ notifications });

    // Auto-remove after duration
    setTimeout(() => {
      this.removeNotification(newNotification.id);
    }, newNotification.duration);
  }

  removeNotification(id: string) {
    const notifications = this.state.notifications.filter(n => n.id !== id);
    this.setState({ notifications });
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
