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

    // Get GameDO
    const gameId = c.env.GAME_DO.idFromName('game');
    const gameStub = c.env.GAME_DO.get(gameId);

    // Start the mission through the GameDO
    const result = await gameStub.startMission(
      playerAddress,
      'scavenge', // Default mission type
      body.drifterIds,
      body.targetNodeId
    );

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }

    return c.json({ 
      success: true, 
      missionId: result.missionId
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

    // Get GameDO
    const gameId = c.env.GAME_DO.idFromName('game');
    const gameStub = c.env.GAME_DO.get(gameId);

    // For now, intercepting is not implemented in the single GameDO
    // This would need to be added as a method to GameDO
    return c.json({ error: 'Mission interception not yet implemented' }, 501);

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

    // Get GameDO
    const gameId = c.env.GAME_DO.idFromName('game');
    const gameStub = c.env.GAME_DO.get(gameId);
    
    const mission = await gameStub.getMission(body.missionId);
    if (!mission) {
      return c.json({ error: 'Mission not found' }, 404);
    }

    // Complete the mission
    const result = await gameStub.completeMission(body.missionId);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
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
    
    // Get GameDO
    const gameId = c.env.GAME_DO.idFromName('game');
    const gameStub = c.env.GAME_DO.get(gameId);

    const mission = await gameStub.getMission(missionId);
    
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
    
    // Get GameDO
    const gameId = c.env.GAME_DO.idFromName('game');
    const gameStub = c.env.GAME_DO.get(gameId);
    
    // Get player missions directly from GameDO
    const missions = await gameStub.getPlayerMissions(playerAddress);

    return c.json({ missions });
  } catch (error) {
    console.error('Get player missions error:', error);
    return c.json({ error: 'Failed to get player missions' }, 500);
  }
});

export default missions;
