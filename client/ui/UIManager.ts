import type { GameState, GameNotification } from '../gameState';
import { gameState } from '../gameState';
import type { DrifterProfile, MissionType } from '@shared/models';
import { calculateLiveEstimates, formatDuration, getAvailableMissionTypes, type DrifterStats } from '../../shared/mission-utils';
import { ActiveMissionsPanel } from './ActiveMissionsPanel';

export class UIManager {
  private notificationContainer: HTMLElement | null = null;
  private missionPanel: HTMLElement | null = null;
  private mercenaryPanel: HTMLElement | null = null;
  private profilePanel: HTMLElement | null = null;
  private activeMissionsPanel: HTMLElement | null = null;
  private buttonUpdateInterval: number | null = null;

  constructor() {
    this.createUIElements();
    this.setupEventListeners();
    
    // Listen to game state changes
    gameState.onStateChange((state) => {
      this.updateUI(state);
    });
    
    // Start real-time button updates (every 5 seconds)
    this.startButtonUpdateTimer();
  }
  
  /**
   * Start a timer to update button highlighting every 5 seconds
   * This ensures the Active Missions button updates when missions complete
   */
  private startButtonUpdateTimer() {
    if (this.buttonUpdateInterval) {
      clearInterval(this.buttonUpdateInterval);
    }
    
    this.buttonUpdateInterval = setInterval(() => {
      const state = gameState.getState();
      if (state.isAuthenticated && state.playerMissions) {
        this.updateActiveMissionsButton(state);
      }
    }, 5000) as any; // Check every 5 seconds
  }
  
  /**
   * Stop the button update timer
   */
  private stopButtonUpdateTimer() {
    if (this.buttonUpdateInterval) {
      clearInterval(this.buttonUpdateInterval);
      this.buttonUpdateInterval = null;
    }
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
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 800px;
      height: 600px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #444;
      border-radius: 12px;
      padding: 20px;
      color: #fff;
      font-family: 'Courier New', monospace;
      display: none;
      z-index: 1050;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
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

    // Prevent clicks inside the mission panel from bubbling to Phaser background
    this.missionPanel.addEventListener('click', (event) => {
      event.stopPropagation();
    });

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
      } else {
        // Stop the live timer when panel is hidden
        ActiveMissionsPanel.stopLiveTimer();
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

    // Preserve scroll position of drifter list before re-render
    const drifterList = document.getElementById('drifter-list-container') as HTMLElement;
    const scrollTop = drifterList?.scrollTop || 0;

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

    // Calculate live estimates based on selected drifters and mission type
    const selectedDrifterIds = state.selectedDrifterIds || [];
    const selectedMissionType = state.selectedMissionType || 'scavenge';
    
    // Get drifter stats for the selected team
    const selectedDrifters = state.ownedDrifters.filter(d => selectedDrifterIds.includes(d.tokenId));
    const teamStats: DrifterStats[] = selectedDrifters.map(d => ({
      combat: d.combat,
      scavenging: d.scavenging, 
      tech: d.tech,
      speed: d.speed
    }));
    
    // Calculate live estimates using selected team and mission type
    const liveEstimates = calculateLiveEstimates(selectedResource, selectedMissionType, teamStats);
    const durationText = formatDuration(liveEstimates.duration);

    content.innerHTML = `
      <!-- Side-by-side layout container - full height -->
      <div style="display: flex; gap: 20px; height: 100%;">
        
        <!-- Left Panel: Node Info, Rewards, Mission Types, Start Button -->
        <div style="flex: 1; display: flex; flex-direction: column;">
          
          <!-- Node Information -->
          <div style="margin-bottom: 16px; border: 2px solid #444; border-radius: 8px; padding: 16px; background: rgba(255, 255, 255, 0.02);">
            <h4 style="color: #00ff00; margin: 0 0 12px 0; text-align: center;">${selectedResource.type.toUpperCase()} NODE</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px;">
              <p style="margin: 4px 0;">Yield: <span style="color: #ffff00; font-weight: bold;">${selectedResource.currentYield}</span></p>
              <p style="margin: 4px 0; color: #ffd700;">★ ${selectedResource.rarity.toUpperCase()}</p>
              <p style="margin: 4px 0;">Location: (${selectedResource.coordinates.x}, ${selectedResource.coordinates.y})</p>
              <p style="margin: 4px 0; color: #00bfff; font-weight: bold;">⏱️ ${durationText}</p>
            </div>
          </div>

          <!-- Expected Rewards -->
          <div style="margin-bottom: 16px;">
            <h4 style="color: #FFD700; margin: 0 0 8px 0;">Expected Rewards (${selectedMissionType.toUpperCase()})</h4>
            <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid #444; border-radius: 4px; padding: 12px;">
              <p style="margin: 4px 0; color: #ffd700; font-size: 14px;">💰 Credits: <span style="font-weight: bold;">${liveEstimates.rewards.creditsRange.min}-${liveEstimates.rewards.creditsRange.max}</span></p>
              <p style="margin: 4px 0; color: #00ff88; font-size: 14px;">📦 ${liveEstimates.rewards.resourcesRange.type.toUpperCase()}: <span style="font-weight: bold;">${liveEstimates.rewards.resourcesRange.min}-${liveEstimates.rewards.resourcesRange.max}</span></p>
              ${liveEstimates.teamStats ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #666;">
                  <p style="margin: 2px 0; color: #ccc; font-size: 12px;">⚡ Team Speed: <span style="color: #ffff66;">${liveEstimates.teamStats.speed}</span> (${liveEstimates.teamStats.speed > 100 ? 'Fast' : liveEstimates.teamStats.speed < 100 ? 'Slow' : 'Normal'})</p>
                  <p style="margin: 2px 0; color: #ccc; font-size: 12px;">🔍 Scavenging Bonus: <span style="color: #66ff66;">+${(liveEstimates.teamStats.scavengingBonus * 100).toFixed(1)}%</span></p>
                  <p style="margin: 2px 0; color: #ccc; font-size: 12px;">💻 Tech Bonus: <span style="color: #6666ff;">+${(liveEstimates.teamStats.techBonus * 100).toFixed(1)}%</span></p>
                </div>
              ` : ''}
              <p style="margin: 8px 0 0 0; color: #888; font-style: italic; font-size: 11px;">*Estimates update based on selected team and mission type</p>
            </div>
          </div>

