import { Hono } from 'hono';
import { authMiddleware, requireAuth, AuthVariables } from '../middleware/auth';

const town = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

town.use('*', authMiddleware);

// GET /api/town - get current town state
// Auth optional: unauthenticated users can still see town status

town.get('/', async (c) => {
	try {
		const gameId = c.env.GAME_DO.idFromName('game');
		const gameStub = c.env.GAME_DO.get(gameId);
		const townState = await (gameStub as any).getTownState();
		return c.json({ town: townState });
	} catch (err) {
		console.error('GET /api/town error:', err);
		return c.json({ error: 'Failed to load town state' }, 500);
	}
});

// POST /api/town/contribute - contribute credits to a town attribute (or repair walls)
// Body: { attribute: 'vehicle_market' | 'perimeter_walls', amount: number }

town.post('/contribute', requireAuth, async (c) => {
	try {
		const playerAddress = c.get('playerAddress')!;
		const body = await c.req.json<{ attribute: 'vehicle_market' | 'perimeter_walls'; amount: number }>();

		if (!body || !body.attribute || typeof body.amount !== 'number' || body.amount <= 0) {
			return c.json({ error: 'Invalid request' }, 400);
		}

		const gameId = c.env.GAME_DO.idFromName('game');
		const gameStub = c.env.GAME_DO.get(gameId);

		const result = await (gameStub as any).contributeToTown(playerAddress, body.attribute, Math.floor(body.amount));

		if (!result || result.error) {
			return c.json({ error: result?.error || 'Contribution failed' }, 400);
		}

		return c.json({ success: true, town: result.town, balance: result.newBalance });
	} catch (err) {
		console.error('POST /api/town/contribute error:', err);
		return c.json({ error: 'Failed to contribute to town' }, 500);
	}
});

export default town;
