import Phaser from 'phaser';
import type { ResourceNode, Mission } from '@shared/models';
import { gameState, GameState } from '../gameState';
import { getResourceTextureKey } from '../utils/resourceTextures';
import { getVehicleData } from '../utils/vehicleUtils';

// Town coordinates - center of the map area
const TOWN_X = 500;
const TOWN_Y = 350;

// Resource node display constants
const RESOURCE_NODE_BASE_SCALE = 0.15; // Base scale for resource nodes (adjust to resize all nodes)
const RESOURCE_NODE_RARITY_SCALE_MULTIPLIER = 1.2; // How much bigger rare/epic/legendary nodes are
const RESOURCE_NODE_LABEL_OFFSET = 30; // Distance above the node to place the label

export class GameScene extends Phaser.Scene {
	private resourceNodes = new Map<string, Phaser.GameObjects.Image>();
	private worldData: any = null;
	private selectedNode: string | null = null;
	private nodeLabels = new Map<string, Phaser.GameObjects.Text>();
	private nodeGlows = new Map<string, Phaser.GameObjects.Arc>(); // Track glow circles
	private missionIndicators = new Map<string, Phaser.GameObjects.Graphics>();
	private missionRoutes = new Map<string, Phaser.GameObjects.Graphics>();
	private missionDrifters = new Map<string, Phaser.GameObjects.Container>();
	private pendingTinyLoads = new Map<string, Promise<string>>();
	private townMarker: Phaser.GameObjects.Container | null = null;
	private missionRenderVersion = 0;
	private missionTooltip: Phaser.GameObjects.Container | null = null;

	constructor() {
		super({ key: 'GameScene' });
	}

	create() {
		// Add the world map background image
		const bg = this.add
			.image(0, 0, 'world-map')
			.setOrigin(0, 0)
			.setDisplaySize(this.cameras.main.width, this.cameras.main.height)
			.setDepth(-10); // ensure it stays behind everything

		// Add invisible background rectangle for click detection
		const background = this.add.rectangle(0, 0, this.cameras.main.width, this.cameras.main.height, 0x000000, 0);
		background.setOrigin(0, 0);
		background.setInteractive();

		// Handle background clicks
		background.on('pointerdown', () => {
			this.handleBackgroundClick();
		});

		// Add title
		this.add
			.text(this.cameras.main.centerX, 50, 'THE SCABLANDS', {
				fontSize: '36px',
				color: '#FFD700',
				fontFamily: 'Courier New',
				fontStyle: 'bold',
			})
			.setOrigin(0.5);

		this.add
			.text(this.cameras.main.centerX, 90, 'A harsh world of opportunity and danger', {
				fontSize: '16px',
				color: '#DAA520',
				fontFamily: 'Courier New',
				fontStyle: 'italic',
			})
			.setOrigin(0.5);

		// Listen for game state changes
		gameState.onStateChange((state: GameState) => {
			this.updateWorldDisplay(state);
		});

		// Create town marker
		this.createTownMarker();
		this.createMissionTooltip();

		// Resource nodes will be loaded from server via gameState

		console.log('Game Scene initialized');
	}

	private createMissionTooltip() {
		this.missionTooltip = this.add.container(0, 0);
		this.missionTooltip.setDepth(1000); // High depth to be on top of everything
		this.missionTooltip.setVisible(false);

		const tooltipBg = this.add.graphics();
		const tooltipText = this.add.text(10, 10, '', {
			fontSize: '12px',
			fontFamily: 'Courier New',
			color: '#ffffff',
			wordWrap: { width: 230 },
		});

		this.missionTooltip.add([tooltipBg, tooltipText]);
	}

