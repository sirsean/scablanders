import { Hono } from 'hono';
import { authMiddleware, requireAuth, getPlayerAddress, AuthVariables } from '../middleware/auth';
import { getPlayerOwnedDrifters } from '../nft';

const profile = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Apply auth middleware to all routes
profile.use('*', authMiddleware);

// GET /api/profile - Get player profile
profile.get('/', async (c) => {
  try {
    const playerAddress = c.get('playerAddress');
    
    if (!playerAddress) {
      // Return mock profile for unauthenticated users
      const mockProfile = {
        address: '0x0000000000000000000000000000000000000000',
        balance: 0,
        ownedDrifters: [],
        discoveredNodes: [],
        upgrades: [],
        lastLogin: new Date()
      };
      
      return c.json(mockProfile);
    }
    
    // Get owned Drifters from NFT ownership
    let ownedDrifters: number[] = [];
    try {
      ownedDrifters = await getPlayerOwnedDrifters(playerAddress, c.env);
    } catch (error) {
      console.error('Failed to fetch owned Drifters:', error);
      // Continue with empty array on error
    }
    
    // Get real player profile from GameDO
    const gameId = c.env.GAME_DO.idFromName('game');
    const gameStub = c.env.GAME_DO.get(gameId);
    
    // Update owned Drifters from NFT lookup
    await gameStub.updateOwnedDrifters(playerAddress, ownedDrifters);
    
    // Get updated profile
    const authenticatedProfile = await gameStub.getProfile(playerAddress);
    
    return c.json(authenticatedProfile);
    
  } catch (error) {
    console.error('Profile endpoint error:', error);
    return c.json({ error: 'Failed to load profile' }, 500);
  }
});

export default profile;
