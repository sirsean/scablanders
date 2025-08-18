import type { GameState, GameNotification } from '../gameState';
import { gameState } from '../gameState';
import type { DrifterProfile } from '@shared/models';
import { ActiveMissionsPanel } from './ActiveMissionsPanel';

export class UIManager {
  private notificationContainer: HTMLElement | null = null;
  private missionPanel: HTMLElement | null = null;
  private mercenaryPanel: HTMLElement | null = null;
  private profilePanel: HTMLElement | null = null;
  private activeMissionsPanel: HTMLElement | null = null;

  constructor() {
    this.createUIElements();
    this.setupEventListeners();
    
    // Listen to game state changes
    gameState.onStateChange((state) => {
      this.updateUI(state);
    });
  }

  private createUIElements() {
    this.createNotificationContainer();
    this.createMissionPanel();
    this.createMercenaryPanel();
    this.createProfilePanel();
    this.createActiveMissionsPanel();
  }

  private createNotificationContainer() {
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.id = 'notifications';
    this.notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 300px;
      width: 350px;
      z-index: 1000;
      pointer-events: none;
    `;
    document.body.appendChild(this.notificationContainer);
  }

  private createMissionPanel() {
    this.missionPanel = document.createElement('div');
    this.missionPanel.id = 'mission-panel';
    this.missionPanel.className = 'game-panel';
    this.missionPanel.style.cssText = `
      position: fixed;
      left: 20px;
      bottom: 20px;
      width: 400px;
      max-height: 500px;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 16px;
      color: #fff;
      font-family: 'Courier New', monospace;
      display: none;
      overflow-y: auto;
    `;

    this.missionPanel.innerHTML = `
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; color: #FFD700;">Mission Planning</h3>
        <button id="close-mission-panel" style="background: none; border: 1px solid #666; color: #fff; padding: 4px 8px; cursor: pointer; margin-left: auto;">✕</button>
      </div>
      <div id="mission-content">
        <p>Select a resource node to plan a mission.</p>
      </div>
    `;

    document.body.appendChild(this.missionPanel);
  }

  private createMercenaryPanel() {
    this.mercenaryPanel = document.createElement('div');
    this.mercenaryPanel.id = 'mercenary-panel';
    this.mercenaryPanel.className = 'game-panel';
    this.mercenaryPanel.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 20px;
      width: 400px;
      max-height: 500px;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 16px;
      color: #fff;
      font-family: 'Courier New', monospace;
      display: none;
      overflow-y: auto;
    `;

    this.mercenaryPanel.innerHTML = `
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; color: #FFD700;">Mercenaries</h3>
        <button id="close-mercenary-panel" style="background: none; border: 1px solid #666; color: #fff; padding: 4px 8px; cursor: pointer; margin-left: auto;">✕</button>
      </div>
      <div id="mercenary-content">
        <p>Loading mercenaries...</p>
      </div>
    `;

    document.body.appendChild(this.mercenaryPanel);
  }

  private createProfilePanel() {
    this.profilePanel = document.createElement('div');
    this.profilePanel.id = 'profile-panel';
    this.profilePanel.className = 'game-panel';
    this.profilePanel.style.cssText = `
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      max-height: 600px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 20px;
      color: #fff;
      font-family: 'Courier New', monospace;
      display: none;
      overflow-y: auto;
      z-index: 1001;
    `;

    this.profilePanel.innerHTML = `
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; color: #FFD700;">Player Profile</h3>
        <button id="close-profile-panel" style="background: none; border: 1px solid #666; color: #fff; padding: 4px 8px; cursor: pointer; margin-left: auto;">✕</button>
      </div>
      <div id="profile-content">
        <p>Loading profile...</p>
      </div>
    `;

    document.body.appendChild(this.profilePanel);
  }

  private createActiveMissionsPanel() {
    this.activeMissionsPanel = ActiveMissionsPanel.createActiveMissionsPanel();
    document.body.appendChild(this.activeMissionsPanel);
  }

