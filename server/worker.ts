import { DurableObject } from 'cloudflare:workers';
import type { 
  PlayerProfile, 
  Mission, 
  ResourceNode, 
  WorldState,
  StartMissionRequest,
  StartMissionResponse 
} from '@shared/models';

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
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

// Auth endpoints (placeholder for Phase 2)
async function handleAuth(path: string[], method: string, request: Request, env: Env): Promise<Response> {
  const endpoint = path[1];
  
  switch (endpoint) {
    case 'nonce':
      if (method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
      }
      return new Response(
        JSON.stringify({ 
          nonce: Math.random().toString(36).substring(7),
          message: 'Sign this message to authenticate with Scablanders' 
        }), 
        { headers: { 'Content-Type': 'application/json' } }
      );
    
    case 'verify':
      if (method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }
      // TODO: Implement SIWE verification in Phase 2
      return new Response(
        JSON.stringify({ success: false, error: 'Not implemented yet' }), 
        { headers: { 'Content-Type': 'application/json' } }
      );
    
    default:
      return new Response('Auth endpoint not found', { status: 404 });
  }
}

// Profile endpoint (placeholder)
async function handleProfile(method: string, request: Request, env: Env): Promise<Response> {
  if (method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  // TODO: Get actual player profile in Phase 2
  const mockProfile = {
    address: '0x0000000000000000000000000000000000000000',
    balance: 500,
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

export default {
  async fetch(request, env, ctx): Promise<Response> {
    return handleApiRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
