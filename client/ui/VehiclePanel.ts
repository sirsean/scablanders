import type { PlayerVehicle } from '@shared/models';
import { gameState } from '../gameState';
import { getVehicleData } from '../utils/vehicleUtils';

export class VehiclePanel {
	static createVehiclePanel(): HTMLElement {
		const panel = document.createElement('div');
		panel.id = 'vehicle-panel';
		panel.className = 'game-panel';
		panel.style.cssText = `
      position: fixed;
      width: 800px;
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

		// Base width and unified z-index
		(panel as any).dataset.baseWidth = '800';
		panel.style.zIndex = '1050';

		panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 8px;">
        <h3 style="margin: 0; color: #FFD700;">Your Vehicles</h3>
        <div style="margin-left: auto; display: flex; gap: 8px;">
          <button id="reconcile-vehicles-btn" style="background: #444; border: 1px solid #666; color: #fff; padding: 4px 10px; cursor: pointer; border-radius: 4px;">Reconcile</button>
          <button id="close-vehicle-panel" style="background: none; border: 1px solid #666; color: #fff; padding: 4px 8px; cursor: pointer;">✕</button>
        </div>
      </div>
      <div id="vehicle-content">
        <p>Loading vehicles...</p>
      </div>
    `;

		// Hook up reconcile button handler
		setTimeout(() => {
			const btn = panel.querySelector('#reconcile-vehicles-btn') as HTMLButtonElement | null;
			if (btn) {
				btn.addEventListener('click', async () => {
					btn.disabled = true;
					const original = btn.textContent;
					btn.textContent = 'Reconciling...';
					try {
						await gameState.reconcileVehicles();
						// Refresh the displayed vehicles
						await gameState.loadPlayerProfile();
						const vehicles = gameState.getState().profile?.vehicles || [];
						VehiclePanel.updateVehiclePanel(vehicles);
					} finally {
						btn.disabled = false;
						btn.textContent = original || 'Reconcile';
					}
				});
			}
		}, 0);

		return panel;
	}

	static updateVehiclePanel(vehicles: PlayerVehicle[]) {
		const content = document.getElementById('vehicle-content');
		if (!content) {
			return;
		}

		if (!vehicles || vehicles.length === 0) {
			content.innerHTML = '<p>No vehicles owned. Visit the market to purchase one.</p>';
			return;
		}

		// Build a unified set of vehicle instance IDs that are currently used by any of the player's active missions
		const state = gameState.getState();
		const selfAddr = state.playerAddress?.toLowerCase() || '';
		const fromPlayer = state.playerMissions || [];
		const fromGlobal = (state.activeMissions || []).filter((m) => m.playerAddress?.toLowerCase() === selfAddr);
		const mergedMap = new Map<string, any>();
		for (const m of fromGlobal) {
			mergedMap.set(m.id, m);
		}
		for (const m of fromPlayer) {
			mergedMap.set(m.id, m);
		}
		const activeVehicleIds = new Set<string>(
			Array.from(mergedMap.values())
				.filter((m: any) => m.status === 'active' && !!m.vehicleInstanceId)
				.map((m: any) => m.vehicleInstanceId as string),
		);

		const vehiclesByType = vehicles.reduce(
			(acc, vehicle) => {
				if (!acc[vehicle.vehicleId]) {
					acc[vehicle.vehicleId] = [];
				}
				acc[vehicle.vehicleId].push(vehicle);
				return acc;
			},
			{} as Record<string, PlayerVehicle[]>,
		);

		content.innerHTML = `
	      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">
	        ${Object.entries(vehiclesByType)
						.map(([vehicleId, instances]) => this.renderVehicleCard(vehicleId, instances, activeVehicleIds))
						.join('')}
	      </div>
	    `;

		document.querySelectorAll('.select-vehicle-btn').forEach((button) => {
			button.addEventListener('click', async (e) => {
				e.preventDefault();
				const vehicleInstanceId = (e.target as HTMLElement).dataset.id;
				if (!vehicleInstanceId) {
					return;
				}
				const currentSelected = gameState.getState().selectedVehicleInstanceId;
				if (currentSelected === vehicleInstanceId) {
					// Deselect if clicking the already selected vehicle
					gameState.selectVehicleInstance(null);
				} else {
					// Select the clicked vehicle
					gameState.selectVehicleInstance(vehicleInstanceId);
				}
				// Re-render the panel to reflect the new selection without closing it
				const vehicles = gameState.getState().profile?.vehicles || [];
				VehiclePanel.updateVehiclePanel(vehicles);
			});
		});
	}

