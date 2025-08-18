import { GameWebSocketMessage } from '@/shared/models';
import { parseSessionToken } from './auth';

interface WebSocketSession {
  websocket: WebSocket;
  playerAddress?: string;
  authenticated: boolean;
  lastPing: number;
}

// Global map to track WebSocket connections
const activeSessions = new Map<string, WebSocketSession>();

/**
 * Handle WebSocket upgrade request and manage connections
 */
export function handleWebSocket(request: Request, env: Env): Response {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected websocket upgrade', { status: 426 });
  }

  // Try to authenticate using session cookie
  let playerAddress: string | undefined;
  let authenticated = false;
  
  console.log('[WS] New WebSocket connection attempt');
  
  try {
    const cookieHeader = request.headers.get('Cookie');
    console.log('[WS] Cookie header:', cookieHeader);
    
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim());
      console.log('[WS] Parsed cookies:', cookies);
      
      const authCookie = cookies.find(c => c.startsWith('CF_ACCESS_TOKEN='));
      console.log('[WS] Auth cookie found:', !!authCookie);
      
      if (authCookie) {
        const token = authCookie.split('=')[1];
        console.log('[WS] Extracted token length:', token?.length);
        
        const session = parseSessionToken(token);
        console.log('[WS] Parsed session:', session);
        
        if (session && session.address) {
          playerAddress = session.address;
          authenticated = true;
          console.log('[WS] Authentication successful for player:', playerAddress);
        } else {
          console.log('[WS] Session parsing failed or no address found');
        }
      } else {
        console.log('[WS] No CF_ACCESS_TOKEN cookie found');
      }
    } else {
      console.log('[WS] No cookie header found');
    }
  } catch (error) {
    console.error('[WS] Authentication error:', error);
  }

  // Create WebSocket pair
  const [client, server] = Object.values(new WebSocketPair());

  // Accept the WebSocket connection
  server.accept();

  // Create session
  const sessionId = crypto.randomUUID();
  const session: WebSocketSession = {
    websocket: server,
    playerAddress,
    authenticated,
    lastPing: Date.now()
  };

  activeSessions.set(sessionId, session);

  // Set up WebSocket event handlers
  server.addEventListener('message', async (event) => {
    try {
      const message = JSON.parse(event.data as string);
      await handleWebSocketMessage(sessionId, message, env);
    } catch (error) {
      console.error('WebSocket message error:', error);
      sendToSession(sessionId, {
        type: 'error',
        timestamp: new Date(),
        data: { message: 'Invalid message format' }
      });
    }
  });

  server.addEventListener('close', async () => {
    console.log(`WebSocket session ${sessionId} closed`);
    activeSessions.delete(sessionId);
    
    // Notify GameDO that session is closed
    try {
      const gameId = env.GAME_DO.idFromName('game');
      const gameStub = env.GAME_DO.get(gameId);
      await gameStub.removeWebSocketConnection(sessionId);
    } catch (error) {
      console.error('[WS] Error removing WebSocket connection:', error);
    }
  });

  server.addEventListener('error', async (error) => {
    console.error(`WebSocket session ${sessionId} error:`, error);
    activeSessions.delete(sessionId);
    
    // Notify GameDO that session had an error
    try {
      const gameId = env.GAME_DO.idFromName('game');
      const gameStub = env.GAME_DO.get(gameId);
      await gameStub.removeWebSocketConnection(sessionId);
    } catch (error) {
      console.error('[WS] Error removing WebSocket connection:', error);
    }
  });

  // Send initial connection status
  sendToSession(sessionId, {
    type: 'connection_status',
    timestamp: new Date(),
    data: {
      status: 'connected',
      authenticated
    }
  });

  // Register with GameDO and set up subscriptions
  setTimeout(async () => {
    try {
      console.log(`[WS] Registering session ${sessionId} with GameDO`);
      
      const gameId = env.GAME_DO.idFromName('game');
      const gameStub = env.GAME_DO.get(gameId);
      
      // Register session with GameDO (without WebSocket object)
      await gameStub.addWebSocketSession(sessionId, playerAddress, authenticated);
      
      // Send subscription confirmed message
      sendToSession(sessionId, {
        type: 'subscription_confirmed',
        timestamp: new Date(),
        data: { events: ['player_state', 'world_state'] }
      });
      
      console.log(`[WS] Session ${sessionId} registered successfully with GameDO`);
    } catch (error) {
      console.error('[WS] Error registering with GameDO:', error);
    }
  }, 100); // Small delay to ensure WebSocket is fully set up

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

