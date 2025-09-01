import { Hono } from 'hono';
import { authMiddleware, requireAuth, getPlayerAddress, AuthVariables } from '../middleware/auth';
import { getPlayerOwnedDrifters, getOwnedDrifters } from '../nft';
import { getDrifterRegistry } from '../drifters';

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
				vehicles: [],
				discoveredNodes: [],
				upgrades: [],
				lastLogin: new Date(),
			};

			return c.json(mockProfile);
		}

		// Get owned Drifters from NFT ownership
		const ownedTokenIds = await getOwnedDrifters(playerAddress, c.env.KV, c.env.ALCHEMY_API_KEY);
		const drifterRegistry = getDrifterRegistry();
		const ownedDrifters = ownedTokenIds.map((tokenId) => ({
			tokenId,
			...drifterRegistry[tokenId.toString()],
		}));

		// Get real player profile from GameDO
		const gameId = c.env.GAME_DO.idFromName('game');
		const gameStub = c.env.GAME_DO.get(gameId);

		// Update owned Drifters from NFT lookup
		await gameStub.updateOwnedDrifters(playerAddress, ownedDrifters);

		// Get updated profile
		const authenticatedProfile = await gameStub.getProfile(playerAddress);

		// Add full drifter details to the profile
		authenticatedProfile.ownedDrifters = ownedDrifters;

		return c.json(authenticatedProfile);
	} catch (error) {
		console.error('Profile endpoint error:', error);
		return c.json({ error: 'Failed to load profile' }, 500);
	}
});

export default profile;
