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

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract address and configuration
const FRINGE_DRIFTERS_CONTRACT = '0xe3B399AAb015D2C0D787ECAd40410D88f4f4cA50';
const METADATA_BASE_URL = 'https://omniscient.fringedrifters.com/main/metadata';

// Setup CLI
const program = new Command();
program
  .name('build-drifters')
  .description('Build drifters.json file from Fringe Drifters NFT metadata')
  .option('-k, --key <alchemy_key>', 'Alchemy API key (or use ALCHEMY_API_KEY env var)')
  .option('-l, --limit <number>', 'Limit number of tokens to process (for testing)', parseInt)
  .option('-o, --output <path>', 'Output file path', path.join(__dirname, '../server/data/drifters.json'))
  .option('-b, --batch-size <number>', 'Batch size for processing', parseInt, 10)
  .option('-d, --delay <number>', 'Delay between batches (ms)', parseInt, 100)
  .parse();

const options = program.opts();

// Get API key from CLI option or environment
const ALCHEMY_API_KEY = options.key || process.env.ALCHEMY_API_KEY;

if (!ALCHEMY_API_KEY) {
    console.error('Error: ALCHEMY_API_KEY is required');
    console.error('Usage: node scripts/build-drifters.js --key <API_KEY>');
    console.error('Or set ALCHEMY_API_KEY environment variable');
    program.help();
}

// Configuration
const OUTPUT_PATH = options.output;
const TOKEN_LIMIT = options.limit;
const BATCH_SIZE = options.batchSize;
const DELAY = options.delay;

// Initialize Alchemy
const alchemy = new Alchemy({
    apiKey: ALCHEMY_API_KEY,
    network: Network.ETH_MAINNET,
});

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
 * This maps the NFT attributes to game stats
 */
