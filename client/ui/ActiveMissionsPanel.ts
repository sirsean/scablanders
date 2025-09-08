import type { Mission, DrifterProfile, ResourceNode } from '@shared/models';
import { gameState } from '../gameState';
import { getVehicleData } from '../utils/vehicleUtils';
import { calculateOneWayTravelDuration, type DrifterStats } from '../../shared/mission-utils';

export class ActiveMissionsPanel {
	private static updateInterval: number | null = null;
	private static lastMissions: Mission[] = [];
	private static lastOwnedDrifters: DrifterProfile[] = [];
	private static lastResources: ResourceNode[] = [];

	// Set up cleanup on page unload
	static {
		if (typeof window !== 'undefined') {
			window.addEventListener('beforeunload', () => {
				ActiveMissionsPanel.stopLiveTimer();
			});
		}
	}

	static createActiveMissionsPanel(): HTMLElement {
		const panel = document.createElement('div');
		panel.id = 'active-missions-panel';
		panel.className = 'game-panel';
		panel.style.cssText = `
      position: fixed;
      width: 600px;
      max-height: 400px;
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
		(panel as any).dataset.baseWidth = '600';
		panel.style.zIndex = '1050';

		panel.innerHTML = `
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0;">Active Missions</h3>
        <button id="close-active-missions-panel" style="margin-left: auto;">✕</button>
      </div>
      <div id="active-missions-content">
        <p>Loading active missions...</p>
      </div>
    `;

		return panel;
	}

	static updateActiveMissionsPanel(
		playerMissions: Mission[],
		ownedDrifters: DrifterProfile[],
		resources: ResourceNode[],
		isLoading: boolean,
	) {
		// Store the data for live updates
		this.lastMissions = playerMissions || [];
		this.lastOwnedDrifters = ownedDrifters || [];
		this.lastResources = resources || [];

		this.renderContent(isLoading);

		// Start or restart the live timer
		this.startLiveTimer();
	}

	/**
	 * Start the live timer that updates countdowns every second
	 */
	private static startLiveTimer() {
		// Clear any existing timer
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
		}

		// Start new timer
		this.updateInterval = setInterval(() => {
			// Only update if the panel is visible and we have missions
			const panel = document.getElementById('active-missions-panel');
			if (panel && panel.style.display !== 'none') {
				this.renderContent(false); // Not loading, just live update
			}
		}, 1000) as any;
	}

	/**
	 * Stop the live timer
	 */
	static stopLiveTimer() {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
	}

	/**
	 * Render the content using stored data
	 */
	private static renderContent(isLoading: boolean) {
		const content = document.getElementById('active-missions-content');
		if (!content) {
			return;
		}

		if (isLoading) {
			content.innerHTML = '<p>Loading active missions...</p>';
			return;
		}

		if (!this.lastMissions || this.lastMissions.length === 0) {
			content.innerHTML = `
        <div style="text-align: center; color: #888; padding: 20px;">
          <p>No active missions</p>
          <p style="font-size: 14px;">Start a mission by selecting a resource node on the map!</p>
        </div>
      `;
			this.stopLiveTimer(); // No point running timer with no missions
			return;
		}

		// Filter and sort by soonest completion
		const activeMissions = this.lastMissions
			.filter((m) => m.status === 'active')
			.sort((a, b) => new Date(a.completionTime).getTime() - new Date(b.completionTime).getTime());

		if (activeMissions.length === 0) {
			content.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <p class="muted">No active missions</p>
          <p class="muted" style="font-size: 14px;">Start a mission by selecting a resource node on the map!</p>
        </div>
      `;
			this.stopLiveTimer(); // No active missions, stop the timer
			return;
		}

		content.innerHTML = `
      <div style="margin-bottom: 12px;">
        <span style="font-weight: bold;">Active Missions: ${activeMissions.length}</span>
      </div>
      
      ${activeMissions.map((mission) => this.renderMissionCard(mission, this.lastOwnedDrifters, this.lastResources)).join('')}
    `;
	}

