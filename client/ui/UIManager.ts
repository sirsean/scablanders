import type { GameState, GameNotification } from '../gameState';
import { gameState } from '../gameState';
import { getVehicleData } from '../utils/vehicleUtils';
import type { DrifterProfile, MissionType } from '@shared/models';
import { calculateLiveEstimates, formatDuration, getAvailableMissionTypes, type DrifterStats, BASE_SPEED } from '../../shared/mission-utils';
import { ActiveMissionsPanel } from './ActiveMissionsPanel';
import { MarketPanel } from './MarketPanel';
import { VehiclePanel } from './VehiclePanel';
import { LogPanel } from './LogPanel';
import { DrifterInfoPanel } from './DrifterInfoPanel';

export class UIManager {
	private notificationContainer: HTMLElement | null = null;
	private missionPanel: HTMLElement | null = null;
	private mercenaryPanel: HTMLElement | null = null;
	private profilePanel: HTMLElement | null = null;
	private activeMissionsPanel: HTMLElement | null = null;
	private marketPanel: HTMLElement | null = null;
	private vehiclePanel: HTMLElement | null = null;
	private logPanel: HTMLElement | null = null;
	private drifterInfoPanel: HTMLElement | null = null;
	private buttonUpdateInterval: number | null = null;

	constructor() {
		this.createUIElements();
		this.setupEventListeners();

		// Reflow on window resize
		window.addEventListener('resize', () => this.layoutOpenPanels());

		// Reflow when panels change visibility outside of gameState (e.g., DrifterInfoPanel)
		window.addEventListener('ui:reflow-panels' as any, () => this.layoutOpenPanels());
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
		this.createActionMenu();
		this.createMissionPanel();
		this.createMercenaryPanel();
		this.createProfilePanel();
		this.createActiveMissionsPanel();
		this.createMarketPanel();
		this.createVehiclePanel();
		this.createLogPanel();
		this.createDrifterInfoPanel();
	}

