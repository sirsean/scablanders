import Phaser from 'phaser';
import { RESOURCE_TYPES, RARITIES_WITH_TEXTURE } from '../utils/resourceTextures';

export class BootScene extends Phaser.Scene {
	constructor() {
		super({ key: 'BootScene' });
	}

	preload() {
		// Show loading progress
		const centerX = this.cameras.main.centerX;
		const centerY = this.cameras.main.centerY;

		// Loading text
		const _loadingText = this.add
			.text(centerX, centerY - 50, 'Loading Scablanders...', {
				fontSize: '24px',
				color: '#FFD700',
				fontFamily: 'Courier New',
			})
			.setOrigin(0.5);

		// Progress bar background
		const _progressBg = this.add.rectangle(centerX, centerY, 300, 20, 0x333333);
		const progressBar = this.add.rectangle(centerX - 150, centerY, 0, 16, 0xffd700);
		progressBar.setOrigin(0, 0.5);

		// Update progress bar
		this.load.on('progress', (value: number) => {
			progressBar.width = 300 * value;
		});

		// Create simple colored rectangles as placeholder assets
		this.load.image(
			'desert-bg',
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
		);

		// Load the world map background image
		this.load.image('tile-bg', this.generateTilePattern(128, '#2c1810', '#3a2a22'));
		this.load.image('world-map', 'assets/images/scablanders-map.png');

		// Load resource node textures by type and rarity
		for (const type of RESOURCE_TYPES) {
			for (const rarity of RARITIES_WITH_TEXTURE) {
				this.load.image(`${type}-${rarity}`, `assets/images/resources/${type}-${rarity}.png`);
			}
		}

		// Generate UI textures
		this.load.image('panel-bg', this.generatePanelTexture(200, 150));

		// Fallback tiny drifter texture
		this.load.image('generic-drifter', this.generateResourceTexture(0x00bfff, 8));
	}

	private generateResourceTexture(color: number, radius: number): string {
		// Create a canvas and draw a circle
		const canvas = document.createElement('canvas');
		canvas.width = radius * 2;
		canvas.height = radius * 2;
		const ctx = canvas.getContext('2d')!;

		// Draw outer glow
		const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
		gradient.addColorStop(0, `#${color.toString(16).padStart(6, '0')}`);
		gradient.addColorStop(0.7, `#${color.toString(16).padStart(6, '0')}80`);
		gradient.addColorStop(1, 'transparent');

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw solid center
		ctx.beginPath();
		ctx.arc(radius, radius, radius * 0.6, 0, Math.PI * 2);
		ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
		ctx.fill();

		return canvas.toDataURL();
	}

	private generatePanelTexture(width: number, height: number): string {
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d')!;

		// Background with transparency
		ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
		ctx.fillRect(0, 0, width, height);

		// Border
		ctx.strokeStyle = '#444444';
		ctx.lineWidth = 2;
		ctx.strokeRect(1, 1, width - 2, height - 2);

		// Subtle inner glow
		ctx.strokeStyle = '#666666';
		ctx.lineWidth = 1;
		ctx.strokeRect(2, 2, width - 4, height - 4);

		return canvas.toDataURL();
	}

	private generateTilePattern(size: number, base: string, dot: string): string {
		const c = document.createElement('canvas');
		c.width = size;
		c.height = size;
		const g = c.getContext('2d');
		if (!g) return '';
		g.fillStyle = base;
		g.fillRect(0, 0, size, size);
		// Subtle dot grid
		g.globalAlpha = 0.25;
		g.fillStyle = dot;
		for (let y = 0; y <= size; y += 16) {
			for (let x = 0; x <= size; x += 16) {
				g.fillRect(x, y, 2, 2);
			}
		}
		// Light grid lines to break monotony, seamless at edges
		g.globalAlpha = 0.12;
		g.strokeStyle = dot;
		g.lineWidth = 1;
		g.beginPath();
		for (let i = 0; i <= size; i += 32) {
			g.moveTo(i + 0.5, 0);
			g.lineTo(i + 0.5, size);
			g.moveTo(0, i + 0.5);
			g.lineTo(size, i + 0.5);
		}
		g.stroke();
		return c.toDataURL();
	}

	create() {
		console.log('Scablanders Boot Scene Started');

		// Hide HTML loading element
		const loadingEl = document.getElementById('loading');
		if (loadingEl) {
			loadingEl.style.display = 'none';
		}

		// Start the main game scene
		this.scene.start('GameScene');
	}
}
