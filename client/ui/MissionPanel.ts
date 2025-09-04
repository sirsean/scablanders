import type { GameState } from '../gameState';
import { gameState } from '../gameState';
import { getVehicleData } from '../utils/vehicleUtils';
import type { DrifterProfile } from '@shared/models';
import {
	calculateLiveEstimates,
	formatDuration,
	getAvailableMissionTypes,
	type DrifterStats,
	BASE_SPEED,
} from '../../shared/mission-utils';

export class MissionPanel {
	static createMissionPanel(): HTMLElement {
		const panel = document.createElement('div');
		panel.id = 'mission-panel';
		panel.className = 'game-panel';
		panel.style.cssText = `
      position: fixed;
      width: 800px;
      max-height: 700px;
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #444;
      border-radius: 12px;
      padding: 20px;
      color: #fff;
      font-family: 'Courier New', monospace;
      display: none;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
      overflow-y: auto;
    `;

		// Base width and unified z-index
		(panel as any).dataset.baseWidth = '800';
		panel.style.zIndex = '1050';

		panel.innerHTML = `
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; color: #FFD700;">Mission Planning</h3>
        <button id="close-mission-panel" style="background: none; border: 1px solid #666; color: #fff; padding: 4px 8px; cursor: pointer; margin-left: auto;">✕</button>
      </div>
      <div id="mission-content">
        <p>Select a resource node to plan a mission.</p>
      </div>
    `;

		// Prevent clicks inside the mission panel from bubbling to Phaser background
		panel.addEventListener('click', (event) => {
			event.stopPropagation();
		});

		return panel;
	}

