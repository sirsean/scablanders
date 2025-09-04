import { Hono } from 'hono';
import { authMiddleware, requireAuth, AuthVariables } from '../middleware/auth';

const drifters = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

drifters.use('*', authMiddleware);

// GET /api/drifters/progress?ids=1,2,3
// Returns drifter progress records for the provided token IDs (if any)
drifters.get('/progress', requireAuth, async (c) => {
	try {
		const playerAddress = c.get('playerAddress')!;
		const idsParam = c.req.query('ids');
		const ids = idsParam
			? idsParam
					.split(',')
					.map((s) => s.trim())
					.filter((s) => s.length > 0)
					.map((s) => Number(s))
					.filter((n) => Number.isFinite(n))
			: [];

		const gameId = c.env.GAME_DO.idFromName('game');
		const gameStub = c.env.GAME_DO.get(gameId);

		// Optionally, restrict to the caller's owned drifters for privacy
		const progress = await gameStub.getDrifterProgress(ids);

		// Filter to owned drifters only
		const ownedIds = new Set((await gameStub.getProfile(playerAddress)).ownedDrifters.map((d: any) => d.tokenId));
		const filtered: Record<string, any> = {};
		for (const [k, v] of Object.entries(progress)) {
			if (ownedIds.has(Number(k))) {
				filtered[k] = v;
			}
		}

		return c.json({ progress: filtered });
	} catch (err) {
		console.error('Progress error:', err);
		return c.json({ error: 'Failed to get progress' }, 500);
	}
});

// POST /api/drifters/allocate-point
// Body: { tokenId: number; attribute: 'combat'|'scavenging'|'tech'|'speed' }
drifters.post('/allocate-point', requireAuth, async (c) => {
	try {
		const playerAddress = c.get('playerAddress')!;
		const body = (await c.req.json()) as { tokenId: number; attribute: 'combat' | 'scavenging' | 'tech' | 'speed' };

		if (!body || !Number.isFinite(body.tokenId) || !body.attribute) {
			return c.json({ error: 'Invalid request' }, 400);
		}

		const gameId = c.env.GAME_DO.idFromName('game');
		const gameStub = c.env.GAME_DO.get(gameId);

		const result = await (gameStub as any).allocateBonusPoint(playerAddress, Number(body.tokenId), body.attribute);
		if (!result.success) {
			return c.json({ success: false, error: result.error || 'Allocation failed' }, 400);
		}

		return c.json({ success: true, progress: result.progress });
	} catch (err) {
		console.error('Allocate point error:', err);
		return c.json({ error: 'Failed to allocate point' }, 500);
	}
});

export default drifters;
