import type { GameState, GameNotification } from '../gameState';
import { gameState } from '../gameState';
import { ActiveMissionsPanel } from './ActiveMissionsPanel';
import { MarketPanel } from './MarketPanel';
import { VehiclePanel } from './VehiclePanel';
import { LogPanel } from './LogPanel';
import { DrifterInfoPanel } from './DrifterInfoPanel';
import { MissionPanel } from './MissionPanel';
import { DriftersPanel } from './DriftersPanel';
import { ProfilePanel } from './ProfilePanel';

export class UIManager {
	private notificationContainer: HTMLElement | null = null;
	private missionPanel: HTMLElement | null = null;
	private driftersPanel: HTMLElement | null = null;
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
		this.createDriftersPanel();
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
			{ id: 'toggle-drifters', label: 'Drifters (D)' },
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
		this.missionPanel = MissionPanel.createMissionPanel();
		document.body.appendChild(this.missionPanel);
	}

	private createDriftersPanel() {
		this.driftersPanel = DriftersPanel.createDriftersPanel();
		document.body.appendChild(this.driftersPanel);
	}

	private createProfilePanel() {
		this.profilePanel = ProfilePanel.createProfilePanel();
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

		document.getElementById('close-drifters-panel')?.addEventListener('click', () => {
			gameState.toggleDriftersPanel();
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
		document.getElementById('toggle-drifters')?.addEventListener('click', () => {
			gameState.toggleDriftersPanel();
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
					if (gameState.getState().showMissionPanel) {
						gameState.toggleMissionPanel();
					}
				if (gameState.getState().showDriftersPanel) {
					gameState.toggleDriftersPanel();
				}
					if (gameState.getState().showProfilePanel) {
						gameState.toggleProfilePanel();
					}
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
					gameState.toggleDriftersPanel();
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
			MissionPanel.updateMissionPanel(state);
		}

		if (this.driftersPanel) {
			this.driftersPanel.style.display = state.showDriftersPanel ? 'block' : 'none';
			if (state.showDriftersPanel) {
				DriftersPanel.updateDriftersPanel(state);
			}
		}

		if (this.profilePanel) {
			this.profilePanel.style.display = state.showProfilePanel ? 'block' : 'none';
			if (state.showProfilePanel) {
				ProfilePanel.updateProfilePanel(state);
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

	private updateNotifications(notifications: GameNotification[]) {
		if (!this.notificationContainer) {
			return;
		}

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
			if (connectButton) {
				connectButton.style.display = 'none';
			}
			if (walletInfo) {
				walletInfo.style.display = 'block';
			}
		} else {
			if (connectButton) {
				connectButton.style.display = 'block';
			}
			if (walletInfo) {
				walletInfo.style.display = 'none';
			}
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
			if (mission.status !== 'active') {
				return false;
			}

			const completionTime = mission.completionTime instanceof Date ? mission.completionTime : new Date(mission.completionTime);

			return now >= completionTime;
		});
	}

	/**
	 * Update the Active Missions button with highlighting when rewards are ready
	 */
	private updateActiveMissionsButton(state: GameState) {
		const button = document.getElementById('toggle-missions');
		if (!button) {
			return;
		}

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
			if (mission.status !== 'active') {
				return false;
			}

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
			this.vehiclePanel,
			this.driftersPanel,
			this.drifterInfoPanel,
			this.marketPanel,
			this.missionPanel,
		];

		const panels: HTMLElement[] = order.filter((p): p is HTMLElement => !!p && p.style.display !== 'none');

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

		if (seconds < 60) {
			return `${seconds}s ago`;
		}
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) {
			return `${minutes}m ago`;
		}
		const hours = Math.floor(minutes / 60);
		return `${hours}h ago`;
	}
}
