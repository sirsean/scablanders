#!/usr/bin/env node

/**
 * Script to build the real drifters.json file using Alchemy SDK and metadata API
 *
 * This script:
 * 1. Uses Alchemy SDK to get the total number of Fringe Drifters NFTs
 * 2. Iterates through all token IDs (or a limited range for testing)
 * 3. Fetches metadata from https://omniscient.fringedrifters.com/main/metadata/{tokenId}.json
 * 4. Computes stats based on attributes
 * 5. Saves the new drifters.json file
 */

import { Alchemy, Network } from 'alchemy-sdk';
import { Command } from 'commander';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract address and configuration
const FRINGE_DRIFTERS_CONTRACT = '0xe3B399AAb015D2C0D787ECAd40410D88f4f4cA50';
const METADATA_BASE_URL = 'https://omniscient.fringedrifters.com/main/metadata';
const IMAGE_BASE_DIR = path.join(__dirname, '../public/images/drifters');

// Setup CLI
const program = new Command();
program
	.name('build-drifters')
	.description('Build drifters.json file and process images from Fringe Drifters NFT metadata')
	.option('-k, --key <alchemy_key>', 'Alchemy API key (or use ALCHEMY_API_KEY env var)')
	.option('-l, --limit <number>', 'Limit number of tokens to process (for testing)', parseInt)
	.option('-o, --output <path>', 'Output file path for drifters.json', path.join(__dirname, '../server/data/drifters.json'))
	.option('-b, --batch-size <number>', 'Batch size for processing', parseInt, 10)
	.option('-d, --delay <number>', 'Delay between batches (ms)', parseInt, 100)
	.option('--refresh-metadata', 'Fetch and rebuild drifters.json')
	.option('--download-images', 'Download original images')
	.option('--resize-images', 'Create thumbnails and tiny versions of images')
	.option('--force-images', 'Re-download images even if they exist')
	.option('--force-resize', 'Re-create resized images even if they exist')
	.option('--recovery-mode', 'Only download missing images (recovery mode)')
	.option('--backfill-resize', 'Create missing thumbnails/tiny images (backfill mode)')
	.option('--recompute-stats', 'Recompute stats from existing attributes in drifters.json (no API calls)')
	.option('--dry-run', 'When used with --recompute-stats, do not write changes, only print summary')
	.parse();

const options = program.opts();

// Get API key from CLI option or environment
const ALCHEMY_API_KEY = options.key || process.env.ALCHEMY_API_KEY;

// Configuration
const OUTPUT_PATH = options.output;
const TOKEN_LIMIT = options.limit;
const BATCH_SIZE = options.batchSize;
const DELAY = options.delay;

// Initialize Alchemy (only if we have an API key)
let alchemy = null;
if (ALCHEMY_API_KEY) {
	alchemy = new Alchemy({
		apiKey: ALCHEMY_API_KEY,
		network: Network.ETH_MAINNET,
	});
}

/**
 * Fetch metadata from the Fringe Drifters API
 */
async function fetchMetadata(tokenId) {
	const url = `${METADATA_BASE_URL}/${tokenId}.json`;

	try {
		console.log(`Fetching metadata for token ${tokenId}...`);
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const metadata = await response.json();
		return metadata;
	} catch (error) {
		console.error(`Failed to fetch metadata for token ${tokenId}:`, error.message);
		return null;
	}
}

/**
 * Compute drifter stats based on attributes
 * New approach: deterministic, attribute-driven, higher variation, 1–8 scale
 */
import crypto from 'node:crypto';

