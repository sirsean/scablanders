import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WorldDO } from './world-do';
import { PlayerDO } from './player-do';

// Import Hono route modules
import auth from './routes/auth';
import profile from './routes/profile';
import world from './routes/world';
import missions from './routes/missions';
import mercenaries from './routes/mercenaries';
import { getPlayerOwnedDrifters } from './nft';

/**
 * Scablanders Game Worker
 * 
 * Hono-based API server that coordinates with Durable Objects
 * for persistent game state management.
 */

// Create the main Hono app
const app = new Hono<{ Bindings: Env }>();

// Configure CORS middleware
app.use('/*', cors({
  origin: 'http://localhost:5173',
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}));

// Health check endpoint
app.get('/api/health', async (c) => {
  try {
    // Test WorldDO connection
    const worldId = c.env.WORLD_DO.idFromName('world');
    const worldStub = c.env.WORLD_DO.get(worldId);
    const worldState = await worldStub.getWorldState();
    
    return c.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      worldConnected: true,
      activeMissions: worldState.activeMissions.length
    });
  } catch (error) {
    console.error('Health check error:', error);
    return c.json({ 
      status: 'degraded', 
      timestamp: new Date().toISOString(),
      error: 'Failed to connect to services'
    }, 503);
  }
});

// Test NFT endpoint (for development only)
app.get('/api/test-nft/:address', async (c) => {
  const address = c.req.param('address');
  
  if (!address) {
    return c.json({ error: 'Ethereum address required' }, 400);
  }
  
  try {
    console.log(`Testing NFT ownership for address: ${address}`);
    
    const ownedDrifters = await getPlayerOwnedDrifters(address, c.env);
    
    return c.json({ 
      address,
      ownedDrifters,
      count: ownedDrifters.length,
      alchemyApiKeyConfigured: !!c.env.ALCHEMY_API_KEY
    });
    
  } catch (error) {
    console.error('Test NFT endpoint error:', error);
    return c.json({ 
      error: 'Failed to test NFT ownership',
      details: error.message,
      alchemyApiKeyConfigured: !!c.env.ALCHEMY_API_KEY
    }, 500);
  }
});

// Mount route handlers
app.route('/api/auth', auth);
app.route('/api/profile', profile);
app.route('/api/world', world);
app.route('/api/missions', missions);
app.route('/api/mercenaries', mercenaries);
app.route('/api/mercs', mercenaries); // Alias for mercenaries

// 404 handler for unmatched API routes
app.notFound((c) => {
  return c.json({ error: 'API endpoint not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});




// Export Durable Object classes
export { WorldDO, PlayerDO };

export default app;
