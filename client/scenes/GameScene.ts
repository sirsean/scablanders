import Phaser from 'phaser';
import type { ResourceNode, Mission } from '@shared/models';
import { gameState, GameState } from '../gameState';

// Town coordinates - center of the map area
const TOWN_X = 500;
const TOWN_Y = 350;

export class GameScene extends Phaser.Scene {
  private resourceNodes: Map<string, Phaser.GameObjects.Image> = new Map();
  private worldData: any = null;
  private selectedNode: string | null = null;
  private nodeLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private missionIndicators: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private missionRoutes: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private missionDrifters: Map<string, Phaser.GameObjects.Container> = new Map();
  private townMarker: Phaser.GameObjects.Container | null = null;
  
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // Set desert background
    this.cameras.main.setBackgroundColor('#8B4513');
    
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
      // Clear existing placeholder nodes
      this.resourceNodes.forEach(node => node.destroy());
      this.nodeLabels.forEach(label => label.destroy());
      this.resourceNodes.clear();
      this.nodeLabels.clear();
      
      // Create resource nodes from server data
      state.resourceNodes.forEach((resource: ResourceNode) => {
        this.createResourceNodeFromServerData(resource);
      });
      
      this.updateMissionIndicators(state.activeMissions);
    }
    
    // Update mission routes and drifter positions
    if (state.playerMissions) {
      this.updateMissionRoutes(state.playerMissions);
    }
  }



  private createResourceNodeFromServerData(resource: ResourceNode) {
    const { id, type, coordinates, currentYield, rarity } = resource;
    const { x, y } = coordinates;
    
    // Determine node appearance based on type and rarity
    let textureKey = `${type}-node`;
    let scale = rarity === 'rare' || rarity === 'epic' || rarity === 'legendary' ? 1.3 : 1.0;
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
    
    // Add node label
    const labelY = y - (35 * scale);
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
    
    // If mission panel is open, close it and deselect node
    if (currentState.showMissionPanel) {
      gameState.hideMissionPanel();
      this.deselectCurrentNode();
    }
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

  private updateMissionRoutes(playerMissions: Mission[]) {
    // Clear existing routes and drifters
    this.missionRoutes.forEach(route => route.destroy());
    this.missionDrifters.forEach(drifter => drifter.destroy());
    this.missionRoutes.clear();
    this.missionDrifters.clear();
    
    // Create routes and drifters for active player missions
    const activeMissions = playerMissions.filter(m => m.status === 'active');
    activeMissions.forEach(mission => {
      this.createMissionRoute(mission);
      this.createMissionDrifter(mission);
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

  private createMissionDrifter(mission: Mission) {
    const currentState = gameState.getState();
    const targetNode = currentState.resourceNodes?.find((r: ResourceNode) => r.id === mission.targetNodeId);
    if (!targetNode) return;
    
    const drifterContainer = this.add.container(0, 0);
    
    // Drifter icon (simple diamond shape)
    const drifterIcon = this.add.graphics();
    drifterIcon.fillStyle(0x00BFFF);
    drifterIcon.fillCircle(0, 0, 6);
    drifterIcon.lineStyle(2, 0xFFFFFF);
    drifterIcon.strokeCircle(0, 0, 6);
    
    // Mission indicator
    const missionIndicator = this.add.graphics();
    missionIndicator.lineStyle(2, 0x00FF00);
    missionIndicator.strokeCircle(0, 0, 12);
    
    // Team size indicator
    const teamSize = mission.drifterIds.length;
    const teamLabel = this.add.text(0, -18, `${teamSize}`, {
      fontSize: '10px',
      color: '#FFFFFF',
      fontFamily: 'Courier New',
      fontStyle: 'bold',
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: { x: 2, y: 1 }
    }).setOrigin(0.5);
    
    drifterContainer.add([missionIndicator, drifterIcon, teamLabel]);
    
    // Calculate and set initial position based on mission progress
    this.updateDrifterPosition(drifterContainer, mission, targetNode);
    
    this.missionDrifters.set(mission.id, drifterContainer);
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
