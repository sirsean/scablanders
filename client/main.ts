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
			debug: false,
		},
	},
	scene: [BootScene, GameScene],
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
	duration: 8000,
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
		mercButton.textContent = 'Drifters (M)';
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

		const marketButton = document.createElement('button');
		marketButton.textContent = 'Market';
		marketButton.className = 'button';
		marketButton.style.marginRight = '8px';
		marketButton.addEventListener('click', () => gameState.toggleMarketPanel());
		authPanel.insertBefore(marketButton, authPanel.firstChild);
	}
});

console.log('Scablanders Phase 4 client initialized');
console.log('🎮 Game Controls:');
console.log('  • Click resource nodes to plan missions');
console.log('  • Press M for Mercenaries panel');
console.log('  • Press P for Profile panel');
console.log('  • Press ESC to close panels');
console.log('  • Space to deselect nodes');

// Debug functions for resource management testing
function debugResourceFlow() {
	console.log('🔧 Resource Management Debug Info');
	console.log('='.repeat(40));

	if (!gameState) {
		console.error('❌ gameState not available');
		return;
	}

	const state = gameState.getState();
	console.log('📊 Current State:');
	console.log(`   Resource nodes: ${state.resourceNodes?.length || 0}`);
	console.log(`   WebSocket connected: ${state.wsConnected}`);
	console.log(`   WebSocket authenticated: ${state.wsAuthenticated}`);
	console.log(`   Real-time mode: ${state.realTimeMode}`);
	console.log(`   Connection status: ${state.connectionStatus}`);

	if (state.resourceNodes?.length > 0) {
		console.log('\n📦 Resource Nodes:');
		state.resourceNodes.forEach((node: any) => {
			console.log(
				`   ${node.type} (${node.rarity}) - ${node.currentYield}/${node.baseYield} at (${node.coordinates.x}, ${node.coordinates.y})`,
			);
		});
	}

	return { currentState: state };
}

async function testResourceManagement() {
	console.log('🔧 Starting Resource Management Debug Test');
	console.log('='.repeat(50));

	// Step 1: Check initial state
	console.log('📊 Step 1: Checking initial game state');
	const initialState = gameState?.getState();
	if (!initialState) {
		console.error('❌ Game state not available. Make sure you are logged in to the game.');
		return;
	}

	console.log(`   Initial resource nodes: ${initialState.resourceNodes?.length || 0}`);
	console.log(`   WebSocket connected: ${initialState.wsConnected}`);
	console.log(`   WebSocket authenticated: ${initialState.wsAuthenticated}`);
	console.log(`   Real-time mode: ${initialState.realTimeMode}`);

	if (!initialState.wsAuthenticated) {
		console.error('❌ WebSocket not authenticated. Resource updates may not be received.');
		return;
	}

	// Step 2: Trigger resource management manually
	console.log('\n⚡ Step 2: Triggering resource management on server');
	try {
		const response = await fetch('/api/world/debug/trigger-resource-management', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
		});

		if (!response.ok) {
			console.error(`❌ Failed to trigger resource management: ${response.status} ${response.statusText}`);
			return;
		}

		const result = await response.json();
		console.log(`   ✅ Server response:`, result);
	} catch (error) {
		console.error('❌ Error triggering resource management:', error);
		return;
	}

	// Step 3: Wait and check for updates
	console.log('\n⏳ Step 3: Waiting for WebSocket updates...');

	return new Promise((resolve) => {
		let updateReceived = false;
		const startTime = Date.now();
		const timeout = 10000; // 10 second timeout

		// Listen for state changes
		const stateListener = (newState: any) => {
			if (!updateReceived) {
				updateReceived = true;
				const elapsed = Date.now() - startTime;

				console.log(`   ✅ State update received after ${elapsed}ms`);
				console.log(`   New resource nodes: ${newState.resourceNodes?.length || 0}`);

				// Check if nodes actually changed
				const initialCount = initialState.resourceNodes?.length || 0;
				const newCount = newState.resourceNodes?.length || 0;

				if (newCount !== initialCount) {
					console.log(`   🎉 SUCCESS: Resource count changed from ${initialCount} to ${newCount}`);
				} else {
					console.log(`   ℹ️ Node count unchanged, but yields may have been updated`);

					// Check for yield changes
					const initialNodes = new Map((initialState.resourceNodes || []).map((n: any) => [n.id, n.currentYield]));
					const newNodes = new Map((newState.resourceNodes || []).map((n: any) => [n.id, n.currentYield]));

					let yieldChanges = 0;
					for (const [nodeId, newYield] of newNodes) {
						const oldYield = initialNodes.get(nodeId);
						if (oldYield !== undefined && oldYield !== newYield) {
							yieldChanges++;
						}
					}

					if (yieldChanges > 0) {
						console.log(`   ✅ Found ${yieldChanges} nodes with updated yields`);
					} else {
						console.log(`   ⚠️ No changes detected in resource nodes`);
					}
				}

				resolve(true);
			}
		};

		// Set up state change listener
		if (gameState?.onStateChange) {
			const unsubscribe = gameState.onStateChange(stateListener);

			// Cleanup after timeout
			setTimeout(() => {
				unsubscribe();
				if (!updateReceived) {
					console.error('❌ No state update received within 10 seconds');
					console.log('   Possible issues:');
					console.log('   - WebSocket connection lost');
					console.log('   - Server not broadcasting updates');
					console.log('   - Resource management not making changes');
					resolve(false);
				}
			}, timeout);
		} else {
			console.error('❌ Cannot listen for state changes - gameState not available');
			resolve(false);
		}
	});
}

// Make functions available globally for console use
(window as any).debugResourceFlow = debugResourceFlow;
(window as any).testResourceManagement = testResourceManagement;

console.log('\n🔧 Debug Functions Available:');
console.log('  • debugResourceFlow() - Check current resource state');
console.log('  • testResourceManagement() - Test complete degradation flow');

// Add some demo notifications for testing
setTimeout(() => {
	gameState.addNotification({
		type: 'info',
		title: 'Tutorial',
		message: 'Click on resource nodes to start missions!',
		duration: 6000,
	});
}, 3000);
