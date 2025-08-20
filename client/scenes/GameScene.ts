import Phaser from 'phaser';
import type { ResourceNode, Mission } from '@shared/models';
import { gameState, GameState } from '../gameState';
import { getResourceTextureKey } from '../utils/resourceTextures';

// Town coordinates - center of the map area
const TOWN_X = 500;
const TOWN_Y = 350;

// Resource node display constants
const RESOURCE_NODE_BASE_SCALE = 0.15; // Base scale for resource nodes (adjust to resize all nodes)
const RESOURCE_NODE_RARITY_SCALE_MULTIPLIER = 1.2; // How much bigger rare/epic/legendary nodes are
const RESOURCE_NODE_LABEL_OFFSET = 30; // Distance above the node to place the label

export class GameScene extends Phaser.Scene {
  private resourceNodes: Map<string, Phaser.GameObjects.Image> = new Map();
  private worldData: any = null;
  private selectedNode: string | null = null;
  private nodeLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private missionIndicators: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private missionRoutes: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private missionDrifters: Map<string, Phaser.GameObjects.Container> = new Map();
  private pendingTinyLoads: Map<string, Promise<string>> = new Map();
  private townMarker: Phaser.GameObjects.Container | null = null;
  private missionRenderVersion = 0;
  
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // Add the world map background image
    const bg = this.add.image(0, 0, 'world-map')
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
    this.add.text(this.cameras.main.centerX, 50, 'THE SCABLANDS', {
      fontSize: '36px',
      color: '#FFD700',
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(this.cameras.main.centerX, 90, 'A harsh world of opportunity and danger', {
      fontSize: '16px',
      color: '#DAA520',
      fontFamily: 'Courier New',
      fontStyle: 'italic'
    }).setOrigin(0.5);
    
    // Listen for game state changes
    gameState.onStateChange((state: GameState) => {
      this.updateWorldDisplay(state);
    });
    
    // Create town marker
    this.createTownMarker();
    
    // Resource nodes will be loaded from server via gameState
    
    console.log('Game Scene initialized');
  }

  private updateWorldDisplay(state: GameState) {
    if (state.resourceNodes && state.resourceNodes.length > 0) {
      this.updateResourceNodes(state.resourceNodes);
      this.updateMissionIndicators(state.activeMissions);
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
    const serverNodeMap = new Map(serverNodes.map(node => [node.id, node]));
    
    // Remove nodes that no longer exist on server
    for (const [nodeId] of this.resourceNodes) {
      if (!serverNodeMap.has(nodeId)) {
        console.log(`[GameScene] Removing deleted node: ${nodeId}`);
        this.removeResourceNode(nodeId);
      }
    }
    
    // Update existing nodes or create new ones
    for (const serverNode of serverNodes) {
      const existingNode = this.resourceNodes.get(serverNode.id);
      
      if (!existingNode) {
        // Create new node
        console.log(`[GameScene] Creating new resource node: ${serverNode.id}`);
        this.createResourceNodeFromServerData(serverNode);
      } else {
        // Update existing node if changed
        this.updateExistingResourceNode(serverNode);
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
   * Remove a resource node and its label
   */
  private removeResourceNode(nodeId: string) {
    const nodeSprite = this.resourceNodes.get(nodeId);
    const nodeLabel = this.nodeLabels.get(nodeId);
    
    if (nodeSprite) {
      nodeSprite.destroy();
      this.resourceNodes.delete(nodeId);
    }
    
    if (nodeLabel) {
      nodeLabel.destroy();
      this.nodeLabels.delete(nodeId);
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
      ease: 'Bounce.easeOut'
    });
    
    // Brief tint flash
    this.tweens.add({
      targets: nodeSprite,
      tint: 0x00FF00,
      duration: 200,
      yoyo: true,
      onComplete: () => {
        nodeSprite.clearTint();
      }
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
    let scale = rarity === 'rare' || rarity === 'epic' || rarity === 'legendary' 
      ? RESOURCE_NODE_BASE_SCALE * RESOURCE_NODE_RARITY_SCALE_MULTIPLIER 
      : RESOURCE_NODE_BASE_SCALE;
    let glowColor = this.getRarityColor(rarity);
    
    // Create the main node sprite
    const node = this.add.image(x, y, textureKey);
    node.setScale(scale);
    node.setInteractive({ cursor: 'pointer' });
    
    // Add glow effect for rare nodes
    if (rarity !== 'common') {
      const glow = this.add.circle(x, y, 35, glowColor, 0.3);
      glow.setBlendMode(Phaser.BlendModes.ADD);
    }
    
    // Create hover effects
    node.on('pointerover', () => {
      node.setScale(scale * 1.15);
      node.setTint(0xFFFFFF);
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
    const label = this.add.text(x, labelY, `${type.toUpperCase()}${rarityText}\n${currentYield}`, {
      fontSize: '11px',
      color: '#FFFFFF',
      fontFamily: 'Courier New',
      align: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: { x: 4, y: 2 }
    }).setOrigin(0.5);
    
    // Store references
    this.resourceNodes.set(id, node);
    this.nodeLabels.set(id, label);
  }

  private updateMissionIndicators(missions: any[]) {
    // Clear existing indicators
    this.missionIndicators.forEach(indicator => indicator.destroy());
    this.missionIndicators.clear();
    
    // Add indicators for active missions
    missions.forEach(mission => {
      if (mission.targetNodeId) {
        const node = this.resourceNodes.get(mission.targetNodeId);
        if (node) {
          const indicator = this.add.graphics();
          indicator.lineStyle(3, 0x00FF00);
          indicator.strokeCircle(node.x, node.y, 40);
          
          // Animate the indicator
          this.tweens.add({
            targets: indicator,
            alpha: { from: 1, to: 0.3 },
            duration: 1000,
            yoyo: true,
            repeat: -1
          });
          
          this.missionIndicators.set(mission.id, indicator);
        }
      }
    });
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
      selectedNodeSprite.setTint(0x00FF00);
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
    if (currentState.showMissionPanel || 
        currentState.showMercenaryPanel || 
        currentState.showProfilePanel || 
        currentState.showActiveMissionsPanel) {
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
    townBuilding.fillStyle(0x8B4513);
    townBuilding.fillRect(-20, -15, 40, 30);
    townBuilding.lineStyle(2, 0xFFD700);
    townBuilding.strokeRect(-20, -15, 40, 30);
    
    // Town flag
    townBuilding.fillStyle(0xDC143C);
    townBuilding.fillTriangle(-15, -15, -15, -25, -5, -20);
    townBuilding.lineStyle(1, 0x000000);
    townBuilding.lineBetween(-15, -15, -15, -25);
    
    // Town label
    const townLabel = this.add.text(0, -35, 'TOWN', {
      fontSize: '12px',
      color: '#FFD700',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: { x: 6, y: 2 }
    }).setOrigin(0.5);
    
    townContainer.add([townBuilding, townLabel]);
    this.townMarker = townContainer;
    
    // Add subtle glow effect
    const glow = this.add.circle(TOWN_X, TOWN_Y, 25, 0xFFD700, 0.1);
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
    // Bump render version to invalidate any in-flight async icon loads
    this.missionRenderVersion++;
    const renderVersion = this.missionRenderVersion;
    // Clear existing routes and drifters
    this.missionRoutes.forEach(route => route.destroy());
    this.missionDrifters.forEach(container => {
      // Ensure children are destroyed to prevent ghost images
      try { (container as any).removeAll?.(true); } catch {}
      container.destroy();
    });
    this.missionRoutes.clear();
    this.missionDrifters.clear();
    
    // Create routes and drifters for active player missions
    const activeMissions = playerMissions.filter(m => m.status === 'active');
    activeMissions.forEach(mission => {
      this.createMissionRoute(mission);
      this.createMissionDrifter(mission, renderVersion);
    });
  }

  private createMissionRoute(mission: Mission) {
    const currentState = gameState.getState();
    const targetNode = currentState.resourceNodes?.find((r: ResourceNode) => r.id === mission.targetNodeId);
    if (!targetNode) return;
    
    const { x: nodeX, y: nodeY } = targetNode.coordinates;
    const routeGraphics = this.add.graphics();
    
    // Draw route line from town to resource node
    routeGraphics.lineStyle(2, 0x888888, 0.6);
    routeGraphics.lineBetween(TOWN_X, TOWN_Y, nodeX, nodeY);
    
    // Add dashed effect
    routeGraphics.lineStyle(2, 0xAAAAAAA, 0.8);
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
    if (!targetNode) return;
    
    const drifterContainer = this.add.container(0, 0);

    // If a newer render started while we were setting up, abort
    if (renderVersion !== this.missionRenderVersion) {
      drifterContainer.destroy();
      return;
    }
    
    // Mission indicator ring
    const missionIndicator = this.add.graphics();
    missionIndicator.lineStyle(2, 0x00FF00);
    missionIndicator.strokeCircle(0, 0, 14);

    // Add tiny images for each drifter
    const iconSize = 16;
    const icons: Phaser.GameObjects.Image[] = [];
    for (const drifterId of mission.drifterIds) {
      if (renderVersion !== this.missionRenderVersion) {
        // Abort if superseded
        try { (drifterContainer as any).removeAll?.(true); } catch {}
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
      try { (drifterContainer as any).removeAll?.(true); } catch {}
      drifterContainer.destroy();
      return;
    }

    // Calculate and set initial position based on mission progress
    this.updateDrifterPosition(drifterContainer, mission, targetNode);

    this.missionDrifters.set(mission.id, drifterContainer);
  }

  private layoutDrifterIcons(
    container: Phaser.GameObjects.Container,
    icons: Phaser.GameObjects.Image[],
    iconSize: number
  ) {
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
        { x: 8, y: 0 }
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
    const now = new Date();
    const startTime = mission.startTime instanceof Date ? mission.startTime : new Date(mission.startTime);
    const endTime = mission.completionTime instanceof Date ? mission.completionTime : new Date(mission.completionTime);
    
    const totalDuration = endTime.getTime() - startTime.getTime();
    const elapsed = now.getTime() - startTime.getTime();
    const progress = Math.max(0, Math.min(1, elapsed / totalDuration));
    
    const { x: nodeX, y: nodeY } = targetNode.coordinates;
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
    
    // Add subtle floating motion
    const bobOffset = Math.sin(this.time.now * 0.003) * 2;
    drifterContainer.setPosition(currentX, currentY + bobOffset);
  }

  private getResourceColor(type: string): number {
    switch (type) {
      case 'ore': return 0xFF4500;
      case 'scrap': return 0x708090;
      case 'organic': return 0x8FBC8F;
      default: return 0xFFFFFF;
    }
  }

  private getRarityColor(rarity: string): number {
    switch (rarity) {
      case 'common': return 0xFFFFFF;
      case 'uncommon': return 0x00FF00;
      case 'rare': return 0x0080FF;
      case 'epic': return 0x8000FF;
      case 'legendary': return 0xFFD700;
      default: return 0xFFFFFF;
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
      const activeMissions = gameState.getState().playerMissions.filter(m => m.status === 'active');
      activeMissions.forEach(mission => {
        const drifterContainer = this.missionDrifters.get(mission.id);
        const currentState = gameState.getState();
        const targetNode = currentState.resourceNodes?.find((r: ResourceNode) => r.id === mission.targetNodeId);
        if (drifterContainer && targetNode) {
          this.updateDrifterPosition(drifterContainer, mission, targetNode);
        }
      });
    }
  }
}
