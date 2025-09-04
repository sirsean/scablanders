import type { GameState } from '../gameState';
import { DriftersList } from './components/DriftersList';

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

		content.innerHTML = DriftersList.render({
      idPrefix: 'drifters-panel',
      mode: 'browse',
      drifters: state.ownedDrifters,
      state,
    });

    // Attach row click handlers (open drifter info in browse mode)
    DriftersList.attachHandlers({
      idPrefix: 'drifters-panel',
      mode: 'browse',
      drifters: state.ownedDrifters,
      state,
    });
	}
}
