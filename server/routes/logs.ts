import { Hono } from 'hono';
import { authMiddleware, AuthVariables } from '../middleware/auth';

const logs = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// We allow unauthenticated access for now (global log), but keep middleware for consistency
logs.use('*', authMiddleware);

// GET /api/logs - Global event log (newest first)
logs.get('/', async (c) => {
	try {
		const limitParam = c.req.query('limit');
		const limit = limitParam ? Math.max(1, Math.min(1000, parseInt(limitParam, 10) || 1000)) : 1000;

		const gameId = c.env.GAME_DO.idFromName('game');
		const gameStub = c.env.GAME_DO.get(gameId);

		const events = await (gameStub as any).getEventLog(limit);
		return c.json({ events });
	} catch (error) {
		console.error('Logs endpoint error:', error);
		return c.json({ error: 'Failed to fetch event logs' }, 500);
	}
});

export default logs;