          <!-- Mission Types -->
          <div style="margin-bottom: 16px;">
            <h4 style="color: #FFD700; margin: 0 0 8px 0;">Mission Type</h4>
            ${this.renderMissionTypes(selectedResource, state)}
          </div>
          
          <!-- Start Mission Button -->
          <div style="margin-top: auto;">
            <button id="start-mission-btn" disabled style="width: 100%; padding: 14px 24px; background: #666; border: 1px solid #888; color: #fff; cursor: not-allowed; border-radius: 6px; font-size: 16px; font-weight: bold;">
              Select Drifter & Mission Type
            </button>
          </div>
        </div>
        
        <!-- Right Panel: Team Selection - Full Height -->
        <div style="flex: 1; display: flex; flex-direction: column; height: 100%;">
          <h4 style="color: #FFD700; margin: 0 0 12px 0;">Select Team</h4>
          <div id="drifter-selection" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
            ${this.renderDrifterSelection(state.ownedDrifters, state)}
          </div>
        </div>
      </div>
    `;

    this.setupMissionPanelHandlers();
    
    // Update start button state to reflect current selections
    this.updateStartButton();
    
    // Restore scroll position after re-render
    if (scrollTop > 0) {
      requestAnimationFrame(() => {
        const newDrifterList = document.getElementById('drifter-list-container') as HTMLElement;
        if (newDrifterList) {
          newDrifterList.scrollTop = scrollTop;
        }
      });
    }
  }

  private renderDrifterSelection(drifters: DrifterProfile[], state: GameState): string {
    if (!drifters || drifters.length === 0) {
      return '<p style="color: #ff6b6b; font-size: 12px;">No owned Drifters available. You need to own Fringe Drifters NFTs to start missions.</p>';
    }

    // Filter out drifters that are on active missions
    const busyDrifterIds = new Set(
      state.playerMissions
        .filter(m => m.status === 'active')
        .flatMap(m => m.drifterIds)
    );

    // Sort drifters based on selected sort criteria
    const sortedDrifters = [...drifters].sort((a, b) => {
      const sortBy = state.drifterSortBy;
      return b[sortBy] - a[sortBy]; // Descending order (highest first)
    });

    // Limit to max 12 drifters
    const displayDrifters = sortedDrifters.slice(0, 12);
    const selectedIds = state.selectedDrifterIds || [];

    return `
      <!-- Sort Controls -->
      <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <label style="font-size: 12px; color: #ccc;">Sort by:</label>
        <select id="drifter-sort-select" style="
          background: #333; 
          border: 1px solid #666; 
          color: #fff; 
          padding: 4px 8px; 
          border-radius: 4px;
          font-size: 12px;
        ">
          <option value="combat" ${state.drifterSortBy === 'combat' ? 'selected' : ''}>Combat</option>
          <option value="scavenging" ${state.drifterSortBy === 'scavenging' ? 'selected' : ''}>Scavenging</option>
          <option value="tech" ${state.drifterSortBy === 'tech' ? 'selected' : ''}>Tech</option>
          <option value="speed" ${state.drifterSortBy === 'speed' ? 'selected' : ''}>Speed</option>
        </select>
        <span style="font-size: 11px; color: #888;">(Showing ${displayDrifters.length}/${drifters.length})</span>
      </div>

