import { gameState, type GameState } from '../gameState';

export class TownPanel {
  static createTownPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'town-panel';
    panel.className = 'game-panel';
    panel.style.cssText = `
      position: fixed;
      width: 720px;
      max-height: 600px;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 16px;
      color: #fff;
      font-family: 'Courier New', monospace;
      display: none;
      overflow-y: auto;
      z-index: 1060;
    `;

    (panel as any).dataset.baseWidth = '720';
    panel.style.zIndex = '1050';

    panel.innerHTML = `
      <div style="display:flex; align-items:center; gap: 8px;">
        <h3 style="margin:0; color:#FFD700;">Town</h3>
        <div style="margin-left:auto;"><button id="close-town-panel" style="background:none; border:1px solid #666; color:#fff; padding:4px 8px; cursor:pointer;">✕</button></div>
      </div>
      <div id="town-summary" style="margin-top: 8px; border:1px solid #333; padding:12px; border-radius:6px; background: rgba(255,255,255,0.03);"></div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
        <div id="town-vehicle-market" style="border:1px solid #333; padding:12px; border-radius:6px; background: rgba(255,255,255,0.03);"></div>
        <div id="town-walls" style="border:1px solid #333; padding:12px; border-radius:6px; background: rgba(255,255,255,0.03);"></div>
      </div>

      <div id="town-monsters" style="margin-top: 12px; border:1px solid #333; padding:12px; border-radius:6px; background: rgba(255,255,255,0.03);"></div>
    `;

