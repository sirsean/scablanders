This folder contains infrastructure for implementing a universal read/modify/write (RMW) pattern in the GameDO.

Components

- slices.ts: Declares the persisted slices, default factories, and helpers.
- rmw.ts: Generic RMW engine that re-reads slices from storage, runs a mutator, persists only changed slices, emits a broadcast plan, and logs a mutation event.
- broadcast-map.ts: Default mapping from changed slices to broadcast jobs.
- event-log.ts: Mutation event envelope and a console logger.

Notes

- The RMW engine intentionally does not reach into GameDO internals. GameDO wires storage, broadcasting, and logging through adapters.
- Keep storage key names exactly the same as existing code. No schema changes here.
- Prefer domain-specific helpers in GameDO to wrap runRmw with the minimal read set and appropriate broadcast overrides.