function computeStats(attributes) {
    // Initialize base stats
    let combat = 5;
    let scavenging = 5;
    let tech = 5;
    let speed = 5;
    let rarity = 'common';
    let hireCost = 50;

    // Convert attributes array to map for easier lookup
    const attrMap = {};
    attributes.forEach(attr => {
        attrMap[attr.trait_type] = attr.value;
    });

    // Class-based stat modifiers
    const classType = attrMap['Class'] || 'Drifter';
    switch (classType.toLowerCase()) {
        case 'drifter':
            // Balanced stats
            break;
        case 'scavenger':
            scavenging += 2;
            tech += 1;
            combat -= 1;
            break;
        case 'warrior':
            combat += 3;
            speed += 1;
            tech -= 1;
            scavenging -= 1;
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
    }

    // Location-based modifiers
    const location = attrMap['Location'];
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
    }

    // Suit-based modifiers
    const suit = attrMap['Suit'];
    if (suit) {
        if (suit.includes('Combat') || suit.includes('Armor')) {
            combat += 1;
        }
        if (suit.includes('Tech') || suit.includes('Circuit')) {
            tech += 1;
        }
        if (suit.includes('Scout') || suit.includes('Light')) {
            speed += 1;
        }
        if (suit.includes('Scrap') || suit.includes('Salvage')) {
            scavenging += 1;
        }
    }

    // Backpack-based modifiers
    const backpack = attrMap['Backpack'];
    if (backpack) {
        if (backpack.includes('Combat') || backpack.includes('Weapon')) {
            combat += 1;
        }
        if (backpack.includes('Tech') || backpack.includes('Data')) {
            tech += 1;
        }
        if (backpack.includes('Speed') || backpack.includes('Boost')) {
            speed += 1;
        }
        if (backpack.includes('Scrap') || backpack.includes('Salvage')) {
            scavenging += 1;
        }
    }

    // Accessory-based modifiers
    const accessory = attrMap['Accessory'];
    if (accessory) {
        if (accessory.includes('Weapon') || accessory.includes('Blade')) {
            combat += 1;
        }
        if (accessory.includes('Scanner') || accessory.includes('Computer')) {
            tech += 1;
        }
        if (accessory.includes('Boost') || accessory.includes('Engine')) {
            speed += 1;
        }
        if (accessory.includes('Tool') || accessory.includes('Kit')) {
            scavenging += 1;
        }
    }

    // Phase-based rarity and stat bonuses
    const phase = attrMap['Phase'];
    switch (phase) {
        case 'Phase 1':
            rarity = 'common';
            hireCost = 50;
            break;
        case 'Phase 2':
            rarity = 'uncommon';
            hireCost = 100;
            // Small stat boost
            combat += 1;
            scavenging += 1;
            tech += 1;
            speed += 1;
            break;
        case 'Phase 3':
            rarity = 'rare';
            hireCost = 150;
            // Moderate stat boost
            combat += 2;
            scavenging += 2;
            tech += 2;
            speed += 2;
            break;
        case 'Genesis':
        case 'Legendary':
            rarity = 'legendary';
            hireCost = 300;
            // Large stat boost
            combat += 3;
            scavenging += 3;
            tech += 3;
            speed += 3;
            break;
    }

    // Special graphic-based bonuses
    const graphic = attrMap['Graphic'];
    if (graphic) {
        if (graphic.includes('Guild') || graphic.includes('Elite')) {
            // Guild members get small bonuses
            combat += 1;
            tech += 1;
            hireCost += 20;
        }
        if (graphic.includes('Legendary') || graphic.includes('Apex')) {
            rarity = 'legendary';
            hireCost = Math.max(hireCost, 250);
        }
    }

    // Ensure stats are within reasonable bounds (3-10)
    combat = Math.max(3, Math.min(10, combat));
    scavenging = Math.max(3, Math.min(10, scavenging));
    tech = Math.max(3, Math.min(10, tech));
    speed = Math.max(3, Math.min(10, speed));

    // Adjust hire cost based on total stats
    const totalStats = combat + scavenging + tech + speed;
    const statMultiplier = Math.floor(totalStats / 4); // Average stat as multiplier
    hireCost = Math.max(30, hireCost + (statMultiplier * 10));

    return {
        combat,
        scavenging,
        tech,
        speed,
        rarity,
        hireCost
    };
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
            limit: 100 // Start with a small sample to check
        });
        
        if (tokens.nfts && tokens.nfts.length > 0) {
            // Get the highest token ID as an approximation
            const maxTokenId = Math.max(...tokens.nfts.map(nft => parseInt(nft.tokenId, 10)));
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
        let totalSupply = TOKEN_LIMIT || await getTotalSupply();
        
        if (TOKEN_LIMIT && TOKEN_LIMIT < totalSupply) {
            totalSupply = TOKEN_LIMIT;
            console.log(`📊 Limited processing to: ${totalSupply} tokens`);
        } else {
            console.log(`📊 Total supply detected: ${totalSupply}`);
        }
        
        const drifters = {};
        
        for (let start = 1; start <= totalSupply; start += BATCH_SIZE) {
            const end = Math.min(start + BATCH_SIZE - 1, totalSupply);
            console.log(`\n📦 Processing batch ${start}-${end} (${Math.round(start/totalSupply*100)}% complete)`);
            
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
                            attributes: metadata.attributes || []
                        };
                        
                        return { tokenId, drifter };
                    })
                );
            }
            
            // Wait for batch to complete
            const results = await Promise.all(promises);
            
            // Add successful results to drifters object
            results.forEach(result => {
                if (result && result.drifter) {
                    drifters[result.tokenId.toString()] = result.drifter;
                    console.log(`✅ Added ${result.drifter.name} (ID: ${result.tokenId}) - Stats: C:${result.drifter.combat} S:${result.drifter.scavenging} T:${result.drifter.tech} Sp:${result.drifter.speed}`);
                }
            });
            
            // Delay between batches
            if (end < totalSupply) {
                console.log(`⏳ Waiting ${DELAY}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, DELAY));
            }
        }
        
        // Write the results to file
        console.log(`\n💾 Writing ${Object.keys(drifters).length} drifters to ${OUTPUT_PATH}...`);
        
        const jsonData = JSON.stringify(drifters, null, 2);
        await fs.writeFile(OUTPUT_PATH, jsonData, 'utf8');
        
        console.log('✅ Drifters data file built successfully!');
        
        // Print some statistics
        const rarityCount = {};
        const statTotals = { combat: 0, scavenging: 0, tech: 0, speed: 0 };
        
        Object.values(drifters).forEach(drifter => {
            rarityCount[drifter.rarity] = (rarityCount[drifter.rarity] || 0) + 1;
            statTotals.combat += drifter.combat;
            statTotals.scavenging += drifter.scavenging;
            statTotals.tech += drifter.tech;
            statTotals.speed += drifter.speed;
        });
        
        const totalDrifters = Object.keys(drifters).length;
        
        console.log('\n📈 Statistics:');
        console.log(`Total Drifters: ${totalDrifters}`);
        console.log('Rarity Distribution:');
        Object.entries(rarityCount).forEach(([rarity, count]) => {
            console.log(`  ${rarity}: ${count} (${(count/totalDrifters*100).toFixed(1)}%)`);
        });
        console.log('Average Stats:');
        console.log(`  Combat: ${(statTotals.combat/totalDrifters).toFixed(1)}`);
        console.log(`  Scavenging: ${(statTotals.scavenging/totalDrifters).toFixed(1)}`);
        console.log(`  Tech: ${(statTotals.tech/totalDrifters).toFixed(1)}`);
        console.log(`  Speed: ${(statTotals.speed/totalDrifters).toFixed(1)}`);
        
    } catch (error) {
        console.error('❌ Error building drifters data:', error);
        process.exit(1);
    }
}

// Run the script
buildDriftersData();
