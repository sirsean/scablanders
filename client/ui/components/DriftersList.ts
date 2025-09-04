import type { DrifterProfile } from '@shared/models';
import type { GameState } from '../../gameState';
import { gameState } from '../../gameState';
import { getVehicleData } from '../../utils/vehicleUtils';

export type DriftersListMode = 'browse' | 'select';

export interface DriftersListOptions {
  idPrefix: string; // unique prefix to avoid DOM id collisions
  mode: DriftersListMode;
  drifters: DrifterProfile[];
  state: GameState;
}

export class DrifterListRow {
  static render(
    drifter: DrifterProfile,
    opts: {
      isSelected: boolean;
      isBusy: boolean;
      mode: DriftersListMode;
    }
  ): string {
    const { isSelected, isBusy, mode } = opts;
    const checkbox = `
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
      </div>`;

    return `
      <div class="drifter-option" data-id="${drifter.tokenId}" data-busy="${isBusy}" style="
        border: 2px solid ${isSelected ? '#00ff00' : isBusy ? '#666' : '#444'};
        padding: 8px;
        margin: 4px 0;
        cursor: ${mode === 'select' ? (isBusy ? 'not-allowed' : 'pointer') : 'pointer'};
        border-radius: 4px;
        background: ${isSelected ? 'rgba(0, 255, 0, 0.1)' : isBusy ? 'rgba(100, 100, 100, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
        opacity: ${isBusy && mode === 'select' ? '0.6' : '1'};
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
            ${mode === 'select' ? checkbox : ''}
            <strong style="color: ${isBusy ? '#999' : '#fff'};">${drifter.name} #${drifter.tokenId}</strong>
          </div>
          <div style="font-size: 11px;">
            ${isBusy ? '<span style="color: #ff6666;">ON MISSION</span>' : '<span style="color: #00ff00;">OWNED</span>'}
          </div>
        </div>
        <div style="font-size: 11px; color: #ccc; margin-top: 4px;">
          ${(() => {
            const dp = gameState.getState().profile?.drifterProgress?.[String(drifter.tokenId)];
            const b = dp?.bonuses || { combat:0, scavenging:0, tech:0, speed:0 };
            return `Combat: <span style=\"color: #ff6666;\">${drifter.combat + (b.combat||0)}</span> ${b.combat?`(<span style=\"color:#ff9999;\">+${b.combat}</span>)`:''} | Scavenging: <span style=\"color: #66ff66;\">${drifter.scavenging + (b.scavenging||0)}</span> ${b.scavenging?`(<span style=\"color:#aaffaa;\">+${b.scavenging}</span>)`:''} | Tech: <span style=\"color: #6666ff;\">${drifter.tech + (b.tech||0)}</span> ${b.tech?`(<span style=\"color:#99aaff;\">+${b.tech}</span>)`:''} | Speed: <span style=\"color: #ffff66;\">${drifter.speed + (b.speed||0)}</span> ${b.speed?`(<span style=\"color:#ffff99;\">+${b.speed}</span>)`:''}`;
          })()}
        </div>
      </div>
    `;
  }
}

export class DriftersList {
  static render(opts: DriftersListOptions): string {
    const { idPrefix, mode, drifters, state } = opts;

    // Compute busy set from active missions
    const busyDrifterIds = new Set(
      state.playerMissions.filter((m) => m.status === 'active').flatMap((m) => m.drifterIds)
    );

    // Selected and capacity (mission-select mode)
    const selectedIds = state.selectedDrifterIds || [];
    const selectedVehicleInstance = state.profile?.vehicles.find((v) => v.instanceId === state.selectedVehicleInstanceId);
    const selectedVehicle = selectedVehicleInstance ? getVehicleData(selectedVehicleInstance.vehicleId) : undefined;
    const maxDrifters = selectedVehicle?.maxDrifters || 0;
    const atCapacity = mode === 'select' && selectedVehicle && selectedIds.length >= maxDrifters;

    // Sort drifters: available first then by chosen attribute
    const sortedDrifters = [...drifters].sort((a, b) => {
      const aBusy = busyDrifterIds.has(a.tokenId);
      const bBusy = busyDrifterIds.has(b.tokenId);
      if (aBusy && !bBusy) {
        return 1;
      }
      if (!aBusy && bBusy) {
        return -1;
      }
      const sortBy = state.drifterSortBy;
      return (b as any)[sortBy] - (a as any)[sortBy];
    });

    const headerRight = mode === 'select'
      ? `<span style="font-size: 11px; color: ${atCapacity ? '#ff6b6b' : '#ccc'}; margin-left: auto;">${selectedIds.length} / ${maxDrifters > 0 ? maxDrifters : '-'} Drifters Selected</span>`
      : `<span style="font-size: 11px; color: #888;">(Showing ${sortedDrifters.length}/${drifters.length})</span>`;

    return `
      <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <label style="font-size: 12px; color: #ccc;">Sort by:</label>
        <select id="${idPrefix}-drifter-sort-select" style="
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
        ${headerRight}
      </div>

      <div id="${idPrefix}-drifter-list-container" style="flex: 1; overflow-y: auto; margin-bottom: 12px; min-height: 0; max-height: 405px;">
        ${sortedDrifters.map((d) => DrifterListRow.render(d, {
          isSelected: selectedIds.includes(d.tokenId),
          isBusy: busyDrifterIds.has(d.tokenId),
          mode
        })).join('')}
      </div>
    `;
  }

  static attachHandlers(opts: DriftersListOptions & { idPrefix: string; onChanged?: () => void }): void {
    const { idPrefix, mode, onChanged } = opts;

    // Sort change
    const sortSelect = document.getElementById(`${idPrefix}-drifter-sort-select`) as HTMLSelectElement | null;
    if (sortSelect) {
      sortSelect.addEventListener('change', (event) => {
        const sortBy = (event.target as HTMLSelectElement).value as 'combat' | 'scavenging' | 'tech' | 'speed';
        gameState.setDrifterSortBy(sortBy);
        onChanged?.();
      });
    }

    // Row click
    document.querySelectorAll(`#${idPrefix}-drifter-list-container .drifter-option`).forEach((row) => {
      row.addEventListener('click', (e) => {
        e.preventDefault();
        const el = row as HTMLElement;
        const id = Number(el.getAttribute('data-id'));
        const isBusy = el.getAttribute('data-busy') === 'true';

        if (mode === 'browse') {
          (window as any).openDrifterInfo?.(id);
          return;
        }

        if (isBusy) {
          return; // can't select busy drifters
        }
        gameState.toggleDrifterSelection(id);
        // Allow caller to re-render panel to update UI, estimates, and buttons
        onChanged?.();
      });
    });
  }
}

