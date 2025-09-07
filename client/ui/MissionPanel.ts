import type { GameState } from '../gameState';
import { gameState } from '../gameState';
import { getVehicleData } from '../utils/vehicleUtils';
import type { DrifterProfile } from '@shared/models';
import {
	calculateLiveEstimates,
	formatDuration,
	getAvailableMissionTypes,
	calculateMonsterMissionDuration,
	estimateMonsterDamage,
	type DrifterStats,
	BASE_SPEED,
} from '../../shared/mission-utils';
import { DriftersList } from './components/DriftersList';

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
		const drifterList = document.getElementById('mission-drifter-list-container') as HTMLElement;
		const scrollTop = drifterList?.scrollTop || 0;

		// Monster-targeting mode
		if (state.selectedTargetMonsterId) {
			if (!state.isAuthenticated) {
				content.innerHTML = '<p style="color: #ff6b6b;">Please connect your wallet to start missions.</p>';
				return;
			}

			const monster = (state.monsters || []).find((m) => m.id === state.selectedTargetMonsterId);
			if (!monster) {
				content.innerHTML = '<p>Monster not found.</p>';
				return;
			}

			const selectedDrifterIds = state.selectedDrifterIds || [];
			const selectedVehicleInstance = state.profile?.vehicles.find((v) => v.instanceId === state.selectedVehicleInstanceId);
			const selectedVehicle = selectedVehicleInstance ? getVehicleData(selectedVehicleInstance.vehicleId) : undefined;
			const maxDrifters = selectedVehicle ? selectedVehicle.maxDrifters || 0 : 0;
			const atCapacity = !!selectedVehicle && selectedDrifterIds.length >= maxDrifters;

			// Build effective team stats for estimates
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

			// Estimate duration and damage using shared helpers
			const durationMs = calculateMonsterMissionDuration(
				{ x: monster.coordinates.x, y: monster.coordinates.y },
				teamStats,
				selectedVehicle,
			);
			const durationText = formatDuration(durationMs);

			const dmg = estimateMonsterDamage(teamStats, selectedVehicle);
			const minDmg = dmg.min;
			const maxDmg = dmg.max;

			content.innerHTML = `
			  <div style="display:flex; gap: 20px; height:100%;">
			    <div style="flex:1; display:flex; flex-direction:column;">
			      <div style="margin-bottom: 16px; border: 2px solid #444; border-radius: 8px; padding: 16px; background: rgba(255, 255, 255, 0.02);">
			        <h4 style="color:#FFD700; margin:0 0 12px 0;">Combat Mission (Monster)</h4>
        <div>Monster: <b>${monster.kind}</b></div>
			        <div>HP: <b style="color:#ff6666;">${monster.hp}</b> / <b>${monster.maxHp}</b></div>
			        <div>Coords: (${monster.coordinates.x}, ${monster.coordinates.y})</div>
			        <div>State: ${monster.state}</div>
			      </div>
			      <div style="margin-bottom: 16px;">
			        <h4 style="color:#FFD700; margin: 0 0 8px 0;">Vehicle</h4>
			        ${MissionPanel.renderVehicleSelection(state)}
			      </div>
			      <div style="margin-bottom: 16px; border: 2px solid #444; border-radius: 8px; padding: 12px; background: rgba(255,255,255,0.02);">
			        <h4 style="color:#FFD700; margin: 0 0 8px 0;">Estimated Outcome</h4>
			        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px;">
			          <div>⏱️ Duration: <b style="color:#ffff66;">${durationText}</b></div>
			          <div>🔥 Est. Damage: <b style="color:#ff8888;">${minDmg}-${maxDmg}</b></div>
			        </div>
			      </div>
			      <div style="margin-top:auto;">
			        <button id="start-monster-mission-btn" disabled style="width:100%; padding: 14px 24px; background:#666; border:1px solid #888; color:#fff; cursor:not-allowed; border-radius:6px; font-size:16px; font-weight:bold;">Select Drifter(s)</button>
			      </div>
			    </div>
			    <div style="flex:1; display:flex; flex-direction:column; height:100%;">
			      <div style="display:flex; align-items:center; justify-content:space-between; margin:0 0 12px 0;">
			        <h4 style="color:#FFD700; margin:0;">Select Team</h4>
			        <span style="font-size:11px; color: ${atCapacity ? '#ff6b6b' : '#ccc'};">${selectedDrifterIds.length} / ${maxDrifters > 0 ? maxDrifters : '-'} Drifters Selected</span>
			      </div>
			      <div id="drifter-selection" style="flex:1; display:flex; flex-direction:column; min-height:0;">
			        ${DriftersList.render({ idPrefix: 'mission', mode: 'select', drifters: state.ownedDrifters, state })}
			      </div>
			    </div>
			  </div>
			`;

			MissionPanel.setupMonsterMissionHandlers();
			return;
		}

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

		const maxDrifters = selectedVehicle?.maxDrifters || 0;
		const atCapacity = !!selectedVehicle && selectedDrifterIds.length >= maxDrifters;

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
          <div style="display: flex; align-items: center; justify-content: space-between; margin: 0 0 12px 0;">
            <h4 style="color: #FFD700; margin: 0;">Select Team</h4>
            <span style="font-size: 11px; color: ${atCapacity ? '#ff6b6b' : '#ccc'};">${selectedDrifterIds.length} / ${maxDrifters > 0 ? maxDrifters : '-'} Drifters Selected</span>
          </div>
          <div id="drifter-selection" style="flex: 1; display: flex; flex-direction: column; min-height: 0;">
            ${DriftersList.render({ idPrefix: 'mission', mode: 'select', drifters: state.ownedDrifters, state })}
            ${MissionPanel.renderTeamSummary(selectedDrifterIds, state.ownedDrifters)}
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
				const newDrifterList = document.getElementById('mission-drifter-list-container') as HTMLElement;
				if (newDrifterList) {
					newDrifterList.scrollTop = scrollTop;
				}
			});
		}
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
		// Attach shared drifters list handlers in select mode
		const stateNow = gameState.getState();
		DriftersList.attachHandlers({
			idPrefix: 'mission',
			mode: 'select',
			drifters: stateNow.ownedDrifters,
			state: stateNow,
			onChanged: () => {
				// Re-render to update estimates, selection visuals, and start button
				setTimeout(() => MissionPanel.updateMissionPanel(gameState.getState()), 50);
			},
		});

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

	private static setupMonsterMissionHandlers() {
		const stateNow = gameState.getState();
		DriftersList.attachHandlers({
			idPrefix: 'mission',
			mode: 'select',
			drifters: stateNow.ownedDrifters,
			state: stateNow,
			onChanged: () => setTimeout(() => MissionPanel.updateMissionPanel(gameState.getState()), 50),
		});

		document.getElementById('select-vehicle-btn')?.addEventListener('click', () => {
			gameState.toggleVehiclePanel();
		});

		MissionPanel.setupMonsterStartButton();
	}

	private static setupMonsterStartButton() {
		const btn = document.getElementById('start-monster-mission-btn') as HTMLButtonElement | null;
		if (!btn) {
			return;
		}
		const state = gameState.getState();
		const selectedIds = state.selectedDrifterIds || [];
		const vehicleInstanceId = state.selectedVehicleInstanceId;
		const selectedVehicleInstance = state.profile?.vehicles.find((v) => v.instanceId === vehicleInstanceId);
		const selectedVehicle = selectedVehicleInstance ? getVehicleData(selectedVehicleInstance.vehicleId) : undefined;
		const maxDrifters = selectedVehicle?.maxDrifters ?? Infinity;

		if (selectedIds.length === 0) {
			btn.disabled = true;
			btn.style.background = '#666';
			btn.style.cursor = 'not-allowed';
			btn.textContent = 'Select Drifter(s)';
		} else if (selectedVehicle && selectedIds.length > maxDrifters) {
			btn.disabled = true;
			btn.style.background = '#666';
			btn.style.cursor = 'not-allowed';
			btn.textContent = `Too many drifters for ${selectedVehicle.name}`;
		} else {
			btn.disabled = false;
			btn.style.background = '#2c5530';
			btn.style.cursor = 'pointer';
			btn.textContent = `Start COMBAT Mission (${selectedIds.length} Drifter${selectedIds.length > 1 ? 's' : ''})`;
		}

		btn.onclick = async () => {
			const st = gameState.getState();
			const mid = st.selectedTargetMonsterId;
			if (!mid) {
				return;
			}
			// Re-check capacity at click time
			const vInst = st.profile?.vehicles.find((v) => v.instanceId === st.selectedVehicleInstanceId);
			const v = vInst ? getVehicleData(vInst.vehicleId) : undefined;
			if (v && selectedIds.length > (v.maxDrifters ?? Infinity)) {
				return;
			}
			const res = await gameState.startMonsterCombatMission(selectedIds, mid, vehicleInstanceId);
			if (res?.success) {
				gameState.clearSelectedDrifters();
				gameState.setMissionType(null);
				gameState.setSelectedTargetMonster(null);
				gameState.selectVehicleInstance(null);
				gameState.toggleMissionPanel();
			}
		};
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