function computeStats(attributes) {
	// Helper: build a lowercase map from trait_type to value for quick lookups
	const attrMap = {};
	(attributes || []).forEach((attr) => {
		if (!attr || !attr.trait_type) {return;}
		attrMap[attr.trait_type] = String(attr.value || '').trim();
	});

	const lc = (s) => (s ? String(s).toLowerCase() : '');

	// Base stats target around mid with room to move down/up to 1–8
	let combat = 4;
	let scavenging = 4;
	let tech = 4;
	let speed = 4;

	// 1) Class-based strong identity
	const classType = lc(attrMap['Class'] || 'drifter');
	switch (classType) {
		case 'warrior':
			combat += 3;
			speed += 1;
			tech -= 1;
			scavenging -= 1;
			break;
		case 'scavenger':
			scavenging += 3;
			tech += 1;
			combat -= 1;
			break;
		case 'tech':
			tech += 3;
			scavenging += 1;
			combat -= 2;
			break;
		case 'scout':
			speed += 3;
			scavenging += 1;
			combat -= 1;
			tech -= 1;
			break;
		case 'drifter':
		default:
			// leave balanced
			break;
	}

	// 2) Location flavor
	const location = attrMap['Location'] || '';
	switch (location) {
		case 'Scablands':
			scavenging += 1;
			combat += 1;
			break;
		case 'Tech Ruins':
			tech += 2;
			break;
		case 'Wasteland':
			combat += 1;
			speed += 1;
			break;
		case 'Underground':
			scavenging += 2;
			break;
		default:
			break;
	}

	// 3) Equipment and outfit keywords (apply per-trait once per category)
	const containsAny = (text, words) => {
		const t = lc(text);
		return words.some((w) => t.includes(w));
	};

	const bumpFromKeywords = (text) => {
		if (!text) {return;}
		const t = lc(text);
		const incOnce = (cond, fn) => {
			if (cond) {fn();}
		};

		// Combat indicators
		incOnce(
			containsAny(t, [
				'weapon',
				'blade',
				'hammer',
				'mace',
				'axe',
				'sword',
				'spear',
				'gauntlet',
				'armor',
				'armour',
				'war',
				'guard',
				'striker',
				'shriek',
				'cannon',
				'rifle',
			]),
			() => {
				combat += 1;
			},
		);

		// Tech indicators
		incOnce(
			containsAny(t, ['tech', 'circuit', 'regulator', 'scanner', 'computer', 'sensor', 'data', 'grid', 'device', 'processor']),
			() => {
				tech += 1;
			},
		);

		// Speed indicators
		incOnce(containsAny(t, ['speed', 'boost', 'jet', 'skimmer', 'light', 'scout', 'runner', 'flag']), () => {
			speed += 1;
		});

		// Scavenging indicators
		incOnce(containsAny(t, ['scrap', 'salvage', 'pack', 'caddy', 'squirrel', 'miner', 'mining', 'trunk', 'bag']), () => {
			scavenging += 1;
		});
	};

	// Apply to multiple gear-like traits
	bumpFromKeywords(attrMap['Suit']);
	bumpFromKeywords(attrMap['Headgear']);
	bumpFromKeywords(attrMap['Backpack']);
	bumpFromKeywords(attrMap['Accessory']);
	bumpFromKeywords(attrMap['Suit Accessory']);

	// 4) Graphic/Guild flavor
	const graphic = attrMap['Graphic'] || '';
	if (graphic) {
		const g = lc(graphic);
		if (g.includes('guild')) {
			combat += 1;
			tech += 1;
		}
		if (g.includes('miner')) {
			scavenging += 2;
		}
		if (g.includes('grid')) {
			tech += 1;
		}
		if (g.includes('roving') || g.includes('terror')) {
			combat += 2;
		}
		if (g.includes('free')) {
			speed += 1;
		}
		if (g.includes('topography')) {
			scavenging += 1;
			tech += 1;
		}
	}

	// 5) Suit Pattern / Color very small tweaks
	const suitPattern = lc(attrMap['Suit Pattern'] || '');
	if (suitPattern.includes('flag')) {speed += 1;}

	const suitColor = lc(attrMap['Suit Color'] || '');
	if (suitColor.includes('white') || suitColor.includes('yellow') || suitColor.includes('orange')) {speed += 1;}
	if (suitColor.includes('black') || suitColor.includes('brown')) {combat += 1;}
	if (suitColor.includes('green')) {scavenging += 1;}
	if (suitColor.includes('blue') || suitColor.includes('purple')) {tech += 1;}

	// 6) Phase -> rarity and base hire cost scaffolding
	let rarity = 'common';
	let baseHire = 60;
	const phase = attrMap['Phase'];
	switch (phase) {
		case 'Phase 2':
			rarity = 'uncommon';
			baseHire = 90;
			combat += 1;
			scavenging += 1;
			tech += 1;
			speed += 1;
			break;
		case 'Phase 3':
			rarity = 'rare';
			baseHire = 130;
			combat += 1;
			scavenging += 1;
			tech += 1;
			speed += 1;
			break;
		case 'Genesis':
		case 'Legendary':
			rarity = 'legendary';
			baseHire = 200;
			combat += 1;
			scavenging += 1;
			tech += 1;
			speed += 1;
			break;
		default:
			rarity = 'common';
			baseHire = 60;
			break;
	}

	// 7) Deterministic "jitter" based on attributes to break ties among similar gear
	const canonical = (attributes || [])
		.map((a) => `${lc(a.trait_type)}:${lc(a.value)}`)
		.sort()
		.join('|');

	const digest = crypto
		.createHash('sha256')
		.update('scablanders:stats:v2|' + canonical)
		.digest();
	const j0 = (digest[0] % 3) - 1; // -1..+1
	const j1 = (digest[1] % 3) - 1;
	const j2 = (digest[2] % 3) - 1;
	const j3 = (digest[3] % 3) - 1;

	combat += j0;
	scavenging += j1;
	tech += j2;
	speed += j3;

	// Final clamp to 1–8 and ensure integers
	const clamp18 = (n) => Math.max(1, Math.min(8, Math.round(n)));
	combat = clamp18(combat);
	scavenging = clamp18(scavenging);
	tech = clamp18(tech);
	speed = clamp18(speed);

	// Hire cost: base by rarity + scale by overall power
	const total = combat + scavenging + tech + speed; // 4..32
	const hireCost = Math.max(30, Math.round(baseHire + (total - 16) * 8));

	return { combat, scavenging, tech, speed, rarity, hireCost };
}

/**
 * Get total supply of the NFT collection
 */
