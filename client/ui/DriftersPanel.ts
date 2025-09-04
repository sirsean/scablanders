import type { GameState } from '../gameState';

export class DriftersPanel {
  static createDriftersPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'drifters-panel';
		panel.className = 'game-panel';
		panel.style.cssText = `
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
		(panel as any).dataset.baseWidth = '400';
		panel.style.zIndex = '1050';

		panel.innerHTML = `
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; color: #FFD700;">Owned Drifters</h3>
        <button id=\"close-drifters-panel\" style=\"background: none; border: 1px solid #666; color: #fff; padding: 4px 8px; cursor: pointer; margin-left: auto;\">✕</button>
      </div>
      <div id=\"drifters-content\">
        <p>Loading drifters...</p>
      </div>
    `;

		return panel;
	}

  static updateDriftersPanel(state: GameState) {
    const content = document.getElementById('drifters-content');
		if (!content) {
			return;
		}

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
								const b = dp?.bonuses || { combat: 0, scavenging: 0, tech: 0, speed: 0 };
								return `
            <div class=\"owned-drifter-row\" data-id=\"${merc.tokenId}\" style=\"border: 1px solid #00ff00; padding: 6px; margin: 4px 0; border-radius: 4px; font-size: 12px; cursor: pointer;\">
              <strong>${merc.name} #${merc.tokenId}</strong>
              <div style=\"color: #ccc;\">Combat: ${merc.combat + (b.combat || 0)} ${b.combat ? `(+${b.combat})` : ''} | Scavenging: ${merc.scavenging + (b.scavenging || 0)} ${b.scavenging ? `(+${b.scavenging})` : ''} | Tech: ${merc.tech + (b.tech || 0)} ${b.tech ? `(+${b.tech})` : ''} | Speed: ${merc.speed + (b.speed || 0)} ${b.speed ? `(+${b.speed})` : ''}</div>
            </div>
          `;
							})
							.join('') || '<p style=\"color: #888; font-size: 12px;\">No owned Drifters</p>'
					}
        </div>
      </div>
    `;

		// Click to open DrifterInfo (global function wired in UIManager)
		document.querySelectorAll('.owned-drifter-row').forEach((row) => {
			row.addEventListener('click', () => {
				const id = Number((row as HTMLElement).getAttribute('data-id'));
				(window as any).openDrifterInfo?.(id);
			});
		});
	}
}
