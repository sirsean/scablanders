import { DurableObject } from 'cloudflare:workers';
import { generateNonce } from 'siwe';
import type { 
  PlayerProfile, 
  Mission, 
  ResourceNode, 
  WorldState,
  StartMissionRequest,
  StartMissionResponse 
} from '@shared/models';
import { getPlayerOwnedDrifters } from './nft';
import { getAvailableMercenaries } from './drifters';

/**
 * Scablanders Game Worker
 * 
 * Handles all API routes and coordinates with Durable Objects
 * for persistent game state management.
 */

// Placeholder World Durable Object - will be expanded in Phase 3
export class MyDurableObject extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  // Placeholder method - will be replaced with proper game logic
  async sayHello(name: string): Promise<string> {
    return `Hello from the Scablands, ${name}! The harsh desert awaits your expeditions.`;
  }

  // Placeholder for future world state methods
  async getWorldState(): Promise<WorldState> {
    return {
      resources: [],
      activeMissions: [],
      townMetrics: {
        prosperity: 50,
        security: 50,
        population: 100,
        upgradeLevel: 1
      },
      lastUpdate: new Date()
    };
  }
}

// API route handler
async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS headers for development
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Route API requests
    if (path.startsWith('/api/')) {
      const response = await routeApiCall(path, method, request, env);
      
      // Add CORS headers to all API responses
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    }

    // Default response for non-API routes
    return new Response('Not found', { status: 404, headers: corsHeaders });
    
  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Route API calls to appropriate handlers
async function routeApiCall(path: string, method: string, request: Request, env: Env): Promise<Response> {
  const segments = path.split('/').filter(s => s.length > 0);
  
  // Remove 'api' prefix
  const [, ...apiPath] = segments;
  
  switch (apiPath[0]) {
    case 'health':
      return handleHealthCheck(env);
    
    case 'auth':
      return handleAuth(apiPath, method, request, env);
    
    case 'profile':
      return handleProfile(method, request, env);
    
    case 'world':
      return handleWorld(apiPath, method, request, env);
    
    case 'mission':
      return handleMission(apiPath, method, request, env);
    
    case 'mercenaries':
    case 'mercs':
      return handleMercenaries(method, request, env);
    
    case 'test-nft':
      return handleTestNft(apiPath, method, request, env);
    
    default:
      return new Response(
        JSON.stringify({ error: 'API endpoint not found' }), 
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
  }
}

// Health check endpoint
async function handleHealthCheck(env: Env): Promise<Response> {
  // Test Durable Object connection
  const id = env.MY_DURABLE_OBJECT.idFromName('world');
  const stub = env.MY_DURABLE_OBJECT.get(id);
  const greeting = await stub.sayHello('health-check');
  
  return new Response(
    JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      message: greeting 
    }), 
    { headers: { 'Content-Type': 'application/json' } }
  );
}