async function getTotalSupply() {
	try {
		console.log('Getting total supply from Alchemy...');

		// Get NFT metadata to determine collection size
		const metadata = await alchemy.nft.getContractMetadata(FRINGE_DRIFTERS_CONTRACT);

		if (metadata.totalSupply) {
			return parseInt(metadata.totalSupply, 10);
		}

		// Fallback: try to get all tokens (this might be rate-limited)
		const tokens = await alchemy.nft.getNftsForContract(FRINGE_DRIFTERS_CONTRACT, {
			omitMetadata: true,
			limit: 100, // Start with a small sample to check
		});

		if (tokens.nfts && tokens.nfts.length > 0) {
			// Get the highest token ID as an approximation
			const maxTokenId = Math.max(...tokens.nfts.map((nft) => parseInt(nft.tokenId, 10)));
			console.log(`Detected max token ID: ${maxTokenId}, assuming total supply is around this number`);
			return maxTokenId;
		}

		// Final fallback: assume a reasonable number for Fringe Drifters
		console.warn('Could not determine total supply, defaulting to 5000');
		return 5000;
	} catch (error) {
		console.error('Error getting total supply:', error);
		console.warn('Defaulting to 5000 tokens');
		return 5000;
	}
}

/**
 * Ensure necessary directories exist for image operations
 */
async function ensureDirectories() {
	const dirs = [IMAGE_BASE_DIR, path.join(IMAGE_BASE_DIR, 'thumbnails'), path.join(IMAGE_BASE_DIR, 'tiny')];

	for (const dir of dirs) {
		try {
			await fs.mkdir(dir, { recursive: true });
		} catch (error) {
			console.error(`Failed to create directory ${dir}:`, error.message);
		}
	}
}

/**
 * Load existing drifters data or return null if not found
 */
async function loadExistingDrifters() {
	try {
		const data = await fs.readFile(OUTPUT_PATH, 'utf8');
		return JSON.parse(data);
	} catch (error) {
		console.warn(`Could not load existing drifters.json: ${error.message}`);
		return null;
	}
}

/**
 * Identify missing images from the drifters collection
 */
async function identifyMissingImages(drifters) {
	const missingTokens = [];
	const tokenIds = Object.keys(drifters);

	console.log(`\n🔍 Scanning for missing images in ${tokenIds.length} drifters...`);

	for (const tokenId of tokenIds) {
		const drifter = drifters[tokenId];
		if (!drifter.imageUrl) {
			console.warn(`No image URL for token ${tokenId}, skipping`);
			continue;
		}

		const fileName = `${tokenId}.jpeg`;
		const localPath = path.join(IMAGE_BASE_DIR, fileName);

		try {
			await fs.access(localPath);
			// File exists, check if it's valid (not corrupted/empty)
			const stats = await fs.stat(localPath);
			if (stats.size === 0) {
				console.warn(`Empty image file found for token ${tokenId}, marking for re-download`);
				missingTokens.push(tokenId);
			}
		} catch {
			// File doesn't exist
			missingTokens.push(tokenId);
		}
	}

	console.log(`Found ${missingTokens.length} missing images out of ${tokenIds.length} total`);
	return missingTokens;
}

/**
 * Identify original images that are missing thumbnails or tiny versions
 */
async function identifyMissingResizes(drifters) {
	const missingThumbs = [];
	const missingTiny = [];
	const tokenIds = Object.keys(drifters);

	console.log(`\n🔍 Scanning for missing resized images in ${tokenIds.length} drifters...`);

	for (const tokenId of tokenIds) {
		const fileName = `${tokenId}.jpeg`;
		const originalPath = path.join(IMAGE_BASE_DIR, fileName);
		const thumbPath = path.join(IMAGE_BASE_DIR, 'thumbnails', fileName);
		const tinyPath = path.join(IMAGE_BASE_DIR, 'tiny', fileName);

		// Check if original exists
		try {
			await fs.access(originalPath);

			// Check for missing thumbnail
			try {
				await fs.access(thumbPath);
			} catch {
				missingThumbs.push(tokenId);
			}

			// Check for missing tiny
			try {
				await fs.access(tinyPath);
			} catch {
				missingTiny.push(tokenId);
			}
		} catch {
			// Original doesn't exist, can't resize
			console.warn(`Original image missing for token ${tokenId}, skipping resize check`);
		}
	}

	console.log(`Found ${missingThumbs.length} missing thumbnails and ${missingTiny.length} missing tiny images`);

	// Return unique token IDs that need any type of resize
	const allMissingTokens = [...new Set([...missingThumbs, ...missingTiny])];

	return {
		missingThumbs,
		missingTiny,
		allMissingTokens,
	};
}

/**
 * Backfill resize mode: Create missing thumbnails/tiny images with corruption recovery
 */
