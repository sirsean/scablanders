import { Hono } from 'hono';
import { authMiddleware, AuthVariables } from '../middleware/auth';
import { getVehicleRegistry } from '../data/vehicles';

const market = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// All market routes require authentication
market.use('*', authMiddleware);

// GET /api/market/vehicles - List all vehicles available for purchase
market.get('/vehicles', (c) => {
	const vehicleRegistry = getVehicleRegistry();
	const vehicles = Object.values(vehicleRegistry);
	return c.json({ vehicles });
});

// POST /api/market/vehicles/purchase - Purchase a vehicle
market.post('/vehicles/purchase', async (c) => {
	const playerAddress = c.get('playerAddress');
	if (!playerAddress) {
		return c.json({ error: 'Authentication required' }, 401);
	}

	const { vehicleId } = await c.req.json<{ vehicleId: string }>();
	if (!vehicleId) {
		return c.json({ error: 'vehicleId is required' }, 400);
	}

	const vehicleRegistry = getVehicleRegistry();
	const vehicleToPurchase = vehicleRegistry[vehicleId];

	if (!vehicleToPurchase) {
		return c.json({ error: 'Vehicle not found' }, 404);
	}

	// Forward the purchase logic to the GameDO
	const gameId = c.env.GAME_DO.idFromName('game');
	const gameStub = c.env.GAME_DO.get(gameId);

	const response = await gameStub.purchaseVehicle(playerAddress, vehicleToPurchase);

	if (!response.success) {
		return c.json({ error: response.error }, 400);
	}

	return c.json({ success: true, newBalance: response.newBalance });
});

export default market;