	private showMissionTooltip(pointer: Phaser.Input.Pointer, mission: Mission) {
		if (!this.missionTooltip) return;

		const textObject = this.missionTooltip.getAt(1) as Phaser.GameObjects.Text;
		const bgObject = this.missionTooltip.getAt(0) as Phaser.GameObjects.Graphics;
		const currentState = gameState.getState();

		const timeRemaining = this.formatTimeRemaining(mission.completionTime);

		const drifterProfiles = currentState.ownedDrifters.filter((d) => mission.drifterIds.includes(d.tokenId));
		let drifterNames = drifterProfiles.map((d) => d.name).join(', ');
		if (drifterProfiles.length === 0) {
			drifterNames = mission.drifterIds.map((id) => `#${id}`).join(', ');
		} else if (drifterProfiles.length > 3) {
			drifterNames =
				drifterProfiles
					.slice(0, 3)
					.map((d) => d.name)
					.join(', ') + `, +${drifterProfiles.length - 3} more`;
		}

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

		const content =
			`Mission: ${mission.type.toUpperCase()}
` +
			`Target: ${targetName}
` +
			`Vehicle: ${vehicleName}
` +
			`Time Left: ${timeRemaining}
` +
			`Drifters: ${drifterNames}`;

		textObject.setText(content);

		// Resize background based on text content
		const textBounds = textObject.getBounds();
		const padding = 10;
		const newWidth = textBounds.width + padding * 2;
		const newHeight = textBounds.height + padding * 2;

		bgObject.clear();
		bgObject.fillStyle(0x111111, 0.9);
		bgObject.fillRoundedRect(0, 0, newWidth, newHeight, 5);
		bgObject.lineStyle(1, 0xaaaaaa, 1);
		bgObject.strokeRoundedRect(0, 0, newWidth, newHeight, 5);

		// Position tooltip near cursor, ensuring it stays within screen bounds
		let x = pointer.x + 20;
		let y = pointer.y + 20;

		if (x + newWidth > this.cameras.main.width) {
			x = pointer.x - newWidth - 20;
		}
		if (y + newHeight > this.cameras.main.height) {
			y = pointer.y - newHeight - 20;
		}

		this.missionTooltip.setPosition(x, y);
		this.missionTooltip.setVisible(true);
	}

	private hideMissionTooltip() {
		if (this.missionTooltip) {
			this.missionTooltip.setVisible(false);
		}
	}