async function backfillResize(drifters) {
	const { missingThumbs, missingTiny, allMissingTokens } = await identifyMissingResizes(drifters);

	if (allMissingTokens.length === 0) {
		console.log('\n✅ No missing resized images to create!');
		return {
			total: 0,
			thumbnail: { success: 0, failed: 0, redownloaded: 0 },
			tiny: { success: 0, failed: 0, redownloaded: 0 },
			failedResizes: [],
		};
	}

	const totalCount = allMissingTokens.length;
	let thumbSuccess = 0,
		thumbFail = 0,
		thumbRedownload = 0;
	let tinySuccess = 0,
		tinyFail = 0,
		tinyRedownload = 0;
	const failedResizes = [];

	console.log(`\n📐 Backfill Resize Mode: Processing ${totalCount} images...`);

	for (let i = 0; i < allMissingTokens.length; i += BATCH_SIZE) {
		const batch = allMissingTokens.slice(i, i + BATCH_SIZE);
		const batchPromises = batch.map(async (tokenId) => {
			const fileName = `${tokenId}.jpeg`;
			const originalPath = path.join(IMAGE_BASE_DIR, fileName);
			const thumbPath = path.join(IMAGE_BASE_DIR, 'thumbnails', fileName);
			const tinyPath = path.join(IMAGE_BASE_DIR, 'tiny', fileName);

			const needsThumb = missingThumbs.includes(tokenId);
			const needsTiny = missingTiny.includes(tokenId);

			// Function to attempt resize with corruption recovery
			const attemptResize = async (retryCount = 0) => {
				try {
					// Get original dimensions
					const metadata = await sharp(originalPath).metadata();
					const originalWidth = metadata.width;
					const originalHeight = metadata.height;

					// Create thumbnail if needed
					if (needsThumb) {
						const thumbWidth = Math.round(originalWidth * 0.3);
						const thumbHeight = Math.round(originalHeight * 0.3);
						await sharp(originalPath).resize(thumbWidth, thumbHeight).toFile(thumbPath);
						thumbSuccess++;
						console.log(`✅ Created thumbnail for token ${tokenId}`);
					}

					// Create tiny if needed
					if (needsTiny) {
						const tinyWidth = Math.round(originalWidth * 0.1);
						const tinyHeight = Math.round(originalHeight * 0.1);
						await sharp(originalPath).resize(tinyWidth, tinyHeight).toFile(tinyPath);
						tinySuccess++;
						console.log(`✅ Created tiny for token ${tokenId}`);
					}
				} catch (error) {
					// If resize fails, the original might be corrupted
					if (
						retryCount === 0 &&
						(error.message.includes('premature end') || error.message.includes('corrupt') || error.message.includes('invalid'))
					) {
						console.warn(`🔧 Corrupted image detected for token ${tokenId}, attempting re-download...`);

						const drifter = drifters[tokenId];
						if (drifter && drifter.imageUrl) {
							try {
								// Re-download the corrupted original
								const response = await fetch(drifter.imageUrl);
								if (!response.ok) {
									throw new Error(`HTTP ${response.status}: ${response.statusText}`);
								}

								const buffer = Buffer.from(await response.arrayBuffer());
								await fs.writeFile(originalPath, buffer);
								console.log(`✅ Re-downloaded corrupted image for token ${tokenId}`);

								if (needsThumb) {thumbRedownload++;}
								if (needsTiny) {tinyRedownload++;}

								// Retry the resize operation
								return await attemptResize(1);
							} catch (downloadError) {
								console.error(`Failed to re-download image for token ${tokenId}:`, downloadError.message);
								throw error; // Re-throw original resize error
							}
						} else {
							console.error(`No image URL found for token ${tokenId}, cannot re-download`);
							throw error;
						}
					} else {
						// Not a corruption error or already retried
						throw error;
					}
				}
			};

			try {
				await attemptResize();
			} catch (error) {
				console.error(`Failed to resize images for token ${tokenId}:`, error.message);
				if (needsThumb) {thumbFail++;}
				if (needsTiny) {tinyFail++;}
				failedResizes.push({ tokenId, reason: error.message });
			}
		});

		await Promise.all(batchPromises);

		// Progress update
		const processed = Math.min(i + BATCH_SIZE, allMissingTokens.length);
		const percent = Math.round((processed / totalCount) * 100);
		console.log(`Backfill progress: ${processed}/${totalCount} (${percent}%)`);

		// Delay between batches
		if (i + BATCH_SIZE < allMissingTokens.length) {
			await new Promise((resolve) => setTimeout(resolve, DELAY));
		}
	}

	return {
		total: totalCount,
		thumbnail: { success: thumbSuccess, failed: thumbFail, redownloaded: thumbRedownload },
		tiny: { success: tinySuccess, failed: tinyFail, redownloaded: tinyRedownload },
		failedResizes,
	};
}

/**
 * Download images only for specified token IDs (used in recovery mode)
 */