/**
 * Handle incoming WebSocket messages from clients
 */
async function handleWebSocketMessage(sessionId: string, message: any, env: Env) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  switch (message.type) {
    case 'authenticate':
      await handleAuthentication(sessionId, message.token, env);
      break;
    
    case 'ping':
      session.lastPing = Date.now();
      sendToSession(sessionId, {
        type: 'pong',
        timestamp: new Date()
      });
      break;
    
    case 'subscribe':
      if (session.authenticated) {
        await handleSubscription(sessionId, message.events, env);
      } else {
        sendToSession(sessionId, {
          type: 'error',
          timestamp: new Date(),
          data: { message: 'Authentication required for subscriptions' }
        });
      }
      break;

    default:
      sendToSession(sessionId, {
        type: 'error',
        timestamp: new Date(),
        data: { message: `Unknown message type: ${message.type}` }
      });
  }
}

/**
 * Authenticate WebSocket session using session token
 */
async function handleAuthentication(sessionId: string, token: string, env: Env) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  try {
    // Verify JWT token (simplified - you might want to use the same auth logic from your routes)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const playerAddress = payload.address;

    if (playerAddress && typeof playerAddress === 'string') {
      session.playerAddress = playerAddress;
      session.authenticated = true;

      sendToSession(sessionId, {
        type: 'connection_status',
        timestamp: new Date(),
        data: {
          status: 'connected',
          authenticated: true
        }
      });

      // Register the authenticated session with GameDO
      const gameId = env.GAME_DO.idFromName('game');
      const gameStub = env.GAME_DO.get(gameId);
      await gameStub.addWebSocketSession(sessionId, playerAddress, true);

      console.log(`WebSocket session ${sessionId} authenticated for player ${playerAddress}`);
    } else {
      throw new Error('Invalid token payload');
    }
  } catch (error) {
    console.error('WebSocket authentication error:', error);
    sendToSession(sessionId, {
      type: 'connection_status',
      timestamp: new Date(),
      data: {
        status: 'connected',
        authenticated: false
      }
    });
  }
}

/**
 * Handle subscription requests for specific event types
 */
async function handleSubscription(sessionId: string, events: string[], env: Env) {
  const session = activeSessions.get(sessionId);
  if (!session || !session.authenticated || !session.playerAddress) return;

  // All subscriptions are handled by GameDO - no additional work needed here
  // The GameDO already registered this session and will send appropriate events
  console.log(`[WS] Session ${sessionId} subscribed to events:`, events);

  sendToSession(sessionId, {
    type: 'subscription_confirmed',
    timestamp: new Date(),
    data: { events }
  });
}

/**
 * Send message to specific WebSocket session
 */
export function sendToSession(sessionId: string, message: GameWebSocketMessage) {
  const session = activeSessions.get(sessionId);
  if (session && session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
    session.websocket.send(JSON.stringify(message));
  }
}

/**
 * Broadcast message to all authenticated sessions
 */
export function broadcastToAll(message: GameWebSocketMessage) {
  for (const [sessionId, session] of activeSessions) {
    if (session.authenticated && session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
      session.websocket.send(JSON.stringify(message));
    }
  }
}

/**
 * Broadcast message to specific player
 */
export function sendToPlayer(playerAddress: string, message: GameWebSocketMessage) {
  for (const [sessionId, session] of activeSessions) {
    if (session.playerAddress === playerAddress && 
        session.websocket.readyState === WebSocket.READY_STATE_OPEN) {
      session.websocket.send(JSON.stringify(message));
    }
  }
}

/**
 * Clean up inactive sessions (called periodically)
 */
export function cleanupInactiveSessions() {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes

  for (const [sessionId, session] of activeSessions) {
    if (now - session.lastPing > timeout) {
      console.log(`Cleaning up inactive WebSocket session ${sessionId}`);
      session.websocket.close();
      activeSessions.delete(sessionId);
    }
  }
}
