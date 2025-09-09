import { Hono } from 'hono';
import type { LeaderboardsResponse } from '@shared/leaderboards';

const leaderboards = new Hono<{ Bindings: Env }>();

// Public: GET /api/leaderboards
leaderboards.get('/', async (c) => {
  try {
    const gameId = c.env.GAME_DO.idFromName('game');
    const gameStub = c.env.GAME_DO.get(gameId);
    const data = (await (gameStub as any).getLeaderboards()) as LeaderboardsResponse;
    return c.json(data);
  } catch (err) {
    console.error('GET /api/leaderboards error:', err);
    return c.json({ error: 'Failed to load leaderboards' }, 500);
  }
});

export default leaderboards;

