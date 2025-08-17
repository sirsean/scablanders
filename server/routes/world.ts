import { Hono } from 'hono';
import { authMiddleware, AuthVariables } from '../middleware/auth';

const world = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Apply auth middleware to all routes
world.use('*', authMiddleware);

// GET /api/world/state - Get full world state
world.get('/state', async (c) => {
  try {
    // Get the singleton WorldDO
    const worldId = c.env.WORLD_DO.idFromName('world');
    const worldStub = c.env.WORLD_DO.get(worldId);
    
    const worldState = await worldStub.getWorldState();
    
    return c.json(worldState);
  } catch (error) {
    console.error('World state error:', error);
    return c.json({ error: 'Failed to get world state' }, 500);
  }
});

// GET /api/world/resources - Get resource nodes (filtered by discoveries)
world.get('/resources', async (c) => {
  try {
    const worldId = c.env.WORLD_DO.idFromName('world');
    const worldStub = c.env.WORLD_DO.get(worldId);
    
    let discoveredNodes: string[] = [];
    const playerAddress = c.get('playerAddress');
    
    if (playerAddress) {
      // Get player's discovered nodes from PlayerDO
      const playerId = c.env.PLAYER_DO.idFromName(playerAddress);
      const playerStub = c.env.PLAYER_DO.get(playerId);
      const profile = await playerStub.getProfile(playerAddress);
      discoveredNodes = profile.discoveredNodes;
    }
    
    const resources = await worldStub.listResources(discoveredNodes);
    
    return c.json({ resources });
  } catch (error) {
    console.error('Resources error:', error);
    return c.json({ error: 'Failed to get resources' }, 500);
  }
});

// GET /api/world/missions - Get active missions list
world.get('/missions', async (c) => {
  try {
    const worldId = c.env.WORLD_DO.idFromName('world');
    const worldStub = c.env.WORLD_DO.get(worldId);
    
    // Get query parameter for player filtering
    const playerAddress = c.req.query('player');
    
    const missions = await worldStub.listActiveMissions(playerAddress || undefined);
    
    return c.json({ missions });
  } catch (error) {
    console.error('Missions error:', error);
    return c.json({ error: 'Failed to get missions' }, 500);
  }
});

export default world;
