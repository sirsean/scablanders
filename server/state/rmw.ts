import { defaultForSlice, type SliceKey, type SliceMap } from './slices';
import { defaultBroadcastMapping, type BroadcastPlan } from './broadcast-map';
import { createConsoleLogger, type MutationLogger, type MutationEvent } from './event-log';

// Minimal facade for Durable Object storage used by RMW
export interface StorageFacade {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface RmwContext {
  correlationId?: string;
  now?: () => Date;
  random?: () => number;
}

export interface RmwOptions<K extends SliceKey, TResult = unknown> {
  read: K[];
  mutate: (
    draft: Pick<SliceMap, K>,
    helpers: { now: Date; correlationId?: string },
    prev: Pick<SliceMap, K>,
  ) => Promise<{ result?: TResult; broadcast?: BroadcastPlan; event?: Partial<MutationEvent> } | TResult>;
  broadcast?: (
    prev: Pick<SliceMap, K>,
    next: Pick<SliceMap, K>,
    changed: K[],
  ) => BroadcastPlan | undefined;
  event?: Partial<MutationEvent>;
  context?: RmwContext;
}

export interface RmwResult<K extends SliceKey, TResult = unknown> {
  changed: K[];
  result?: TResult;
  plan: BroadcastPlan;
  next: Pick<SliceMap, K>;
}

function deepClone<T>(obj: T): T {
  // Workers env supports structuredClone; provide a fallback
  try {
    // @ts-ignore
    if (typeof structuredClone === 'function') { return structuredClone(obj); }
  } catch {}
  return JSON.parse(JSON.stringify(obj));
}

export async function rmw<K extends SliceKey, TResult = unknown>(
  storage: StorageFacade,
  logger: MutationLogger = createConsoleLogger(),
  options: RmwOptions<K, TResult>,
): Promise<RmwResult<K, TResult>> {
  const start = Date.now();
  const nowDate = options?.context?.now ? options.context.now() : new Date();
  const correlationId = options?.context?.correlationId;

  // 1) Read requested slices fresh from storage and apply defaults
  const prev = {} as Pick<SliceMap, K>;
  for (const key of options.read) {
    const raw = await storage.get<any>(key);
    prev[key] = (raw === undefined || raw === null) ? (defaultForSlice(key) as any) : (raw as any);
  }

  // 2) Clone to build a mutable draft
  const draft = {} as Pick<SliceMap, K>;
  for (const key of options.read) {
    draft[key] = deepClone(prev[key]);
  }

  // 3) Run mutator
  const mutateResult = await options.mutate(draft, { now: nowDate, correlationId }, prev);
  let domainResult: TResult | undefined;
  let overridePlan: BroadcastPlan | undefined;
  let eventOverride: Partial<MutationEvent> | undefined;
  if (mutateResult && typeof mutateResult === 'object' && 'broadcast' in (mutateResult as any) || 'event' in (mutateResult as any) || 'result' in (mutateResult as any)) {
    const mr = mutateResult as { result?: TResult; broadcast?: BroadcastPlan; event?: Partial<MutationEvent> };
    domainResult = mr.result;
    overridePlan = mr.broadcast;
    eventOverride = mr.event;
  } else {
    domainResult = mutateResult as TResult;
  }

  // 4) Detect changed slices
  const changed: K[] = [];
  for (const key of options.read) {
    const before = prev[key];
    const after = draft[key];
    const same = JSON.stringify(before) === JSON.stringify(after);
    if (!same) { changed.push(key); }
  }

  // 5) Persist only changed slices
  await Promise.all(
    changed.map((key) => storage.put(key, draft[key] as any)),
  );

  // 6) Build broadcast plan (override > custom mapper > default)
  const explicitPlan = overridePlan ?? options.broadcast?.(prev, draft, changed) ?? defaultBroadcastMapping(prev as any, draft as any, changed as SliceKey[]);

  // 7) Log event
  const event: MutationEvent = {
    op: options.event?.op || eventOverride?.op || 'mutation',
    changedSlices: (options.event?.changedSlices as any) || (eventOverride?.changedSlices as any) || (changed as SliceKey[]),
    durationMs: Date.now() - start,
    timestamp: nowDate,
    correlationId,
    details: options.event?.details || eventOverride?.details,
  };
  await logger.log(event);

  // Build the next state projection for the requested slices
  const next = {} as Pick<SliceMap, K>;
  for (const key of options.read) {
    next[key] = draft[key];
  }

  return { changed, result: domainResult, plan: explicitPlan, next };
}