async function downloadMissingImages(drifters, missingTokenIds) {
	if (missingTokenIds.length === 0) {
		console.log('\n✅ No missing images to download!');
		return {
			total: 0,
			success: 0,
			skipped: 0,
			failed: 0,
			failedDownloads: [],
		};
	}

	const totalCount = missingTokenIds.length;
	let successCount = 0;
	let failCount = 0;
	const failedDownloads = [];

	console.log(`\n🔧 Recovery Mode: Downloading ${totalCount} missing images...`);

	for (let i = 0; i < missingTokenIds.length; i += BATCH_SIZE) {
		const batch = missingTokenIds.slice(i, i + BATCH_SIZE);
		const batchPromises = batch.map(async (tokenId) => {
			const drifter = drifters[tokenId];
			if (!drifter) {
				console.error(`No drifter data found for token ${tokenId}`);
				failCount++;
				failedDownloads.push({ tokenId, reason: 'No drifter data' });
				return;
			}

			const imageUrl = drifter.imageUrl;
			if (!imageUrl) {
				console.warn(`No image URL for token ${tokenId}, skipping`);
				failCount++;
				failedDownloads.push({ tokenId, reason: 'No image URL' });
				return;
			}

			const fileName = `${tokenId}.jpeg`;
			const localPath = path.join(IMAGE_BASE_DIR, fileName);

			try {
				console.log(`Downloading missing image for token ${tokenId}...`);
				const response = await fetch(imageUrl);
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const buffer = Buffer.from(await response.arrayBuffer());
				await fs.writeFile(localPath, buffer);
				successCount++;
				console.log(`✅ Downloaded image for token ${tokenId}`);
			} catch (error) {
				console.error(`Failed to download image for token ${tokenId}:`, error.message);
				failCount++;
				failedDownloads.push({ tokenId, reason: error.message });
			}
		});

		await Promise.all(batchPromises);

		// Progress update
		const processed = Math.min(i + BATCH_SIZE, missingTokenIds.length);
		const percent = Math.round((processed / totalCount) * 100);
		console.log(`Recovery progress: ${processed}/${totalCount} (${percent}%)`);

		// Delay between batches
		if (i + BATCH_SIZE < missingTokenIds.length) {
			await new Promise((resolve) => setTimeout(resolve, DELAY));
		}
	}

	return {
		total: totalCount,
		success: successCount,
		skipped: 0,
		failed: failCount,
		failedDownloads,
	};
}

/**
 * Download original images for drifters
 */
async function downloadImages(drifters) {
	const tokenIds = Object.keys(drifters);
	const totalCount = tokenIds.length;
	let successCount = 0;
	let skipCount = 0;
	let failCount = 0;
	const failedDownloads = [];

	console.log(`\n📥 Starting image download for ${totalCount} drifters...`);

	for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
		const batch = tokenIds.slice(i, i + BATCH_SIZE);
		const batchPromises = batch.map(async (tokenId) => {
			const drifter = drifters[tokenId];
			const imageUrl = drifter.imageUrl;

			if (!imageUrl) {
				console.warn(`No image URL for token ${tokenId}, skipping`);
				failCount++;
				failedDownloads.push({ tokenId, reason: 'No image URL' });
				return;
			}

			const fileName = `${tokenId}.jpeg`;
			const localPath = path.join(IMAGE_BASE_DIR, fileName);

			// Check if file exists and we're not forcing
			if (!options.forceImages) {
				try {
					await fs.access(localPath);
					skipCount++;
					return;
				} catch {
					// File doesn't exist, continue with download
				}
			}

			try {
				const response = await fetch(imageUrl);
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const buffer = Buffer.from(await response.arrayBuffer());
				await fs.writeFile(localPath, buffer);
				successCount++;
			} catch (error) {
				console.error(`Failed to download image for token ${tokenId}:`, error.message);
				failCount++;
				failedDownloads.push({ tokenId, reason: error.message });
			}
		});

		await Promise.all(batchPromises);

		// Progress update
		const processed = Math.min(i + BATCH_SIZE, tokenIds.length);
		const percent = Math.round((processed / totalCount) * 100);
		console.log(`Downloading images: ${processed}/${totalCount} (${percent}%)`);

		// Delay between batches
		if (i + BATCH_SIZE < tokenIds.length) {
			await new Promise((resolve) => setTimeout(resolve, DELAY));
		}
	}

	return {
		total: totalCount,
		success: successCount,
		skipped: skipCount,
		failed: failCount,
		failedDownloads,
	};
}

/**
 * Resize images to create thumbnails and tiny versions
 */