	private static renderVehicleCard(vehicleId: string, instances: PlayerVehicle[], activeVehicleIds: Set<string>): string {
		const vehicleData = getVehicleData(vehicleId);
		if (!vehicleData) {
			return '';
		}

		return `
	      <div style="border: 1px solid #555; border-radius: 6px; padding: 12px; background: rgba(255, 255, 255, 0.02);">
	        <h4 style="color: #FFD700; margin-top: 0;">${vehicleData.name} (${instances.length})</h4>
	        <p style="font-size: 12px; color: #ccc;">${vehicleData.description}</p>
	        <div style="font-size: 12px; margin-top: 8px;">
	          <p style="margin: 4px 0;">Speed: <span style="color: #00ff00;">${vehicleData.speed}</span></p>
	          <p style="margin: 4px 0;">Combat Bonus: <span style="color: #ff6666;">${(vehicleData as any).combat ?? 0}</span></p>
	          <p style="margin: 4px 0;">Scavenging Bonus: <span style="color: #66ff66;">${(vehicleData as any).scavenging ?? 0}</span></p>
	          <p style="margin: 4px 0;">Tech Bonus: <span style="color: #6666ff;">${(vehicleData as any).tech ?? 0}</span></p>
	          <p style="margin: 4px 0;">Max Drifters: <span style="color: #00ff00;">${vehicleData.maxDrifters}</span></p>
	          <p style="margin: 4px 0;">Max Cargo: <span style="color: #00ff00;">${vehicleData.maxCargo}</span></p>
	        </div>
			<div style="margin-top: 12px;">
				${instances.map((instance) => this.renderVehicleInstance(instance, activeVehicleIds)).join('')}
			</div>
	      </div>
	    `;
	}

	private static renderVehicleInstance(instance: PlayerVehicle, activeVehicleIds: Set<string>): string {
		const isOnMission = instance.status === 'on_mission' || activeVehicleIds.has(instance.instanceId);
		const isIdle = !isOnMission;
		const selectedId = gameState.getState().selectedVehicleInstanceId;
		const isSelected = selectedId === instance.instanceId;
		const bg = isSelected ? '#2a3d55' : isIdle ? '#2c5530' : '#552c2c';
		const border = isSelected ? '#4a6a8a' : isIdle ? '#4a7c59' : '#7c4a4a';
		const buttonLabel = isSelected ? 'Deselect' : isIdle ? 'Select' : 'On Mission';
		const buttonDisabled = !isIdle; // prevent selecting while on a mission
		const buttonBg = isSelected ? '#2f5d87' : isIdle ? '#4a7c59' : '#7c4a4a';
		return `
			<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-top: 8px; background: ${bg}; border: 1px solid ${border}; border-radius: 4px; position: relative;">
				<p style="margin: 0; font-size: 12px; color: #fff;">Instance: ${instance.instanceId.slice(0, 8)}...</p>
${isSelected ? '<span style="position:absolute; top:-8px; left:-8px; background:#2f5d87; color:#fff; font-size:10px; padding:2px 6px; border-radius:4px; border:1px solid #4a6a8a;">SELECTED</span>' : ''}
				<button class="select-vehicle-btn" data-id="${instance.instanceId}" style="padding: 4px 8px; background: ${buttonBg}; border: 1px solid #fff; color: #fff; cursor: ${buttonDisabled ? 'not-allowed' : 'pointer'}; border-radius: 4px;" ${buttonDisabled ? 'disabled' : ''}>
					${buttonLabel}
				</button>
			</div>
		`;
	}
}
