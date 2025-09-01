import type { Vehicle } from '@shared/models';
import { gameState } from '../gameState';

export class MarketPanel {
  static createMarketPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'market-panel';
    panel.className = 'game-panel';
    panel.style.cssText = `
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
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

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; color: #FFD700;">Vehicle Market</h3>
        <button id="close-market-panel" style="background: none; border: 1px solid #666; color: #fff; padding: 4px 8px; cursor: pointer; margin-left: auto;">✕</button>
      </div>
      <div id="market-content">
        <p>Loading vehicles...</p>
      </div>
    `;

    return panel;
  }

  static updateMarketPanel(vehicles: Vehicle[], isLoading: boolean) {
    const content = document.getElementById('market-content');
    if (!content) return;

    if (isLoading) {
      content.innerHTML = '<p>Loading vehicles...</p>';
      return;
    }

    if (!vehicles || vehicles.length === 0) {
      content.innerHTML = '<p>No vehicles available for purchase.</p>';
      return;
    }

    content.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">
        ${vehicles.map(vehicle => this.renderVehicleCard(vehicle)).join('')}
      </div>
    `;

    document.querySelectorAll('.purchase-vehicle-btn').forEach(button => {
      button.addEventListener('click', async (e) => {
        const vehicleId = (e.target as HTMLElement).dataset.id;
        if (vehicleId) {
          await gameState.purchaseVehicle(vehicleId);
        }
      });
    });
  }

  private static renderVehicleCard(vehicle: Vehicle): string {
    return `
      <div style="border: 1px solid #555; border-radius: 6px; padding: 12px; background: rgba(255, 255, 255, 0.02);">
        <h4 style="color: #FFD700; margin-top: 0;">${vehicle.name}</h4>
        <p style="font-size: 12px; color: #ccc;">${vehicle.description}</p>
        <div style="font-size: 12px; margin-top: 8px;">
          <p style="margin: 4px 0;">Speed: <span style="color: #00ff00;">${vehicle.speed}%</span></p>
          <p style="margin: 4px 0;">Max Drifters: <span style="color: #00ff00;">${vehicle.maxDrifters}</span></p>
          <p style="margin: 4px 0;">Max Cargo: <span style="color: #00ff00;">${vehicle.maxCargo}</span></p>
        </div>
        <button class="purchase-vehicle-btn" data-id="${vehicle.id}" style="width: 100%; padding: 8px; margin-top: 12px; background: #2c5530; border: 1px solid #4a7c59; color: #fff; cursor: pointer; border-radius: 4px;">
          Purchase (${vehicle.cost} credits)
        </button>
      </div>
    `;
  }
}