async function resizeImages(drifters) {
	const tokenIds = Object.keys(drifters);
	const totalCount = tokenIds.length;
	let thumbSuccess = 0,
		thumbSkip = 0,
		thumbFail = 0;
	let tinySuccess = 0,
		tinySkip = 0,
		tinyFail = 0;
	const failedResizes = [];

	console.log(`\n🔄 Starting image resize for ${totalCount} drifters...`);

	for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
		const batch = tokenIds.slice(i, i + BATCH_SIZE);
		const batchPromises = batch.map(async (tokenId) => {
			const fileName = `${tokenId}.jpeg`;
			const originalPath = path.join(IMAGE_BASE_DIR, fileName);
			const thumbPath = path.join(IMAGE_BASE_DIR, 'thumbnails', fileName);
			const tinyPath = path.join(IMAGE_BASE_DIR, 'tiny', fileName);

			// Check if original exists
			try {
				await fs.access(originalPath);
			} catch {
				console.warn(`Original image not found for token ${tokenId}, skipping resize`);
				thumbFail++;
				tinyFail++;
				failedResizes.push({ tokenId, reason: 'Original image not found' });
				return;
			}

			try {
				// Get original dimensions
				const metadata = await sharp(originalPath).metadata();
				const originalWidth = metadata.width;
				const originalHeight = metadata.height;

				// Create thumbnail (30%)
				const thumbWidth = Math.round(originalWidth * 0.3);
				const thumbHeight = Math.round(originalHeight * 0.3);

				if (!options.forceResize) {
					try {
						await fs.access(thumbPath);
						thumbSkip++;
					} catch {
						// File doesn't exist, create it
						await sharp(originalPath).resize(thumbWidth, thumbHeight).toFile(thumbPath);
						thumbSuccess++;
					}
				} else {
					await sharp(originalPath).resize(thumbWidth, thumbHeight).toFile(thumbPath);
					thumbSuccess++;
				}

				// Create tiny (10%)
				const tinyWidth = Math.round(originalWidth * 0.1);
				const tinyHeight = Math.round(originalHeight * 0.1);

				if (!options.forceResize) {
					try {
						await fs.access(tinyPath);
						tinySkip++;
					} catch {
						// File doesn't exist, create it
						await sharp(originalPath).resize(tinyWidth, tinyHeight).toFile(tinyPath);
						tinySuccess++;
					}
				} else {
					await sharp(originalPath).resize(tinyWidth, tinyHeight).toFile(tinyPath);
					tinySuccess++;
				}
			} catch (error) {
				console.error(`Failed to resize images for token ${tokenId}:`, error.message);
				thumbFail++;
				tinyFail++;
				failedResizes.push({ tokenId, reason: error.message });
			}
		});

		await Promise.all(batchPromises);

		// Progress update
		const processed = Math.min(i + BATCH_SIZE, tokenIds.length);
		const percent = Math.round((processed / totalCount) * 100);
		console.log(`Resizing images: ${processed}/${totalCount} (${percent}%)`);

		// Delay between batches
		if (i + BATCH_SIZE < tokenIds.length) {
			await new Promise((resolve) => setTimeout(resolve, DELAY));
		}
	}

	return {
		total: totalCount,
		thumbnail: { success: thumbSuccess, skipped: thumbSkip, failed: thumbFail },
		tiny: { success: tinySuccess, skipped: tinySkip, failed: tinyFail },
		failedResizes,
	};
}

/**
 * Main function to build the drifters.json file
 */
async function buildDriftersData() {
	console.log('🚀 Starting Fringe Drifters data build...');
	console.log(`Using contract: ${FRINGE_DRIFTERS_CONTRACT}`);

	if (TOKEN_LIMIT) {
		console.log(`🧪 TEST MODE: Limited to first ${TOKEN_LIMIT} tokens`);
	}

	console.log(`⚙️  Settings: Batch size: ${BATCH_SIZE}, Delay: ${DELAY}ms`);
	console.log(`📁 Output file: ${OUTPUT_PATH}`);

	try {
		// Get total supply or use limit
		let totalSupply = TOKEN_LIMIT || (await getTotalSupply());

		if (TOKEN_LIMIT && TOKEN_LIMIT < totalSupply) {
			totalSupply = TOKEN_LIMIT;
			console.log(`📊 Limited processing to: ${totalSupply} tokens`);
		} else {
			console.log(`📊 Total supply detected: ${totalSupply}`);
		}

		const drifters = {};

		for (let start = 1; start <= totalSupply; start += BATCH_SIZE) {
			const end = Math.min(start + BATCH_SIZE - 1, totalSupply);
			console.log(`\n📦 Processing batch ${start}-${end} (${Math.round((start / totalSupply) * 100)}% complete)`);

			// Process batch in parallel
			const promises = [];
			for (let tokenId = start; tokenId <= end; tokenId++) {
				promises.push(
					fetchMetadata(tokenId).then(async (metadata) => {
						if (!metadata) {
							return null;
						}

						// Compute stats
						const stats = computeStats(metadata.attributes || []);

						// Build drifter object
						const drifter = {
							tokenId: tokenId,
							name: metadata.name || `Drifter #${tokenId.toString().padStart(4, '0')}`,
							imageUrl: metadata.image || '',
							combat: stats.combat,
							scavenging: stats.scavenging,
							tech: stats.tech,
							speed: stats.speed,
							hireCost: stats.hireCost,
							rarity: stats.rarity,
							attributes: metadata.attributes || [],
						};

						return { tokenId, drifter };
					}),
				);
			}

			// Wait for batch to complete
			const results = await Promise.all(promises);

			// Add successful results to drifters object
			results.forEach((result) => {
				if (result && result.drifter) {
					drifters[result.tokenId.toString()] = result.drifter;
					console.log(
						`✅ Added ${result.drifter.name} (ID: ${result.tokenId}) - Stats: C:${result.drifter.combat} S:${result.drifter.scavenging} T:${result.drifter.tech} Sp:${result.drifter.speed}`,
					);
				}
			});

			// Delay between batches
			if (end < totalSupply) {
				console.log(`⏳ Waiting ${DELAY}ms before next batch...`);
				await new Promise((resolve) => setTimeout(resolve, DELAY));
			}
		}

		// Write the results to file
		console.log(`\n💾 Writing ${Object.keys(drifters).length} drifters to ${OUTPUT_PATH}...`);

		const jsonData = JSON.stringify(drifters, null, 2);
		await fs.writeFile(OUTPUT_PATH, jsonData, 'utf8');

		console.log('✅ Drifters data file built successfully!');

		return drifters;
	} catch (error) {
		console.error('❌ Error building drifters data:', error);
		process.exit(1);
	}
}

