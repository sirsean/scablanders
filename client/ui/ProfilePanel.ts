import type { GameState } from '../gameState';
import { buildEventBorderStyle } from './utils/eventStyles';

export class ProfilePanel {
	static createProfilePanel(): HTMLElement {
		const panel = document.createElement('div');
		panel.id = 'profile-panel';
		panel.className = 'game-panel';
		panel.style.cssText = `
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
    `;

		// Base width and unified z-index
		(panel as any).dataset.baseWidth = '500';
		panel.style.zIndex = '1050';

		panel.innerHTML = `
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0;">Player Profile</h3>
        <button id="close-profile-panel" style="margin-left: auto;">✕</button>
      </div>
      <div id="profile-content">
        <p>Loading profile...</p>
      </div>
    `;

		return panel;
	}

	static updateProfilePanel(state: GameState) {
		const content = document.getElementById('profile-content');
		if (!content) {
			return;
		}

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
		const recentForPlayer = (state.eventLog || [])
			.filter((e: any) => e.playerAddress && state.playerAddress && e.playerAddress.toLowerCase() === state.playerAddress.toLowerCase())
			.slice(0, 10);

		content.innerHTML = `
      <div class="crt-section" style="margin-bottom: 20px;">
        <h4>Wallet Info</h4>
        <p class="muted" style="margin: 4px 0; word-break: break-all; font-size: 14px;">${profile.address}</p>
      </div>

      <div class="crt-section balance" style="margin-bottom: 20px; text-align:center;">
        <h4>Balance</h4>
        <div class="balance__amount">${profile.balance || 0}</div>
        <div class="balance__label">Credits</div>
      </div>

      <div class="crt-section" style="margin-bottom: 20px;">
        <h4>Statistics</h4>
        <div style="font-size: 14px;">
          <p style="margin: 4px 0;">Owned Drifters: <b>${state.ownedDrifters.length}</b></p>
          <p style="margin: 4px 0;">Active Missions: <b>${profile.activeMissions?.length || 0}</b></p>
          <p style="margin: 4px 0;">Vehicles Owned: <b>${profile.vehicles?.length || 0}</b></p>
        </div>
      </div>

      <div class="crt-section" style="margin-bottom: 20px;">
        <h4>Recent Activity</h4>
        <div class="crt-scroll" style="font-size: 12px;">
          ${
						recentForPlayer.length
							? recentForPlayer
									.map(
										(ev) => `
            <div style=\"${buildEventBorderStyle((ev as any).type, 'margin: 8px 0;')}\">
              <div style=\"font-size:11px;\">${ProfilePanel.formatTime(ev.timestamp)}</div>
              <div style=\"font-size:13px;\">${ev.message}</div>
            </div>
          `,
									)
									.join('')
							: '<p class="muted">No recent activity</p>'
					}
        </div>
      </div>
    `;
	}

	private static formatTime(timestamp: Date): string {
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
