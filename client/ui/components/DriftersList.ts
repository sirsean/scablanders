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

const SORTABLE_STATS = ['combat', 'scavenging', 'tech', 'speed'] as const;
export type SortableStat = (typeof SORTABLE_STATS)[number];

function isSortableStat(x: string): x is SortableStat {
  return (SORTABLE_STATS as readonly string[]).includes(x);
}

function getEffectiveStat(
  drifter: DrifterProfile,
  stat: SortableStat,
  state: GameState
): number {
  const dp = state.profile?.drifterProgress?.[String(drifter.tokenId)];
  const bonus = dp?.bonuses?.[stat] || 0;
  return (drifter as any)[stat] + bonus;
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
        width: 18px;
        height: 18px;
        border: 2px solid ${isSelected ? '#00ff00' : '#666'};
        border-radius: 3px;
        background: ${isSelected ? '#00ff00' : 'transparent'};
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${isSelected ? '<span style=\"color: #000; font-size: 12px; font-weight: bold;\">✓</span>' : ''}
      </div>`;

    // Effective stats for display (include bonuses)
    const state = gameState.getState();
    const dp = state.profile?.drifterProgress?.[String(drifter.tokenId)];
    const unspent = dp?.unspentPoints || 0;
    const hasUnspent = unspent > 0;
    const eff = {
      combat: getEffectiveStat(drifter, 'combat', state),
      scavenging: getEffectiveStat(drifter, 'scavenging', state),
      tech: getEffectiveStat(drifter, 'tech', state),
      speed: getEffectiveStat(drifter, 'speed', state),
    };

    const gridTemplateCols = mode === 'select' ? '28px 80px repeat(4, 1fr)' : '80px repeat(4, 1fr)';

    return `
      <div class="drifter-option" data-id="${drifter.tokenId}" data-busy="${isBusy}" style="
        display: grid;
        grid-template-columns: ${gridTemplateCols};
        gap: 12px;
        align-items: center;
        border: 2px solid ${isSelected ? '#00ff00' : isBusy ? '#666' : '#444'};
        padding: 10px 12px;
        margin: 6px 0;
        cursor: ${mode === 'select' ? (isBusy ? 'not-allowed' : 'pointer') : 'pointer'};
        border-radius: 4px;
        background: ${isSelected ? 'rgba(0, 255, 0, 0.1)' : isBusy ? 'rgba(100, 100, 100, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
        opacity: ${isBusy && mode === 'select' ? '0.6' : '1'};
        position: relative;
      ">
        ${mode === 'select' ? `<div style=\"display:flex; align-items:center; justify-content:center;\">${checkbox}</div>` : ''}
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <img
            src="/images/drifters/thumbnails/${drifter.tokenId}.jpeg"
            alt="#${drifter.tokenId}"
            style="width: 56px; height: 56px; border-radius: 4px; object-fit: cover; border: ${hasUnspent ? '2px solid #00ffcc' : '1px solid #333'}; box-shadow: ${hasUnspent ? '0 0 6px rgba(0,255,204,0.6)' : 'none'};"
            onerror="this.style.display='none'"
          />
          <div style="margin-top: 4px; font-size: 12px; color: #ccc; text-align: center;">#${drifter.tokenId}</div>
          ${isBusy ? '<div style="margin-top: 2px; font-size: 11px; color: #ff6666; text-align: center;">ON MISSION</div>' : ''}
        </div>
        <div style="color: #ff6666; text-align: center; font-size: 16px; font-weight: 600;">${eff.combat}</div>
        <div style="color: #66ff66; text-align: center; font-size: 16px; font-weight: 600;">${eff.scavenging}</div>
        <div style="color: #6666ff; text-align: center; font-size: 16px; font-weight: 600;">${eff.tech}</div>
        <div style="color: #ffff66; text-align: center; font-size: 16px; font-weight: 600;">${eff.speed}</div>
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

    // Active sort metric
    const activeSort: SortableStat = isSortableStat(state.drifterSortBy) ? (state.drifterSortBy as SortableStat) : 'combat';

    // Sort drifters: available first then by chosen attribute (effective stat, desc)
    const sortedDrifters = [...drifters].sort((a, b) => {
      const aBusy = busyDrifterIds.has(a.tokenId);
      const bBusy = busyDrifterIds.has(b.tokenId);
      if (aBusy && !bBusy) {
        return 1;
      }
      if (!aBusy && bBusy) {
        return -1;
      }
      const av = getEffectiveStat(a, activeSort, state);
      const bv = getEffectiveStat(b, activeSort, state);
      if (bv !== av) {
        return bv - av;
      }
      // tie-breaker by token id asc
      return a.tokenId - b.tokenId;
    });

    const headerRight = mode === 'select'
      ? `<span style="font-size: 11px; color: ${atCapacity ? '#ff6b6b' : '#ccc'}; margin-left: auto;">${selectedIds.length} / ${maxDrifters > 0 ? maxDrifters : '-'} Drifters Selected</span>`
      : `<span style="font-size: 11px; color: #888;">(Showing ${sortedDrifters.length}/${drifters.length})</span>`;

    const headerGridCols = mode === 'select' ? '28px 80px repeat(4, 1fr)' : '80px repeat(4, 1fr)';
    const headerLeading = mode === 'select' ? '<div></div><div></div>' : '<div></div>';

    const headerGrid = `
      <div id="${idPrefix}-drifter-header" style="margin-bottom: 8px; display: grid; grid-template-columns: ${headerGridCols}; gap: 12px; align-items: center; padding-right: 16px;">
        ${headerLeading}
        ${SORTABLE_STATS.map((s) => {
          const label = (s === 'combat') ? 'COMBAT' : (s === 'scavenging') ? 'SCAV' : (s === 'tech') ? 'TECH' : 'SPEED';
          const active = s === activeSort;
          const color = s === 'combat' ? '#ff6666' : s === 'scavenging' ? '#66ff66' : s === 'tech' ? '#6666ff' : '#ffff66';
          return `<div id=\"${idPrefix}-sort-${s}\" data-sort=\"${s}\" role=\"button\" tabindex=\"0\" aria-pressed=\"${active ? 'true' : 'false'}\" style=\"\n            cursor: pointer;\n            text-align: center;\n            color: ${color};\n            font-size: 16px;\n            letter-spacing: 0.5px;\n            ${active ? 'font-weight: 800; text-decoration: underline;' : 'opacity: 0.9; font-weight: 600;'}\n          \">${label}</div>`;
        }).join('')}
      </div>
    `;

    return `
      ${headerGrid}
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

    // Header sort clicks (single click)
    SORTABLE_STATS.forEach((s) => {
      const el = document.getElementById(`${idPrefix}-sort-${s}`);
      if (el) {
        const activate = () => {
          gameState.setDrifterSortBy(s);
          onChanged?.();
        };
        el.addEventListener('click', activate);
        el.addEventListener('keydown', (e) => {
          if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
            e.preventDefault();
            activate();
          }
        });
      }
    });

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

