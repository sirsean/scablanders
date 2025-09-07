import { gameState, type GameState } from '../gameState';

export class TownPanel {
  private static liveTimer: number | null = null;

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
        <div style="margin-left:auto; display:flex; gap:8px; align-items:center;">
          <button id="center-town-btn" style="background:none; border:1px solid #666; color:#fff; padding:4px 8px; cursor:pointer;">Center on Town</button>
          <button id="close-town-panel" style="background:none; border:1px solid #666; color:#fff; padding:4px 8px; cursor:pointer;">✕</button>
        </div>
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
        if (!target) {
          return;
        }
        if (target.matches('#center-town-btn')) {
          // Center the map on the town (0,0)
          window.dispatchEvent(new CustomEvent('map:center-on' as any, { detail: { x: 0, y: 0, smooth: true, duration: 600 } }));
        } else if (target.matches('.center-monster-btn')) {
          const x = parseFloat(target.getAttribute('data-x') || 'NaN');
          const y = parseFloat(target.getAttribute('data-y') || 'NaN');
          if (!Number.isNaN(x) && !Number.isNaN(y)) {
            window.dispatchEvent(new CustomEvent('map:center-on' as any, { detail: { x, y, smooth: true, duration: 600 } }));
          }
        } else if (target.matches('.contrib-btn')) {
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

    if (!summary || !vmEl || !wallsEl || !monstersEl) {
      return;
    }

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
      const missionCounts = TownPanel.getActiveMissionCounts(state);
      monstersEl.innerHTML = `
        <h4 style="margin:0 0 8px 0; color:#FFD700;">Monsters</h4>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px;">
          ${monsters.map(m => {
            const isTraveling = m.state === 'traveling';
            const etaText = (isTraveling && m.etaToTown) ? TownPanel.formatCountdown(m.etaToTown) : '';
            const coords = (m.coordinates && typeof m.coordinates.x === 'number' && typeof m.coordinates.y === 'number') ? m.coordinates : null;
            const count = missionCounts.get(m.id) || 0;
            const centerBtn = coords
              ? `<button class=\"center-monster-btn\" data-monster-id=\"${m.id}\" data-x=\"${coords.x}\" data-y=\"${coords.y}\" style=\"background:#444; border:1px solid #666; color:#fff; padding:4px 8px; cursor:pointer; border-radius:4px;\">Center</button>`
              : `<button class=\"center-monster-btn\" data-monster-id=\"${m.id}\" disabled style=\"background:#222; border:1px solid #333; color:#777; padding:4px 8px; border-radius:4px; cursor:not-allowed;\">Center</button>`;
            return `
            <div style="border:1px solid #333; padding:8px; border-radius:6px; background: rgba(255,255,255,0.02); display:flex; flex-direction:column; gap:6px;">
              <div style="display:flex; align-items:center; gap:8px; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <b>${m.id.slice(0,8)}...</b>
                  <span title="Active missions" style="background:#1e90ff; color:#fff; border-radius:10px; padding:1px 6px; font-size:12px; line-height:18px; display:inline-block;">${count}</span>
                </div>
                <div style="display:flex; gap:6px;">
                  ${centerBtn}
                  <button class="target-monster-btn" data-monster-id="${m.id}" style="background:#8b0000; border:1px solid #fff; color:#fff; padding:4px 8px; cursor:pointer; border-radius:4px;">Target</button>
                </div>
              </div>
              <div>HP: <b>${m.hp}</b> / <b>${m.maxHp}</b></div>
              <div>State: <b>${m.state}</b></div>
              ${coords ? `<div>Coords: (${coords.x}, ${coords.y})</div>` : ''}
              ${etaText ? `<div>ETA: ${etaText}</div>` : ''}
            </div>`;
          }).join('')}
        </div>
      `;

      // Attach target handlers
      setTimeout(() => {
        document.querySelectorAll('.target-monster-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = (btn as HTMLElement).getAttribute('data-monster-id');
            if (!id) {
              return;
            }
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
    `;
  }

  // Start live timer to refresh ETA countdowns while panel is visible
  static startLiveTimer(getState: () => GameState) {
    if (TownPanel.liveTimer) {
      clearInterval(TownPanel.liveTimer);
    }
    TownPanel.liveTimer = setInterval(() => {
      const panel = document.getElementById('town-panel');
      if (!panel || panel.style.display === 'none') {
        return;
      }
      TownPanel.updateTownPanel(getState());
    }, 1000) as any;
  }

  static stopLiveTimer() {
    if (TownPanel.liveTimer) {
      clearInterval(TownPanel.liveTimer);
      TownPanel.liveTimer = null;
    }
  }

  private static formatCountdown(eta: string | Date): string {
    const d = typeof eta === 'string' ? new Date(eta) : eta;
    const diffSec = Math.max(0, Math.floor((d.getTime() - Date.now()) / 1000));
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    if (m > 0) {
      return `${m}m ${s}s`;
    }
    return `${s}s`;
  }

  private static getActiveMissionCounts(state: GameState): Map<string, number> {
    const counts = new Map<string, number>();
    const missions = (state.activeMissions || []) as any[];
    const isActive = (m: any) => {
      const status = (m?.status ?? m?.state ?? '').toLowerCase();
      return !['completed', 'failed', 'canceled', 'cancelled', 'aborted', 'expired'].includes(status);
    };
    for (const m of missions) {
      if (!m) {
        continue;
      }
      if ((m.type === 'combat' || m.missionType === 'combat') && m.targetMonsterId && isActive(m)) {
        const id = m.targetMonsterId as string;
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
    return counts;
  }
}

