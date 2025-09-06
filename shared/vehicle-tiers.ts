export const VEHICLE_TIERS: Record<number, string[]> = {
  1: ['dune-buggy'],
  2: ['sand-skimmer'],
  3: ['cargo-hauler'],
  4: ['personnel-carrier'],
  5: ['war-rig', 'sand-crawler'],
};

export const VEHICLE_LEVEL_BY_ID: Record<string, number> = Object.entries(VEHICLE_TIERS).reduce(
  (acc, [lvlStr, ids]) => {
    const lvl = Number(lvlStr);
    for (const id of ids) {
      if (!(id in acc) || lvl < acc[id]) acc[id] = lvl;
    }
    return acc;
  },
  {} as Record<string, number>,
);

export function requiredMarketLevel(vehicleId: string): number {
  return VEHICLE_LEVEL_BY_ID[vehicleId] ?? 1;
}

export function isVehicleUnlocked(vehicleId: string, marketLevel: number): boolean {
  const req = requiredMarketLevel(vehicleId);
  return typeof marketLevel === 'number' && marketLevel >= req;
}