	private createActionMenu() {
		const menu = document.createElement('div');
		menu.id = 'action-menu';
		menu.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 1100;
      pointer-events: auto;
    `;

		// Action buttons (vertical) - desired order top->bottom
		const buttons: { id: string; label: string }[] = [
			{ id: 'toggle-profile', label: 'Profile (P)' },
			{ id: 'toggle-mercenaries', label: 'Drifters (D)' },
			{ id: 'toggle-vehicles', label: 'Vehicles (V)' },
			{ id: 'toggle-market', label: 'Market (M)' },
			{ id: 'toggle-missions', label: 'Active Missions (A)' },
			{ id: 'toggle-log', label: 'Log (L)' },
		];

		for (const b of buttons) {
			const btn = document.createElement('button');
			btn.id = b.id;
			btn.textContent = b.label;
			btn.className = 'button';
			menu.appendChild(btn);
		}

		// Wallet controls (should be at the bottom)
		const connectButton = document.createElement('button');
		connectButton.id = 'connect-wallet';
		connectButton.textContent = 'Connect Wallet';
		connectButton.className = 'button';

		const walletInfo = document.createElement('div');
		walletInfo.id = 'wallet-info';
		walletInfo.style.display = 'none';
		walletInfo.style.cssText = 'display: none;';

		const addressDisplay = document.createElement('div');
		addressDisplay.id = 'address-display';
		addressDisplay.style.cssText = 'padding: 6px; background: #222; border: 1px solid #444; color: #fff; font-size: 12px;';
		walletInfo.appendChild(addressDisplay);

		const disconnectButton = document.createElement('button');
		disconnectButton.id = 'disconnect-wallet';
		disconnectButton.textContent = 'Disconnect';
		disconnectButton.className = 'button';
		walletInfo.appendChild(disconnectButton);

		// Append wallet controls last (bottom of stack)
		menu.appendChild(walletInfo);
		menu.appendChild(connectButton);

		document.body.appendChild(menu);
	}

	private createNotificationContainer() {
		this.notificationContainer = document.createElement('div');
		this.notificationContainer.id = 'notifications';
		this.notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 350px;
      z-index: 10000;
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
      width: 800px;
      max-height: 700px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #444;
      border-radius: 12px;
      padding: 20px;
      color: #fff;
      font-family: 'Courier New', monospace;
      display: none;
      z-index: 1050;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
      overflow-y: auto;
    `;
		// Base width and unified z-index
		(this.missionPanel as any).dataset.baseWidth = '800';
		this.missionPanel.style.zIndex = '1050';

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
		// Base width and unified z-index
		(this.mercenaryPanel as any).dataset.baseWidth = '400';
		this.mercenaryPanel.style.zIndex = '1050';

		this.mercenaryPanel.innerHTML = `
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; color: #FFD700;">Owned Drifters</h3>
        <button id="close-mercenary-panel" style="background: none; border: 1px solid #666; color: #fff; padding: 4px 8px; cursor: pointer; margin-left: auto;">✕</button>
      </div>
      <div id="mercenary-content">
        <p>Loading drifters...</p>
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
		// Base width and unified z-index
		(this.profilePanel as any).dataset.baseWidth = '500';
		this.profilePanel.style.zIndex = '1050';

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

	private createMarketPanel() {
		this.marketPanel = MarketPanel.createMarketPanel();
		document.body.appendChild(this.marketPanel);
	}

	private createVehiclePanel() {
		this.vehiclePanel = VehiclePanel.createVehiclePanel();
		document.body.appendChild(this.vehiclePanel);
	}

	private createLogPanel() {
		this.logPanel = LogPanel.createLogPanel();
		document.body.appendChild(this.logPanel);
	}

	private createDrifterInfoPanel() {
		this.drifterInfoPanel = DrifterInfoPanel.createDrifterInfoPanel();
		document.body.appendChild(this.drifterInfoPanel);
		(window as any).openDrifterInfo = (tokenId: number) => DrifterInfoPanel.open(tokenId);
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

		document.getElementById('close-market-panel')?.addEventListener('click', () => {
			gameState.toggleMarketPanel();
		});
		document.getElementById('close-log-panel')?.addEventListener('click', () => {
			gameState.toggleLogPanel();
		});

		document.getElementById('toggle-market')?.addEventListener('click', () => {
			gameState.toggleMarketPanel();
		});

		document.getElementById('toggle-vehicles')?.addEventListener('click', () => {
			gameState.toggleVehiclePanel();
		});

		// Action menu buttons
		document.getElementById('toggle-mercenaries')?.addEventListener('click', () => {
			gameState.toggleMercenaryPanel();
		});
		document.getElementById('toggle-missions')?.addEventListener('click', () => {
			gameState.toggleActiveMissionsPanel();
		});
		document.getElementById('toggle-profile')?.addEventListener('click', () => {
			gameState.toggleProfilePanel();
		});
		document.getElementById('toggle-log')?.addEventListener('click', () => {
			gameState.toggleLogPanel();
		});

		document.getElementById('close-vehicle-panel')?.addEventListener('click', () => {
			gameState.toggleVehiclePanel();
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
				case 'a':
				case 'A':
					gameState.toggleActiveMissionsPanel();
					break;
				case 'm':
				case 'M':
					gameState.toggleMarketPanel();
					break;
				case 'v':
				case 'V':
					gameState.toggleVehiclePanel();
					break;
				case 'd':
				case 'D':
					gameState.toggleMercenaryPanel();
					break;
				case 'p':
				case 'P':
					gameState.toggleProfilePanel();
					break;
				case 'l':
				case 'L':
					gameState.toggleLogPanel();
					break;
			}
		});
	}

	private updateUI(state: GameState) {
		// Update panel visibility
		if (this.missionPanel) {
			this.missionPanel.style.display = state.showMissionPanel ? 'block' : 'none';
			this.updateMissionPanel(state);
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
					state.isLoadingPlayerMissions,
				);
			} else {
				// Stop the live timer when panel is hidden
				ActiveMissionsPanel.stopLiveTimer();
			}
		}

		if (this.marketPanel) {
			this.marketPanel.style.display = state.showMarketPanel ? 'block' : 'none';
			if (state.showMarketPanel) {
				MarketPanel.updateMarketPanel(state.availableVehicles, state.isLoadingMarket);
			}
		}

		if (this.vehiclePanel) {
			this.vehiclePanel.style.display = state.showVehiclePanel ? 'block' : 'none';
			if (state.showVehiclePanel && state.profile) {
				VehiclePanel.updateVehiclePanel(state.profile.vehicles);
			}
		}

		if (this.logPanel) {
			this.logPanel.style.display = state.showLogPanel ? 'block' : 'none';
			if (state.showLogPanel) {
				LogPanel.updateLogPanel(state.eventLog);
				// Start live timer to refresh relative timestamps while open
				LogPanel.startLiveTimer(() => gameState.getState().eventLog);
			} else {
				// Stop live timer when hidden
				LogPanel.stopLiveTimer();
			}
		}

		// Update notifications
		this.updateNotifications(state.notifications);

		// Update top bar info
		this.updateTopBar(state);

		// Reflow panels in a tiled layout
		this.layoutOpenPanels();
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
		const selectedResource = state.resourceNodes?.find((r) => r.id === state.selectedResourceNode);
		if (!selectedResource) {
			content.innerHTML = '<p>Resource node data not available.</p>';
			return;
		}

		// Calculate live estimates based on selected drifters and mission type
		const selectedDrifterIds = state.selectedDrifterIds || [];
		const selectedMissionType = state.selectedMissionType || 'scavenge';

		// Get drifter stats for the selected team (effective)
		const selectedDrifters = state.ownedDrifters.filter((d) => selectedDrifterIds.includes(d.tokenId));
		const teamStats: DrifterStats[] = selectedDrifters.map((d) => {
			const dp = state.profile?.drifterProgress?.[String(d.tokenId)];
			return {
				combat: d.combat + (dp?.bonuses.combat || 0),
				scavenging: d.scavenging + (dp?.bonuses.scavenging || 0),
				tech: d.tech + (dp?.bonuses.tech || 0),
				speed: d.speed + (dp?.bonuses.speed || 0),
			};
		});

		const selectedVehicleInstance = state.profile?.vehicles.find((v) => v.instanceId === state.selectedVehicleInstanceId);
		const selectedVehicle = selectedVehicleInstance ? getVehicleData(selectedVehicleInstance.vehicleId) : undefined;

		// Calculate live estimates using selected team and mission type
		const liveEstimates = calculateLiveEstimates(selectedResource, selectedMissionType, teamStats, selectedVehicle);
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
              ${
								liveEstimates.teamStats
									? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #666;">
<p style=\"margin: 2px 0; color: #ccc; font-size: 12px;\">⚡ Team Speed: <span style=\"color: #ffff66;\">${liveEstimates.teamStats.speed}</span> (${liveEstimates.teamStats.speed > BASE_SPEED ? 'Fast' : liveEstimates.teamStats.speed < BASE_SPEED ? 'Slow' : 'Normal'})</p>
                  <p style="margin: 2px 0; color: #ccc; font-size: 12px;">🔍 Scavenging Bonus: <span style="color: #66ff66;">+${(liveEstimates.teamStats.scavengingBonus * 100).toFixed(1)}%</span></p>
                  <p style="margin: 2px 0; color: #ccc; font-size: 12px;">💻 Tech Bonus: <span style="color: #6666ff;">+${(liveEstimates.teamStats.techBonus * 100).toFixed(1)}%</span></p>
                </div>
              `
									: ''
							}
              <p style="margin: 8px 0 0 0; color: #888; font-style: italic; font-size: 11px;">*Estimates update based on selected team and mission type</p>
            </div>
          </div>

