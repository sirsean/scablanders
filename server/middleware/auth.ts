import { Context, Next } from 'hono';
import { createAuthMiddleware } from '../auth';

/**
 * Hono middleware for authentication
 * Checks for valid JWT tokens and adds player address to context
 */
export interface AuthVariables {
  playerAddress?: string;
}

export const authMiddleware = async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
  try {
    const auth = createAuthMiddleware({} as any);
    const result = await auth(c.req.raw);
    
    if (result.address && !result.error) {
      // Set authenticated player address in context
      c.set('playerAddress', result.address);
    }
    
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    await next();
  }
};

/**
 * Middleware that requires authentication
 * Returns 401 if not authenticated
 */
export const requireAuth = async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
  const playerAddress = c.get('playerAddress');
  
  if (!playerAddress) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  await next();
};

/**
 * Helper to get authenticated player address from context
 */
export const getPlayerAddress = (c: Context<{ Variables: AuthVariables }>): string => {
  const address = c.get('playerAddress');
  if (!address) {
    throw new Error('Player not authenticated');
  }
  return address;
};
