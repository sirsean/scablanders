import Phaser from 'phaser';
import '@shared/models';

// Simple boot scene to initialize the game
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Create simple colored rectangles as placeholder assets
    this.load.image('desert-bg', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  }

  create() {
    console.log('Scablanders Boot Scene Started');
    this.scene.start('MapScene');
  }
}

// Main map scene where the game takes place
class MapScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MapScene' });
  }

  create() {
    // Set background color to desert-like brown
    this.cameras.main.setBackgroundColor('#8B4513');
    
    // Add some temporary text
    const welcomeText = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      'Welcome to the Scablands\nA harsh world awaits...',
      {
        fontSize: '32px',
        color: '#FFD700',
        align: 'center',
        fontFamily: 'Courier New'
      }
    );
    welcomeText.setOrigin(0.5);

    // Add some placeholder resource nodes
    this.createPlaceholderNodes();
    
    // Make sure loading screen is hidden
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
    
    console.log('Map Scene initialized');
  }

  private createPlaceholderNodes() {
    // Create some placeholder resource nodes
    const nodePositions = [
      { x: 200, y: 300, type: 'ore' },
      { x: 500, y: 200, type: 'scrap' },
      { x: 700, y: 400, type: 'organic' },
    ];

    nodePositions.forEach((pos, index) => {
      const node = this.add.circle(pos.x, pos.y, 20, 0xFF6600);
      node.setInteractive();
      node.on('pointerdown', () => {
        console.log(`Clicked resource node ${index} (${pos.type})`);
        // TODO: Open mission planning UI
      });
      
      // Add hover effect
      node.on('pointerover', () => {
        node.setScale(1.2);
      });
      
      node.on('pointerout', () => {
        node.setScale(1.0);
      });
      
      // Add label
      this.add.text(pos.x, pos.y - 35, pos.type.toUpperCase(), {
        fontSize: '12px',
        color: '#FFFFFF',
        fontFamily: 'Courier New'
      }).setOrigin(0.5);
    });
  }
}

// Game configuration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1200,
  height: 800,
  parent: 'game-container',
  backgroundColor: '#2c1810',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [BootScene, MapScene]
};

// Initialize the game
const game = new Phaser.Game(config);

// Basic wallet connection handler (placeholder)
document.getElementById('connect-wallet')?.addEventListener('click', async () => {
  console.log('Connect wallet clicked');
  // TODO: Implement proper SIWE authentication
  
  if (typeof window.ethereum !== 'undefined') {
    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      console.log('Connected to wallet:', accounts[0]);
      
      // Show wallet info
      const connectButton = document.getElementById('connect-wallet');
      const walletInfo = document.getElementById('wallet-info');
      const addressDisplay = document.getElementById('address-display');
      
      if (connectButton) connectButton.style.display = 'none';
      if (walletInfo) walletInfo.style.display = 'block';
      if (addressDisplay) {
        addressDisplay.textContent = `${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`;
      }
      
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  } else {
    alert('Please install MetaMask or another web3 wallet');
  }
});

// Disconnect handler
document.getElementById('disconnect-wallet')?.addEventListener('click', () => {
  console.log('Disconnect wallet clicked');
  
  const connectButton = document.getElementById('connect-wallet');
  const walletInfo = document.getElementById('wallet-info');
  
  if (connectButton) connectButton.style.display = 'block';
  if (walletInfo) walletInfo.style.display = 'none';
});

console.log('Scablanders client initialized');