/**
 * Print statistics for drifters data
 */
function printDrifterStats(drifters) {
	const rarityCount = {};
	const statTotals = { combat: 0, scavenging: 0, tech: 0, speed: 0 };

	Object.values(drifters).forEach((drifter) => {
		rarityCount[drifter.rarity] = (rarityCount[drifter.rarity] || 0) + 1;
		statTotals.combat += drifter.combat;
		statTotals.scavenging += drifter.scavenging;
		statTotals.tech += drifter.tech;
		statTotals.speed += drifter.speed;
	});

	const totalDrifters = Object.keys(drifters).length;

	console.log('\n📈 Drifter Statistics:');
	console.log(`Total Drifters: ${totalDrifters}`);
	console.log('Rarity Distribution:');
	Object.entries(rarityCount).forEach(([rarity, count]) => {
		console.log(`  ${rarity}: ${count} (${((count / totalDrifters) * 100).toFixed(1)}%)`);
	});
	console.log('Average Stats:');
	console.log(`  Combat: ${(statTotals.combat / totalDrifters).toFixed(1)}`);
	console.log(`  Scavenging: ${(statTotals.scavenging / totalDrifters).toFixed(1)}`);
	console.log(`  Tech: ${(statTotals.tech / totalDrifters).toFixed(1)}`);
	console.log(`  Speed: ${(statTotals.speed / totalDrifters).toFixed(1)}`);
}

/**
 * Main execution flow
 */
