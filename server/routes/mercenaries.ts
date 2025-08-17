import { Hono } from 'hono';
import { authMiddleware, AuthVariables } from '../middleware/auth';
import { getDrifterRegistry } from '../drifters';
import { getOwnedDrifters } from '../nft';

const mercenaries = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Apply auth middleware to all routes  
mercenaries.use('*', authMiddleware);

// GET /api/mercenaries - Get full mercenary list with adjusted hire costs
mercenaries.get('/', async (c) => {
  try {
    const playerAddress = c.get('playerAddress');
    let ownedTokenIds: number[] = [];

    // If authenticated, get owned tokens
    if (playerAddress) {
      try {
        ownedTokenIds = await getOwnedDrifters(playerAddress, c.env.KV, c.env.ALCHEMY_API_KEY);
      } catch (error) {
        console.error('Failed to fetch owned tokens:', error);
        // Continue with empty owned tokens - don't fail the request
      }
    }

    const registry = getDrifterRegistry();
    
    // Adjust hire costs based on ownership
    const mercenaries = Object.entries(registry).map(([tokenId, drifter]) => ({
      tokenId: parseInt(tokenId),
      ...drifter,
      // Set hire cost to 0 for owned tokens
      hireCost: ownedTokenIds.includes(parseInt(tokenId)) ? 0 : drifter.hireCost
    }));

    return c.json({ 
      mercenaries,
      ownedCount: ownedTokenIds.length,
      totalCount: mercenaries.length 
    });
  } catch (error) {
    console.error('Mercenaries error:', error);
    return c.json({ error: 'Failed to get mercenaries' }, 500);
  }
});

// GET /api/mercenaries/owned - Get only owned mercenaries
mercenaries.get('/owned', async (c) => {
  const playerAddress = c.get('playerAddress');
  
  if (!playerAddress) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const ownedTokenIds = await getOwnedDrifters(playerAddress, c.env.KV, c.env.ALCHEMY_API_KEY);
    const registry = getDrifterRegistry();
    
    const ownedMercenaries = ownedTokenIds
      .map(tokenId => ({
        tokenId,
        ...registry[tokenId.toString()],
        hireCost: 0 // Owned tokens have no hire cost
      }))
      .filter(merc => merc.combat !== undefined); // Filter out tokens not in registry

    return c.json({ 
      mercenaries: ownedMercenaries,
      count: ownedMercenaries.length 
    });
  } catch (error) {
    console.error('Owned mercenaries error:', error);
    return c.json({ error: 'Failed to get owned mercenaries' }, 500);
  }
});

// GET /api/mercenaries/:tokenId - Get specific mercenary details
mercenaries.get('/:tokenId', async (c) => {
  try {
    const tokenId = c.req.param('tokenId');
    const registry = getDrifterRegistry();
    const mercenary = registry[tokenId];
    
    if (!mercenary) {
      return c.json({ error: 'Mercenary not found' }, 404);
    }

    const playerAddress = c.get('playerAddress');
    let isOwned = false;
    
    // Check ownership if authenticated
    if (playerAddress) {
      try {
        const ownedTokenIds = await getOwnedDrifters(playerAddress, c.env.KV, c.env.ALCHEMY_API_KEY);
        isOwned = ownedTokenIds.includes(parseInt(tokenId));
      } catch (error) {
        console.error('Failed to check ownership:', error);
        // Continue without ownership info
      }
    }

    return c.json({
      tokenId: parseInt(tokenId),
      ...mercenary,
      hireCost: isOwned ? 0 : mercenary.hireCost,
      isOwned
    });
  } catch (error) {
    console.error('Get mercenary error:', error);
    return c.json({ error: 'Failed to get mercenary' }, 500);
  }
});

// POST /api/mercenaries/hire - Hire a mercenary for a mission
mercenaries.post('/hire', async (c) => {
  const playerAddress = c.get('playerAddress');
  
  if (!playerAddress) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json() as {
      tokenId: number;
      duration: number; // hours
    };

    const registry = getDrifterRegistry();
    const mercenary = registry[body.tokenId.toString()];
    
    if (!mercenary) {
      return c.json({ error: 'Mercenary not found' }, 404);
    }

    // Check if player owns this token
    const ownedTokenIds = await getOwnedDrifters(playerAddress, c.env.KV, c.env.ALCHEMY_API_KEY);
    const isOwned = ownedTokenIds.includes(body.tokenId);
    
    // Calculate hire cost
    const hourlyRate = isOwned ? 0 : mercenary.hireCost;
    const totalCost = hourlyRate * body.duration;

    // Get player's resources to check if they can afford it
    const playerId = c.env.PLAYER_DO.idFromName(playerAddress);
    const playerStub = c.env.PLAYER_DO.get(playerId);
    const profile = await playerStub.getProfile(playerAddress);

    if (!isOwned && profile.resources.credits < totalCost) {
      return c.json({ 
        error: 'Insufficient credits',
        required: totalCost,
        available: profile.resources.credits
      }, 400);
    }

    // Deduct credits if not owned
    if (!isOwned) {
      await playerStub.addResources({ credits: -totalCost });
    }

    return c.json({ 
      success: true,
      hired: {
        tokenId: body.tokenId,
        duration: body.duration,
        cost: totalCost,
        owned: isOwned
      }
    });
  } catch (error) {
    console.error('Hire mercenary error:', error);
    return c.json({ error: 'Failed to hire mercenary' }, 500);
  }
});

export default mercenaries;