      <!-- Drifter List -->
      <div id="drifter-list-container" style="flex: 1; overflow-y: auto; margin-bottom: 12px; min-height: 0; max-height: 405px;">
        ${displayDrifters.map(drifter => {
          const isSelected = selectedIds.includes(drifter.tokenId);
          const isBusy = busyDrifterIds.has(drifter.tokenId);
          
          return `
            <div class="drifter-option" data-id="${drifter.tokenId}" data-busy="${isBusy}" style="
              border: 2px solid ${isSelected ? '#00ff00' : (isBusy ? '#666' : '#444')}; 
              padding: 8px; 
              margin: 4px 0; 
              cursor: ${isBusy ? 'not-allowed' : 'pointer'}; 
              border-radius: 4px;
              background: ${isSelected ? 'rgba(0, 255, 0, 0.1)' : (isBusy ? 'rgba(100, 100, 100, 0.3)' : 'rgba(255, 255, 255, 0.05)')};
              opacity: ${isBusy ? '0.6' : '1'};
              position: relative;
            ">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <img 
                    src="/images/drifters/thumbnails/${drifter.tokenId}.jpeg"
                    alt="${drifter.name} #${drifter.tokenId}"
                    style="width: 48px; height: 48px; border-radius: 4px; object-fit: cover; border: 1px solid #333;"
                    onerror="this.style.display='none'"
                  />
                  <div style="
                    width: 16px; 
                    height: 16px; 
                    border: 2px solid ${isSelected ? '#00ff00' : '#666'}; 
                    border-radius: 3px;
                    background: ${isSelected ? '#00ff00' : 'transparent'};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  ">
                    ${isSelected ? '<span style="color: #000; font-size: 10px; font-weight: bold;">✓</span>' : ''}
                  </div>
                  <strong style="color: ${isBusy ? '#999' : '#fff'};">${drifter.name} #${drifter.tokenId}</strong>
                </div>
                <div style="font-size: 11px;">
                  ${isBusy ? '<span style="color: #ff6666;">ON MISSION</span>' : '<span style="color: #00ff00;">OWNED</span>'}
                </div>
              </div>
              <div style="font-size: 11px; color: #ccc; margin-top: 4px;">
                Combat: <span style="color: #ff6666;">${drifter.combat}</span> | 
                Scavenging: <span style="color: #66ff66;">${drifter.scavenging}</span> | 
                Tech: <span style="color: #6666ff;">${drifter.tech}</span> | 
                Speed: <span style="color: #ffff66;">${drifter.speed}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      ${this.renderTeamSummary(selectedIds, drifters)}
    `;
  }

  private renderTeamSummary(selectedIds: number[], drifters: DrifterProfile[]): string {
    if (selectedIds.length === 0) {
      return `
        <div style="
          background: rgba(100, 100, 100, 0.2); 
          border: 1px solid #666; 
          border-radius: 4px; 
          padding: 12px; 
          text-align: center;
        ">
          <p style="margin: 0; color: #999; font-size: 12px;">Select drifters to see team summary</p>
        </div>
      `;
    }

    const selectedDrifters = drifters.filter(d => selectedIds.includes(d.tokenId));
    const totalCombat = selectedDrifters.reduce((sum, d) => sum + d.combat, 0);
    const totalScavenging = selectedDrifters.reduce((sum, d) => sum + d.scavenging, 0);
    const totalTech = selectedDrifters.reduce((sum, d) => sum + d.tech, 0);
    const slowestSpeed = Math.min(...selectedDrifters.map(d => d.speed));
    const teamSize = selectedIds.length;

    return `
      <div style="
        background: rgba(255, 215, 0, 0.1); 
        border: 2px solid #ffd700; 
        border-radius: 6px; 
        padding: 12px;
      ">
        <h5 style="margin: 0 0 8px 0; color: #ffd700;">Team Summary (${teamSize} drifter${teamSize > 1 ? 's' : ''})</h5>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
          <div>Combat: <span style="color: #ff6666; font-weight: bold;">${totalCombat}</span></div>
          <div>Scavenging: <span style="color: #66ff66; font-weight: bold;">${totalScavenging}</span></div>
          <div>Tech: <span style="color: #6666ff; font-weight: bold;">${totalTech}</span></div>
          <div>Speed: <span style="color: #ffff66; font-weight: bold;">${slowestSpeed}</span> (slowest)</div>
        </div>
      </div>
    `;
  }

  private renderMissionTypes(selectedResource: any, state: GameState): string {
    const availableMissionTypes = getAvailableMissionTypes(
      selectedResource,
      state.activeMissions,
      state.playerAddress
    );

    if (availableMissionTypes.length === 0) {
      return `
        <div style="
          background: rgba(100, 100, 100, 0.2); 
          border: 1px solid #666; 
          border-radius: 4px; 
          padding: 12px; 
          text-align: center;
        ">
          <p style="margin: 0; color: #999; font-size: 12px;">No mission types available for this node</p>
        </div>
      `;
    }

    const selectedMissionType = state.selectedMissionType;

    return `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        ${availableMissionTypes.map(missionType => {
          const isSelected = selectedMissionType === missionType.type;
          return `
            <button 
              class="mission-type-btn" 
              data-type="${missionType.type}" 
              style="
                background: ${isSelected ? '#ffd700' : missionType.color}; 
                border: 2px solid ${isSelected ? '#ffff00' : missionType.borderColor}; 
                color: ${isSelected ? '#000' : '#fff'}; 
                padding: 8px; 
                cursor: ${missionType.enabled ? 'pointer' : 'not-allowed'}; 
                border-radius: 4px;
                opacity: ${missionType.enabled ? (isSelected ? '1' : '0.7') : '0.6'};
                transform: ${isSelected ? 'scale(1.05)' : 'scale(1)'};
                box-shadow: ${isSelected ? '0 0 12px rgba(255, 215, 0, 0.6)' : 'none'};
                font-weight: ${isSelected ? 'bold' : 'normal'};
                transition: all 0.2s ease;
              "
              ${!missionType.enabled ? 'disabled' : ''}
            >
              ${missionType.name}<br><small>${missionType.description}</small>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  private setupMissionPanelHandlers() {
    const state = gameState.getState();

    // Drifter selection - handle multi-selection
    document.querySelectorAll('.drifter-option').forEach(option => {
      option.addEventListener('click', (event) => {
        event.preventDefault();
        const drifterId = parseInt(option.getAttribute('data-id') || '0');
        const isBusy = option.getAttribute('data-busy') === 'true';
        
        // Don't allow selection of busy drifters
        if (isBusy) return;
        
        // Toggle selection in game state
        gameState.toggleDrifterSelection(drifterId);
        
        // Update estimates when drifter selection changes
        setTimeout(() => this.updateMissionPanel(gameState.getState()), 50);
      });
    });

    // Drifter sort dropdown
    const sortSelect = document.getElementById('drifter-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (event) => {
        const sortBy = (event.target as HTMLSelectElement).value as 'combat' | 'scavenging' | 'tech' | 'speed';
        gameState.setDrifterSortBy(sortBy);
      });
    }

    // Mission type selection
    document.querySelectorAll('.mission-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const missionType = btn.getAttribute('data-type');
        gameState.setMissionType(missionType);
        
        // Update estimates when mission type changes
        this.updateMissionPanel(gameState.getState());
      });
    });

    // Start mission button
    document.getElementById('start-mission-btn')?.addEventListener('click', async () => {
      const currentState = gameState.getState();
      const selectedIds = currentState.selectedDrifterIds || [];
      const missionType = currentState.selectedMissionType;
      
      if (selectedIds.length > 0 && missionType && currentState.selectedResourceNode) {
        // Send all selected drifters to the backend
        const result = await gameState.startMission(
          selectedIds, 
          currentState.selectedResourceNode, 
          missionType as any
        );
        
        if (result.success) {
          // Clear selections and close panel
          gameState.clearSelectedDrifters();
          gameState.setMissionType(null);
          gameState.toggleMissionPanel();
        }
      }
    });
  }

  private updateStartButton() {
    const button = document.getElementById('start-mission-btn') as HTMLButtonElement;
    if (!button) return;

    const state = gameState.getState();
    const selectedIds = state.selectedDrifterIds || [];
    const missionType = state.selectedMissionType;

    if (selectedIds.length > 0 && missionType) {
      button.disabled = false;
      button.style.background = '#2c5530';
      button.style.cursor = 'pointer';
      const teamText = selectedIds.length === 1 ? '1 Drifter' : `${selectedIds.length} Drifters`;
      button.textContent = `Start ${missionType.toUpperCase()} Mission (${teamText})`;
    } else {
      button.disabled = true;
      button.style.background = '#666';
      button.style.cursor = 'not-allowed';
      if (selectedIds.length === 0 && !missionType) {
        button.textContent = 'Select Drifters & Mission Type';
      } else if (selectedIds.length === 0) {
        button.textContent = 'Select Drifters';
      } else {
        button.textContent = 'Select Mission Type';
      }
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
    
    // Update Active Missions button highlighting
    this.updateActiveMissionsButton(state);
  }
  
  /**
   * Check if there are completed missions ready for reward collection
   */
  private hasCompletedMissions(state: GameState): boolean {
    if (!state.playerMissions || state.playerMissions.length === 0) {
      return false;
    }
    
    const now = new Date();
    return state.playerMissions.some(mission => {
      if (mission.status !== 'active') return false;
      
      const completionTime = mission.completionTime instanceof Date 
        ? mission.completionTime 
        : new Date(mission.completionTime);
      
      return now >= completionTime;
    });
  }
  
  /**
   * Update the Active Missions button with highlighting when rewards are ready
   */
  private updateActiveMissionsButton(state: GameState) {
    const button = document.getElementById('toggle-missions');
    if (!button) return;
    
    const hasCompleted = this.hasCompletedMissions(state);
    const completedCount = this.getCompletedMissionsCount(state);
    
    if (hasCompleted) {
      // Highlight the button when there are completed missions
      button.style.background = 'linear-gradient(45deg, #FFD700, #FFA500)';
      button.style.border = '2px solid #FFD700';
      button.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.6)';
      button.style.animation = 'pulse 2s infinite';
      button.style.color = '#000';
      button.style.fontWeight = 'bold';
      
      // Update button text to show count
      if (completedCount === 1) {
        button.textContent = 'Active Missions (1 Complete!)';
      } else {
        button.textContent = `Active Missions (${completedCount} Complete!)`;
      }
    } else {
      // Reset to normal styling
      button.style.background = '#444';
      button.style.border = '1px solid #666';
      button.style.boxShadow = 'none';
      button.style.animation = 'none';
      button.style.color = '#fff';
      button.style.fontWeight = 'normal';
      button.textContent = 'Active Missions';
    }
  }
  
  /**
   * Get the count of completed missions ready for collection
   */
  private getCompletedMissionsCount(state: GameState): number {
    if (!state.playerMissions || state.playerMissions.length === 0) {
      return 0;
    }
    
    const now = new Date();
    return state.playerMissions.filter(mission => {
      if (mission.status !== 'active') return false;
      
      const completionTime = mission.completionTime instanceof Date 
        ? mission.completionTime 
        : new Date(mission.completionTime);
      
      return now >= completionTime;
    }).length;
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
