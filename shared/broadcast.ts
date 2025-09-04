import { GameWebSocketMessage } from './models';

/**
 * BroadcastChannel name for cross-isolate WebSocket message transport
 * This channel bridges messages from GameDO (Durable Object isolate) to
 * WebSocket handlers (main worker isolate)
 */
export const GAME_BC_NAME = 'GAME_EVENTS';

/**
 * Message envelope for cross-isolate WebSocket communication
 * Defines how GameDO can target specific sessions, players, or broadcast to all
 */
export interface OutboundWSMessage {
	scope: 'all' | 'player' | 'session';
	playerAddress?: string;
	sessionId?: string;
	payload: GameWebSocketMessage;
}

/**
 * Send a WebSocket message from GameDO to WebSocket handler via BroadcastChannel
 * Creates a transient channel to avoid memory leaks in long-running DO instances
 *
 * Note: BroadcastChannel not available in current environment, using console logging
 */
export function sendBroadcast(msg: OutboundWSMessage) {
	// TODO: Implement proper cross-isolate communication when BroadcastChannel is available
	console.log('[Broadcast] Would send message:', msg.scope, msg.payload.type);
}
