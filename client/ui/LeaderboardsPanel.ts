import type { GameState } from '../gameState';
import type { LeaderboardEntry, LeaderboardsResponse } from '@shared/leaderboards';

export class LeaderboardsPanel {
	static createLeaderboardsPanel(): HTMLElement {
		const panel = document.createElement('div');
		panel.id = 'leaderboards-panel';
		panel.className = 'game-panel';
		panel.style.cssText = `
      position: fixed;
      width: 600px;
      max-height: 600px;
      background: rgba(0,0,0,0.95);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 16px;
      color: #fff;
      font-family: 'Courier New', monospace;
      display: none;
      overflow-y: auto;
      z-index: 1050;
    `;

		(panel as any).dataset.baseWidth = '600';

		panel.innerHTML = `
      <div class="crt-section" style="display: flex; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0;">Leaderboards</h3>
        <button id="close-leaderboards-panel" style="margin-left: auto;">✕</button>
      </div>
      <div id="leaderboards-content">
        <p class="muted">Loading leaderboards…</p>
      </div>
    `;

		// Prevent click-through
		panel.addEventListener('click', (e) => e.stopPropagation());

		return panel;
	}

	private static truncate(addr: string): string {
		if (!addr) {
			return '';
		}
		if (addr.length <= 12) {
			return addr;
		}
		return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
	}

	private static renderSection(title: string, rows: LeaderboardEntry[], me?: string): string {
		const highlight = (address: string) => (me && me.toLowerCase() === address.toLowerCase() ? 'font-weight:bold;color:#ffd700;' : '');
		const rowsHtml = rows.length
			? rows
					.map(
						(r) => `
          <div style="display:flex; gap:8px; align-items:center; font-size: 13px;">
            <div style="width: 28px; text-align:right;">${r.rank}</div>
            <div style="width: 140px;">${LeaderboardsPanel.truncate(r.address)}</div>
            <div style="flex:1; text-align:right; ${highlight(r.address)}">${r.value.toLocaleString()}</div>
          </div>`,
					)
					.join('')
			: '<p class="muted">No entries yet.</p>';

		return `
      <div class="crt-section" style="margin-bottom: 16px;">
        <h4 style="margin:0 0 8px 0;">${title}</h4>
        <div class="crt-scroll" style="display:flex; flex-direction:column; gap:6px; max-height: 180px; overflow-y: auto;">
          ${rowsHtml}
        </div>
      </div>
    `;
	}

	static updateLeaderboardsPanel(state: GameState) {
		const content = document.getElementById('leaderboards-content');
		if (!content) {
			return;
		}

		if (state.isLoadingLeaderboards) {
			content.innerHTML = '<p>Loading leaderboards…</p>';
			return;
		}

		const data: LeaderboardsResponse | null = state.leaderboards || null;
		if (!data) {
			content.innerHTML = '<p class="muted">No leaderboard data yet.</p>';
			return;
		}

		const me = state.playerAddress || undefined;

		content.innerHTML = [
			LeaderboardsPanel.renderSection('Town Upgrade Contributions', data.upgradeContributions, me),
			LeaderboardsPanel.renderSection('Prosperity From Resource Missions', data.resourceProsperity, me),
			LeaderboardsPanel.renderSection('Combat Damage to Monsters', data.combatDamage, me),
		].join('');
	}
}