	static updateMissionPanel(state: GameState) {
		const content = document.getElementById('mission-content');
		if (!content) {
			return;
		}

		// Preserve scroll position of drifter list before re-render
		const drifterList = document.getElementById('drifter-list-container') as HTMLElement;
		const scrollTop = drifterList?.scrollTop || 0;

		if (!state.selectedResourceNode) {
			content.innerHTML = '<p>Select a resource node to plan a mission.</p>';
			return;
		}

		if (!state.isAuthenticated) {
			content.innerHTML = '<p style="color: #ff6b6b;">Please connect your wallet to start missions.</p>';
			return;
		}

		// Find the selected resource node data
		const selectedResource = state.resourceNodes?.find((r) => r.id === state.selectedResourceNode);
		if (!selectedResource) {
			content.innerHTML = '<p>Resource node data not available.</p>';
			return;
		}

		// Calculate live estimates based on selected drifters and mission type
		const selectedDrifterIds = state.selectedDrifterIds || [];
		const selectedMissionType = state.selectedMissionType || 'scavenge';

		// Get drifter stats for the selected team (effective)
		const selectedDrifters = state.ownedDrifters.filter((d) => selectedDrifterIds.includes(d.tokenId));
		const teamStats: DrifterStats[] = selectedDrifters.map((d) => {
			const dp = state.profile?.drifterProgress?.[String(d.tokenId)];
			return {
				combat: d.combat + (dp?.bonuses.combat || 0),
				scavenging: d.scavenging + (dp?.bonuses.scavenging || 0),
				tech: d.tech + (dp?.bonuses.tech || 0),
				speed: d.speed + (dp?.bonuses.speed || 0),
			};
		});

		const selectedVehicleInstance = state.profile?.vehicles.find((v) => v.instanceId === state.selectedVehicleInstanceId);
		const selectedVehicle = selectedVehicleInstance ? getVehicleData(selectedVehicleInstance.vehicleId) : undefined;

		// Calculate live estimates using selected team and mission type
		const liveEstimates = calculateLiveEstimates(selectedResource, selectedMissionType, teamStats, selectedVehicle);
		const durationText = formatDuration(liveEstimates.duration);

		content.innerHTML = `
      <!-- Side-by-side layout container - full height -->
      <div style="display: flex; gap: 20px; height: 100%;">

        <!-- Left Panel: Node Info, Rewards, Mission Types, Start Button -->
        <div style="flex: 1; display: flex; flex-direction: column;">

          <!-- Node Information -->
          <div style="margin-bottom: 16px; border: 2px solid #444; border-radius: 8px; padding: 16px; background: rgba(255, 255, 255, 0.02);">
            <h4 style="color: #00ff00; margin: 0 0 12px 0; text-align: center;">${selectedResource.type.toUpperCase()} NODE</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px;">
              <p style="margin: 4px 0;">Yield: <span style="color: #ffff00; font-weight: bold;">${selectedResource.currentYield}</span></p>
              <p style="margin: 4px 0; color: #ffd700;">★ ${selectedResource.rarity.toUpperCase()}</p>
              <p style="margin: 4px 0;">Location: (${selectedResource.coordinates.x}, ${selectedResource.coordinates.y})</p>
              <p style="margin: 4px 0; color: #00bfff; font-weight: bold;">⏱️ ${durationText}</p>
            </div>
          </div>

          <!-- Expected Rewards -->
          <div style="margin-bottom: 16px;">
            <h4 style="color: #FFD700; margin: 0 0 8px 0;">Expected Rewards (${selectedMissionType.toUpperCase()})</h4>
            <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid #444; border-radius: 4px; padding: 12px;">
              <p style="margin: 4px 0; color: #ffd700; font-size: 14px;">💰 Credits: <span style="font-weight: bold;">${liveEstimates.rewards.creditsRange.min}-${liveEstimates.rewards.creditsRange.max}</span></p>
              <p style="margin: 4px 0; color: #00ff88; font-size: 14px;">📦 ${liveEstimates.rewards.resourcesRange.type.toUpperCase()}: <span style="font-weight: bold;">${liveEstimates.rewards.resourcesRange.min}-${liveEstimates.rewards.resourcesRange.max}</span></p>
              ${
								liveEstimates.teamStats
									? `
                <div style=\"margin-top: 8px; padding-top: 8px; border-top: 1px solid #666;\">
<p style=\\\"margin: 2px 0; color: #ccc; font-size: 12px;\\\">⚡ Team Speed: <span style=\\\"color: #ffff66;\\\">${liveEstimates.teamStats.speed}</span> (${liveEstimates.teamStats.speed > BASE_SPEED ? 'Fast' : liveEstimates.teamStats.speed < BASE_SPEED ? 'Slow' : 'Normal'})</p>
                  <p style=\"margin: 2px 0; color: #ccc; font-size: 12px;\">🔍 Scavenging Bonus: <span style=\"color: #66ff66;\">+${(liveEstimates.teamStats.scavengingBonus * 100).toFixed(1)}%</span></p>
                  <p style=\"margin: 2px 0; color: #ccc; font-size: 12px;\">💻 Tech Bonus: <span style=\"color: #6666ff;\">+${(liveEstimates.teamStats.techBonus * 100).toFixed(1)}%</span></p>
                </div>
              `
									: ''
							}
              <p style="margin: 8px 0 0 0; color: #888; font-style: italic; font-size: 11px;">*Estimates update based on selected team and mission type</p>
            </div>
          </div>

          <!-- Mission Types -->
          <div style="margin-bottom: 16px;">
            <h4 style="color: #FFD700; margin: 0 0 8px 0;">Mission Type</h4>
            ${MissionPanel.renderMissionTypes(selectedResource, state)}
          </div>

          <!-- Vehicle Selection -->
          <div style="margin-bottom: 16px;">
            <h4 style="color: #FFD700; margin: 0 0 8px 0;">Vehicle</h4>
            ${MissionPanel.renderVehicleSelection(state)}
          </div>

          <!-- Start Mission Button -->
          <div style="margin-top: auto;">
            <button id="start-mission-btn" disabled style="width: 100%; padding: 14px 24px; background: #666; border: 1px solid #888; color: #fff; cursor: not-allowed; border-radius: 6px; font-size: 16px; font-weight: bold;">
              Select Drifter & Mission Type
            </button>
          </div>
        </div>

        <!-- Right Panel: Team Selection - Full Height -->
        <div style="flex: 1; display: flex; flex-direction: column; height: 100%;">
          <h4 style="color: #FFD700; margin: 0 0 12px 0;">Select Team</h4>
          <div id="drifter-selection" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
            ${MissionPanel.renderDrifterSelection(state.ownedDrifters, state)}
          </div>
        </div>
      </div>
    `;

		MissionPanel.setupMissionPanelHandlers();

		// Update start button state to reflect current selections
		MissionPanel.updateStartButton();

		// Restore scroll position after re-render
		if (scrollTop > 0) {
			requestAnimationFrame(() => {
				const newDrifterList = document.getElementById('drifter-list-container') as HTMLElement;
				if (newDrifterList) {
					newDrifterList.scrollTop = scrollTop;
				}
			});
		}
	}

