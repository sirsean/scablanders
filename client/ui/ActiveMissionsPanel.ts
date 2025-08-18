import type { Mission, DrifterProfile, ResourceNode } from '@shared/models';
import { gameState } from '../gameState';

export class ActiveMissionsPanel {
  private static updateInterval: number | null = null;
  private static lastMissions: Mission[] = [];
  private static lastOwnedDrifters: DrifterProfile[] = [];
  private static lastResources: ResourceNode[] = [];
  
  // Set up cleanup on page unload
  static {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        ActiveMissionsPanel.stopLiveTimer();
      });
    }
  }
  
  static createActiveMissionsPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'active-missions-panel';
    panel.className = 'game-panel';
    panel.style.cssText = `
      position: fixed;
      left: 50%;
      bottom: 20px;
      transform: translateX(-50%);
      width: 600px;
      max-height: 400px;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 16px;
      color: #fff;
      font-family: 'Courier New', monospace;
      display: none;
      overflow-y: auto;
      z-index: 1000;
    `;

    panel.innerHTML = `
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; color: #FFD700;">Active Missions</h3>
        <button id="close-active-missions-panel" style="background: none; border: 1px solid #666; color: #fff; padding: 4px 8px; cursor: pointer; margin-left: auto;">✕</button>
      </div>
      <div id="active-missions-content">
        <p>Loading active missions...</p>
      </div>
    `;

    return panel;
  }

  static updateActiveMissionsPanel(
    playerMissions: Mission[], 
    ownedDrifters: DrifterProfile[], 
    resources: ResourceNode[],
    isLoading: boolean
  ) {
    // Store the data for live updates
    this.lastMissions = playerMissions || [];
    this.lastOwnedDrifters = ownedDrifters || [];
    this.lastResources = resources || [];
    
    this.renderContent(isLoading);
    
    // Start or restart the live timer
    this.startLiveTimer();
  }
  
  /**
   * Start the live timer that updates countdowns every second
   */
  private static startLiveTimer() {
    // Clear any existing timer
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Start new timer
    this.updateInterval = setInterval(() => {
      // Only update if the panel is visible and we have missions
      const panel = document.getElementById('active-missions-panel');
      if (panel && panel.style.display !== 'none') {
        this.renderContent(false); // Not loading, just live update
      }
    }, 1000) as any;
  }
  
  /**
   * Stop the live timer
   */
  static stopLiveTimer() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  /**
   * Render the content using stored data
   */
  private static renderContent(isLoading: boolean) {
    const content = document.getElementById('active-missions-content');
    if (!content) return;

    if (isLoading) {
      content.innerHTML = '<p>Loading active missions...</p>';
      return;
    }

    if (!this.lastMissions || this.lastMissions.length === 0) {
      content.innerHTML = `
        <div style="text-align: center; color: #888; padding: 20px;">
          <p>No active missions</p>
          <p style="font-size: 14px;">Start a mission by selecting a resource node on the map!</p>
        </div>
      `;
      this.stopLiveTimer(); // No point running timer with no missions
      return;
    }

    const activeMissions = this.lastMissions.filter(m => m.status === 'active');
    
    if (activeMissions.length === 0) {
      content.innerHTML = `
        <div style="text-align: center; color: #888; padding: 20px;">
          <p>No active missions</p>
          <p style="font-size: 14px;">Start a mission by selecting a resource node on the map!</p>
        </div>
      `;
      this.stopLiveTimer(); // No active missions, stop the timer
      return;
    }

    content.innerHTML = `
      <div style="margin-bottom: 12px;">
        <span style="color: #00ff00; font-weight: bold;">Active Missions: ${activeMissions.length}</span>
      </div>
      
      ${activeMissions.map(mission => this.renderMissionCard(mission, this.lastOwnedDrifters, this.lastResources)).join('')}
    `;
  }

  private static renderMissionCard(mission: Mission, ownedDrifters: DrifterProfile[], resources: ResourceNode[]): string {
    const targetResource = resources.find(r => r.id === mission.targetNodeId);
    const missionDrifters = ownedDrifters.filter(d => mission.drifterIds.includes(d.tokenId));
    
    const now = new Date();
    const progress = this.calculateMissionProgress(mission.startTime, mission.completionTime, now);
    const timeRemaining = this.formatTimeRemaining(mission.completionTime, now);
    
    return `
      <div style="
        border: 1px solid #555; 
        border-radius: 6px; 
        padding: 12px; 
        margin: 8px 0;
        background: rgba(255, 255, 255, 0.02);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <strong style="color: #FFD700;">${mission.type.toUpperCase()} MISSION</strong>
            <span style="color: #888; margin-left: 8px;">#${mission.id.slice(-6)}</span>
          </div>
          <div style="text-align: right;">
            <div style="color: ${progress >= 100 ? '#00ff00' : '#ffff00'}; font-size: 12px;">
              ${progress >= 100 ? 'COMPLETE!' : timeRemaining}
            </div>
          </div>
        </div>
        
        <div style="margin-bottom: 8px;">
          <span style="color: #ccc;">Target: </span>
          <span style="color: #00ff00;">
            ${targetResource ? `${targetResource.type.toUpperCase()} (${targetResource.coordinates.x}, ${targetResource.coordinates.y})` : 'Unknown location'}
          </span>
        </div>
        
        <div style="margin-bottom: 8px;">
          <span style="color: #ccc;">Drifters: </span>
          ${missionDrifters.map(d => `
            <span style="color: #00bfff; font-size: 12px; margin-right: 8px;">
              ${d.name} #${d.tokenId}
            </span>
          `).join('')}
        </div>
        
        <div style="margin-bottom: 8px;">
          <div style="background: #333; height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="
              background: ${progress >= 100 ? '#00ff00' : 'linear-gradient(90deg, #ff8800, #ffff00)'}; 
              height: 100%; 
              width: ${Math.min(100, progress)}%;
              transition: width 0.5s ease;
            "></div>
          </div>
          <div style="font-size: 10px; color: #aaa; text-align: center; margin-top: 2px;">
            ${progress.toFixed(1)}% Complete
          </div>
        </div>
        
        ${progress >= 100 ? `
          <button 
            onclick="collectMission('${mission.id}')" 
            style="
              width: 100%; 
              padding: 6px; 
              background: #2c5530; 
              border: 1px solid #4a7c59; 
              color: #fff; 
              cursor: pointer; 
              border-radius: 4px;
              font-size: 12px;
            "
          >
            Collect Rewards
          </button>
        ` : ''}
      </div>
    `;
  }

  private static calculateMissionProgress(startTime: Date | string, completionTime: Date | string, currentTime: Date): number {
    const startDate = startTime instanceof Date ? startTime : new Date(startTime);
    const endDate = completionTime instanceof Date ? completionTime : new Date(completionTime);
    
    const totalDuration = endDate.getTime() - startDate.getTime();
    const elapsed = currentTime.getTime() - startDate.getTime();
    return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
  }

  private static formatTimeRemaining(completionTime: Date | string, currentTime: Date): string {
    const endDate = completionTime instanceof Date ? completionTime : new Date(completionTime);
    const remainingMs = endDate.getTime() - currentTime.getTime();
    
    if (remainingMs <= 0) return 'Complete!';
    
    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Global function for collecting missions
(window as any).collectMission = async (missionId: string) => {
  try {
    const response = await fetch('/api/missions/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ missionId })
    });
    
    const result = await response.json();
    if (result.success) {
      gameState.addNotification({
        type: 'success',
        title: 'Mission Complete!',
        message: `Collected rewards from mission #${missionId.slice(-6)}`
      });
      gameState.loadPlayerMissions();
      gameState.loadPlayerProfile();
    } else {
      gameState.addNotification({
        type: 'error',
        title: 'Collection Failed',
        message: result.error || 'Failed to collect mission rewards'
      });
    }
  } catch (error) {
    gameState.addNotification({
      type: 'error',
      title: 'Network Error',
      message: 'Failed to collect mission rewards'
    });
  }
};
