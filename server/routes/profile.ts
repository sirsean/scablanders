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
    
    // Get real player profile from PlayerDO
    const playerId = c.env.PLAYER_DO.idFromName(playerAddress);
    const playerStub = c.env.PLAYER_DO.get(playerId);
    
    // Update owned Drifters from NFT lookup
    await playerStub.updateOwnedDrifters(ownedDrifters);
    
    // Get updated profile
    const authenticatedProfile = await playerStub.getProfile(playerAddress);
    
    return c.json(authenticatedProfile);
    
  } catch (error) {
    console.error('Profile endpoint error:', error);
    return c.json({ error: 'Failed to load profile' }, 500);
  }
});

export default profile;
