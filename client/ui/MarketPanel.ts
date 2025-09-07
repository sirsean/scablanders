import type { Vehicle } from '@shared/models';
import { gameState } from '../gameState';
import { isVehicleUnlocked, requiredMarketLevel } from '../../shared/vehicle-tiers';

export class MarketPanel {
	static createMarketPanel(): HTMLElement {
		const panel = document.createElement('div');
		panel.id = 'market-panel';
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
      z-index: 1000;
    `;

		// Base width and unified z-index
		(panel as any).dataset.baseWidth = '800';
		panel.style.zIndex = '1050';

		panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px;">
        <h3 id="market-title" style="margin: 0; color: #FFD700;">Vehicle Market (Loading...)</h3>
        <div id="market-balance" style="margin-left: auto; color: #ccc; font-size: 12px;">Balance: —</div>
        <button id="close-market-panel" style="background: none; border: 1px solid #666; color: #fff; padding: 4px 8px; cursor: pointer;">✕</button>
      </div>
      <div id="market-content">
        <p>Loading vehicles...</p>
      </div>
    `;

		return panel;
	}

	static updateMarketPanel(vehicles: Vehicle[], isLoading: boolean) {
		const content = document.getElementById('market-content');
		if (!content) {
			return;
		}

		// Update balance display
		const state = gameState.getState();
		const balance = state.profile?.balance ?? 0;
		const marketLevel = state.town?.attributes?.vehicle_market?.level;
		const balanceEl = document.getElementById('market-balance');
		if (balanceEl) {
			balanceEl.textContent = `Balance: ${balance} credits`;
		}
		const titleEl = document.getElementById('market-title');
		if (titleEl) {
			(titleEl as HTMLElement).textContent = marketLevel != null ? `Vehicle Market (Level ${marketLevel})` : 'Vehicle Market (Loading...)';
		}

		if (isLoading) {
			content.innerHTML = '<p>Loading vehicles...</p>';
			return;
		}

		// If town/market level not yet available, show explicit loading for market gating
		if (marketLevel == null) {
			content.innerHTML = '<p>Loading vehicle market...</p>';
			return;
		}

		if (!vehicles || vehicles.length === 0) {
			content.innerHTML = '<p>No vehicles available for purchase.</p>';
			return;
		}

		content.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">
        ${vehicles.map((vehicle) => this.renderVehicleCard(vehicle, balance, marketLevel as number)).join('')}
      </div>
    `;

		document.querySelectorAll('.purchase-vehicle-btn').forEach((button) => {
			button.addEventListener('click', async (e) => {
				const btn = e.currentTarget as HTMLButtonElement;
				const reason = (btn.dataset.disabledReason || '').toLowerCase();
				const name = btn.dataset.name || 'this vehicle';
				if (reason === 'level') {
					const req = btn.dataset.requiredLevel || '?';
					gameState.addNotification({
						type: 'error',
						title: 'Vehicle Locked',
						message: `Requires Vehicle Market Level ${req} to purchase ${name}.`,
					});
					return;
				}
				if (reason === 'credits') {
					const cost = btn.dataset.cost || '?';
					const currentBalance = gameState.getState().profile?.balance ?? 0;
					gameState.addNotification({
						type: 'error',
						title: 'Insufficient Credits',
						message: `You need ${cost} credits to purchase ${name}. You have ${currentBalance}.`,
					});
					return;
				}
				const vehicleId = btn.dataset.id;
				if (vehicleId) {
					await gameState.purchaseVehicle(vehicleId);
				}
			});
		});
	}

	private static renderVehicleCard(vehicle: Vehicle, balance: number, marketLevel: number): string {
		const levelRequired = requiredMarketLevel(vehicle.id);
		const unlocked = isVehicleUnlocked(vehicle.id, marketLevel);
		const canAfford = balance >= vehicle.cost;

		let buttonStyles = '';
		let label = '';
		let disabledReason = '';
		if (!unlocked) {
			buttonStyles = 'background: #333; border: 1px solid #555; color: #aaa; cursor: not-allowed; opacity: 0.7;';
			label = `Requires Vehicle Market L${levelRequired}`;
			disabledReason = 'level';
		} else if (!canAfford) {
			buttonStyles = 'background: #333; border: 1px solid #555; color: #aaa; cursor: not-allowed; opacity: 0.7;';
			label = `Insufficient credits (${vehicle.cost} needed)`;
			disabledReason = 'credits';
		} else {
			buttonStyles = 'background: #2c5530; border: 1px solid #4a7c59; color: #fff; cursor: pointer;';
			label = `Purchase (${vehicle.cost} credits)`;
		}

		return `
      <div style="border: 1px solid #555; border-radius: 6px; padding: 12px; background: rgba(255, 255, 255, 0.02);">
        <h4 style="color: #FFD700; margin-top: 0;">${vehicle.name}</h4>
        <p style="font-size: 12px; color: #ccc;">${vehicle.description}</p>
        <div style="font-size: 12px; margin-top: 8px;">
          <p style="margin: 4px 0;">Speed: <span style="color: #00ff00;">${vehicle.speed}</span></p>
          <p style="margin: 4px 0;">Combat Bonus: <span style="color: #ff6666;">${(vehicle as any).combat ?? 0}</span></p>
          <p style="margin: 4px 0;">Scavenging Bonus: <span style="color: #66ff66;">${(vehicle as any).scavenging ?? 0}</span></p>
          <p style="margin: 4px 0;">Tech Bonus: <span style="color: #6666ff;">${(vehicle as any).tech ?? 0}</span></p>
          <p style="margin: 4px 0;">Max Drifters: <span style="color: #00ff00;">${vehicle.maxDrifters}</span></p>
          <p style="margin: 4px 0;">Max Cargo: <span style="color: #00ff00;">${vehicle.maxCargo}</span></p>
        </div>
        <button class="purchase-vehicle-btn" data-id="${vehicle.id}" data-name="${vehicle.name}" data-disabled-reason="${disabledReason}" data-required-level="${levelRequired}" data-cost="${vehicle.cost}" aria-disabled="${disabledReason ? 'true' : 'false'}" style="width: 100%; padding: 8px; margin-top: 12px; border-radius: 4px; ${buttonStyles}">
          ${label}
        </button>
        ${unlocked && !canAfford ? `<p style=\"margin: 6px 0 0; font-size: 11px; color: #bbb;\">You have ${balance} credits.</p>` : ''}
      </div>
    `;
	}
}