          <!-- Mission Types -->
          <div style="margin-bottom: 16px;">
            <h4 style="color: #FFD700; margin: 0 0 8px 0;">Mission Type</h4>
            ${this.renderMissionTypes(selectedResource, state)}
          </div>

          <!-- Vehicle Selection -->
          <div style="margin-bottom: 16px;">
            <h4 style="color: #FFD700; margin: 0 0 8px 0;">Vehicle</h4>
            ${this.renderVehicleSelection(state)}
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

		const selectedVehicleInstance = state.profile?.vehicles.find((v) => v.instanceId === state.selectedVehicleInstanceId);
		const selectedVehicle = selectedVehicleInstance ? getVehicleData(selectedVehicleInstance.vehicleId) : undefined;
		const maxDrifters = selectedVehicle?.maxDrifters || 0;

		// Filter out drifters that are on active missions
		const busyDrifterIds = new Set(state.playerMissions.filter((m) => m.status === 'active').flatMap((m) => m.drifterIds));

		// Sort drifters based on availability first, then by selected sort criteria
		const sortedDrifters = [...drifters].sort((a, b) => {
			const aIsBusy = busyDrifterIds.has(a.tokenId);
			const bIsBusy = busyDrifterIds.has(b.tokenId);

			if (aIsBusy && !bIsBusy) {
				return 1; // a (busy) comes after b (available)
			}
			if (!aIsBusy && bIsBusy) {
				return -1; // a (available) comes before b (busy)
			}

			const sortBy = state.drifterSortBy;
			return b[sortBy] - a[sortBy]; // Descending order (highest first)
		});

