import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GameDO } from './game-do';

// Import Hono route modules
import auth from './routes/auth';
import profile from './routes/profile';
import world from './routes/world';
import missions from './routes/missions';
import market from './routes/market';
import logs from './routes/logs';
import drifters from './routes/drifters';

import { getPlayerOwnedDrifters } from './nft';
import { handleWebSocket } from './websocket';

/**
 * Scablanders Game Worker
 *
 * Hono-based API server that coordinates with Durable Objects
 * for persistent game state management.
 */

// Create the main Hono app
const app = new Hono<{ Bindings: Env }>();

// Configure CORS middleware
app.use(
	'/*',
	cors({
		origin: 'http://localhost:5173',
		allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
		allowMethods: ['GET', 'POST', 'OPTIONS'],
		credentials: true,
	}),
);

// Health check endpoint
app.get('/api/health', async (c) => {
	try {
		// Test GameDO connection
		const gameId = c.env.GAME_DO.idFromName('game');
		const gameStub = c.env.GAME_DO.get(gameId);
		const stats = await gameStub.getStats();

		return c.json({
			status: 'healthy',
			timestamp: new Date().toISOString(),
			gameConnected: true,
			...stats,
		});
	} catch (error) {
		console.error('Health check error:', error);
		return c.json(
			{
				status: 'degraded',
				timestamp: new Date().toISOString(),
				error: 'Failed to connect to services',
			},
			503,
		);
	}
});

// Test NFT endpoint (for development only)
app.get('/api/test-nft/:address', async (c) => {
	const address = c.req.param('address');

	if (!address) {
		return c.json({ error: 'Ethereum address required' }, 400);
	}

	try {
		console.log(`Testing NFT ownership for address: ${address}`);

		const ownedDrifters = await getPlayerOwnedDrifters(address, c.env);

		return c.json({
			address,
			ownedDrifters,
			count: ownedDrifters.length,
			alchemyApiKeyConfigured: !!c.env.ALCHEMY_API_KEY,
		});
	} catch (error) {
		console.error('Test NFT endpoint error:', error);
		return c.json(
			{
				error: 'Failed to test NFT ownership',
				details: error.message,
				alchemyApiKeyConfigured: !!c.env.ALCHEMY_API_KEY,
			},
			500,
		);
	}
});

// Debug endpoint for mission troubleshooting (development only)
app.get('/api/debug/missions/:address?', async (c) => {
	try {
		const gameId = c.env.GAME_DO.idFromName('game');
		const gameStub = c.env.GAME_DO.get(gameId);
		const address = c.req.param('address');

		const stats = await gameStub.getStats();
		const allMissions = await gameStub.getActiveMissions();

		let playerInfo = null;
		if (address) {
			const profile = await gameStub.getProfile(address);
			const playerMissions = await gameStub.getPlayerMissions(address);
			playerInfo = {
				address,
				activeMissionIds: profile.activeMissions,
				retrievedMissions: playerMissions.length,
				missions: playerMissions,
			};
		}

		return c.json({
			timestamp: new Date().toISOString(),
			globalStats: stats,
			allActiveMissions: allMissions.length,
			missionDetails: allMissions.map((m) => ({
				id: m.id,
				playerAddress: m.playerAddress,
				status: m.status,
				type: m.type,
			})),
			playerInfo,
		});
	} catch (error) {
		console.error('Debug missions error:', error);
		return c.json({ error: 'Debug failed', details: error.message }, 500);
	}
});

// Cleanup endpoint for orphaned missions (development only)
app.post('/api/debug/cleanup-missions', async (c) => {
	try {
		const gameId = c.env.GAME_DO.idFromName('game');
		const gameStub = c.env.GAME_DO.get(gameId);

		const result = await gameStub.cleanupOrphanedMissions();

		return c.json({
			success: true,
			...result,
		});
	} catch (error) {
		console.error('Cleanup missions error:', error);
		return c.json({ error: 'Cleanup failed', details: error.message }, 500);
	}
});

// Mount route handlers
app.route('/api/auth', auth);
app.route('/api/profile', profile);
app.route('/api/world', world);
app.route('/api/missions', missions);
app.route('/api/market', market);
app.route('/api/logs', logs);
app.route('/api/drifters', drifters);

// 404 handler for unmatched API routes
app.notFound((c) => {
	return c.json({ error: 'API endpoint not found' }, 404);
});

// Error handler
app.onError((err, c) => {
	console.error('Server error:', err);
	return c.json({ error: 'Internal server error' }, 500);
});

// Export Durable Object classes
export { GameDO };

// Main worker export that handles both HTTP and WebSocket requests
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		// Check if this is a WebSocket upgrade request
		const upgradeHeader = request.headers.get('Upgrade');
		if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
			// Handle WebSocket upgrade through GameDO
			if (new URL(request.url).pathname === '/ws') {
				const gameId = env.GAME_DO.idFromName('game');
				const gameStub = env.GAME_DO.get(gameId);
				return gameStub.fetch(request);
			}
		}

		// Handle regular HTTP requests with Hono
		return app.fetch(request, env, ctx);
	},
};
