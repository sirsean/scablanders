import Phaser from 'phaser';
import type { ResourceNode, Mission } from '@shared/models';
import { gameState, GameState } from '../gameState';
import { getResourceTextureKey } from '../utils/resourceTextures';
import { getVehicleData } from '../utils/vehicleUtils';
import { getMonsterTextureKey } from '../utils/monsterTextures';

// Town coordinates - world origin
const TOWN_X = 0;
const TOWN_Y = 0;

// Camera zoom limits
const MIN_ZOOM = 1.0; // max zoom out
const MAX_ZOOM = 1.0; // max zoom in
// Resource node display constants
const RESOURCE_NODE_BASE_SCALE = 0.15; // Base scale for resource nodes (adjust to resize all nodes)
const RESOURCE_NODE_RARITY_SCALE_MULTIPLIER = 1.2; // How much bigger rare/epic/legendary nodes are
const RESOURCE_NODE_LABEL_OFFSET = 30; // Distance above the node to place the label

// Mission color palette (Material-inspired)
const COLOR_OTHER_ACTIVE = 0xe53935; // red 600
const COLOR_SELF_ACTIVE = 0xffc107; // amber 500
const COLOR_COMPLETED = 0x43a047; // green 600

// How long to show completed missions after completion (ms)
const RECENT_COMPLETED_MS = 15_000;

// Render depths
const DEPTH_BG = -10;
const DEPTH_TOWN = 100;
const DEPTH_ROUTES = 200;
const DEPTH_DRIFTERS = 300;
const DEPTH_MONSTERS = 320;
const DEPTH_INDICATORS = DEPTH_ROUTES + 1;

export class GameScene extends Phaser.Scene {
	private resourceNodes = new Map<string, Phaser.GameObjects.Image>();
	private worldData: any = null;
	private selectedNode: string | null = null;
	private nodeLabels = new Map<string, Phaser.GameObjects.Text>();
	private nodeGlows = new Map<string, Phaser.GameObjects.Arc>(); // Track glow circles
	// Deprecated per-mission indicators; replaced by batched layer
	private missionIndicators = new Map<string, Phaser.GameObjects.Graphics>();
	private missionIndicatorGlows = new Map<string, Phaser.GameObjects.Graphics>();
	// Batched indicators layer
	private missionIndicatorLayer: Phaser.GameObjects.Graphics | null = null;
	private missionIndicatorItems: { x: number; y: number; color: number; isCompleted: boolean }[] = [];
	private missionRoutes = new Map<string, Phaser.GameObjects.Graphics>();
	private missionDrifters = new Map<string, Phaser.GameObjects.Container>();
	private battleMarkers = new Map<string, Phaser.GameObjects.Graphics>();
	private monsterIcons = new Map<string, Phaser.GameObjects.Container>();
	// Batched route layers
	private routeStaticLayer: Phaser.GameObjects.Graphics | null = null;
	private routeAnimatedLayer: Phaser.GameObjects.Graphics | null = null;
	private animatedRoutes: { x1: number; y1: number; x2: number; y2: number; color: number; phase: number; dash: number; gap: number; startTs: number; endTs: number }[] = [];
	private pendingTinyLoads = new Map<string, Promise<string>>();
	private townMarker: Phaser.GameObjects.Container | null = null;
	private missionRenderVersion = 0;
	// Mission planning overlay
	private planningRoute: Phaser.GameObjects.Graphics | null = null;
	private planningCircle: Phaser.GameObjects.Graphics | null = null;
	// Track visibility window for recently completed missions
	private recentCompletedMissions = new Map<string, number>(); // missionId -> expiresAt (epoch ms)
	private recentCompletedCleanupTimer?: Phaser.Time.TimerEvent;

	private bgTile: Phaser.GameObjects.TileSprite | null = null;
	private isDragging = false;
	private dragMoved = false;
	private dragStart = { x: 0, y: 0 };
	private cameraStart = { x: 0, y: 0 };
	private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
	private onResize = (gameSize: any) => {
		try {
			if (this.bgTile && gameSize) {
				this.bgTile.setSize(gameSize.width, gameSize.height);
			}
		} catch {}
	};

	// Window event handler to center/pan the camera to a given world position
	private onMapCenterOn = (ev: Event) => {
		try {
			const ce = ev as CustomEvent<{ x: number; y: number; smooth?: boolean; duration?: number }>;
			const { x, y, smooth = true, duration = 600 } = (ce && ce.detail) || { x: 0, y: 0, smooth: true, duration: 600 };
			const cam = this.cameras.main;
			const worldX = typeof x === 'number' ? x : 0;
			const worldY = typeof y === 'number' ? y : 0;
			if (smooth && typeof (cam as any).pan === 'function') {
				// Phaser Camera pan(x, y, duration, ease, force, callback, context)
				(cam as any).pan(worldX, worldY, duration, 'Sine.easeInOut', true);
			} else {
				cam.centerOn(worldX, worldY);
			}
		} catch (e) {
			console.warn('[GameScene] Failed to handle map:center-on', e);
		}
	};

	constructor() {
		super({ key: 'GameScene' });
	}

