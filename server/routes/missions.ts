import { Hono } from 'hono';
import { authMiddleware, requireAuth, AuthVariables } from '../middleware/auth';

const missions = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Apply auth middleware to all routes
missions.use('*', authMiddleware);

// POST /api/missions/start - Start a new mission
missions.post('/start', requireAuth, async (c) => {
  try {
    const playerAddress = c.get('playerAddress')!;
    const body = await c.req.json() as {
      drifterIds: number[];
      targetNodeId: string;
    };

    // Get PlayerDO and WorldDO
    const playerId = c.env.PLAYER_DO.idFromName(playerAddress);
    const playerStub = c.env.PLAYER_DO.get(playerId);
    const worldId = c.env.WORLD_DO.idFromName('world');
    const worldStub = c.env.WORLD_DO.get(worldId);

    // Start the mission through the WorldDO
    const result = await worldStub.startMission({
      playerAddress,
      drifterIds: body.drifterIds,
      targetNodeId: body.targetNodeId
    });

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }

    // Update player's active missions
    await playerStub.addActiveMission(result.mission!.id);

    return c.json({ 
      success: true, 
      mission: result.mission,
      estimatedDuration: result.estimatedDuration 
    });
  } catch (error) {
    console.error('Start mission error:', error);
    return c.json({ error: 'Failed to start mission' }, 500);
  }
});

// POST /api/missions/intercept - Intercept another player's mission
missions.post('/intercept', requireAuth, async (c) => {
  try {
    const playerAddress = c.get('playerAddress')!;
    const body = await c.req.json() as {
      missionId: string;
      drifterId: number;
    };

    // Get WorldDO
    const worldId = c.env.WORLD_DO.idFromName('world');
    const worldStub = c.env.WORLD_DO.get(worldId);

    // Intercept the mission
    const result = await worldStub.interceptMission({
      missionId: body.missionId,
      interceptorAddress: playerAddress,
      drifterId: body.drifterId
    });

    // Update player's active missions
    const playerId = c.env.PLAYER_DO.idFromName(playerAddress);
    const playerStub = c.env.PLAYER_DO.get(playerId);
    await playerStub.addActiveMission(body.missionId);

    return c.json({ success: true, result });
  } catch (error) {
    console.error('Intercept mission error:', error);
    return c.json({ error: 'Failed to intercept mission' }, 500);
  }
});

// POST /api/missions/complete - Complete a mission (usually called by alarm)
missions.post('/complete', requireAuth, async (c) => {
  try {
    const body = await c.req.json() as {
      missionId: string;
    };

    // Get WorldDO to fetch mission info first
    const worldId = c.env.WORLD_DO.idFromName('world');
    const worldStub = c.env.WORLD_DO.get(worldId);
    
    const mission = await worldStub.getMission(body.missionId);
    if (!mission) {
      return c.json({ error: 'Mission not found' }, 404);
    }

    // Complete the mission
    const result = await worldStub.completeMission(body.missionId);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    // Update player's mission list and reward them
    const playerId = c.env.PLAYER_DO.idFromName(mission.playerAddress);
    const playerStub = c.env.PLAYER_DO.get(playerId);
    await playerStub.removeActiveMission(body.missionId);
    
    // Add loot as resources (convert to resource map)
    if (result.lootAmount && result.resourceType) {
      const resources = { [result.resourceType]: result.lootAmount };
      await playerStub.addResources(resources);
    }

    return c.json({ success: true, result });
  } catch (error) {
    console.error('Complete mission error:', error);
    return c.json({ error: 'Failed to complete mission' }, 500);
  }
});

// GET /api/missions/:id - Get specific mission details
missions.get('/:id', async (c) => {
  try {
    const missionId = c.req.param('id');
    
    // Get WorldDO
    const worldId = c.env.WORLD_DO.idFromName('world');
    const worldStub = c.env.WORLD_DO.get(worldId);

    const mission = await worldStub.getMission(missionId);
    
    if (!mission) {
      return c.json({ error: 'Mission not found' }, 404);
    }

    return c.json({ mission });
  } catch (error) {
    console.error('Get mission error:', error);
    return c.json({ error: 'Failed to get mission' }, 500);
  }
});

// GET /api/missions/player/:address - Get missions for specific player
missions.get('/player/:address', async (c) => {
  try {
    const playerAddress = c.req.param('address');
    
    // Get PlayerDO
    const playerId = c.env.PLAYER_DO.idFromName(playerAddress);
    const playerStub = c.env.PLAYER_DO.get(playerId);
    const profile = await playerStub.getProfile(playerAddress);

    // Get WorldDO to fetch full mission details
    const worldId = c.env.WORLD_DO.idFromName('world');
    const worldStub = c.env.WORLD_DO.get(worldId);

    const missions = [];
    for (const missionId of profile.activeMissions) {
      const mission = await worldStub.getMission(missionId);
      if (mission) {
        missions.push(mission);
      }
    }

    return c.json({ missions });
  } catch (error) {
    console.error('Get player missions error:', error);
    return c.json({ error: 'Failed to get player missions' }, 500);
  }
});

export default missions;