	private formatTimeRemaining(completionTime: Date | string): string {
		const endDate = completionTime instanceof Date ? completionTime : new Date(completionTime);
		const remainingMs = endDate.getTime() - new Date().getTime();

		if (remainingMs <= 0) return 'Mission Complete';

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

	private updateWorldDisplay(state: GameState) {
		if (state.resourceNodes && state.resourceNodes.length > 0) {
			this.updateResourceNodes(state.resourceNodes);
			// Use playerMissions for indicators too, not global activeMissions
			this.updateMissionIndicators(state.playerMissions || []);
		}

		// Update mission routes and drifter positions
		if (state.playerMissions) {
			this.updateMissionRoutes(state.playerMissions);
		}
	}

	/**
	 * Update resource nodes incrementally - only change what's different
	 */
	private updateResourceNodes(serverNodes: ResourceNode[]) {
		const serverNodeMap = new Map(serverNodes.map((node) => [node.id, node]));

		console.log(`[GameScene] 🔄 Processing resource node updates:`);
		console.log(`[GameScene]   - Server has ${serverNodes.length} nodes`);
		console.log(`[GameScene]   - Client has ${this.resourceNodes.size} nodes`);

		// AGGRESSIVE CLEANUP: Remove any nodes that either:
		// 1. No longer exist on server, OR
		// 2. Have 0 yield (even if server still has them)
		const nodesToRemove: string[] = [];

		for (const [nodeId] of this.resourceNodes) {
			const serverNode = serverNodeMap.get(nodeId);
			if (!serverNode) {
				// Node no longer exists on server
				console.log(`[GameScene] ❌ Removing server-deleted node: ${nodeId}`);
				nodesToRemove.push(nodeId);
			} else if (serverNode.currentYield <= 0 || !serverNode.isActive) {
				// Node has 0 yield or is inactive - remove from client immediately
				console.log(`[GameScene] 💀 Removing depleted node: ${nodeId} (yield: ${serverNode.currentYield}, active: ${serverNode.isActive})`);
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
				console.log(
					`[GameScene] 🚫 Skipping depleted/inactive node: ${serverNode.id} (yield: ${serverNode.currentYield}, active: ${serverNode.isActive})`,
				);
				continue;
			}

			const existingNode = this.resourceNodes.get(serverNode.id);

			if (!existingNode) {
				// Create new node (only if it has yield and is active)
				console.log(`[GameScene] ✨ Creating new resource node: ${serverNode.id} (${serverNode.type}, ${serverNode.currentYield} yield)`);
				this.createResourceNodeFromServerData(serverNode);
			} else {
				// Update existing node if changed
				this.updateExistingResourceNode(serverNode);
			}
		}

		console.log(`[GameScene] 🏁 Resource update complete. Client now has ${this.resourceNodes.size} nodes`);

		// Final validation - log any remaining nodes with 0 yield (this shouldn't happen)
		for (const [nodeId] of this.resourceNodes) {
			const serverNode = serverNodeMap.get(nodeId);
			if (serverNode && serverNode.currentYield <= 0) {
				console.warn(`[GameScene] ⚠️ WARNING: Node ${nodeId} still displayed but has 0 yield!`);
			}
		}
	}

	/**
	 * Update an existing resource node's display
	 */
	private updateExistingResourceNode(resource: ResourceNode) {
		const nodeSprite = this.resourceNodes.get(resource.id);
		const nodeLabel = this.nodeLabels.get(resource.id);

		if (!nodeSprite || !nodeLabel) return;

		// Update label text with new yield amount
		const rarityText = resource.rarity !== 'common' ? ` (${resource.rarity.toUpperCase()})` : '';
		const newLabelText = `${resource.type.toUpperCase()}${rarityText}\n${resource.currentYield}`;

		if (nodeLabel.text !== newLabelText) {
			console.log(`[GameScene] Updating node ${resource.id} yield: ${resource.currentYield}`);
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
		console.log(`[GameScene] 🎯 Updating mission indicators for ${missions.length} missions`);

		// Clear existing indicators completely
		this.missionIndicators.forEach((indicator, missionId) => {
			console.log(`[GameScene] 🗑️ Destroying indicator for mission: ${missionId}`);
			indicator.destroy();
		});
		this.missionIndicators.clear();

		// Filter to only active missions with valid target nodes
		const activeMissions = missions.filter((mission) => mission.status === 'active' && mission.targetNodeId);

		console.log(`[GameScene] 🎯 Creating indicators for ${activeMissions.length} active missions`);

		// Add indicators for active missions
		activeMissions.forEach((mission) => {
			const node = this.resourceNodes.get(mission.targetNodeId);
			if (node) {
				console.log(`[GameScene] ➥ Creating contested indicator for node: ${mission.targetNodeId} at (${node.x}, ${node.y})`);
				const indicator = this.add.graphics();
				indicator.lineStyle(3, 0x00ff00);
				indicator.strokeCircle(node.x, node.y, 40);
				console.log(
					`[GameScene] 🟢 Drew large mission indicator circle at (${node.x}, ${node.y}) with radius 40 for mission ${mission.id.slice(-6)}`,
				);

				// Animate the indicator
				this.tweens.add({
					targets: indicator,
					alpha: { from: 1, to: 0.3 },
					duration: 1000,
					yoyo: true,
					repeat: -1,
				});

				this.missionIndicators.set(mission.id, indicator);
			} else {
				console.warn(`[GameScene] ⚠️ Cannot create indicator - node ${mission.targetNodeId} not found`);
			}
		});

		console.log(`[GameScene] 🎯 Mission indicators update complete. Active: ${this.missionIndicators.size}`);
	}

	private selectResourceNode(nodeId: string, nodeData: any) {
		console.log(`Selected resource node: ${nodeId}`, nodeData);

		const currentState = gameState.getState();
		const wasAlreadySelected = this.selectedNode === nodeId;

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
	}

	private createTownMarker() {
		const townContainer = this.add.container(TOWN_X, TOWN_Y);

		// Town building silhouette
		const townBuilding = this.add.graphics();
		townBuilding.fillStyle(0x8b4513);
		townBuilding.fillRect(-20, -15, 40, 30);
		townBuilding.lineStyle(2, 0xffd700);
		townBuilding.strokeRect(-20, -15, 40, 30);

		// Town flag
		townBuilding.fillStyle(0xdc143c);
		townBuilding.fillTriangle(-15, -15, -15, -25, -5, -20);
		townBuilding.lineStyle(1, 0x000000);
		townBuilding.lineBetween(-15, -15, -15, -25);

		// Town label
		const townLabel = this.add
			.text(0, -35, 'TOWN', {
				fontSize: '12px',
				color: '#FFD700',
				fontFamily: 'Courier New',
				fontStyle: 'bold',
				backgroundColor: 'rgba(0,0,0,0.8)',
				padding: { x: 6, y: 2 },
			})
			.setOrigin(0.5);

		townContainer.add([townBuilding, townLabel]);
		this.townMarker = townContainer;

		// Add subtle glow effect
		const glow = this.add.circle(TOWN_X, TOWN_Y, 25, 0xffd700, 0.1);
		glow.setBlendMode(Phaser.BlendModes.ADD);
	}

	private async ensureDrifterTinyTexture(tokenId: number | string): Promise<string> {
		const key = `drifter-${tokenId}-tiny`;
		if (this.textures.exists(key)) return key;
		if (this.pendingTinyLoads.has(key)) return this.pendingTinyLoads.get(key)!;

		const loadPromise = new Promise<string>((resolve) => {
			const onComplete = (loadedKey: string) => {
				if (loadedKey === key) {
					this.load.off(Phaser.Loader.Events.FILE_COMPLETE, onComplete);
					this.load.off(Phaser.Loader.Events.LOAD_ERROR, onError as any);
					resolve(key);
				}
			};
			const onError = () => {
				this.load.off(Phaser.Loader.Events.FILE_COMPLETE, onComplete);
				this.load.off(Phaser.Loader.Events.LOAD_ERROR, onError as any);
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

	private updateMissionRoutes(playerMissions: Mission[]) {
		console.log(`[GameScene] 🎬 updateMissionRoutes called with ${playerMissions.length} missions`);
		console.log(
			`[GameScene]   ALL mission statuses:`,
			playerMissions.map((m) => `${m.id.slice(-6)}:${m.status}`),
		);

		// Bump render version to invalidate any in-flight async icon loads
		this.missionRenderVersion++;
		const renderVersion = this.missionRenderVersion;

		console.log(
			`[GameScene] 🧹 Cleaning up existing routes and drifters (${this.missionRoutes.size} routes, ${this.missionDrifters.size} drifters)`,
		);

		// Clear existing routes and drifters
		this.missionRoutes.forEach((route, missionId) => {
			console.log(`[GameScene] 🗑️ Destroying route for mission ${missionId.slice(-6)}`);
			route.destroy();
		});
		this.missionDrifters.forEach((container, missionId) => {
			console.log(
				`[GameScene] 🗑️ Destroying drifter container for mission ${missionId.slice(-6)} at position (${container.x}, ${container.y})`,
			);
			// Ensure children are destroyed to prevent ghost images
			try {
				(container as any).removeAll?.(true);
			} catch {}
			container.destroy();
		});
		this.missionRoutes.clear();
		this.missionDrifters.clear();

		// Create routes and drifters for active player missions
		const activeMissions = playerMissions.filter((m) => m.status === 'active');
		console.log(`[GameScene] 🚀 Creating new routes/drifters for ${activeMissions.length} active missions`);

		activeMissions.forEach((mission) => {
			console.log(`[GameScene] 🎯 Processing active mission ${mission.id.slice(-6)} targeting node ${mission.targetNodeId}`);
			this.createMissionRoute(mission);
			this.createMissionDrifter(mission, renderVersion);
		});

		console.log(
			`[GameScene] 🏁 updateMissionRoutes complete. Now have ${this.missionRoutes.size} routes and ${this.missionDrifters.size} drifters`,
		);
	}

	private createMissionRoute(mission: Mission) {
		const currentState = gameState.getState();
		const targetNode = currentState.resourceNodes?.find((r: ResourceNode) => r.id === mission.targetNodeId);
		if (!targetNode) {
			console.warn(`[GameScene] ⚠️ Skipping route creation - target node ${mission.targetNodeId} not found for mission ${mission.id}`);
			console.warn(`[GameScene]   - Available resource node IDs:`, currentState.resourceNodes?.map((n) => n.id) || []);
			return;
		}

		const { x: nodeX, y: nodeY } = targetNode.coordinates;
		const routeGraphics = this.add.graphics();

		// Draw route line from town to resource node
		routeGraphics.lineStyle(2, 0x888888, 0.6);
		routeGraphics.lineBetween(TOWN_X, TOWN_Y, nodeX, nodeY);

		// Add dashed effect
		routeGraphics.lineStyle(2, 0xaaaaaaa, 0.8);
		const distance = Phaser.Math.Distance.Between(TOWN_X, TOWN_Y, nodeX, nodeY);
		const steps = Math.floor(distance / 20);

		for (let i = 0; i < steps; i += 2) {
			const t1 = i / steps;
			const t2 = Math.min((i + 1) / steps, 1);
			const x1 = TOWN_X + (nodeX - TOWN_X) * t1;
			const y1 = TOWN_Y + (nodeY - TOWN_Y) * t1;
			const x2 = TOWN_X + (nodeX - TOWN_X) * t2;
			const y2 = TOWN_Y + (nodeY - TOWN_Y) * t2;

			routeGraphics.lineBetween(x1, y1, x2, y2);
		}

		this.missionRoutes.set(mission.id, routeGraphics);
	}

	private async createMissionDrifter(mission: Mission, renderVersion: number) {
		const currentState = gameState.getState();
		const targetNode = currentState.resourceNodes?.find((r: ResourceNode) => r.id === mission.targetNodeId);
		if (!targetNode) {
			console.warn(`[GameScene] ⚠️ Skipping drifter creation - target node ${mission.targetNodeId} not found for mission ${mission.id}`);
			console.warn(`[GameScene]   - Available resource node IDs:`, currentState.resourceNodes?.map((n) => n.id) || []);
			console.warn(`[GameScene]   - Looking for node ID: ${mission.targetNodeId}`);

			// Check if we have the node in our rendered nodes map
			const clientNode = this.resourceNodes.get(mission.targetNodeId);
			if (clientNode) {
				console.warn(`[GameScene]   - 😱 WEIRD: Node exists in client render map but not in gameState!`);
			} else {
				console.warn(`[GameScene]   - Node not in client render map either`);
			}
			return;
		}

		// Create container at (0,0) but hide it initially to prevent showing green circle at wrong position
		const drifterContainer = this.add.container(0, 0);
		drifterContainer.setVisible(false); // Hide until properly positioned

		// Make container interactive for hover tooltips
		// A larger circle for easier hovering
		drifterContainer.setInteractive(new Phaser.Geom.Circle(0, 0, 20), Phaser.Geom.Circle.Contains);
		drifterContainer.on('pointerover', (pointer: Phaser.Input.Pointer) => {
			this.showMissionTooltip(pointer, mission);
		});
		drifterContainer.on('pointerout', () => {
			this.hideMissionTooltip();
		});

		// If a newer render started while we were setting up, abort
		if (renderVersion !== this.missionRenderVersion) {
			drifterContainer.destroy();
			return;
		}

		// Mission indicator ring
		const missionIndicator = this.add.graphics();
		missionIndicator.lineStyle(2, 0x00ff00);
		missionIndicator.strokeCircle(0, 0, 14);
		console.log(
			`[GameScene] 🟢 Created mission indicator ring for mission ${mission.id.slice(-6)} at container position (0, 0) - will be positioned later`,
		);

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
		this.updateDrifterPosition(drifterContainer, mission, targetNode);

		this.missionDrifters.set(mission.id, drifterContainer);
	}

	private layoutDrifterIcons(container: Phaser.GameObjects.Container, icons: Phaser.GameObjects.Image[], iconSize: number) {
		const n = icons.length;
		if (n === 0) return;

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

	private updateDrifterPosition(drifterContainer: Phaser.GameObjects.Container, mission: Mission, targetNode: ResourceNode) {
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

			const { x: nodeX, y: nodeY } = targetNode.coordinates;

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
			if (drifterContainer.x === 0 && drifterContainer.y === 0) {
				console.log(`[GameScene] 📍 Moving drifter container for mission ${mission.id.slice(-6)} from (0,0) to (${finalX}, ${finalY})`);
			}

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

	update() {
		const cursors = this.input.keyboard?.createCursorKeys();
		if (!cursors) return;

		// ESC to close mission panel and deselect
		if (Phaser.Input.Keyboard.JustDown(cursors.space)) {
			const currentState = gameState.getState();
			if (currentState.showMissionPanel) {
				gameState.hideMissionPanel();
				this.deselectCurrentNode();
			}
		}

		// Update mission drifter positions
		if (gameState.getState().playerMissions?.length > 0) {
			const activeMissions = gameState.getState().playerMissions.filter((m) => m.status === 'active');
			activeMissions.forEach((mission) => {
				const drifterContainer = this.missionDrifters.get(mission.id);
				const currentState = gameState.getState();
				const targetNode = currentState.resourceNodes?.find((r: ResourceNode) => r.id === mission.targetNodeId);
				if (drifterContainer && targetNode) {
					this.updateDrifterPosition(drifterContainer, mission, targetNode);
				}
			});
		}

		// Periodic cleanup check for orphaned containers (every 5 seconds)
		if (Math.floor(this.time.now / 5000) !== this.lastCleanupCheck) {
			this.lastCleanupCheck = Math.floor(this.time.now / 5000);
			this.checkForOrphanedContainers();
		}
	}

	private lastCleanupCheck = 0;

	private checkForOrphanedContainers() {
		// Get current mission IDs
		const currentMissionIds = new Set(gameState.getState().playerMissions?.map((m) => m.id) || []);

		// Check for containers whose missions no longer exist
		this.missionDrifters.forEach((container, missionId) => {
			if (!currentMissionIds.has(missionId)) {
				console.warn(
					`[GameScene] 🧟 Mission ${missionId.slice(-6)} no longer exists, destroying its container at (${container.x}, ${container.y})`,
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
}