async function main() {
	// Check what operations to perform
	const shouldRefreshMetadata = options.refreshMetadata;
	const shouldDownloadImages = options.downloadImages || options.forceImages;
	const shouldResizeImages = options.resizeImages || options.forceResize;
	const isRecoveryMode = options.recoveryMode;
	const isBackfillResize = options.backfillResize;

	// If no primary flags are set, show help
	if (
		!shouldRefreshMetadata &&
		!shouldDownloadImages &&
		!shouldResizeImages &&
		!isRecoveryMode &&
		!isBackfillResize &&
		!options.recomputeStats
	) {
		console.log('🤖 Scablanders Drifter Build Tool\n');
		console.log('No operations specified. Available options:');
		console.log('  --refresh-metadata    Fetch and rebuild drifters.json');
		console.log('  --download-images     Download original images');
		console.log('  --resize-images       Create thumbnails and tiny versions');
		console.log('  --force-images        Re-download existing images');
		console.log('  --force-resize        Re-create existing resized images');
		console.log('  --recovery-mode       Only download missing images (recovery mode)');
		console.log('  --backfill-resize     Create missing thumbnails/tiny images (backfill mode)');
		console.log('  --recompute-stats     Recompute stats from existing drifters.json (no API calls)');
		console.log('      [--dry-run]       Preview changes when used with --recompute-stats');
		console.log('\nExamples:');
		console.log('  node scripts/build-drifters.js --refresh-metadata --download-images --limit 10');
		console.log('  node scripts/build-drifters.js --recovery-mode  # Download only missing images');
		console.log('  node scripts/build-drifters.js --backfill-resize  # Create missing resized images');
		console.log('  node scripts/build-drifters.js --recompute-stats  # Recompute stats from attributes only');
		process.exit(0);
	}

	let drifters = {};

	// Exclusive mode: recompute stats only, no API calls
	if (options.recomputeStats) {
		if (shouldRefreshMetadata || shouldDownloadImages || shouldResizeImages || isRecoveryMode || isBackfillResize) {
			console.error('❌ --recompute-stats cannot be combined with other operations. Run it alone.');
			process.exit(1);
		}
		console.log('📖 Loading existing metadata for stat recomputation...');
		drifters = await loadExistingDrifters();
		if (!drifters) {
			console.error('❌ No existing drifters.json found. Use --refresh-metadata first.');
			process.exit(1);
		}
		const tokenIds = Object.keys(drifters);
		console.log(`🔄 Recomputing stats for ${tokenIds.length} drifters...`);
		let changed = 0;
		let skipped = 0;
		for (const tokenId of tokenIds) {
			const d = drifters[tokenId];
			const attrs = d.attributes || [];
			if (!Array.isArray(attrs) || attrs.length === 0) {
				skipped++;
				continue;
			}
			const prev = { combat: d.combat, scavenging: d.scavenging, tech: d.tech, speed: d.speed, rarity: d.rarity, hireCost: d.hireCost };
			const next = computeStats(attrs);
			d.combat = next.combat;
			d.scavenging = next.scavenging;
			d.tech = next.tech;
			d.speed = next.speed;
			d.hireCost = next.hireCost;
			d.rarity = next.rarity;
			if (
				prev.combat !== d.combat ||
				prev.scavenging !== d.scavenging ||
				prev.tech !== d.tech ||
				prev.speed !== d.speed ||
				prev.hireCost !== d.hireCost ||
				prev.rarity !== d.rarity
			) {
				changed++;
			}
		}
		if (options.dryRun) {
			console.log(`✅ Dry run complete. Would update ${changed} drifters. Skipped: ${skipped}.`);
			process.exit(0);
		}
		console.log(`💾 Writing updates to ${OUTPUT_PATH}...`);
		await fs.writeFile(OUTPUT_PATH, JSON.stringify(drifters, null, 2), 'utf8');
		console.log(`✅ Recompute complete. Updated ${changed} drifters. Skipped: ${skipped}.`);
		// Print brief distribution summary
		printDrifterStats(drifters);
		process.exit(0);
	}

	// Step 1: Handle metadata
	if (shouldRefreshMetadata) {
		console.log('🔄 Refreshing metadata...');
		drifters = await buildDriftersData();
	} else {
		console.log('📖 Loading existing metadata...');
		drifters = await loadExistingDrifters();
		if (!drifters) {
			console.error('❌ No existing drifters.json found. Use --refresh-metadata to create it.');
			process.exit(1);
		}
		console.log(`✅ Loaded ${Object.keys(drifters).length} drifters from existing data`);
	}

	// Ensure directories exist if we're doing image operations
	if (shouldDownloadImages || shouldResizeImages || isRecoveryMode || isBackfillResize) {
		console.log('📁 Creating image directories...');
		await ensureDirectories();
	}

	// Step 2: Download images (regular or recovery mode)
	let imageStats = null;
	if (isRecoveryMode) {
		// Recovery mode: identify and download only missing images
		const missingTokenIds = await identifyMissingImages(drifters);
		imageStats = await downloadMissingImages(drifters, missingTokenIds);
	} else if (shouldDownloadImages) {
		// Regular download mode
		imageStats = await downloadImages(drifters);
	}

	// Step 3: Resize images (regular or backfill mode)
	let resizeStats = null;
	if (isBackfillResize) {
		// Backfill mode: identify and create only missing resized images
		resizeStats = await backfillResize(drifters);
	} else if (shouldResizeImages) {
		// Regular resize mode
		resizeStats = await resizeImages(drifters);
	}

	// Print final summary
	console.log('\n🎉 Operation Complete!');

	if (shouldRefreshMetadata || (!shouldDownloadImages && !shouldResizeImages)) {
		printDrifterStats(drifters);
	}

	if (imageStats) {
		console.log('\n📥 Image Download Summary:');
		console.log(`  Downloaded: ${imageStats.success}`);
		console.log(`  Skipped: ${imageStats.skipped}`);
		console.log(`  Failed: ${imageStats.failed}`);
		if (imageStats.failed > 0) {
			console.log(`  Failed tokens: ${imageStats.failedDownloads.map((f) => f.tokenId).join(', ')}`);
		}
	}

	if (resizeStats) {
		const isBackfill = isBackfillResize;
		console.log(`\n🔄 Image Resize Summary ${isBackfill ? '(Backfill Mode)' : ''}:`);
		console.log('  Thumbnails:');
		console.log(`    Created: ${resizeStats.thumbnail.success}`);
		if (!isBackfill) {
			console.log(`    Skipped: ${resizeStats.thumbnail.skipped}`);
		} else if (resizeStats.thumbnail.redownloaded) {
			console.log(`    Re-downloaded originals: ${resizeStats.thumbnail.redownloaded}`);
		}
		console.log(`    Failed: ${resizeStats.thumbnail.failed}`);
		console.log('  Tiny versions:');
		console.log(`    Created: ${resizeStats.tiny.success}`);
		if (!isBackfill) {
			console.log(`    Skipped: ${resizeStats.tiny.skipped}`);
		} else if (resizeStats.tiny.redownloaded) {
			console.log(`    Re-downloaded originals: ${resizeStats.tiny.redownloaded}`);
		}
		console.log(`    Failed: ${resizeStats.tiny.failed}`);
		if (resizeStats.failedResizes.length > 0) {
			console.log(`  Failed tokens: ${resizeStats.failedResizes.map((f) => f.tokenId).join(', ')}`);
		}
	}
}

// Check if API key is needed and run main
if ((options.refreshMetadata || options.downloadImages || options.forceImages) && !ALCHEMY_API_KEY) {
	console.error('Error: ALCHEMY_API_KEY is required for metadata operations');
	console.error('Usage: node scripts/build-drifters.js --key <API_KEY> --refresh-metadata');
	console.error('Or set ALCHEMY_API_KEY environment variable');
	process.exit(1);
}

// Run the main function
main().catch((error) => {
	console.error('❌ Fatal error:', error);
	process.exit(1);
});