private static renderMissionCard(mission: Mission, ownedDrifters: DrifterProfile[], resources: ResourceNode[]): string {
		const targetResource = resources.find((r) => r.id === mission.targetNodeId);
		const missionDrifters = ownedDrifters.filter((d) => mission.drifterIds.includes(d.tokenId));
		const monsters = gameState.getState().monsters || [];
		const targetMonster = mission.targetMonsterId ? monsters.find((m) => m.id === mission.targetMonsterId) : null;

		// Determine vehicle name from player's profile if present
		const profile = gameState.getState().profile;
		let vehicleName = 'On Foot';
		if (mission.vehicleInstanceId && profile) {
			const vi = profile.vehicles.find((v) => v.instanceId === mission.vehicleInstanceId);
			if (vi) {
				const v = getVehicleData(vi.vehicleId);
				if (v) {
					vehicleName = v.name;
				}
			}
		}

		const now = new Date();
		const progress = this.calculateMissionProgress(mission.startTime, mission.completionTime, now);
		const timeRemaining = this.formatTimeRemaining(mission.completionTime, now);

		// Engagement countdown (for monster missions not yet engaged)
		let engagementCountdownHtml = '';
		if (mission.targetMonsterId && !mission.engagementApplied && targetMonster) {
			// Build effective team stats
			const prof = gameState.getState().profile;
			const teamStats: DrifterStats[] = missionDrifters.map((d) => {
				const dp = prof?.drifterProgress?.[String(d.tokenId)];
				return {
					combat: d.combat + (dp?.bonuses.combat || 0),
					scavenging: d.scavenging + (dp?.bonuses.scavenging || 0),
					tech: d.tech + (dp?.bonuses.tech || 0),
					speed: d.speed + (dp?.bonuses.speed || 0),
				};
			});
			// Vehicle (if any)
			let selectedVehicle: any = undefined;
			if (mission.vehicleInstanceId && prof) {
				const vi = prof.vehicles.find((v) => v.instanceId === mission.vehicleInstanceId);
				if (vi) {
					selectedVehicle = getVehicleData(vi.vehicleId);
				}
			}
			if (targetMonster.state === 'attacking') {
				engagementCountdownHtml = `<div class=\"crt-row\"><span class=\"label\">Engages in:</span> <span class=\"crt-status\" data-state=\"active\">Now</span></div>`;
			} else {
				const outboundMs = calculateOneWayTravelDuration(targetMonster.coordinates as any, teamStats, selectedVehicle);
				const startTimeMs = (mission.startTime instanceof Date ? mission.startTime : new Date(mission.startTime)).getTime();
				if (Number.isFinite(startTimeMs)) {
					const engageAt = startTimeMs + outboundMs;
					const remainingMs = engageAt - now.getTime();
					if (remainingMs > 0) {
						const engagesIn = this.formatTimeRemaining(new Date(engageAt), now);
						engagementCountdownHtml = `<div class=\"crt-row\"><span class=\"label\">Engages in:</span> <span class=\"crt-status\" data-state=\"active\">${engagesIn}</span></div>`;
					} else {
						engagementCountdownHtml = `<div class=\"crt-row\"><span class=\"label\">Engages in:</span> <span class=\"crt-status\" data-state=\"active\">Now</span></div>`;
					}
				}
			}
		}

		const progressKind = progress >= 100 ? 'complete' : targetMonster ? 'combat' : 'resource';
		const targetKind = targetMonster ? 'monster' : 'resource';

		return `
      <div class="crt-section mission-card">
        <div class="mission-card__header" style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <strong class="crt-heading">${mission.type.toUpperCase()} MISSION</strong>
            <span class="muted" style="margin-left: 8px;">#${mission.id.slice(-6)}</span>
          </div>
          <div class="crt-status" data-state="${progress >= 100 ? 'complete' : 'active'}">${progress >= 100 ? 'COMPLETE!' : timeRemaining}</div>
        </div>

        <div class="mission-card__target" style="margin-bottom: 8px;">
          <span class="label">Target: </span>
          <span class="value" data-kind="${targetKind}">
            ${
              targetMonster
                ? `${targetMonster.kind} (${targetMonster.coordinates.x}, ${targetMonster.coordinates.y})`
                : targetResource
                  ? `${targetResource.type.toUpperCase()} (${targetResource.rarity.toUpperCase()}) (${targetResource.coordinates.x}, ${targetResource.coordinates.y})`
                  : 'Unknown location'
            }
          </span>
        </div>

        ${
          mission.targetMonsterId
            ? `
        <div class=\"mission-card__engagement\" style=\"margin-bottom: 8px;\">
          <span class=\"label\">Engagement: </span>
          <span class=\"crt-status\" data-state=\"${mission.engagementApplied ? 'complete' : 'active'}\">${mission.engagementApplied ? 'Engaged' : 'Pending'}</span>
          ${mission.engagementApplied && typeof mission.combatDamageDealt === 'number' ? `<span class=\"muted\" style=\"margin-left:6px;\">• Damage dealt: <b>${mission.combatDamageDealt}</b></span>` : ''}
        </div>
${!mission.engagementApplied ? engagementCountdownHtml : ''}
${
  mission.battleLocation
    ? `
        <div class=\"mission-card__battle\" style=\"margin-bottom: 8px; display:flex; align-items:center; gap:8px;\">
          <span class=\"label\">Battle:</span>
          <span class=\"tag\">X</span>
          <span class=\"muted\">(${mission.battleLocation.x}, ${mission.battleLocation.y})</span>
          <button onclick=\"centerOnMap(${mission.battleLocation.x}, ${mission.battleLocation.y})\" title=\"Center map on battle location\">Center</button>
        </div>
        `
    : ''
}
        `
            : ''
        }

        <div class="mission-card__team" style="margin-bottom: 8px;">
          <span class="label">Drifters: </span>
          ${missionDrifters.map((d) => `<span style=\"font-size: 12px; margin-right: 8px;\">#${d.tokenId}</span>`).join('')}
        </div>

        <div class="mission-card__vehicle" style="margin-bottom: 8px;">
          <span class="label">Vehicle: </span>
          <span class="value" data-kind="vehicle" style="font-size: 12px;">${vehicleName}</span>
        </div>

        <div class="mission-card__progress" style="margin-bottom: 8px;">
          <div class="crt-progress"><div class="crt-progress__bar" data-kind="${progressKind}" style="width: ${Math.min(100, progress)}%;"></div></div>
          <div class="muted" style="font-size: 10px; text-align: center; margin-top: 2px;">${progress.toFixed(1)}% Complete</div>
        </div>

        ${
          progress >= 100
            ? `
          <button onclick="collectMission('${mission.id}')" style="width: 100%; padding: 6px; font-size: 12px;">Collect Rewards</button>
        `
            : ''
        }
      </div>
    `;
}

	private static calculateMissionProgress(startTime: Date | string, completionTime: Date | string, currentTime: Date): number {
		const startDate = startTime instanceof Date ? startTime : new Date(startTime);
		const endDate = completionTime instanceof Date ? completionTime : new Date(completionTime);

		const totalDuration = endDate.getTime() - startDate.getTime();
		const elapsed = currentTime.getTime() - startDate.getTime();
		return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
	}

	private static formatTimeRemaining(completionTime: Date | string, currentTime: Date): string {
		const endDate = completionTime instanceof Date ? completionTime : new Date(completionTime);
		const remainingMs = endDate.getTime() - currentTime.getTime();

		if (remainingMs <= 0) {
			return 'Complete!';
		}

		const totalSeconds = Math.floor(remainingMs / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m ${seconds}s`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds}s`;
		} else {
			return `${seconds}s`;
		}
	}
}

// Global function for collecting missions
(window as any).centerOnMap = (x: number, y: number) => {
	try {
		window.dispatchEvent(new CustomEvent('map:center-on' as any, { detail: { x, y, smooth: true, duration: 800 } } as any));
	} catch (e) {
		console.warn('Failed to dispatch center-on event', e);
	}
};

(window as any).collectMission = async (missionId: string) => {
	try {
		const response = await fetch('/api/missions/complete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ missionId }),
		});

		const result = await response.json();
		if (result.success) {
			// NOTE: Removed client-side notification - server will broadcast via WebSocket
			// gameState.addNotification({
			//   type: 'success',
			//   title: 'Mission Complete!',
			//   message: `Collected rewards from mission #${missionId.slice(-6)}`
			// });
			await gameState.loadWorldState();
			gameState.loadPlayerMissions();
			gameState.loadPlayerProfile();
		} else {
			gameState.addNotification({
				type: 'error',
				title: 'Collection Failed',
				message: result.error || 'Failed to collect mission rewards',
			});
		}
	} catch {
		gameState.addNotification({
			type: 'error',
			title: 'Network Error',
			message: 'Failed to collect mission rewards',
		});
	}
};