	create() {
		// Infinite tiled background
		this.bgTile = this.add
			.tileSprite(0, 0, this.scale.width, this.scale.height, 'tile-bg')
			.setOrigin(0, 0)
			.setScrollFactor(0)
			.setDepth(DEPTH_BG);

		// Resize background to always cover the viewport
		this.scale.on('resize', this.onResize as any);

		// Center camera on town at startup
		this.cameras.main.centerOn(TOWN_X, TOWN_Y);

		// Scene-level input: drag-to-pan and background clicks (only when not over interactive objects)
		this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
			if (currentlyOver.length === 0 && pointer.leftButtonDown()) {
				const cam = this.cameras.main;
				this.isDragging = true;
				this.dragMoved = false;
				this.dragStart.x = pointer.x;
				this.dragStart.y = pointer.y;
				this.cameraStart.x = cam.scrollX;
				this.cameraStart.y = cam.scrollY;
			}
		});
		this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
			if (!this.isDragging) {
				return;
			}
			const cam = this.cameras.main;
			const dx = pointer.x - this.dragStart.x;
			const dy = pointer.y - this.dragStart.y;
			if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
				this.dragMoved = true;
			}
			cam.scrollX = this.cameraStart.x - dx / cam.zoom;
			cam.scrollY = this.cameraStart.y - dy / cam.zoom;
		});
		this.input.on('pointerup', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
			const wasDragging = this.isDragging;
			this.isDragging = false;
			if (currentlyOver.length === 0) {
				if (!wasDragging || !this.dragMoved) {
					this.handleBackgroundClick();
				}
			}
		});

		// Listen for game state changes
		gameState.onStateChange((state: GameState) => {
			this.updateWorldDisplay(state);
		});

		// Create town marker
		this.createTownMarker();

		// Create batched mission indicator layer
		this.missionIndicatorLayer = this.add.graphics();
		this.missionIndicatorLayer.setDepth(DEPTH_INDICATORS);

		// Create batched route layers
		this.routeStaticLayer = this.add.graphics();
		this.routeStaticLayer.setDepth(DEPTH_ROUTES);
		this.routeAnimatedLayer = this.add.graphics();
		this.routeAnimatedLayer.setDepth(DEPTH_ROUTES);

		// Resource nodes will be loaded from server via gameState

		// Listen for external UI requests to center/pan the map
		window.addEventListener('map:center-on' as any, this.onMapCenterOn as EventListener);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			// Detach global listeners
			try { window.removeEventListener('map:center-on' as any, this.onMapCenterOn as EventListener); } catch {}
			try { this.scale.off('resize', this.onResize as any); } catch {}
			// Stop timers/tweens registered in this scene
			try { this.time.removeAllEvents(); } catch {}
			try { this.tweens.killAll(); } catch {}
			// Input listeners
			try { this.input?.keyboard?.removeAllListeners(); } catch {}
			try { (this.input as any)?.removeAllListeners?.(); } catch {}
			// Scene event listeners
			try { this.events.removeAllListeners(); } catch {}
			// Camera listeners
			try { this.cameras?.main?.removeAllListeners(); } catch {}
			// Destroy display objects we manage
			try { this.cleanupAllDisplayObjects(); } catch {}
		});

		this.events.once(Phaser.Scenes.Events.DESTROY, () => {
			try { this.cleanupAllDisplayObjects(); } catch {}
		});

		// Keyboard controls (arrows) and Shift for faster pan
		this.cursorKeys = this.input.keyboard.createCursorKeys();

		// Mouse wheel zoom
		this.input.on('wheel', (_pointer: any, _over: any, _dx: number, dy: number, _dz: number, _event: WheelEvent) => {
			const cam = this.cameras.main;
			const factor = dy > 0 ? 0.9 : 1.1;
			const next = Phaser.Math.Clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM);
			cam.setZoom(next);
		});

		// Periodically clean up expired completed mission visuals
		this.recentCompletedCleanupTimer = this.time.addEvent({
			delay: 1000,
			loop: true,
			callback: () => this.cleanupExpiredCompletedArtifacts(),
		});
	}

	private buildMissionTooltipHtml(mission: Mission): string {
		const currentState = gameState.getState();
		const timeRemaining = this.formatTimeRemaining(mission.completionTime);
		const drifterProfiles = currentState.ownedDrifters.filter((d) => mission.drifterIds.includes(d.tokenId));
		const ids: number[] = (drifterProfiles.length > 0 ? drifterProfiles.map((d) => d.tokenId) : mission.drifterIds) || [];
		const shown = ids.slice(0, 3).map((id) => `#${id}`);
		const extra = ids.length - 3;
		const driftersText = extra > 0 ? `${shown.join(', ')}, +${extra} more` : shown.join(', ');
		const targetNode = currentState.resourceNodes?.find((r) => r.id === mission.targetNodeId);
		const targetName = targetNode ? `${targetNode.type.toUpperCase()} (${targetNode.rarity})` : 'Unknown Target';
		let vehicleName = 'On Foot';
		if (mission.vehicleInstanceId) {
			const vehicleInstance = currentState.profile?.vehicles.find((v) => v.instanceId === mission.vehicleInstanceId);
			if (vehicleInstance) {
				const vehicleData = getVehicleData(vehicleInstance.vehicleId);
				if (vehicleData) {
					vehicleName = vehicleData.name;
				}
			}
		}
		// Simple HTML formatting
		return [
			`<div><strong>Mission:</strong> ${mission.type.toUpperCase()}</div>`,
			`<div><strong>Target:</strong> ${targetName}</div>`,
			`<div><strong>Vehicle:</strong> ${vehicleName}</div>`,
			`<div><strong>Time Left:</strong> ${timeRemaining}</div>`,
			`<div><strong>Drifters:</strong> ${driftersText}</div>`,
		].join('');
	}

	private hudShowMissionTooltip(pointer: Phaser.Input.Pointer, mission: Mission) {
		const html = this.buildMissionTooltipHtml(mission);
		window.dispatchEvent(
			new CustomEvent('hud:mission-tooltip', { detail: { visible: true, x: pointer.x, y: pointer.y, content: html } } as any),
		);
	}
	private hudUpdateMissionTooltip(pointer: Phaser.Input.Pointer) {
		window.dispatchEvent(new CustomEvent('hud:mission-tooltip', { detail: { visible: true, x: pointer.x, y: pointer.y } } as any));
	}
	private hudHideMissionTooltip() {
		window.dispatchEvent(new CustomEvent('hud:mission-tooltip', { detail: { visible: false } } as any));
	}

	private formatTimeRemaining(completionTime: Date | string): string {
		const endDate = completionTime instanceof Date ? completionTime : new Date(completionTime);
		const remainingMs = endDate.getTime() - new Date().getTime();

		if (remainingMs <= 0) {
			return 'Mission Complete';
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

	// Mission color helper
	private getMissionColor(mission: Mission, playerAddress?: string | null): number {
		if (mission.status === 'completed') {
			return COLOR_COMPLETED;
		}
		const isSelf = !!playerAddress && mission.playerAddress?.toLowerCase() === playerAddress.toLowerCase();
		return isSelf ? COLOR_SELF_ACTIVE : COLOR_OTHER_ACTIVE;
	}

	private isSelfMission(mission: Mission, playerAddress?: string | null): boolean {
		return !!playerAddress && mission.playerAddress?.toLowerCase() === playerAddress.toLowerCase();
	}

	private isSelfActiveMission(mission: Mission, playerAddress?: string | null): boolean {
		return mission.status === 'active' && this.isSelfMission(mission, playerAddress);
	}

	private updateWorldDisplay(state: GameState) {
		if (state.resourceNodes && state.resourceNodes.length > 0) {
			this.updateResourceNodes(state.resourceNodes);
			// Use world missions for indicators
			this.updateMissionIndicators(state.activeMissions || []);
		}

		// Update monsters
		if (state.monsters) {
			this.updateMonsters(state.monsters);
		}

		// Update mission routes and drifter positions
		if (state.activeMissions) {
			this.updateMissionRoutes(state.activeMissions || []);
		}

		// Render battle markers (red X) for engaged monster missions until completion
		this.updateBattleMarkers(state.activeMissions || []);

		// Update mission planning overlay (dotted line and highlight) when planning
		this.updatePlanningOverlay(state);
	}

	/**
	 * Update resource nodes incrementally - only change what's different
	 */
	private updateResourceNodes(serverNodes: ResourceNode[]) {
		const serverNodeMap = new Map(serverNodes.map((node) => [node.id, node]));

		// AGGRESSIVE CLEANUP: Remove any nodes that either:
		// 1. No longer exist on server, OR
		// 2. Have 0 yield (even if server still has them)
		const nodesToRemove: string[] = [];

		for (const [nodeId] of this.resourceNodes) {
			const serverNode = serverNodeMap.get(nodeId);
			if (!serverNode) {
				nodesToRemove.push(nodeId);
			} else if (serverNode.currentYield <= 0 || !serverNode.isActive) {
				nodesToRemove.push(nodeId);
			}
		}

		// Remove all identified nodes
		for (const nodeId of nodesToRemove) {
			this.removeResourceNode(nodeId);
		}

		// Update existing nodes or create new ones
		// Only process active nodes with yield > 0
		for (const serverNode of serverNodes) {
			if (serverNode.currentYield <= 0 || !serverNode.isActive) {
				// Skip depleted/inactive nodes - they should not be displayed
				continue;
			}

			const existingNode = this.resourceNodes.get(serverNode.id);

			if (!existingNode) {
				// Create new node (only if it has yield and is active)
				this.createResourceNodeFromServerData(serverNode);
			} else {
				// Update existing node if changed
				this.updateExistingResourceNode(serverNode);
			}
		}

		// Final validation - nodes with 0 yield should not remain
		for (const [nodeId] of this.resourceNodes) {
			const serverNode = serverNodeMap.get(nodeId);
			if (serverNode && serverNode.currentYield <= 0) {
				// node displayed but yield is 0
			}
		}
	}

	/**
	 * Update an existing resource node's display
	 */
	private updateExistingResourceNode(resource: ResourceNode) {
		const nodeSprite = this.resourceNodes.get(resource.id);
		const nodeLabel = this.nodeLabels.get(resource.id);

		if (!nodeSprite || !nodeLabel) {
			return;
		}

		// Update label text with new yield amount
		const rarityText = resource.rarity !== 'common' ? ` (${resource.rarity.toUpperCase()})` : '';
		const newLabelText = `${resource.type.toUpperCase()}${rarityText}\n${resource.currentYield}`;

		if (nodeLabel.text !== newLabelText) {
			nodeLabel.setText(newLabelText);

			// Add visual feedback for resource changes
			this.flashNodeUpdate(nodeSprite);
		}

		// Update node visual state if depleted
		if (!resource.isActive) {
			nodeSprite.setTint(0x666666); // Gray out depleted nodes
			nodeSprite.setAlpha(0.6);
		} else {
			nodeSprite.clearTint();
			nodeSprite.setAlpha(1.0);
		}
	}

	/**
	 * Remove a resource node, its label, and glow circle
	 */
	private removeResourceNode(nodeId: string) {
		const nodeSprite = this.resourceNodes.get(nodeId);
		const nodeLabel = this.nodeLabels.get(nodeId);
		const nodeGlow = this.nodeGlows.get(nodeId);

		if (nodeSprite) {
			nodeSprite.destroy();
			this.resourceNodes.delete(nodeId);
		}

		if (nodeLabel) {
			nodeLabel.destroy();
			this.nodeLabels.delete(nodeId);
		}

		// Clean up glow circle if it exists
		if (nodeGlow) {
			nodeGlow.destroy();
			this.nodeGlows.delete(nodeId);
		}
	}

	/**
	 * Flash visual effect when a node is updated
	 */
	private flashNodeUpdate(nodeSprite: Phaser.GameObjects.Image) {
		// Brief flash effect to show the node was updated
		this.tweens.add({
			targets: nodeSprite,
			scaleX: nodeSprite.scaleX * 1.1,
			scaleY: nodeSprite.scaleY * 1.1,
			duration: 150,
			yoyo: true,
			ease: 'Bounce.easeOut',
		});

		// Brief tint flash
		this.tweens.add({
			targets: nodeSprite,
			tint: 0x00ff00,
			duration: 200,
			yoyo: true,
			onComplete: () => {
				nodeSprite.clearTint();
			},
		});
	}

	private createResourceNodeFromServerData(resource: ResourceNode) {
		const { id, type, coordinates, currentYield, rarity } = resource;
		const { x, y } = coordinates;

		// Determine node appearance based on type and rarity
		let textureKey = getResourceTextureKey(type, rarity);

		// Fallback handling if texture doesn't exist (dev safety)
		if (!this.textures.exists(textureKey)) {
			console.warn(`Resource texture '${textureKey}' not found, falling back`);
			// Try falling back to common variant of the same type
			const fallbackKey = `${type}-common`;
			if (this.textures.exists(fallbackKey)) {
				textureKey = fallbackKey;
			} else {
				// Final fallback to ore-common
				console.warn(`Fallback texture '${fallbackKey}' not found, using ore-common`);
				textureKey = 'ore-common';
			}
		}

		// Scale down the large images to appropriate map size
		let scale =
			rarity === 'rare' || rarity === 'epic' || rarity === 'legendary'
				? RESOURCE_NODE_BASE_SCALE * RESOURCE_NODE_RARITY_SCALE_MULTIPLIER
				: RESOURCE_NODE_BASE_SCALE;
		let glowColor = this.getRarityColor(rarity);

		// Create the main node sprite
		const node = this.add.image(x, y, textureKey);
		node.setScale(scale);
		node.setInteractive({ cursor: 'pointer' });

		// Add glow effect for rare nodes and store reference
		let glow: Phaser.GameObjects.Arc | null = null;
		if (rarity !== 'common') {
			glow = this.add.circle(x, y, 35, glowColor, 0.3);
			glow.setBlendMode(Phaser.BlendModes.ADD);
			this.nodeGlows.set(id, glow); // Store for cleanup
		}

		// Create hover effects
		node.on('pointerover', () => {
			node.setScale(scale * 1.15);
			node.setTint(0xffffff);
		});

		node.on('pointerout', () => {
			node.setScale(scale);
			node.clearTint();
		});

		// Handle node clicks
		node.on('pointerdown', () => {
			this.selectResourceNode(id, resource);
		});

		// Add node label (positioned above the scaled node)
		const labelY = y - RESOURCE_NODE_LABEL_OFFSET;
		const rarityText = rarity !== 'common' ? ` (${rarity.toUpperCase()})` : '';
		const label = this.add
			.text(x, labelY, `${type.toUpperCase()}${rarityText}\n${currentYield}`, {
				fontSize: '11px',
				color: '#FFFFFF',
				fontFamily: 'Courier New',
				align: 'center',
				backgroundColor: 'rgba(0,0,0,0.6)',
				padding: { x: 4, y: 2 },
			})
			.setOrigin(0.5);

		// Store references
		this.resourceNodes.set(id, node);
		this.nodeLabels.set(id, label);
	}

	private updateMissionIndicators(missions: any[]) {
		// Compute which missions to render as indicators (no per-indicator objects)
		const playerAddressNow = gameState.getState().playerAddress;
		const items: { x: number; y: number; color: number; isCompleted: boolean }[] = [];
		const toRender = missions
			.filter((m: Mission) => !!m.targetNodeId)
			.map((m: Mission) => ({ mission: m, color: this.getMissionRenderColor(m, playerAddressNow) }))
			.filter((e) => e.color !== null) as { mission: Mission; color: number }[];

		for (const { mission, color } of toRender) {
			const node = this.resourceNodes.get(mission.targetNodeId!);
			if (!node) continue;
			const isCompleted = color === COLOR_COMPLETED;
			items.push({ x: node.x, y: node.y, color: color as number, isCompleted });
		}

		this.missionIndicatorItems = items;
		this.drawMissionIndicators();
	}

	private drawMissionIndicators() {
		if (!this.missionIndicatorLayer) return;
		const g = this.missionIndicatorLayer;
		g.clear();
		// Time-based pulse for completed indicators (green)
		const t = this.time.now;
		const pulseAlpha = 0.1 + 0.08 * (0.5 + 0.5 * Math.sin(t * 0.006));
		for (const it of this.missionIndicatorItems) {
			if (it.isCompleted) {
				g.fillStyle(COLOR_COMPLETED, pulseAlpha);
				g.fillCircle(it.x, it.y, 46);
			}
			g.lineStyle(3, it.color, 1);
			g.strokeCircle(it.x, it.y, 40);
		}
	}

		// Old per-indicator objects removed; batched items computed and drawn instead

	private selectResourceNode(nodeId: string, nodeData: any) {

		const currentState = gameState.getState();

		// Update game state
		gameState.selectResourceNode(nodeId);

		// Visual feedback for selection
		if (this.selectedNode) {
			const prevNode = this.resourceNodes.get(this.selectedNode);
			if (prevNode) {
				prevNode.clearTint();
			}
		}

		this.selectedNode = nodeId;
		const selectedNodeSprite = this.resourceNodes.get(nodeId);
		if (selectedNodeSprite) {
			selectedNodeSprite.setTint(0x00ff00);
		}

		// Show mission panel if not already open, or keep it open for node switching
		if (!currentState.showMissionPanel) {
			gameState.showMissionPanel();
		}
	}

	private handleBackgroundClick() {
		const currentState = gameState.getState();

		// Check if any UI panel is open - if so, don't handle background click
		// The UI panels should handle their own closing via close buttons or explicit actions
		if (
			currentState.showMissionPanel ||
			currentState.showMercenaryPanel ||
			currentState.showProfilePanel ||
			currentState.showActiveMissionsPanel
		) {
			return; // Don't close panels on background click - only via close button or ESC
		}

		// Only deselect nodes if no panels are open
		this.deselectCurrentNode();
	}

	private deselectCurrentNode() {
		if (this.selectedNode) {
			const prevNode = this.resourceNodes.get(this.selectedNode);
			if (prevNode) {
				prevNode.clearTint();
			}
			this.selectedNode = null;
			gameState.selectResourceNode(null);
		}

		// Also clear planning overlay when nothing is selected
		this.clearPlanningOverlay();
	}

	private createTownMarker() {
		const townContainer = this.add.container(TOWN_X, TOWN_Y);
		townContainer.setDepth(DEPTH_TOWN);

		// Town image (replace previous rectangle/flag)
		const townImage = this.add.image(0, 0, 'town').setOrigin(0.5, 0.7);
		// Scale to a sensible display height regardless of source image size
		const TARGET_TOWN_HEIGHT = 128; // px, tweak as needed
		const baseH = townImage.height || 1;
		const scale = TARGET_TOWN_HEIGHT / baseH;
		townImage.setScale(scale);

		// Town label positioned above the top of the image
		const townLabel = this.add
			.text(0, 30, 'TOWN', {
				fontSize: '12px',
				color: '#FFD700',
				fontFamily: 'Courier New',
				fontStyle: 'bold',
				backgroundColor: 'rgba(0,0,0,0.8)',
				padding: { x: 6, y: 2 },
			})
			.setOrigin(0.5);

		// Make the town image clickable to toggle the Town panel (same as pressing 'T')
		townImage.setInteractive({ cursor: 'pointer' });
		townImage.on('pointerdown', () => {
			try {
				gameState.toggleTownPanel();
			} catch (e) {
				console.warn('[GameScene] Failed to toggle TownPanel from town click', e);
			}
		});

		townContainer.add([townImage, townLabel]);
		this.townMarker = townContainer;
	}

	private async ensureDrifterTinyTexture(tokenId: number | string): Promise<string> {
		const key = `drifter-${tokenId}-tiny`;
		if (this.textures.exists(key)) {
			return key;
		}
		if (this.pendingTinyLoads.has(key)) {
			return this.pendingTinyLoads.get(key)!;
		}

		const loadPromise = new Promise<string>((resolve) => {
			const onComplete = (loadedKey: string) => {
				if (loadedKey === key) {
					this.load.off(Phaser.Loader.Events.FILE_COMPLETE, onComplete);
					this.load.off(Phaser.Loader.Events.LOAD_ERROR, onError as any);
					this.pendingTinyLoads.delete(key);
					resolve(key);
				}
			};
			const onError = () => {
				this.load.off(Phaser.Loader.Events.FILE_COMPLETE, onComplete);
				this.load.off(Phaser.Loader.Events.LOAD_ERROR, onError as any);
				this.pendingTinyLoads.delete(key);
				resolve('generic-drifter');
			};

			this.load.on(Phaser.Loader.Events.FILE_COMPLETE, onComplete);
			this.load.on(Phaser.Loader.Events.LOAD_ERROR, onError as any);
			this.load.image(key, `/images/drifters/tiny/${tokenId}.jpeg`);
			this.load.start();
		});

		this.pendingTinyLoads.set(key, loadPromise);
		return loadPromise;
	}

	private updateMissionRoutes(missions: Mission[]) {
		// Bump render version to invalidate any in-flight async icon loads
		this.missionRenderVersion++;
		const renderVersion = this.missionRenderVersion;

		// Clear old per-route Graphics and drifters
		this.missionRoutes.forEach((route) => { try { this.tweens.killTweensOf(route); } catch {}; route.destroy(); });
		this.missionRoutes.clear();
		this.missionDrifters.forEach((container) => { try { (container as any).removeAll?.(true); } catch {}; container.destroy(); });
		this.missionDrifters.clear();

		// Prepare layers
		if (this.routeStaticLayer) this.routeStaticLayer.clear();
		if (this.routeAnimatedLayer) this.routeAnimatedLayer.clear();
		this.animatedRoutes = [];

		const stateNow = gameState.getState();
		const playerAddr = stateNow.playerAddress?.toLowerCase() || '';
		const dashLen = 12;
		const gapLen = 8;

		for (const m of missions) {
			// Determine endpoint
			let nodeX: number | undefined, nodeY: number | undefined;
			let color: number | null = this.getMissionRenderColor(m, stateNow.playerAddress);
			if (color === null) {
				continue;
			}
			if (m.targetNodeId) {
				const targetNode = stateNow.resourceNodes?.find((r: ResourceNode) => r.id === m.targetNodeId);
				if (!targetNode) continue;
				({ x: nodeX, y: nodeY } = targetNode.coordinates);
			} else if (m.targetMonsterId) {
				const mid = m.targetMonsterId as string;
				let monster = (stateNow.monsters || []).find((mm: any) => mm.id === mid);
				if (!monster && m.engagementApplied && m.battleLocation) {
					monster = { coordinates: m.battleLocation } as any;
				}
				if (!monster) continue;
				nodeX = monster.coordinates.x; nodeY = monster.coordinates.y;
				// Monster missions purple while active
				if (m.status === 'active') color = 0x9c27b0;
			} else {
				continue;
			}
			if (typeof nodeX !== 'number' || typeof nodeY !== 'number') continue;

			const x1 = TOWN_X, y1 = TOWN_Y, x2 = nodeX, y2 = nodeY;
			const isSelfActive = m.status === 'active' && (m.playerAddress || '').toLowerCase() === playerAddr;

			if (isSelfActive) {
				const startTs = m.startTime instanceof Date ? m.startTime.getTime() : new Date(m.startTime).getTime();
				const endTs = m.completionTime instanceof Date ? m.completionTime.getTime() : new Date(m.completionTime).getTime();
				this.animatedRoutes.push({ x1, y1, x2, y2, color: color!, phase: 0, dash: dashLen, gap: gapLen, startTs, endTs });
			} else {
				// Draw once onto static layer
				if (this.routeStaticLayer) {
					this.drawDashedLine(this.routeStaticLayer, x1, y1, x2, y2, color!, 0, dashLen, gapLen);
				}
			}
		}

		// Create drifters only for the current user's ACTIVE missions
		const selfActive = missions.filter((m) => m.status === 'active' && (m.playerAddress || '').toLowerCase() === playerAddr);
		selfActive.forEach((mission) => {
			this.createMissionDrifter(mission, renderVersion);
		});
	}

	private createMissionRoute(mission: Mission, color: number) {
		const currentState = gameState.getState();
		let nodeX: number | undefined, nodeY: number | undefined;

		if (mission.targetNodeId) {
			const targetNode = currentState.resourceNodes?.find((r: ResourceNode) => r.id === mission.targetNodeId);
			if (!targetNode) {
				console.warn(`[GameScene] ⚠️ Skipping route creation - target node ${mission.targetNodeId} not found for mission ${mission.id}`);
				return;
			}
			({ x: nodeX, y: nodeY } = targetNode.coordinates);
		} else if (mission.targetMonsterId) {
			const mid = mission.targetMonsterId as string;
			const monster = (currentState.monsters || []).find((m: any) => m.id === mid);
			if (!monster) {
				// Monster may have been killed/removed after engagement; fallback to battleLocation if available
				if (mission.engagementApplied && mission.battleLocation) {
					nodeX = mission.battleLocation.x;
					nodeY = mission.battleLocation.y;
				} else {
					console.warn(`[GameScene] ⚠️ Skipping route creation - monster ${mid} not found for mission ${mission.id}`);
					return;
				}
			} else {
				nodeX = monster.coordinates.x;
				nodeY = monster.coordinates.y;
			}
			// Override color for monster missions to a distinct purple
			color = 0x9c27b0;
		} else {
			return;
		}

		const routeGraphics = this.add.graphics();
		routeGraphics.setDepth(DEPTH_ROUTES);

		// Store route data for animation
		routeGraphics.setData('x1', TOWN_X);
		routeGraphics.setData('y1', TOWN_Y);
		routeGraphics.setData('x2', nodeX);
		routeGraphics.setData('y2', nodeY);
		routeGraphics.setData('phase', 0);
		routeGraphics.setData('color', color);
		routeGraphics.setData('animated', color !== COLOR_COMPLETED);

		// Initial draw
		this.drawDashedLine(routeGraphics, TOWN_X, TOWN_Y, nodeX!, nodeY!, color, 0);

		this.missionRoutes.set(mission.id, routeGraphics);
	}

	private async createMissionDrifter(mission: Mission, renderVersion: number) {
		const currentState = gameState.getState();
		let targetNode: ResourceNode | undefined;
		let targetMonster: any | undefined;
		if (mission.targetNodeId) {
			targetNode = currentState.resourceNodes?.find((r: ResourceNode) => r.id === mission.targetNodeId);
			if (!targetNode) {
				console.warn(`[GameScene] ⚠️ Skipping drifter creation - target node ${mission.targetNodeId} not found for mission ${mission.id}`);
				console.warn(`[GameScene]   - Available resource node IDs:`, currentState.resourceNodes?.map((n) => n.id) || []);
				return;
			}
		} else if (mission.targetMonsterId) {
			const mid = mission.targetMonsterId as string;
			targetMonster = (currentState.monsters || []).find((m: any) => m.id === mid);
			if (!targetMonster) {
				// Monster may have been killed/removed after engagement; fallback to battleLocation if available
				if (mission.engagementApplied && mission.battleLocation) {
					targetMonster = { coordinates: mission.battleLocation } as any;
				} else {
					console.warn(`[GameScene] ⚠️ Skipping drifter creation - monster ${mid} not found for mission ${mission.id}`);
					return;
				}
			}
		} else {
			return;
		}

		// Create container at (0,0) but hide it initially to prevent showing green circle at wrong position
		const drifterContainer = this.add.container(0, 0);
		drifterContainer.setDepth(DEPTH_DRIFTERS);
		drifterContainer.setVisible(false); // Hide until properly positioned

		// Make container interactive for hover tooltips
		// A larger circle for easier hovering
		drifterContainer.setInteractive(new Phaser.Geom.Circle(0, 0, 20), Phaser.Geom.Circle.Contains);
		drifterContainer.on('pointerover', (pointer: Phaser.Input.Pointer) => {
			this.hudShowMissionTooltip(pointer, mission);
		});
		drifterContainer.on('pointermove', (pointer: Phaser.Input.Pointer) => {
			this.hudUpdateMissionTooltip(pointer);
		});
		drifterContainer.on('pointerout', () => {
			this.hudHideMissionTooltip();
		});

		// If a newer render started while we were setting up, abort
		if (renderVersion !== this.missionRenderVersion) {
			drifterContainer.destroy();
			return;
		}

		// Mission indicator ring (color reflects status: amber active, green when time reached)
		const missionIndicator = this.add.graphics();
		// Determine initial color
		const playerAddr = gameState.getState().playerAddress;
		const initialColor = this.getMissionRenderColor(mission, playerAddr) ?? COLOR_SELF_ACTIVE;
		missionIndicator.lineStyle(2, initialColor);
		missionIndicator.strokeCircle(0, 0, 14);
		// Stash reference for live updates
		drifterContainer.setData('indicatorRing', missionIndicator);

		// Add tiny images for each drifter
		const iconSize = 16;
		const icons: Phaser.GameObjects.Image[] = [];
		for (const drifterId of mission.drifterIds) {
			if (renderVersion !== this.missionRenderVersion) {
				// Abort if superseded
				try {
					(drifterContainer as any).removeAll?.(true);
				} catch {}
				drifterContainer.destroy();
				return;
			}
			const key = await this.ensureDrifterTinyTexture(drifterId);
			const img = this.add.image(0, 0, key).setDisplaySize(iconSize, iconSize).setOrigin(0.5);
			icons.push(img);
			drifterContainer.add(img);
		}

		// Layout icons in a cluster
		this.layoutDrifterIcons(drifterContainer, icons, iconSize);

		// Add ring on top
		drifterContainer.add(missionIndicator);

		// If superseded while loading, clean up and abort
		if (renderVersion !== this.missionRenderVersion) {
			try {
				(drifterContainer as any).removeAll?.(true);
			} catch {}
			drifterContainer.destroy();
			return;
		}

		// Calculate and set initial position based on mission progress
		this.updateDrifterPosition(drifterContainer, mission, targetNode, targetMonster);

		this.missionDrifters.set(mission.id, drifterContainer);
	}

	private layoutDrifterIcons(container: Phaser.GameObjects.Container, icons: Phaser.GameObjects.Image[], _iconSize: number) {
		const n = icons.length;
		if (n === 0) {
			return;
		}

		if (n === 1) {
			icons[0].setPosition(0, 0);
			return;
		}

		if (n <= 4) {
			const offsets = [
				{ x: 0, y: -8 },
				{ x: 0, y: 8 },
				{ x: -8, y: 0 },
				{ x: 8, y: 0 },
			];
			for (let i = 0; i < n; i++) {
				icons[i].setPosition(offsets[i].x, offsets[i].y);
			}
			return;
		}

		// 5 or more: circle layout
		const radius = 10;
		for (let i = 0; i < n; i++) {
			const angle = (i / n) * Math.PI * 2;
			const x = Math.cos(angle) * radius;
			const y = Math.sin(angle) * radius;
			icons[i].setPosition(x, y);
		}
	}

	private updateDrifterPosition(
		drifterContainer: Phaser.GameObjects.Container,
		mission: Mission,
		targetNode?: ResourceNode,
		targetMonster?: any,
	) {
		try {
			const now = new Date();
			const startTime = mission.startTime instanceof Date ? mission.startTime : new Date(mission.startTime);
			const endTime = mission.completionTime instanceof Date ? mission.completionTime : new Date(mission.completionTime);

			// Validate dates
			if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
				console.warn('Invalid mission dates, hiding drifter container');
				drifterContainer.setVisible(false);
				return;
			}

			const totalDuration = endTime.getTime() - startTime.getTime();
			const elapsed = now.getTime() - startTime.getTime();

			// Prevent division by zero
			if (totalDuration <= 0) {
				console.warn('Invalid mission duration, hiding drifter container');
				drifterContainer.setVisible(false);
				return;
			}

			const progress = Math.max(0, Math.min(1, elapsed / totalDuration));

			let nodeX: number | undefined, nodeY: number | undefined;
			if (targetNode) {
				({ x: nodeX, y: nodeY } = targetNode.coordinates);
			} else if (targetMonster) {
				nodeX = targetMonster.coordinates.x;
				nodeY = targetMonster.coordinates.y;
			} else {
				console.warn('No target provided, hiding drifter container');
				drifterContainer.setVisible(false);
				return;
			}

			// Validate coordinates
			if (typeof nodeX !== 'number' || typeof nodeY !== 'number' || isNaN(nodeX) || isNaN(nodeY)) {
				console.warn('Invalid target node coordinates, hiding drifter container');
				drifterContainer.setVisible(false);
				return;
			}

			let currentX: number, currentY: number;

			if (progress <= 0.5) {
				// First half: traveling to resource node
				const outboundProgress = progress * 2; // 0 to 1
				currentX = TOWN_X + (nodeX - TOWN_X) * outboundProgress;
				currentY = TOWN_Y + (nodeY - TOWN_Y) * outboundProgress;
			} else {
				// Second half: traveling back to town
				const returnProgress = (progress - 0.5) * 2; // 0 to 1
				currentX = nodeX + (TOWN_X - nodeX) * returnProgress;
				currentY = nodeY + (TOWN_Y - nodeY) * returnProgress;
			}

			// Validate calculated position
			if (isNaN(currentX) || isNaN(currentY)) {
				console.warn('Invalid calculated position, hiding drifter container');
				drifterContainer.setVisible(false);
				return;
			}

			// Add subtle floating motion
			const bobOffset = Math.sin(this.time.now * 0.003) * 2;
			const finalX = currentX;
			const finalY = currentY + bobOffset;

			// Validate final position before setting
			if (isNaN(finalX) || isNaN(finalY)) {
				console.warn('Invalid final position, destroying drifter container');
				// Find and remove this container from our tracking
				for (const [missionId, container] of this.missionDrifters.entries()) {
					if (container === drifterContainer) {
						console.warn(`[GameScene] 🗑️ Destroying invalid drifter container for mission ${missionId}`);
						this.missionDrifters.delete(missionId);
						break;
					}
				}
				drifterContainer.destroy();
				return;
			}

			// Log when we move container from (0,0) to its proper position

			// Make sure container is visible and set position
			drifterContainer.setVisible(true);
			drifterContainer.setPosition(finalX, finalY);
		} catch (error) {
			console.error('Error updating drifter position, hiding container:', error);
			drifterContainer.setVisible(false);
		}
	}

	private getResourceColor(type: string): number {
		switch (type) {
			case 'ore':
				return 0xff4500;
			case 'scrap':
				return 0x708090;
			case 'organic':
				return 0x8fbc8f;
			default:
				return 0xffffff;
		}
	}

	private getRarityColor(rarity: string): number {
		switch (rarity) {
			case 'common':
				return 0xffffff;
			case 'uncommon':
				return 0x00ff00;
			case 'rare':
				return 0x0080ff;
			case 'epic':
				return 0x8000ff;
			case 'legendary':
				return 0xffd700;
			default:
				return 0xffffff;
		}
	}

	update(time: number, delta: number) {
		const cam = this.cameras.main;

		// Space to close mission panel and deselect
		if (Phaser.Input.Keyboard.JustDown(this.cursorKeys.space!)) {
			const currentState = gameState.getState();
			if (currentState.showMissionPanel) {
				gameState.hideMissionPanel();
				this.deselectCurrentNode();
			}
		}

		// Keyboard panning (arrows or WASD); hold Shift to accelerate
		const dt = delta / 1000;
		const accel = this.cursorKeys.shift?.isDown ? 1200 : 600;
		let vx = 0;
		let vy = 0;
		if (this.cursorKeys.left?.isDown) {
			vx -= 1;
		}
		if (this.cursorKeys.right?.isDown) {
			vx += 1;
		}
		if (this.cursorKeys.up?.isDown) {
			vy -= 1;
		}
		if (this.cursorKeys.down?.isDown) {
			vy += 1;
		}
		if (vx !== 0 || vy !== 0) {
			const len = Math.hypot(vx, vy) || 1;
			vx /= len;
			vy /= len;
			cam.scrollX += vx * accel * dt;
			cam.scrollY += vy * accel * dt;
		}

		// Update mission drifter positions
		if (gameState.getState().playerMissions?.length > 0) {
			const activeMissions = gameState.getState().playerMissions.filter((m) => m.status === 'active');
			activeMissions.forEach((mission) => {
				const drifterContainer = this.missionDrifters.get(mission.id);
				if (!drifterContainer) {
					return;
				}
				const currentState = gameState.getState();
				const targetNode = mission.targetNodeId
					? currentState.resourceNodes?.find((r: ResourceNode) => r.id === mission.targetNodeId)
					: undefined;
				const mid = mission.targetMonsterId as string | undefined;
				const monster = mid ? (currentState.monsters || []).find((mm: any) => mm.id === mid) : undefined;
				const monsterFallback =
					!monster && mission.engagementApplied && mission.battleLocation ? ({ coordinates: mission.battleLocation } as any) : undefined;
				const monsterLike = monster || monsterFallback;
				if (targetNode || monsterLike) {
					this.updateDrifterPosition(drifterContainer, mission, targetNode as any, monsterLike as any);
					// Update ring color live based on time
					const ring = drifterContainer.getData('indicatorRing') as Phaser.GameObjects.Graphics | undefined;
					if (ring) {
						const playerAddr = gameState.getState().playerAddress;
						let color = this.getMissionRenderColor(mission, playerAddr) ?? COLOR_SELF_ACTIVE;
						// Ensure monster missions stay purple while active, even when using fallback
						if (mission.targetMonsterId) {
							color = 0x9c27b0;
						}
						ring.clear();
						ring.lineStyle(2, color);
						ring.strokeCircle(0, 0, 14);
					}
				}
			});
		}

		// Periodic cleanup check for orphaned containers (every 5 seconds)
		if (Math.floor(this.time.now / 5000) !== this.lastCleanupCheck) {
			this.lastCleanupCheck = Math.floor(this.time.now / 5000);
			this.checkForOrphanedContainers();
		}

		// Animate mission routes (only self-active) on a single layer
		if (this.routeAnimatedLayer) {
			const cycle = 12 + 8;
			const speed = 12; // px/s
			const nowMs = Date.now();
			this.routeAnimatedLayer.clear();
			for (const r of this.animatedRoutes) {
				// Determine direction based on mission progress
				let dir = 1;
				if (Number.isFinite(r.startTs) && Number.isFinite(r.endTs) && r.endTs > r.startTs) {
					const prog = Math.max(0, Math.min(1, (nowMs - r.startTs) / (r.endTs - r.startTs)));
					dir = prog <= 0.5 ? 1 : -1;
				}
				r.phase += dir * speed * dt;
				if (r.phase >= cycle) r.phase -= cycle;
				if (r.phase < 0) r.phase += cycle;
				this.drawDashedLine(this.routeAnimatedLayer, r.x1, r.y1, r.x2, r.y2, r.color, r.phase, r.dash, r.gap);
			}
		}

		// Sync tiled background with camera scroll/zoom
		if (this.bgTile) {
			this.bgTile.tilePositionX = cam.scrollX * cam.zoom;
			this.bgTile.tilePositionY = cam.scrollY * cam.zoom;
			this.bgTile.setTileScale(cam.zoom);
		}

		// Redraw batched mission indicators each frame for pulse effect
		this.drawMissionIndicators();
	}

	private cleanupAllDisplayObjects() {
		// Resource nodes and labels/glows
		try { this.resourceNodes.forEach((s) => { try { this.tweens.killTweensOf(s); } catch {}; s.destroy(); }); } catch {}
		try { this.nodeLabels.forEach((t) => t.destroy()); } catch {}
		try { this.nodeGlows.forEach((g) => { try { this.tweens.killTweensOf(g); } catch {}; g.destroy(); }); } catch {}
		this.resourceNodes.clear();
		this.nodeLabels.clear();
		this.nodeGlows.clear();
		// Mission indicators and glows
		try { this.missionIndicators.forEach((g) => { try { this.tweens.killTweensOf(g); } catch {}; g.destroy(); }); } catch {}
		try { this.missionIndicatorGlows.forEach((g) => { try { this.tweens.killTweensOf(g); } catch {}; g.destroy(); }); } catch {}
		this.missionIndicators.clear();
		this.missionIndicatorGlows.clear();
		// Routes
		try {
			this.missionRoutes.forEach((r) => {
				try {
					const tw = r.getData('pulseTween') as Phaser.Tweens.Tween | null;
					if (tw) tw.stop();
					this.tweens.killTweensOf(r);
				} catch {}
				r.destroy();
			});
		} catch {}
		this.missionRoutes.clear();
		// Drifter containers
		try { this.missionDrifters.forEach((c) => { try { this.tweens.killTweensOf(c); } catch {}; (c as any).removeAll?.(true); c.destroy(); }); } catch {}
		this.missionDrifters.clear();
		// Battle markers
		try { this.battleMarkers.forEach((g) => { try { const tw = g.getData('pulseTween') as Phaser.Tweens.Tween | null; if (tw) tw.stop(); this.tweens.killTweensOf(g); } catch {}; g.destroy(); }); } catch {}
		this.battleMarkers.clear();
		// Monsters
		try { this.monsterIcons.forEach((c) => { try { this.tweens.killTweensOf(c); } catch {}; c.destroy(true); }); } catch {}
		this.monsterIcons.clear();
		// Planning overlay
		try { this.planningRoute?.destroy(); this.planningRoute = null; } catch {}
		try { this.planningCircle?.destroy(); this.planningCircle = null; } catch {}
		// Background tile
		try { this.tweens.killTweensOf(this.bgTile as any); } catch {}
		try { this.bgTile?.destroy(); this.bgTile = null; } catch {}
		// Batched indicators layer
		try { this.missionIndicatorLayer?.destroy(); this.missionIndicatorLayer = null; } catch {}
		this.missionIndicatorItems = [];
		// Batched routes layers
		try { this.routeStaticLayer?.destroy(); this.routeStaticLayer = null; } catch {}
		try { this.routeAnimatedLayer?.destroy(); this.routeAnimatedLayer = null; } catch {}
		this.animatedRoutes = [];
	}

	private drawDashedLine(
		route: Phaser.GameObjects.Graphics,
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		color: number,
		phase: number,
		dash: number = 12,
		gap: number = 8,
	) {
		route.lineStyle(2, color, 0.9);
		const dx = x2 - x1;
		const dy = y2 - y1;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist <= 0) {
			return;
		}
		const ux = dx / dist;
		const uy = dy / dist;
		let traveled = phase % (dash + gap);
		let sx = x1 + ux * traveled;
		let sy = y1 + uy * traveled;
		while (traveled < dist) {
			const seg = Math.min(dash, dist - traveled);
			const ex = sx + ux * seg;
			const ey = sy + uy * seg;
			route.lineBetween(sx, sy, ex, ey);
			traveled += dash + gap;
			sx = x1 + ux * traveled;
			sy = y1 + uy * traveled;
		}
	}

	private lastCleanupCheck = 0;

	private checkForOrphanedContainers() {
		// Build unified set of the player's current mission IDs (playerMissions + global filtered by player)
		const state = gameState.getState();
		const self = state.playerAddress?.toLowerCase() || '';
		const fromPlayer = state.playerMissions || [];
		const fromGlobal = (state.activeMissions || []).filter((m) => m.playerAddress?.toLowerCase() === self);
		const idSet = new Set<string>();
		for (const m of fromPlayer) {
			idSet.add(m.id);
		}
		for (const m of fromGlobal) {
			idSet.add(m.id);
		}

		// Check for containers whose missions no longer exist
		this.missionDrifters.forEach((container, missionId) => {
			if (!idSet.has(missionId)) {
				console.warn(
					`[GameScene] 🧟 Mission ${missionId.slice(-6)} no longer exists (not in player/global sets), destroying its container at (${container.x}, ${container.y})`,
				);
				this.missionDrifters.delete(missionId);
				container.destroy();
				return;
			}

			// Also look for any containers that are at (0,0) and visible - these are likely orphaned
			if (container.x === 0 && container.y === 0 && container.visible) {
				console.warn(`[GameScene] 👻 Found orphaned drifter container at (0,0) for mission ${missionId.slice(-6)}, destroying it`);
				this.missionDrifters.delete(missionId);
				container.destroy();
			}
		});
	}

	// Render an orange dotted line from town to the selected node and an orange circle around it while planning
	private updatePlanningOverlay(state: GameState) {
		try {
			const selectedId = state.selectedResourceNode;
			const selectedMonsterId = state.selectedTargetMonsterId;
			const isPlanningNode = !!selectedId && state.showMissionPanel;
			const isPlanningMonster = !!selectedMonsterId && state.showMissionPanel;
			if (!isPlanningNode && !isPlanningMonster) {
				this.clearPlanningOverlay();
				return;
			}

			let nodeX: number | undefined, nodeY: number | undefined;
			if (isPlanningNode) {
				const targetNode = state.resourceNodes?.find((r) => r.id === selectedId);
				if (!targetNode) {
					this.clearPlanningOverlay();
					return;
				}
				({ x: nodeX, y: nodeY } = targetNode.coordinates);
			} else if (isPlanningMonster) {
				const monster = (state.monsters || []).find((m) => m.id === selectedMonsterId);
				if (!monster) {
					this.clearPlanningOverlay();
					return;
				}
				nodeX = monster.coordinates.x;
				nodeY = monster.coordinates.y;
			}

			const nodeXFinal = nodeX!;
			const nodeYFinal = nodeY!;

			// Create graphics objects if needed
			if (!this.planningRoute) {
				this.planningRoute = this.add.graphics();
				this.planningRoute.setDepth(950);
			}
			if (!this.planningCircle) {
				this.planningCircle = this.add.graphics();
				this.planningCircle.setDepth(951);
			}

			// Clear previous drawings
			this.planningRoute.clear();
			this.planningCircle.clear();

			// Draw dotted orange route from town to node
			const color = 0xffa500; // orange
			const alpha = 1.0;
			const dash = 10;
			const gap = 6;
			const dx = nodeXFinal - TOWN_X;
			const dy = nodeYFinal - TOWN_Y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			const steps = Math.max(1, Math.floor(dist / (dash + gap)));
			const ux = dx / dist;
			const uy = dy / dist;
			this.planningRoute.lineStyle(2, color, alpha);
			let sx = TOWN_X;
			let sy = TOWN_Y;
			for (let i = 0; i < steps; i++) {
				const ex = sx + ux * dash;
				const ey = sy + uy * dash;
				this.planningRoute.lineBetween(sx, sy, ex, ey);
				sx = ex + ux * gap;
				sy = ey + uy * gap;
			}

			// Orange highlight circle around the target node
			this.planningCircle.lineStyle(3, color, 1);
			this.planningCircle.strokeCircle(nodeXFinal, nodeYFinal, 28);
		} catch (e) {
			console.error('Failed updating planning overlay', e);
		}
	}

	private clearPlanningOverlay() {
		if (this.planningRoute) {
			this.planningRoute.destroy();
			this.planningRoute = null;
		}
		if (this.planningCircle) {
			this.planningCircle.destroy();
			this.planningCircle = null;
		}
	}

	private getMissionRenderColor(mission: Mission, playerAddress?: string | null): number | null {
		// Hide missions that are fully completed/claimed on the server
		if (mission.status === 'completed') {
			return null;
		}
		const isSelf = this.isSelfMission(mission, playerAddress);
		const isMonster = !!mission.targetMonsterId;
		if (mission.status === 'active') {
			// If this is the player's mission and it's reached its end time, show as green (ready to claim)
			const endTs = mission.completionTime instanceof Date ? mission.completionTime.getTime() : new Date(mission.completionTime).getTime();
			if (isSelf && !isNaN(endTs) && Date.now() >= endTs) {
				return COLOR_COMPLETED; // ready to claim, awaiting collection
			}
			// Otherwise, show active colors
			if (isMonster) {
				return 0x9c27b0; // purple for monster missions
			}
			return isSelf ? COLOR_SELF_ACTIVE : COLOR_OTHER_ACTIVE;
		}
		return null;
	}

	private cleanupExpiredCompletedArtifacts() {
		const now = Date.now();
		// Remove expired entries from cache
		for (const [id, expiresAt] of this.recentCompletedMissions) {
			if (expiresAt <= now) {
				this.recentCompletedMissions.delete(id);
			}
		}
		// Remove any indicator/route still present for fully expired completed missions
		const stateNow = gameState.getState();
		const missions = stateNow.activeMissions || [];
		// With batched indicators, nothing to destroy per-mission here; keep old cleanup for safety
		for (const [id, indicator] of this.missionIndicators) {
			const m = missions.find((mm) => mm.id === id);
			if (!m) {
				try { this.tweens.killTweensOf(indicator); } catch {}
				indicator.destroy();
				this.missionIndicators.delete(id);
				continue;
			}
			if (m.status === 'completed') {
				const expiresAt = this.recentCompletedMissions.get(id) ?? 0;
				const completionTs = m.completionTime instanceof Date ? m.completionTime.getTime() : new Date(m.completionTime).getTime();
				const shouldExpire = now > (expiresAt || completionTs + RECENT_COMPLETED_MS);
				if (shouldExpire) {
					try { this.tweens.killTweensOf(indicator); } catch {}
					indicator.destroy();
					this.missionIndicators.delete(id);
				}
			}
		}
		for (const [id, route] of this.missionRoutes) {
			const m = missions.find((mm) => mm.id === id);
			if (!m) {
				try {
					const tw = route.getData('pulseTween') as Phaser.Tweens.Tween | null;
					if (tw) tw.stop();
					this.tweens.killTweensOf(route);
				} catch {}
				route.destroy();
				this.missionRoutes.delete(id);
				continue;
			}
			if (m.status === 'completed') {
				const expiresAt = this.recentCompletedMissions.get(id) ?? 0;
				const completionTs = m.completionTime instanceof Date ? m.completionTime.getTime() : new Date(m.completionTime).getTime();
				const shouldExpire = now > (expiresAt || completionTs + RECENT_COMPLETED_MS);
				if (shouldExpire) {
					try {
						const tw = route.getData('pulseTween') as Phaser.Tweens.Tween | null;
						if (tw) tw.stop();
						this.tweens.killTweensOf(route);
					} catch {}
					route.destroy();
					this.missionRoutes.delete(id);
				}
			}
		}
	}

	private updateBattleMarkers(missions: Mission[]) {
		try {
			const stateNow = gameState.getState();
			const playerAddr = stateNow.playerAddress?.toLowerCase() || '';
			// Determine which missions should have a battle marker (self, engaged monster missions still active)
			const shouldHave = new Set(
				missions
					.filter((m) => m.status === 'active' && !!m.targetMonsterId && !!m.engagementApplied && !!m.battleLocation)
					.filter((m) => (m.playerAddress || '').toLowerCase() === playerAddr)
					.map((m) => m.id),
			);

			// Remove markers that should no longer exist
			for (const [id, g] of this.battleMarkers) {
				const still = shouldHave.has(id);
				if (!still) {
					try {
						const tw = g.getData('pulseTween') as Phaser.Tweens.Tween | null;
						if (tw) {
							tw.stop();
						}
						this.tweens.killTweensOf(g);
						g.destroy();
					} catch {}
					this.battleMarkers.delete(id);
				}
			}

			// Create or update markers
			for (const m of missions) {
				if (!shouldHave.has(m.id)) {
					continue;
				}
				const loc = m.battleLocation!;
				let g = this.battleMarkers.get(m.id);
				if (!g) {
					g = this.add.graphics();
					g.setDepth(DEPTH_ROUTES + 10);
					this.battleMarkers.set(m.id, g);
				}
				g.clear();
				g.lineStyle(3, 0xff4444, 1);
				// Draw X centered at battle location
				const size = 10;
				g.lineBetween(loc.x - size, loc.y - size, loc.x + size, loc.y + size);
				g.lineBetween(loc.x - size, loc.y + size, loc.x + size, loc.y - size);

				// Add or maintain pulse tween
				let pulseTween = g.getData('pulseTween') as Phaser.Tweens.Tween | null;
				if (!pulseTween) {
					pulseTween = this.tweens.add({
						targets: g,
						alpha: { from: 1, to: 0.35 },
						duration: 800,
						yoyo: true,
						repeat: -1,
					});
					g.setData('pulseTween', pulseTween);
				}
			}
		} catch (e) {
			console.error('[GameScene] Failed to update battle markers', e);
		}
	}

	private updateMonsters(monsters: any[]) {
		// Remove stale monsters
		const currentIds = new Set(monsters.map((m) => m.id));
		for (const [id, cnt] of this.monsterIcons) {
				if (!currentIds.has(id)) {
					try { this.tweens.killTweensOf(cnt); } catch {}
					cnt.destroy(true);
					this.monsterIcons.delete(id);
				}
		}

		// Create/update
		for (const m of monsters) {
			let container = this.monsterIcons.get(m.id);
			if (!container) {
				container = this.add.container(m.coordinates.x, m.coordinates.y);
				container.setDepth(DEPTH_MONSTERS);
				// Monster sprite image
				const texKey = getMonsterTextureKey(m.kind as string);
				const sprite = this.add.image(0, 0, texKey).setOrigin(0.5);
				// Reasonable default scale; tweak as art warrants
				sprite.setScale(0.3);
				// Make monster clickable to open combat planning targeting this monster
				sprite.setInteractive({ cursor: 'pointer' });
				sprite.on('pointerdown', () => {
					try {
						gameState.setMissionType('combat');
						gameState.setSelectedTargetMonster(m.id);
						if (!gameState.getState().showMissionPanel) {
							gameState.toggleMissionPanel();
						}
					} catch (e) {
						console.warn('[GameScene] Failed to open combat planning from monster click', e);
					}
				});
				const label = this.add
					.text(0, 48, `${m.kind}\nHP ${m.hp}/${m.maxHp}`, {
						fontSize: '11px',
						color: '#ffdddd',
						fontFamily: 'Courier New',
						align: 'center',
						backgroundColor: 'rgba(0,0,0,0.6)',
						padding: { x: 4, y: 2 },
					})
					.setOrigin(0.5);
				container.add(sprite);
				container.add(label);
				this.monsterIcons.set(m.id, container);
			} else {
				container.setPosition(m.coordinates.x, m.coordinates.y);
				// Update label text
				const lbl = container.list.find((go) => (go as any).style) as Phaser.GameObjects.Text | undefined;
				if (lbl) {
					lbl.setText(`${m.kind}\nHP ${m.hp}/${m.maxHp}`);
				}
			}
		}
	}
}