// Auth endpoints - SIWE implementation
async function handleAuth(path: string[], method: string, request: Request, env: Env): Promise<Response> {
  const endpoint = path[1];
  
  // Create KV adapters for auth storage
  const nonceStore = {
    async get(key: string) {
      return await env.AUTH_KV.get(key);
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      return await env.AUTH_KV.put(key, value, options);
    },
    async delete(key: string) {
      return await env.AUTH_KV.delete(key);
    }
  };
  
  switch (endpoint) {
    case 'nonce':
      if (method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
      }
      
      try {
        const nonce = generateNonce();
        
        // Store nonce with 5 minute expiration
        await nonceStore.put(`nonce:${nonce}`, 'valid', { expirationTtl: 300 });
        
        return new Response(
          JSON.stringify({ 
            nonce,
            message: `Welcome to Scablanders!\n\nSign this message to authenticate with your wallet.\n\nNonce: ${nonce}`
          }), 
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('Nonce generation error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to generate nonce' }), 
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    
    case 'verify':
      if (method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      
      try {
        const body = await request.json();
        const { message, signature } = body;
        
        if (!message || !signature) {
          return new Response(
            JSON.stringify({ success: false, error: 'Message and signature required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        const { verifySiweSignature, createSessionToken } = await import('./auth');
        
        const result = await verifySiweSignature(message, signature, nonceStore);
        
        if (!result.success) {
          return new Response(
            JSON.stringify({ success: false, error: result.error }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // Create session token
        const token = createSessionToken(result.address!);
        
        // Set secure HTTP-only cookie
        const response = new Response(
          JSON.stringify({ 
            success: true, 
            address: result.address 
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
        
        response.headers.set(
          'Set-Cookie', 
          `CF_ACCESS_TOKEN=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`
        );
        
        return response;
        
      } catch (error) {
        console.error('Auth verification error:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Authentication failed' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    
    case 'logout':
      if (method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      
      const response = new Response(
        JSON.stringify({ success: true }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      // Clear the auth cookie
      response.headers.set(
        'Set-Cookie', 
        'CF_ACCESS_TOKEN=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
      );
      
      return response;
    
    default:
      return new Response('Auth endpoint not found', { status: 404 });
  }
}

// Profile endpoint - authenticated
async function handleProfile(method: string, request: Request, env: Env): Promise<Response> {
  if (method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    // Check authentication
    const { createAuthMiddleware } = await import('./auth');
    const auth = createAuthMiddleware({} as any); // Simplified for now
    const authResult = await auth(request);
    
    if (authResult.error || !authResult.address) {
      // Return mock profile for unauthenticated users
      const mockProfile = {
        address: '0x0000000000000000000000000000000000000000',
        balance: 0,
        ownedDrifters: [],
        discoveredNodes: [],
        upgrades: [],
        lastLogin: new Date()
      };
      
      return new Response(
        JSON.stringify(mockProfile), 
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get owned Drifters from NFT ownership
    let ownedDrifters: number[] = [];
    try {
      ownedDrifters = await getPlayerOwnedDrifters(authResult.address, env);
    } catch (error) {
      console.error('Failed to fetch owned Drifters:', error);
      // Continue with empty array on error
    }
    
    // TODO: Get real player profile from PlayerDO in Phase 3
    const authenticatedProfile = {
      address: authResult.address,
      balance: 1000, // Starting balance for authenticated users
      ownedDrifters, // Real NFT ownership data
      discoveredNodes: [], // TODO: Load from persistent storage
      upgrades: [], // TODO: Load from persistent storage
      lastLogin: new Date()
    };
    
    return new Response(
      JSON.stringify(authenticatedProfile), 
      { headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Profile endpoint error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to load profile' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// World state endpoints (placeholder)
async function handleWorld(path: string[], method: string, request: Request, env: Env): Promise<Response> {
  const endpoint = path[1];
  
  switch (endpoint) {
    case 'state':
      if (method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
      }
      
      const id = env.MY_DURABLE_OBJECT.idFromName('world');
      const stub = env.MY_DURABLE_OBJECT.get(id);
      const worldState = await stub.getWorldState();
      
      return new Response(
        JSON.stringify(worldState), 
        { headers: { 'Content-Type': 'application/json' } }
      );
    
    default:
      return new Response('World endpoint not found', { status: 404 });
  }
}

// Mission endpoints (placeholder)
async function handleMission(path: string[], method: string, request: Request, env: Env): Promise<Response> {
  const endpoint = path[1];
  
  switch (endpoint) {
    case 'start':
      if (method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      // TODO: Implement mission starting in Phase 4
      return new Response(
        JSON.stringify({ success: false, error: 'Not implemented yet' }), 
        { headers: { 'Content-Type': 'application/json' } }
      );
    
    default:
      return new Response('Mission endpoint not found', { status: 404 });
  }
}

// Mercenaries endpoint - authenticated
async function handleMercenaries(method: string, request: Request, env: Env): Promise<Response> {
  if (method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    // Check authentication
    const { createAuthMiddleware } = await import('./auth');
    const auth = createAuthMiddleware({} as any); // Simplified for now
    const authResult = await auth(request);
    
    if (authResult.error || !authResult.address) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get available mercenaries for this player
    const mercenaries = await getAvailableMercenaries(authResult.address, env);
    
    return new Response(
      JSON.stringify({ mercenaries }), 
      { headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Mercenaries endpoint error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to load mercenaries' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Test NFT endpoint (for development only)
async function handleTestNft(path: string[], method: string, request: Request, env: Env): Promise<Response> {
  if (method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const endpoint = path[1]; // Should be the Ethereum address to test
  
  if (!endpoint) {
    return new Response(
      JSON.stringify({ error: 'Usage: GET /api/test-nft/[ethereum_address]' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    console.log(`Testing NFT ownership for address: ${endpoint}`);
    
    const ownedDrifters = await getPlayerOwnedDrifters(endpoint, env);
    
    return new Response(
      JSON.stringify({ 
        address: endpoint,
        ownedDrifters,
        count: ownedDrifters.length,
        alchemyApiKeyConfigured: !!env.ALCHEMY_API_KEY
      }), 
      { headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Test NFT endpoint error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to test NFT ownership',
        details: error.message,
        alchemyApiKeyConfigured: !!env.ALCHEMY_API_KEY
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    return handleApiRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
