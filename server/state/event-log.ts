import { type SliceKey } from './slices';

export interface MutationEvent {
  op: string;
  changedSlices: SliceKey[];
  durationMs: number;
  timestamp: Date;
  correlationId?: string;
  // Optional summary payload (kept small)
  details?: Record<string, unknown>;
}

export interface MutationLogger {
  log(event: MutationEvent): Promise<void>;
}

export function createConsoleLogger(): MutationLogger {
  return {
    async log(event: MutationEvent) {
      try {
        // Keep one JSON line per mutation for easy tail/grep
        const payload = {
          ...event,
          timestamp: event.timestamp?.toISOString?.() || new Date().toISOString(),
        };
        console.log('[RMW]', JSON.stringify(payload));
      } catch (e) {
        console.warn('[RMW] Failed to log mutation event', e);
      }
    },
  };
}
