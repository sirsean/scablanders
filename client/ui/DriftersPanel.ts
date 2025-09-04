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
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 16px; gap: 8px;">
        <h3 style="margin: 0; color: #FFD700;">Owned Drifters</h3>
        <span id="drifters-panel-summary" style="font-size: 11px; color: #888; margin-left: auto;"></span>
        <button id=\"close-drifters-panel\" style=\"background: none; border: 1px solid #666; color: #fff; padding: 4px 8px; cursor: pointer;\">✕</button>
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

    // Preserve scroll position of the outer panel and inner list before re-render
    const panelEl = document.getElementById('drifters-panel') as HTMLElement | null;
    const prevPanelScrollTop = panelEl?.scrollTop ?? 0;
    const listElBefore = document.getElementById('drifters-panel-drifter-list-container') as HTMLElement | null;
    const prevListScrollTop = listElBefore?.scrollTop ?? 0;

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

    // Update summary counter in the header row
    const summaryEl = document.getElementById('drifters-panel-summary');
    if (summaryEl) {
      const total = state.ownedDrifters.length;
      summaryEl.textContent = `(Showing ${total}/${total})`;
    }

    // Attach row click handlers (open drifter info in browse mode)
    DriftersList.attachHandlers({
      idPrefix: 'drifters-panel',
      mode: 'browse',
      drifters: state.ownedDrifters,
      state,
    });

    // Restore scroll positions after re-render
    requestAnimationFrame(() => {
      const listElAfter = document.getElementById('drifters-panel-drifter-list-container') as HTMLElement | null;
      if (listElAfter) {
        listElAfter.scrollTop = prevListScrollTop;
      }
      const panelElAfter = document.getElementById('drifters-panel') as HTMLElement | null;
      if (panelElAfter) {
        panelElAfter.scrollTop = prevPanelScrollTop;
      }
    });
	}
}
