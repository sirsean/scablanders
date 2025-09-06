import { Hono } from 'hono';
import { authMiddleware, AuthVariables } from '../middleware/auth';
import { getVehicleRegistry } from '../data/vehicles';
import { isVehicleUnlocked, requiredMarketLevel } from '../../shared/vehicle-tiers';

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

	// Access GameDO
	const gameId = c.env.GAME_DO.idFromName('game');
	const gameStub = c.env.GAME_DO.get(gameId);

	// Vehicle Market gating: check current market level
	try {
		const town = await (gameStub as any).getTownState();
		const marketLevel = town?.attributes?.vehicle_market?.level ?? 0;
		const reqLevel = requiredMarketLevel(vehicleId);
		if (!isVehicleUnlocked(vehicleId, marketLevel)) {
			return c.json({ error: `Vehicle Market level ${reqLevel} required to purchase this vehicle.` }, 400);
		}
	} catch (e) {
		console.warn('[Market] Failed to fetch Town state for gating; denying purchase as safe default.', e);
		return c.json({ error: 'Unable to verify Vehicle Market level. Please try again later.' }, 503);
	}

	// Forward the purchase logic to the GameDO
	const response = await gameStub.purchaseVehicle(playerAddress, vehicleToPurchase);

	if (!response.success) {
		return c.json({ error: response.error }, 400);
	}

	return c.json({ success: true, newBalance: response.newBalance });
});

export default market;
