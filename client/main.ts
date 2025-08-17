import Phaser from 'phaser';
import '@shared/models';

// Import scenes
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

// Import game state management and UI
import { gameState } from './gameState';
import { UIManager } from './ui/UIManager';

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
  scene: [BootScene, GameScene]
};

// Initialize the game
const game = new Phaser.Game(config);

// Initialize UI Manager (handles all panels and notifications)
const uiManager = new UIManager();

// Import authentication system
import { auth } from './auth';

// Add welcome notification
gameState.addNotification({
  type: 'info',
  title: 'Welcome to Scablanders!',
  message: 'Connect your wallet to start exploring the wasteland.',
  duration: 8000
});

// SIWE Authentication handlers
document.getElementById('connect-wallet')?.addEventListener('click', async () => {
  console.log('Starting SIWE authentication...');
  await auth.connect();
});

document.getElementById('disconnect-wallet')?.addEventListener('click', async () => {
  console.log('Disconnecting wallet...');
  await auth.disconnect();
});

// Add bottom control panel button handlers
document.getElementById('toggle-mercenaries')?.addEventListener('click', () => {
  gameState.toggleMercenaryPanel();
});

document.getElementById('toggle-missions')?.addEventListener('click', () => {
  gameState.toggleActiveMissionsPanel();
});

document.getElementById('toggle-profile')?.addEventListener('click', () => {
  gameState.toggleProfilePanel();
});

// Add top bar button handlers for panels
document.addEventListener('DOMContentLoaded', () => {
  // Add mercenaries button to UI
  const authPanel = document.getElementById('auth-panel');
  if (authPanel) {
    const mercButton = document.createElement('button');
    mercButton.textContent = 'Mercenaries (M)';
    mercButton.className = 'button';
    mercButton.style.marginRight = '8px';
    mercButton.addEventListener('click', () => gameState.toggleMercenaryPanel());
    authPanel.insertBefore(mercButton, authPanel.firstChild);
    
    const profileButton = document.createElement('button');
    profileButton.textContent = 'Profile (P)';
    profileButton.className = 'button';
    profileButton.style.marginRight = '8px';
    profileButton.addEventListener('click', () => gameState.toggleProfilePanel());
    authPanel.insertBefore(profileButton, authPanel.firstChild);
  }
});

console.log('Scablanders Phase 4 client initialized');
console.log('🎮 Game Controls:');
console.log('  • Click resource nodes to plan missions');
console.log('  • Press M for Mercenaries panel');
console.log('  • Press P for Profile panel');
console.log('  • Press ESC to close panels');
console.log('  • Space to deselect nodes');

// Add some demo notifications for testing
setTimeout(() => {
  gameState.addNotification({
    type: 'info',
    title: 'Tutorial',
    message: 'Click on resource nodes to start missions!',
    duration: 6000
  });
}, 3000);
