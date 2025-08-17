import type { PlayerProfile, WorldState, Mission, DrifterProfile } from '@shared/models';
import { auth } from './auth';

export interface GameState {
  // Authentication
  isAuthenticated: boolean;
  playerAddress: string | null;
  
  // Player data
  profile: PlayerProfile | null;
  ownedDrifters: DrifterProfile[];
  playerMissions: Mission[]; // Player's specific missions
  
  // World data
  worldState: WorldState | null;
  activeMissions: Mission[]; // All active missions (for map display)
  availableMercenaries: DrifterProfile[];
  
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
    worldState: null,
    activeMissions: [],
    availableMercenaries: [],
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
      } else {
        // Clear data when not authenticated
        this.setState({
          profile: null,
          ownedDrifters: [],
          activeMissions: [],
          playerMissions: []
        });
      }
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
      const worldState = await response.json();
      
      // Also load active missions
      const missionsResponse = await this.apiCall('/world/missions');
      const missionsData = await missionsResponse.json();
      
      this.setState({ 
        worldState,
        activeMissions: missionsData.missions || [],
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

  // Periodic updates (every 30 seconds)
  private startPeriodicUpdates() {
    setInterval(() => {
      if (this.state.isAuthenticated) {
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