	private static renderDrifterSelection(drifters: DrifterProfile[], state: GameState): string {
		if (!drifters || drifters.length === 0) {
			return '<p style="color: #ff6b6b; font-size: 12px;">No owned Drifters available. You need to own Fringe Drifters NFTs to start missions.</p>';
		}

		const selectedVehicleInstance = state.profile?.vehicles.find((v) => v.instanceId === state.selectedVehicleInstanceId);
		const selectedVehicle = selectedVehicleInstance ? getVehicleData(selectedVehicleInstance.vehicleId) : undefined;
		const maxDrifters = selectedVehicle?.maxDrifters || 0;

		// Filter out drifters that are on active missions
		const busyDrifterIds = new Set(state.playerMissions.filter((m) => m.status === 'active').flatMap((m) => m.drifterIds));

		// Sort drifters based on availability first, then by selected sort criteria
		const sortedDrifters = [...drifters].sort((a, b) => {
			const aIsBusy = busyDrifterIds.has(a.tokenId);
			const bIsBusy = busyDrifterIds.has(b.tokenId);

			if (aIsBusy && !bIsBusy) {
				return 1; // a (busy) comes after b (available)
			}
			if (!aIsBusy && bIsBusy) {
				return -1; // a (available) comes before b (busy)
			}

			const sortBy = state.drifterSortBy;
			return (b as any)[sortBy] - (a as any)[sortBy]; // Descending order (highest first)
		});

		const displayDrifters = sortedDrifters;
		const selectedIds = state.selectedDrifterIds || [];
		const atCapacity = selectedVehicle && selectedIds.length >= maxDrifters;

		return `
      <!-- Sort Controls -->
      <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <label style="font-size: 12px; color: #ccc;">Sort by:</label>
        <select id="drifter-sort-select" style="
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
        <span style="font-size: 11px; color: #888;">(Showing ${displayDrifters.length}/${drifters.length})</span>
        <span style="font-size: 11px; color: ${atCapacity ? '#ff6b6b' : '#ccc'}; margin-left: auto;">
          ${selectedIds.length} / ${maxDrifters > 0 ? maxDrifters : '-'} Drifters Selected
        </span>
      </div>

      <!-- Drifter List -->
      <div id="drifter-list-container" style="flex: 1; overflow-y: auto; margin-bottom: 12px; min-height: 0; max-height: 405px;">
        ${displayDrifters
					.map((drifter) => {
						const isSelected = selectedIds.includes(drifter.tokenId);
						const isBusy = busyDrifterIds.has(drifter.tokenId);
						const isDisabled = (atCapacity && !isSelected) || isBusy;

						return `
            <div class=\"drifter-option\" data-id=\"${drifter.tokenId}\" data-busy=\"${isBusy}\" style=\"\
              border: 2px solid ${isSelected ? '#00ff00' : isBusy ? '#666' : '#444'};\
              padding: 8px;\
              margin: 4px 0;\
              cursor: ${isDisabled ? 'not-allowed' : 'pointer'};\
              border-radius: 4px;\
              background: ${isSelected ? 'rgba(0, 255, 0, 0.1)' : isBusy ? 'rgba(100, 100, 100, 0.3)' : 'rgba(255, 255, 255, 0.05)'};\
              opacity: ${isDisabled ? '0.6' : '1'};\
              position: relative;\
            ">\
              <div style=\"display: flex; justify-content: space-between; align-items: center;\">\
                <div style=\"display: flex; align-items: center; gap: 8px;\">\
                  <img\
                    src=\"/images/drifters/thumbnails/${drifter.tokenId}.jpeg\"\
                    alt=\"${drifter.name} #${drifter.tokenId}\"\
                    style=\"width: 48px; height: 48px; border-radius: 4px; object-fit: cover; border: 1px solid #333;\"\
                    onerror=\"this.style.display='none'\"\
                  />\
                  <div style=\"\
                    width: 16px;\
                    height: 16px;\
                    border: 2px solid ${isSelected ? '#00ff00' : '#666'};\
                    border-radius: 3px;\
                    background: ${isSelected ? '#00ff00' : 'transparent'};\
                    display: flex;\
                    align-items: center;\
                    justify-content: center;\
                  \">\
                    ${isSelected ? '<span style=\\\"color: #000; font-size: 10px; font-weight: bold;\\\">✓</span>' : ''}\
                  </div>\
                  <strong style=\"color: ${isBusy ? '#999' : '#fff'};\">${drifter.name} #${drifter.tokenId}</strong>\
                </div>\
                <div style=\"font-size: 11px;\">\
                  ${isBusy ? '<span style=\\\"color: #ff6666;\\\">ON MISSION</span>' : '<span style=\\\"color: #00ff00;\\\">OWNED</span>'}\
                </div>\
              </div>\
              <div style=\"font-size: 11px; color: #ccc; margin-top: 4px;\">\
                ${(() => {
									const dp = gameState.getState().profile?.drifterProgress?.[String(drifter.tokenId)];
									const b = dp?.bonuses || { combat: 0, scavenging: 0, tech: 0, speed: 0 };
									return `Combat: <span style=\\\\\\\"color: #ff6666;\\\\\\\">${drifter.combat + (b.combat || 0)}</span> ${b.combat ? `(<span style=\\\\\\\"color:#ff9999;\\\\\\\">+${b.combat}</span>)` : ''} | Scavenging: <span style=\\\\\\\"color: #66ff66;\\\\\\\">${drifter.scavenging + (b.scavenging || 0)}</span> ${b.scavenging ? `(<span style=\\\\\\\"color:#aaffaa;\\\\\\\">+${b.scavenging}</span>)` : ''} | Tech: <span style=\\\\\\\"color: #6666ff;\\\\\\\">${drifter.tech + (b.tech || 0)}</span> ${b.tech ? `(<span style=\\\\\\\"color:#99aaff;\\\\\\\">+${b.tech}</span>)` : ''} | Speed: <span style=\\\\\\\"color: #ffff66;\\\\\\\">${drifter.speed + (b.speed || 0)}</span> ${b.speed ? `(<span style=\\\\\\\"color:#ffff99;\\\\\\\">+${b.speed}</span>)` : ''}`;
								})()}\
              </div>\
            </div>
          `;
					})
					.join('')}
      </div>

      ${MissionPanel.renderTeamSummary(selectedIds, drifters)}
    `;
	}

	private static renderTeamSummary(selectedIds: number[], drifters: DrifterProfile[]): string {
		if (selectedIds.length === 0) {
			return `
        <div style="
          background: rgba(100, 100, 100, 0.2);
          border: 1px solid #666;
          border-radius: 4px;
          padding: 12px;
          text-align: center;
        ">
          <p style="margin: 0; color: #999; font-size: 12px;">Select drifters to see team summary</p>
        </div>
      `;
		}

		const selectedDrifters = drifters.filter((d) => selectedIds.includes(d.tokenId));
		const totalCombat = selectedDrifters.reduce((sum, d) => sum + d.combat, 0);
		const totalScavenging = selectedDrifters.reduce((sum, d) => sum + d.scavenging, 0);
		const totalTech = selectedDrifters.reduce((sum, d) => sum + d.tech, 0);
		const slowestSpeed = Math.min(...selectedDrifters.map((d) => d.speed));
		const teamSize = selectedIds.length;

		return `
      <div style="
        background: rgba(255, 215, 0, 0.1);
        border: 2px solid #ffd700;
        border-radius: 6px;
        padding: 12px;
      ">
        <h5 style="margin: 0 0 8px 0; color: #ffd700;">Team Summary (${teamSize} drifter${teamSize > 1 ? 's' : ''})</h5>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
          <div>Combat: <span style="color: #ff6666; font-weight: bold;">${totalCombat}</span></div>
          <div>Scavenging: <span style="color: #66ff66; font-weight: bold;">${totalScavenging}</span></div>
          <div>Tech: <span style="color: #6666ff; font-weight: bold;">${totalTech}</span></div>
          <div>Speed: <span style="color: #ffff66; font-weight: bold;">${slowestSpeed}</span> (slowest)</div>
        </div>
      </div>
    `;
	}

	private static renderMissionTypes(selectedResource: any, state: GameState): string {
		const availableMissionTypes = getAvailableMissionTypes(selectedResource, state.activeMissions, state.playerAddress);

		if (availableMissionTypes.length === 0) {
			return `
        <div style="
          background: rgba(100, 100, 100, 0.2);
          border: 1px solid #666;
          border-radius: 4px;
          padding: 12px;
          text-align: center;
        ">
          <p style="margin: 0; color: #999; font-size: 12px;">No mission types available for this node</p>
        </div>
      `;
		}

		const selectedMissionType = state.selectedMissionType;

		return `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        ${availableMissionTypes
					.map((missionType) => {
						const isSelected = selectedMissionType === missionType.type;
						return `
            <button
              class=\"mission-type-btn\"
              data-type=\"${missionType.type}\"
              style=\"\
                background: ${isSelected ? '#ffd700' : missionType.color};\
                border: 2px solid ${isSelected ? '#ffff00' : missionType.borderColor};\
                color: ${isSelected ? '#000' : '#fff'};\
                padding: 8px;\
                cursor: ${missionType.enabled ? 'pointer' : 'not-allowed'};\
                border-radius: 4px;\
                opacity: ${missionType.enabled ? (isSelected ? '1' : '0.7') : '0.6'};\
                transform: ${isSelected ? 'scale(1.05)' : 'scale(1)'};\
                box-shadow: ${isSelected ? '0 0 12px rgba(255, 215, 0, 0.6)' : 'none'};\
                font-weight: ${isSelected ? 'bold' : 'normal'};\
                transition: all 0.2s ease;\
              \"\
              ${!missionType.enabled ? 'disabled' : ''}
            >
              ${missionType.name}<br><small>${missionType.description}</small>
            </button>
          `;
					})
					.join('')}
      </div>
    `;
	}

	private static renderVehicleSelection(state: GameState): string {
		const selectedVehicleInstanceId = state.selectedVehicleInstanceId;
		const selectedVehicleInstance = state.profile?.vehicles.find((v) => v.instanceId === selectedVehicleInstanceId);
		const selectedVehicle = selectedVehicleInstance ? getVehicleData(selectedVehicleInstance.vehicleId) : undefined;

		return `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.05); border-radius: 4px; padding: 12px;">
          <div>
            <p style="margin: 0; font-size: 14px; color: #ccc;">Selected Vehicle:</p>
            <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #00ff00;">${selectedVehicle ? selectedVehicle.name : 'None'}</p>
          </div>
          <button id=\"select-vehicle-btn\" style=\"background: #444; border: 1px solid #666; color: #fff; padding: 8px 16px; cursor: pointer; border-radius: 4px;\">
            ${selectedVehicleInstanceId ? 'Change' : 'Select'} Vehicle
          </button>
        </div>
      `;
	}

	private static setupMissionPanelHandlers() {
		// Drifter selection - handle multi-selection
		document.querySelectorAll('.drifter-option').forEach((option) => {
			option.addEventListener('click', (event) => {
				event.preventDefault();
				const drifterId = parseInt(option.getAttribute('data-id') || '0');
				const isBusy = option.getAttribute('data-busy') === 'true';

				// Don't allow selection of busy drifters
				if (isBusy) {
					return;
				}

				// Toggle selection in game state
				gameState.toggleDrifterSelection(drifterId);

				// Update estimates when drifter selection changes
				setTimeout(() => MissionPanel.updateMissionPanel(gameState.getState()), 50);
			});
		});

		// Drifter sort dropdown
		const sortSelect = document.getElementById('drifter-sort-select');
		if (sortSelect) {
			sortSelect.addEventListener('change', (event) => {
				const sortBy = (event.target as HTMLSelectElement).value as 'combat' | 'scavenging' | 'tech' | 'speed';
				gameState.setDrifterSortBy(sortBy);
			});
		}

		// Mission type selection
		document.querySelectorAll('.mission-type-btn').forEach((btn) => {
			btn.addEventListener('click', () => {
				const missionType = btn.getAttribute('data-type');
				gameState.setMissionType(missionType);

				// Update estimates when mission type changes
				MissionPanel.updateMissionPanel(gameState.getState());
			});
		});

		document.getElementById('select-vehicle-btn')?.addEventListener('click', () => {
			gameState.toggleVehiclePanel();
		});

		// Start mission button
		document.getElementById('start-mission-btn')?.addEventListener('click', async () => {
			const currentState = gameState.getState();
			const selectedIds = currentState.selectedDrifterIds || [];
			const missionType = currentState.selectedMissionType;
			const vehicleInstanceId = currentState.selectedVehicleInstanceId;

			if (selectedIds.length > 0 && missionType && currentState.selectedResourceNode) {
				// Send all selected drifters to the backend
				const result = await gameState.startMission(selectedIds, currentState.selectedResourceNode, missionType as any, vehicleInstanceId);

				if (result.success) {
					// Clear selections and close panel
					gameState.clearSelectedDrifters();
					gameState.setMissionType(null);
					gameState.selectVehicleInstance(null);
					gameState.toggleMissionPanel();
				}
			}
		});
	}

	static updateStartButton() {
		const button = document.getElementById('start-mission-btn') as HTMLButtonElement;
		if (!button) {
			return;
		}

		const state = gameState.getState();
		const selectedIds = state.selectedDrifterIds || [];
		const missionType = state.selectedMissionType;
		const vehicleInstanceId = state.selectedVehicleInstanceId;
		const selectedVehicleInstance = state.profile?.vehicles.find((v) => v.instanceId === vehicleInstanceId);
		const selectedVehicle = selectedVehicleInstance ? getVehicleData(selectedVehicleInstance.vehicleId) : undefined;
		const maxDrifters = selectedVehicle ? selectedVehicle.maxDrifters : Number.POSITIVE_INFINITY;

		if (selectedIds.length > 0 && missionType && selectedIds.length <= maxDrifters) {
			button.disabled = false;
			button.style.background = '#2c5530';
			button.style.cursor = 'pointer';
			const teamText = selectedIds.length === 1 ? '1 Drifter' : `${selectedIds.length} Drifters`;
			button.textContent = `Start ${missionType.toUpperCase()} Mission (${teamText})`;
		} else {
			button.disabled = true;
			button.style.background = '#666';
			button.style.cursor = 'not-allowed';
			if (selectedIds.length === 0) {
				button.textContent = 'Select Drifters';
			} else if (!missionType) {
				button.textContent = 'Select Mission Type';
			} else if (selectedIds.length > maxDrifters) {
				button.textContent = `Too many drifters for ${selectedVehicle?.name}`;
			} else {
				button.textContent = 'Select Drifters & Mission Type';
			}
		}
	}
}
