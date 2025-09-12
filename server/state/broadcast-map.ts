import type { Mission } from '@shared/models';
import { isWorldSlice, type SliceKey, type SliceMap } from './slices';

export type BroadcastJob =
	| { kind: 'world_state' }
	| { kind: 'player_state'; addresses: string[] }
	| { kind: 'mission_update'; missions: Mission[] }
	| { kind: 'leaderboards_update' }
	| { kind: 'custom'; type: string; payload: unknown };

export interface BroadcastPlan {
	jobs: BroadcastJob[];
}

export function defaultBroadcastMapping(prev: Partial<SliceMap>, next: Partial<SliceMap>, changed: SliceKey[]): BroadcastPlan {
	const jobs: BroadcastJob[] = [];

	// World-affecting slices => world_state
	if (changed.some((k) => isWorldSlice(k))) {
		jobs.push({ kind: 'world_state' });
	}

	// By default we avoid mission_update unless explicitly requested by the caller,
	// because the payload tends to be contextual. Callers can override.

	// Players slice updates are best targeted by address. Without an override from
	// the caller providing addresses, we skip to avoid spamming all players.

	// Leaderboards typically change when contribution stats are updated; default
	// to no-op here and let callers opt-in when appropriate.

	return { jobs };
}
