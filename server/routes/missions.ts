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
    missionType: 'scavenge' | 'strip_mine' | 'combat' | 'sabotage';
  };

    // Get GameDO
    const gameId = c.env.GAME_DO.idFromName('game');
    const gameStub = c.env.GAME_DO.get(gameId);

    // Start the mission through the GameDO
    const result = await gameStub.startMission(
      playerAddress,
      body.missionType,
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

// POST /api/missions/complete - Complete a mission (usually called by alarm or for testing)
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

    console.log(`[API] Manually completing mission ${body.missionId} for testing`);
    
    // Complete the mission with force flag - this will trigger WebSocket updates automatically
    const result = await gameStub.completeMission(body.missionId, true);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ 
      success: true, 
      result,
      message: 'Mission completed successfully - WebSocket updates sent'
    });
  } catch (error) {
    console.error('Complete mission error:', error);
    return c.json({ error: 'Failed to complete mission' }, 500);
  }
});

// POST /api/missions/complete-oldest - Complete the oldest active mission for current player (dev tool)
missions.post('/complete-oldest', requireAuth, async (c) => {
  try {
    const playerAddress = c.get('playerAddress')!;
    
    // Get GameDO
    const gameId = c.env.GAME_DO.idFromName('game');
    const gameStub = c.env.GAME_DO.get(gameId);
    
    // Get player's missions
    const playerMissions = await gameStub.getPlayerMissions(playerAddress);
    const activeMissions = playerMissions.filter(m => m.status === 'active');
    
    if (activeMissions.length === 0) {
      return c.json({ error: 'No active missions to complete' }, 404);
    }
    
    // Find oldest mission
    const oldestMission = activeMissions.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )[0];
    
    console.log(`[API] Auto-completing oldest mission ${oldestMission.id} for player ${playerAddress}`);
    
    // Complete the mission with force flag
    const result = await gameStub.completeMission(oldestMission.id, true);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ 
      success: true, 
      completedMission: oldestMission,
      result,
      message: 'Oldest mission completed successfully'
    });
  } catch (error) {
    console.error('Complete oldest mission error:', error);
    return c.json({ error: 'Failed to complete oldest mission' }, 500);
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

// POST /api/missions/trigger-resource-management - Manually trigger resource management (dev tool)
missions.post('/trigger-resource-management', requireAuth, async (c) => {
  try {
    // Get GameDO
    const gameId = c.env.GAME_DO.idFromName('game');
    const gameStub = c.env.GAME_DO.get(gameId);
    
    console.log('[API] Manually triggering resource management');
    
    // Trigger resource management
    const result = await gameStub.triggerResourceManagement();

    return c.json({ 
      success: true, 
      summary: result.summary,
      message: 'Resource management cycle completed - check logs for details'
    });
  } catch (error) {
    console.error('Trigger resource management error:', error);
    return c.json({ error: 'Failed to trigger resource management' }, 500);
  }
});

export default missions;
