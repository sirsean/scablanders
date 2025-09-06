import { Hono } from 'hono';
import { authMiddleware, AuthVariables } from '../middleware/auth';

const world = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Apply auth middleware to all routes
world.use('*', authMiddleware);

// GET /api/world/state - Get full world state
world.get('/state', async (c) => {
	try {
		// Get the singleton GameDO
		const gameId = c.env.GAME_DO.idFromName('game');
		const gameStub = c.env.GAME_DO.get(gameId);

const [resourceNodes, activeMissions, worldMetrics, town, monsters] = await Promise.all([
			gameStub.getResourceNodes(),
			gameStub.getActiveMissions(),
			gameStub.getWorldMetrics(),
			gameStub.getTownState(),
			gameStub.getMonsters(),
		]);

		return c.json({ resourceNodes, activeMissions, worldMetrics, town, monsters });
	} catch (error) {
		console.error('World state error:', error);
		return c.json({ error: 'Failed to get world state' }, 500);
	}
});

// GET /api/world/resources - Get resource nodes (filtered by discoveries)
world.get('/resources', async (c) => {
	try {
		const gameId = c.env.GAME_DO.idFromName('game');
		const gameStub = c.env.GAME_DO.get(gameId);

		let discoveredNodes: string[] = [];
		const playerAddress = c.get('playerAddress');

		if (playerAddress) {
			// Get player's discovered nodes from GameDO
			const profile = await gameStub.getProfile(playerAddress);
			discoveredNodes = profile.discoveredNodes;
		}

		// Get all resources (for now, no filtering by discoveries)
		const resources = await gameStub.getResourceNodes();

		// Filter resources by discovered nodes if player is authenticated
		const filteredResources = playerAddress
			? resources.filter((r) => discoveredNodes.includes(r.id) || discoveredNodes.length === 0)
			: resources; // Show all if not authenticated (for development)

		return c.json({ resources: filteredResources });
	} catch (error) {
		console.error('Resources error:', error);
		return c.json({ error: 'Failed to get resources' }, 500);
	}
});

// GET /api/world/missions - Get active missions list
world.get('/missions', async (c) => {
	try {
		const gameId = c.env.GAME_DO.idFromName('game');
		const gameStub = c.env.GAME_DO.get(gameId);

		// Get query parameter for player filtering
		const playerAddress = c.req.query('player');

		let missions;
		if (playerAddress) {
			missions = await gameStub.getPlayerMissions(playerAddress);
		} else {
			missions = await gameStub.getActiveMissions();
		}

		return c.json({ missions });
	} catch (error) {
		console.error('Missions error:', error);
		return c.json({ error: 'Failed to get missions' }, 500);
	}
});

// POST /api/world/debug/trigger-resource-management - Manually trigger resource management
world.post('/debug/trigger-resource-management', async (c) => {
	try {
		const gameId = c.env.GAME_DO.idFromName('game');
		const gameStub = c.env.GAME_DO.get(gameId);

		console.log('[DEBUG] Manually triggering resource management');
		const result = await gameStub.triggerResourceManagement();

		return c.json({
			success: result.success,
			summary: result.summary,
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error('Debug trigger error:', error);
		return c.json({ error: 'Failed to trigger resource management' }, 500);
	}
});

export default world;