    // Wire quick contribution handlers (delegated)
    setTimeout(() => {
      panel.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        if (!target) return;
        if (target.matches('.contrib-btn')) {
          const attribute = target.getAttribute('data-attr') as 'vehicle_market' | 'perimeter_walls';
          const amountStr = target.getAttribute('data-amount') || '0';
          const amount = parseInt(amountStr, 10) || 0;
          if (amount > 0) {
            (target as HTMLButtonElement).disabled = true;
            try {
              await gameState.contributeToTown(attribute, amount);
            } finally {
              (target as HTMLButtonElement).disabled = false;
            }
          }
        }
        if (target.matches('#town-contrib-custom-apply')) {
          const input = document.getElementById('town-contrib-custom-amount') as HTMLInputElement | null;
          const attrSel = document.getElementById('town-contrib-custom-attr') as HTMLSelectElement | null;
          const amount = input ? parseInt(input.value, 10) || 0 : 0;
          const attribute = (attrSel?.value || 'vehicle_market') as 'vehicle_market' | 'perimeter_walls';
          if (amount > 0) {
            (target as HTMLButtonElement).disabled = true;
            try {
              await gameState.contributeToTown(attribute, amount);
            } finally {
              (target as HTMLButtonElement).disabled = false;
            }
          }
        }
      });
    }, 0);

    return panel;
  }

  static updateTownPanel(state: GameState) {
    const town = state.town;
    const summary = document.getElementById('town-summary');
    const vmEl = document.getElementById('town-vehicle-market');
    const wallsEl = document.getElementById('town-walls');
    const monstersEl = document.getElementById('town-monsters');

    if (!summary || !vmEl || !wallsEl || !monstersEl) return;

    if (!town) {
      summary.innerHTML = '<p>Loading town...</p>';
      vmEl.innerHTML = '';
      wallsEl.innerHTML = '';
      monstersEl.innerHTML = '';
      return;
    }

    const P = town.prosperity || 0;
    const multiplier = Math.min(1.5, Math.max(1.0, 1 + 0.15 * Math.log10(1 + Math.max(0, P))))
      .toFixed(2);

    summary.innerHTML = `
      <div style="display:flex; gap: 12px; align-items:center;">
        <div>Prosperity: <span style="color:#00ff88; font-weight:bold;">${Math.round(P)}</span></div>
        <div>Resource Boost: <span style="color:#FFD700; font-weight:bold;">x${multiplier}</span></div>
      </div>
    `;

    const vm = town.attributes['vehicle_market'];
    vmEl.innerHTML = `
      <h4 style="margin:0 0 8px 0; color:#FFD700;">Vehicle Market</h4>
      <div>Level: <b>${vm.level}</b></div>
      <div>Progress: <b>${vm.progress}</b> / <b>${vm.nextLevelCost}</b></div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        ${this.renderContribButtons('vehicle_market', state)}
      </div>
    `;

    const walls = town.attributes['perimeter_walls'];
    const hp = walls.hp ?? 0;
    const maxHp = walls.maxHp ?? 0;
    wallsEl.innerHTML = `
      <h4 style="margin:0 0 8px 0; color:#FFD700;">Perimeter Walls</h4>
      <div>Level: <b>${walls.level}</b></div>
      <div>HP: <b>${hp}</b> / <b>${maxHp}</b></div>
      <div>Progress: <b>${walls.progress}</b> / <b>${walls.nextLevelCost}</b></div>
      <div style="margin-top:8px; display:flex; gap:8px;">
        ${this.renderContribButtons('perimeter_walls', state)}
      </div>
    `;

const monsters = (state.monsters || []).filter((m: any) => m && m.state !== 'dead');
    if (monsters.length === 0) {
      monstersEl.innerHTML = '<h4 style="margin:0 0 8px 0; color:#FFD700;">Monsters</h4><p>No active monsters.</p>';
    } else {
      monstersEl.innerHTML = `
        <h4 style="margin:0 0 8px 0; color:#FFD700;">Monsters</h4>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px;">
          ${monsters.map(m => `
            <div style="border:1px solid #333; padding:8px; border-radius:6px; background: rgba(255,255,255,0.02); display:flex; flex-direction:column; gap:6px;">
              <div style="display:flex; align-items:center; gap:8px; justify-content:space-between;">
                <div><b>${m.id.slice(0,8)}...</b></div>
                <button class="target-monster-btn" data-monster-id="${m.id}" style="background:#8b0000; border:1px solid #fff; color:#fff; padding:4px 8px; cursor:pointer; border-radius:4px;">Target</button>
              </div>
              <div>HP: <b>${m.hp}</b> / <b>${m.maxHp}</b></div>
              <div>State: <b>${m.state}</b></div>
              <div>Coords: (${m.coordinates.x}, ${m.coordinates.y})</div>
              ${m.etaToTown ? `<div>ETA: ${new Date(m.etaToTown).toLocaleTimeString()}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;

      // Attach target handlers
      setTimeout(() => {
        document.querySelectorAll('.target-monster-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = (btn as HTMLElement).getAttribute('data-monster-id');
            if (!id) return;
            gameState.setMissionType('combat');
            gameState.setSelectedTargetMonster(id);
            // Open mission panel for team/vehicle selection
            gameState.toggleMissionPanel();
          });
        });
      }, 0);
    }
  }

  private static renderContribButtons(attribute: 'vehicle_market' | 'perimeter_walls', state: GameState): string {
    const disabled = !state.isAuthenticated || !state.profile;
    const mkBtn = (amt: number) => `<button class="contrib-btn" data-attr="${attribute}" data-amount="${amt}" style="background:#444; border:1px solid #666; color:#fff; padding:4px 10px; cursor:pointer; border-radius:4px;" ${disabled ? 'disabled' : ''}>+${amt}</button>`;
    return `
      ${mkBtn(10)}
      ${mkBtn(100)}
      ${mkBtn(1000)}
      <span style="margin-left:8px;">
        <select id="town-contrib-custom-attr" style="background:#222; color:#fff; border:1px solid #666; padding:2px 6px;">
          <option value="vehicle_market">Vehicle Market</option>
          <option value="perimeter_walls">Perimeter Walls</option>
        </select>
        <input id="town-contrib-custom-amount" type="number" min="1" step="1" placeholder="Amount" style="width:100px; background:#222; color:#fff; border:1px solid #666; padding:2px 6px; margin-left:4px;" />
        <button id="town-contrib-custom-apply" style="background:#4a7c59; border:1px solid #fff; color:#fff; padding:4px 10px; cursor:pointer; border-radius:4px; margin-left:4px;" ${disabled ? 'disabled' : ''}>Contribute</button>
      </span>
    `;
  }
}