  private setupEventListeners() {
    // Panel close buttons
    document.getElementById('close-mission-panel')?.addEventListener('click', () => {
      gameState.toggleMissionPanel();
    });

    document.getElementById('close-mercenary-panel')?.addEventListener('click', () => {
      gameState.toggleMercenaryPanel();
    });

    document.getElementById('close-profile-panel')?.addEventListener('click', () => {
      gameState.toggleProfilePanel();
    });

    document.getElementById('close-active-missions-panel')?.addEventListener('click', () => {
      gameState.toggleActiveMissionsPanel();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Escape':
          // Close all panels
          gameState.selectResourceNode(null);
          if (gameState.getState().showMissionPanel) gameState.toggleMissionPanel();
          if (gameState.getState().showMercenaryPanel) gameState.toggleMercenaryPanel();
          if (gameState.getState().showProfilePanel) gameState.toggleProfilePanel();
          break;
        case 'm':
        case 'M':
          gameState.toggleMercenaryPanel();
          break;
        case 'p':
        case 'P':
          gameState.toggleProfilePanel();
          break;
      }
    });
  }

  private updateUI(state: GameState) {
    // Update panel visibility
    if (this.missionPanel) {
      this.missionPanel.style.display = state.showMissionPanel ? 'block' : 'none';
      if (state.showMissionPanel) {
        this.updateMissionPanel(state);
      }
    }

    if (this.mercenaryPanel) {
      this.mercenaryPanel.style.display = state.showMercenaryPanel ? 'block' : 'none';
      if (state.showMercenaryPanel) {
        this.updateMercenaryPanel(state);
      }
    }

    if (this.profilePanel) {
      this.profilePanel.style.display = state.showProfilePanel ? 'block' : 'none';
      if (state.showProfilePanel) {
        this.updateProfilePanel(state);
      }
    }

    if (this.activeMissionsPanel) {
      this.activeMissionsPanel.style.display = state.showActiveMissionsPanel ? 'block' : 'none';
      if (state.showActiveMissionsPanel) {
        ActiveMissionsPanel.updateActiveMissionsPanel(
          state.playerMissions,
          state.ownedDrifters,
          state.resourceNodes || [],
          state.isLoadingPlayerMissions
        );
      }
    }

    // Update notifications
    this.updateNotifications(state.notifications);

    // Update top bar info
    this.updateTopBar(state);
  }

  private updateMissionPanel(state: GameState) {
    const content = document.getElementById('mission-content');
    if (!content) return;

    if (!state.selectedResourceNode) {
      content.innerHTML = '<p>Select a resource node to plan a mission.</p>';
      return;
    }

    if (!state.isAuthenticated) {
      content.innerHTML = '<p style="color: #ff6b6b;">Please connect your wallet to start missions.</p>';
      return;
    }

    // Find the selected resource node data
    const selectedResource = state.resourceNodes?.find(r => r.id === state.selectedResourceNode);
    if (!selectedResource) {
      content.innerHTML = '<p>Resource node data not available.</p>';
      return;
    }

    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h4 style="color: #00ff00; margin: 0 0 8px 0;">${selectedResource.type.toUpperCase()} NODE</h4>
        <p style="margin: 4px 0;">Current Yield: <span style="color: #ffff00;">${selectedResource.currentYield}</span></p>
        <p style="margin: 4px 0;">Location: (${selectedResource.coordinates.x}, ${selectedResource.coordinates.y})</p>
        <p style="margin: 4px 0; color: #ffd700;">★ ${selectedResource.rarity.toUpperCase()} ★</p>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="color: #FFD700; margin: 0 0 8px 0;">Select Drifter</h4>
        <div id="drifter-selection">
          ${this.renderDrifterSelection(state.ownedDrifters)}
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <h4 style="color: #FFD700; margin: 0 0 8px 0;">Mission Type</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <button class="mission-type-btn" data-type="SCAVENGE" style="background: #2c5530; border: 1px solid #4a7c59; color: #fff; padding: 8px; cursor: pointer; border-radius: 4px;">
            SCAVENGE<br><small>Gather resources safely</small>
          </button>
          <button class="mission-type-btn" data-type="EXPLORE" style="background: #4a5c2a; border: 1px solid #6b7c4a; color: #fff; padding: 8px; cursor: pointer; border-radius: 4px;">
            EXPLORE<br><small>Discover new areas</small>
          </button>
          <button class="mission-type-btn" data-type="RAID" style="background: #5c2a2a; border: 1px solid #7c4a4a; color: #fff; padding: 8px; cursor: pointer; border-radius: 4px;">
            RAID<br><small>High risk, high reward</small>
          </button>
          <button class="mission-type-btn" data-type="ESCORT" style="background: #2a4a5c; border: 1px solid #4a6b7c; color: #fff; padding: 8px; cursor: pointer; border-radius: 4px;">
            ESCORT<br><small>Protect other missions</small>
          </button>
        </div>
      </div>

      <button id="start-mission-btn" disabled style="width: 100%; padding: 12px; background: #666; border: 1px solid #888; color: #fff; cursor: not-allowed; border-radius: 4px;">
        Select Drifter & Mission Type
      </button>
    `;

    this.setupMissionPanelHandlers();
  }

  private renderDrifterSelection(drifters: DrifterProfile[]): string {
    if (!drifters || drifters.length === 0) {
      return '<p style="color: #ff6b6b; font-size: 12px;">No owned Drifters available. You need to own Fringe Drifters NFTs to start missions.</p>';
    }

    return drifters.map(drifter => `
      <div class="drifter-option" data-id="${drifter.tokenId}" style="
        border: 1px solid #444; 
        padding: 8px; 
        margin: 4px 0; 
        cursor: pointer; 
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.05);
      ">
        <div style="display: flex; justify-content: between;">
          <strong>${drifter.name} #${drifter.tokenId}</strong>
          <span style="color: #00ff00;">OWNED</span>
        </div>
        <div style="font-size: 11px; color: #ccc; margin-top: 4px;">
          Combat: ${drifter.combat} | Scavenging: ${drifter.scavenging} | Tech: ${drifter.tech} | Speed: ${drifter.speed}
        </div>
      </div>
    `).join('');
  }

  private setupMissionPanelHandlers() {
    let selectedDrifter: number | null = null;
    let selectedMissionType: string | null = null;

    // Drifter selection
    document.querySelectorAll('.drifter-option').forEach(option => {
      option.addEventListener('click', () => {
        // Clear previous selection
        document.querySelectorAll('.drifter-option').forEach(o => {
          (o as HTMLElement).style.borderColor = '#444';
        });
        
        // Highlight selected
        (option as HTMLElement).style.borderColor = '#00ff00';
        selectedDrifter = parseInt(option.getAttribute('data-id') || '0');
        
        this.updateStartButton(selectedDrifter, selectedMissionType);
      });
    });

    // Mission type selection
    document.querySelectorAll('.mission-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Clear previous selection
        document.querySelectorAll('.mission-type-btn').forEach(b => {
          (b as HTMLElement).style.transform = 'none';
        });
        
        // Highlight selected
        (btn as HTMLElement).style.transform = 'scale(0.95)';
        selectedMissionType = btn.getAttribute('data-type');
        
        this.updateStartButton(selectedDrifter, selectedMissionType);
      });
    });

    // Start mission button
    document.getElementById('start-mission-btn')?.addEventListener('click', async () => {
      if (selectedDrifter && selectedMissionType) {
        const state = gameState.getState();
        const result = await gameState.startMission(
          selectedDrifter, 
          state.selectedResourceNode!, 
          selectedMissionType as any
        );
        
        if (result.success) {
          gameState.toggleMissionPanel();
        }
      }
    });
  }

  private updateStartButton(drifterId: number | null, missionType: string | null) {
    const button = document.getElementById('start-mission-btn') as HTMLButtonElement;
    if (!button) return;

    if (drifterId && missionType) {
      button.disabled = false;
      button.style.background = '#2c5530';
      button.style.cursor = 'pointer';
      button.textContent = `Start ${missionType} Mission`;
    } else {
      button.disabled = true;
      button.style.background = '#666';
      button.style.cursor = 'not-allowed';
      button.textContent = 'Select Drifter & Mission Type';
    }
  }

  private updateMercenaryPanel(state: GameState) {
    const content = document.getElementById('mercenary-content');
    if (!content) return;

    if (state.isLoadingMercenaries) {
      content.innerHTML = '<p>Loading mercenaries...</p>';
      return;
    }

    if (!state.availableMercenaries.length) {
      content.innerHTML = '<p>No mercenaries available.</p>';
      return;
    }

    const owned = state.availableMercenaries.filter(m => m.hireCost === 0);
    const available = state.availableMercenaries.filter(m => m.hireCost > 0);

    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h4 style="color: #00ff00; margin: 0 0 8px 0;">Owned Drifters (${owned.length})</h4>
        <div style="max-height: 150px; overflow-y: auto;">
          ${owned.map(merc => `
            <div style="border: 1px solid #00ff00; padding: 6px; margin: 4px 0; border-radius: 4px; font-size: 12px;">
              <strong>${merc.name} #${merc.tokenId}</strong>
              <div style="color: #ccc;">Combat: ${merc.combat} | Scavenging: ${merc.scavenging} | Tech: ${merc.tech} | Speed: ${merc.speed}</div>
            </div>
          `).join('') || '<p style="color: #888; font-size: 12px;">No owned Drifters</p>'}
        </div>
      </div>
      
      <div>
        <h4 style="color: #ffd700; margin: 0 0 8px 0;">Available for Hire (${available.length})</h4>
        <div style="max-height: 200px; overflow-y: auto;">
          ${available.slice(0, 10).map(merc => `
            <div style="border: 1px solid #666; padding: 6px; margin: 4px 0; border-radius: 4px; font-size: 12px;">
              <div style="display: flex; justify-content: between;">
                <strong>${merc.name} #${merc.tokenId}</strong>
                <span style="color: #ffd700;">${merc.hireCost} credits/hr</span>
              </div>
              <div style="color: #ccc;">Combat: ${merc.combat} | Scavenging: ${merc.scavenging} | Tech: ${merc.tech} | Speed: ${merc.speed}</div>
            </div>
          `).join('')}
          ${available.length > 10 ? '<p style="color: #888; text-align: center; font-size: 12px;">... and more</p>' : ''}
        </div>
      </div>
    `;
  }

  private updateProfilePanel(state: GameState) {
    const content = document.getElementById('profile-content');
    if (!content) return;

    if (!state.isAuthenticated) {
      content.innerHTML = '<p style="color: #ff6b6b;">Please connect your wallet to view profile.</p>';
      return;
    }

    if (state.isLoadingProfile || !state.profile) {
      content.innerHTML = '<p>Loading profile...</p>';
      return;
    }

    const profile = state.profile;
    content.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h4 style="color: #ffd700; margin: 0 0 8px 0;">Wallet Info</h4>
        <p style="margin: 4px 0; word-break: break-all; font-size: 14px;">${profile.address}</p>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="color: #ffd700; margin: 0 0 8px 0;">Balance</h4>
        <div style="text-align: center; padding: 16px; border: 2px solid #ffd700; border-radius: 8px; background: rgba(255, 215, 0, 0.1);">
          <div style="color: #00ff00; font-size: 24px; font-weight: bold;">${profile.balance || 0}</div>
          <div style="color: #ffd700; font-size: 14px; margin-top: 4px;">Credits</div>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="color: #ffd700; margin: 0 0 8px 0;">Statistics</h4>
        <div style="font-size: 14px;">
          <p style="margin: 4px 0;">Owned Drifters: <span style="color: #00ff00;">${state.ownedDrifters.length}</span></p>
          <p style="margin: 4px 0;">Active Missions: <span style="color: #ffff00;">${profile.activeMissions?.length || 0}</span></p>
          <p style="margin: 4px 0;">Discovered Nodes: <span style="color: #00bfff;">${profile.discoveredNodes?.length || 0}</span></p>
          <p style="margin: 4px 0;">Upgrades Owned: <span style="color: #ff69b4;">${profile.upgrades?.length || 0}</span></p>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="color: #ffd700; margin: 0 0 8px 0;">Recent Activity</h4>
        <div style="max-height: 120px; overflow-y: auto; font-size: 12px;">
          ${profile.notifications?.slice(0, 5).map(notif => `
            <div style="border-left: 2px solid #666; padding-left: 8px; margin: 8px 0;">
              <div style="color: #ffd700;">${notif.title}</div>
              <div style="color: #ccc;">${notif.message}</div>
            </div>
          `).join('') || '<p style="color: #888;">No recent activity</p>'}
        </div>
      </div>
    `;
  }

  private updateNotifications(notifications: GameNotification[]) {
    if (!this.notificationContainer) return;

    this.notificationContainer.innerHTML = notifications.map(notif => `
      <div class="notification notification-${notif.type}" style="
        background: ${this.getNotificationColor(notif.type)};
        border: 1px solid ${this.getNotificationBorderColor(notif.type)};
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 8px;
        pointer-events: auto;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      " onclick="gameState.removeNotification('${notif.id}')">
        <div style="font-weight: bold; margin-bottom: 4px; color: #fff;">${notif.title}</div>
        <div style="font-size: 12px; color: #ddd;">${notif.message}</div>
        <div style="font-size: 10px; color: #bbb; margin-top: 4px;">${this.formatTime(notif.timestamp)}</div>
      </div>
    `).join('');
  }

  private updateTopBar(state: GameState) {
    // Update credits display
    const creditsDisplay = document.getElementById('credits-amount');
    if (creditsDisplay && state.profile) {
      const credits = state.profile.balance || 0;
      console.log('Updating credits display:', credits, 'Profile:', state.profile);
      creditsDisplay.textContent = credits.toString();
    } else {
      console.log('Credits update failed - creditsDisplay:', !!creditsDisplay, 'profile:', !!state.profile);
    }

    // Update wallet info
    const addressDisplay = document.getElementById('address-display');
    if (addressDisplay && state.playerAddress) {
      addressDisplay.textContent = `${state.playerAddress.slice(0, 6)}...${state.playerAddress.slice(-4)}`;
    }

    // Update connection state
    const connectButton = document.getElementById('connect-wallet');
    const walletInfo = document.getElementById('wallet-info');
    
    if (state.isAuthenticated && state.playerAddress) {
      if (connectButton) connectButton.style.display = 'none';
      if (walletInfo) walletInfo.style.display = 'block';
    } else {
      if (connectButton) connectButton.style.display = 'block';
      if (walletInfo) walletInfo.style.display = 'none';
    }
  }

  private getNotificationColor(type: string): string {
    switch (type) {
      case 'success': return 'rgba(0, 150, 0, 0.9)';
      case 'error': return 'rgba(150, 0, 0, 0.9)';
      case 'mission': return 'rgba(0, 100, 150, 0.9)';
      case 'combat': return 'rgba(150, 100, 0, 0.9)';
      default: return 'rgba(100, 100, 100, 0.9)';
    }
  }

  private getNotificationBorderColor(type: string): string {
    switch (type) {
      case 'success': return '#00ff00';
      case 'error': return '#ff0000';
      case 'mission': return '#0088ff';
      case 'combat': return '#ffaa00';
      default: return '#888888';
    }
  }

  private formatTime(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }
}