		const displayDrifters = sortedDrifters;
		const selectedIds = state.selectedDrifterIds || [];
		const atCapacity = selectedVehicle && selectedIds.length >= maxDrifters;

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
		<span style="font-size: 11px; color: ${atCapacity ? '#ff6b6b' : '#ccc'}; margin-left: auto;">
		  ${selectedIds.length} / ${maxDrifters > 0 ? maxDrifters : '-'} Drifters Selected
		</span>
      </div>

      <!-- Drifter List -->
      <div id="drifter-list-container" style="flex: 1; overflow-y: auto; margin-bottom: 12px; min-height: 0; max-height: 405px;">
        ${displayDrifters
					.map((drifter) => {
						const isSelected = selectedIds.includes(drifter.tokenId);
						const isBusy = busyDrifterIds.has(drifter.tokenId);
						const isDisabled = (atCapacity && !isSelected) || isBusy;

						return `
            <div class="drifter-option" data-id="${drifter.tokenId}" data-busy="${isBusy}" style="
              border: 2px solid ${isSelected ? '#00ff00' : isBusy ? '#666' : '#444'};
              padding: 8px;
              margin: 4px 0;
              cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
              border-radius: 4px;
              background: ${isSelected ? 'rgba(0, 255, 0, 0.1)' : isBusy ? 'rgba(100, 100, 100, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
              opacity: ${isDisabled ? '0.6' : '1'};
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
                ${(() => { const dp = gameState.getState().profile?.drifterProgress?.[String(drifter.tokenId)]; const b = dp?.bonuses || { combat:0, scavenging:0, tech:0, speed:0 }; return `Combat: <span style=\\\"color: #ff6666;\\\">${drifter.combat + (b.combat||0)}</span> ${b.combat?`(<span style=\\\"color:#ff9999;\\\">+${b.combat}</span>)`:''} | Scavenging: <span style=\\\"color: #66ff66;\\\">${drifter.scavenging + (b.scavenging||0)}</span> ${b.scavenging?`(<span style=\\\"color:#aaffaa;\\\">+${b.scavenging}</span>)`:''} | Tech: <span style=\\\"color: #6666ff;\\\">${drifter.tech + (b.tech||0)}</span> ${b.tech?`(<span style=\\\"color:#99aaff;\\\">+${b.tech}</span>)`:''} | Speed: <span style=\\\"color: #ffff66;\\\">${drifter.speed + (b.speed||0)}</span> ${b.speed?`(<span style=\\\"color:#ffff99;\\\">+${b.speed}</span>)`:''}`})()}
              </div>
            </div>
          `;
					})
					.join('')}
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

		const selectedDrifters = drifters.filter((d) => selectedIds.includes(d.tokenId));
		const totalCombat = selectedDrifters.reduce((sum, d) => sum + d.combat, 0);
		const totalScavenging = selectedDrifters.reduce((sum, d) => sum + d.scavenging, 0);
		const totalTech = selectedDrifters.reduce((sum, d) => sum + d.tech, 0);
		const slowestSpeed = Math.min(...selectedDrifters.map((d) => d.speed));
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
		const availableMissionTypes = getAvailableMissionTypes(selectedResource, state.activeMissions, state.playerAddress);

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
        ${availableMissionTypes
					.map((missionType) => {
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
					})
					.join('')}
      </div>
    `;
	}

	private renderVehicleSelection(state: GameState): string {
		const selectedVehicleInstanceId = state.selectedVehicleInstanceId;
		const selectedVehicleInstance = state.profile?.vehicles.find((v) => v.instanceId === selectedVehicleInstanceId);
		const selectedVehicle = selectedVehicleInstance ? getVehicleData(selectedVehicleInstance.vehicleId) : undefined;

		return `
		  <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.05); border-radius: 4px; padding: 12px;">
			<div>
			  <p style="margin: 0; font-size: 14px; color: #ccc;">Selected Vehicle:</p>
			  <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #00ff00;">${selectedVehicle ? selectedVehicle.name : 'None'}</p>
			</div>
			<button id="select-vehicle-btn" style="background: #444; border: 1px solid #666; color: #fff; padding: 8px 16px; cursor: pointer; border-radius: 4px;">
			  ${selectedVehicleInstanceId ? 'Change' : 'Select'} Vehicle
			</button>
		  </div>
		`;
	}

	private setupMissionPanelHandlers() {
		const state = gameState.getState();

		// Drifter selection - handle multi-selection
		document.querySelectorAll('.drifter-option').forEach((option) => {
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
		document.querySelectorAll('.mission-type-btn').forEach((btn) => {
			btn.addEventListener('click', () => {
				const missionType = btn.getAttribute('data-type');
				gameState.setMissionType(missionType);

				// Update estimates when mission type changes
				this.updateMissionPanel(gameState.getState());
			});
		});

		document.getElementById('select-vehicle-btn')?.addEventListener('click', () => {
			gameState.toggleVehiclePanel();
		});

		// Start mission button
		document.getElementById('start-mission-btn')?.addEventListener('click', async () => {
			const currentState = gameState.getState();
			const selectedIds = currentState.selectedDrifterIds || [];
			const missionType = currentState.selectedMissionType;
			const vehicleInstanceId = currentState.selectedVehicleInstanceId;

			if (selectedIds.length > 0 && missionType && currentState.selectedResourceNode) {
				// Send all selected drifters to the backend
				const result = await gameState.startMission(selectedIds, currentState.selectedResourceNode, missionType as any, vehicleInstanceId);

				if (result.success) {
					// Clear selections and close panel
					gameState.clearSelectedDrifters();
					gameState.setMissionType(null);
					gameState.selectVehicleInstance(null);
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
		const vehicleInstanceId = state.selectedVehicleInstanceId;
		const selectedVehicleInstance = state.profile?.vehicles.find((v) => v.instanceId === vehicleInstanceId);
		const selectedVehicle = selectedVehicleInstance ? getVehicleData(selectedVehicleInstance.vehicleId) : undefined;
		const maxDrifters = selectedVehicle ? selectedVehicle.maxDrifters : Number.POSITIVE_INFINITY;

		if (selectedIds.length > 0 && missionType && selectedIds.length <= maxDrifters) {
			button.disabled = false;
			button.style.background = '#2c5530';
			button.style.cursor = 'pointer';
			const teamText = selectedIds.length === 1 ? '1 Drifter' : `${selectedIds.length} Drifters`;
			button.textContent = `Start ${missionType.toUpperCase()} Mission (${teamText})`;
		} else {
			button.disabled = true;
			button.style.background = '#666';
			button.style.cursor = 'not-allowed';
			if (selectedIds.length === 0) {
				button.textContent = 'Select Drifters';
			} else if (!missionType) {
				button.textContent = 'Select Mission Type';
			} else if (selectedIds.length > maxDrifters) {
				button.textContent = `Too many drifters for ${selectedVehicle?.name}`;
			} else {
				button.textContent = 'Select Drifters & Mission Type';
			}
		}
	}

	private updateMercenaryPanel(state: GameState) {
		const content = document.getElementById('mercenary-content');
		if (!content) return;

		if (state.isLoadingProfile) {
			content.innerHTML = '<p>Loading drifters...</p>';
			return;
		}

		if (!state.ownedDrifters.length) {
			content.innerHTML = '<p>No drifters available.</p>';
			return;
		}

		const owned = state.ownedDrifters;

		content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h4 style="color: #00ff00; margin: 0 0 8px 0;">Owned Drifters (${owned.length})</h4>
        <div style="max-height: 400px; overflow-y: auto;">
          ${
            owned
              .map((merc) => {
                const dp = state.profile?.drifterProgress?.[String(merc.tokenId)];
                const b = dp?.bonuses || { combat:0, scavenging:0, tech:0, speed:0 };
                return `
            <div class=\"owned-drifter-row\" data-id=\"${merc.tokenId}\" style=\"border: 1px solid #00ff00; padding: 6px; margin: 4px 0; border-radius: 4px; font-size: 12px; cursor: pointer;\">
              <strong>${merc.name} #${merc.tokenId}</strong>
              <div style=\"color: #ccc;\">Combat: ${merc.combat + (b.combat||0)} ${b.combat?`(+${b.combat})`:''} | Scavenging: ${merc.scavenging + (b.scavenging||0)} ${b.scavenging?`(+${b.scavenging})`:''} | Tech: ${merc.tech + (b.tech||0)} ${b.tech?`(+${b.tech})`:''} | Speed: ${merc.speed + (b.speed||0)} ${b.speed?`(+${b.speed})`:''}</div>
            </div>
          `;
              })
              .join('') || '<p style=\"color: #888; font-size: 12px;\">No owned Drifters</p>'
          }
        </div>
      </div>
    `;

		// Click to open DrifterInfo
		document.querySelectorAll('.owned-drifter-row').forEach((row) => {
			row.addEventListener('click', () => {
				const id = Number((row as HTMLElement).getAttribute('data-id'));
				(window as any).openDrifterInfo?.(id);
			});
		});
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

		// Recent activity: derive from global event log filtered to this player
		const recentForPlayer = (state.eventLog || []).filter((e: any) => e.playerAddress && state.playerAddress && e.playerAddress.toLowerCase() === state.playerAddress.toLowerCase()).slice(0, 10);

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
          <p style="margin: 4px 0;">Vehicles Owned: <span style="color: #00bfff;">${profile.vehicles?.length || 0}</span></p>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="color: #ffd700; margin: 0 0 8px 0;">Recent Activity</h4>
        <div style="max-height: 160px; overflow-y: auto; font-size: 12px;">
          ${
            recentForPlayer.length
              ? recentForPlayer
                  .map(
                    (ev) => `
            <div style="border-left: 2px solid #666; padding-left: 8px; margin: 8px 0;">
              <div style="color: #ffd700;">${this.formatTime(ev.timestamp)}</div>
              <div style="color: #ccc;">${ev.message}</div>
            </div>
          `,
                  )
                  .join('')
              : '<p style="color: #888;">No recent activity</p>'
          }
        </div>
      </div>
    `;
	}

	private updateNotifications(notifications: GameNotification[]) {
		if (!this.notificationContainer) return;

		this.notificationContainer.innerHTML = notifications
			.map(
				(notif) => `
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
    `,
			)
			.join('');
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
		return state.playerMissions.some((mission) => {
			if (mission.status !== 'active') return false;

			const completionTime = mission.completionTime instanceof Date ? mission.completionTime : new Date(mission.completionTime);

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

			// Update button text to show count (preserve shortcut key)
			if (completedCount === 1) {
				button.textContent = 'Active Missions (A) (1 Complete!)';
			} else {
				button.textContent = `Active Missions (A) (${completedCount} Complete!)`;
			}
		} else {
			// Reset to normal styling
			button.style.background = '#444';
			button.style.border = '1px solid #666';
			button.style.boxShadow = 'none';
			button.style.animation = 'none';
			button.style.color = '#fff';
			button.style.fontWeight = 'normal';
			button.textContent = 'Active Missions (A)';
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
		return state.playerMissions.filter((mission) => {
			if (mission.status !== 'active') return false;

			const completionTime = mission.completionTime instanceof Date ? mission.completionTime : new Date(mission.completionTime);

			return now >= completionTime;
		}).length;
	}

	private getNotificationColor(type: string): string {
		switch (type) {
			case 'success':
				return 'rgba(0, 150, 0, 0.9)';
			case 'error':
				return 'rgba(150, 0, 0, 0.9)';
			case 'mission':
				return 'rgba(0, 100, 150, 0.9)';
			case 'combat':
				return 'rgba(150, 100, 0, 0.9)';
			default:
				return 'rgba(100, 100, 100, 0.9)';
		}
	}

	private getNotificationBorderColor(type: string): string {
		switch (type) {
			case 'success':
				return '#00ff00';
			case 'error':
				return '#ff0000';
			case 'mission':
				return '#0088ff';
			case 'combat':
				return '#ffaa00';
			default:
				return '#888888';
		}
	}

	private layoutOpenPanels() {
		const margin = 20;
		const gap = 12;
		const maxRowWidth = window.innerWidth - margin * 2;

		// Explicit ordering (left-to-right) per spec
		const order: (HTMLElement | null)[] = [
			this.profilePanel,
			this.logPanel,
			this.activeMissionsPanel,
			this.mercenaryPanel,
			this.drifterInfoPanel,
			this.missionPanel,
			this.vehiclePanel,
			this.marketPanel,
		];

		const panels: HTMLElement[] = order.filter(
			(p): p is HTMLElement => !!p && p.style.display !== 'none',
		);

		// Track position within the content area (excluding margins)
		let x = 0;
		let y = 0;
		let rowHeight = 0;

		for (const panel of panels) {
			// Unified z-index
			panel.style.zIndex = '1050';
			// Reset any conflicting positioning
			panel.style.right = '';
			panel.style.bottom = '';

			// Use dataset/style width as target width, then measure real box width for spacing (includes padding/border)
			const base = parseInt(((panel as any).dataset?.baseWidth as string) || panel.style.width || '600', 10);
			const targetWidth = Math.min(isNaN(base) ? 600 : base, maxRowWidth);
			panel.style.width = `${targetWidth}px`;

			// Measure actual rendered size (forces layout once after width set)
			let rect = panel.getBoundingClientRect();
			let usedWidth = rect.width || targetWidth;
			let usedHeight = rect.height || parseInt(panel.style.height || '0', 10) || 0;

			// Wrap to next row if this panel would exceed the row width
			if (x + usedWidth > maxRowWidth) {
				x = 0;
				y += rowHeight + gap;
				rowHeight = 0;
			}

			// Position with outer margin
			panel.style.left = `${margin + x}px`;
			panel.style.top = `${margin + y}px`;

			// Advance cursor
			x += usedWidth + gap;
			rowHeight = Math.max(rowHeight, usedHeight);
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
