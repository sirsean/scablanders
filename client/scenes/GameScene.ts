import Phaser from 'phaser';
import type { ResourceNode } from '@shared/models';
import { gameState, GameState } from '../gameState';

export class GameScene extends Phaser.Scene {
  private resourceNodes: Map<string, Phaser.GameObjects.Image> = new Map();
  private worldData: any = null;
  private selectedNode: string | null = null;
  private nodeLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private missionIndicators: Map<string, Phaser.GameObjects.Graphics> = new Map();
  
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
    
    // Create initial placeholder nodes if no world data
    this.createPlaceholderNodes();
    
    console.log('Game Scene initialized');
  }

  private updateWorldDisplay(state: GameState) {
    if (state.worldState) {
      this.worldData = state.worldState;
      this.updateResourceNodes();
      this.updateMissionIndicators(state.activeMissions);
    }
  }

  private createPlaceholderNodes() {
    // Create placeholder resource nodes until real data loads
    const placeholderNodes = [
      { id: 'ore_1', x: 200, y: 300, type: 'ore', quantity: 100 },
      { id: 'ore_2', x: 800, y: 350, type: 'ore', quantity: 150 },
      { id: 'scrap_1', x: 400, y: 250, type: 'scrap', quantity: 80 },
      { id: 'scrap_2', x: 700, y: 500, type: 'scrap', quantity: 120 },
      { id: 'organic_1', x: 300, y: 450, type: 'organic', quantity: 60 },
      { id: 'organic_2', x: 900, y: 200, type: 'organic', quantity: 90 },
      { id: 'rare_1', x: 500, y: 400, type: 'ore', quantity: 200, rarity: 'rare' },
    ];
    
    placeholderNodes.forEach(node => {
      this.createResourceNode(node);
    });
  }

  private updateResourceNodes() {
    if (!this.worldData?.resources) return;
    
    // Clear existing placeholder nodes
    this.resourceNodes.forEach(node => node.destroy());
    this.nodeLabels.forEach(label => label.destroy());
    this.resourceNodes.clear();
    this.nodeLabels.clear();
    
    // Create real resource nodes from world data
    this.worldData.resources.forEach((resource: ResourceNode) => {
      this.createResourceNode(resource);
    });
  }

  private createResourceNode(resource: any) {
    const { id, x, y, type, quantity, rarity } = resource;
    
    // Determine node appearance based on type and rarity
    let textureKey = `${type}-node`;
    let scale = rarity === 'rare' ? 1.3 : 1.0;
    let glowColor = rarity === 'rare' ? 0xFFD700 : this.getResourceColor(type);
    
    // Create the main node sprite
    const node = this.add.image(x, y, textureKey);
    node.setScale(scale);
    node.setInteractive({ cursor: 'pointer' });
    
    // Add glow effect for rare nodes
    if (rarity === 'rare') {
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
    const label = this.add.text(x, labelY, `${type.toUpperCase()}\n${quantity}`, {
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

  private getResourceColor(type: string): number {
    switch (type) {
      case 'ore': return 0xFF4500;
      case 'scrap': return 0x708090;
      case 'organic': return 0x8FBC8F;
      default: return 0xFFFFFF;
    }
  }

  // Handle keyboard input
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
  }
}
