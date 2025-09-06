// Vehicle tier gating for the Vehicle Market
// Map market level -> array of vehicle IDs unlocked at that level.
// Adjust these IDs to match server/data/vehicles registry identifiers.

export const VEHICLE_TIERS: Record<number, string[]> = {
  1: ['scout_bike'],
  2: ['sand_runner'],
  3: ['desert_buggy'],
  4: ['armored_crawler'],
  5: ['storm_chaser'],
};

// Flatten reverse lookup: vehicleId -> required level
const REQUIRED_LEVEL: Record<string, number> = Object.entries(VEHICLE_TIERS).reduce(
  (acc, [lvlStr, ids]) => {
    const lvl = Number(lvlStr);
    ids.forEach((id) => (acc[id] = Math.min(acc[id] ?? lvl, lvl)));
    return acc;
  },
  {} as Record<string, number>,
);

export function isVehicleUnlocked(vehicleId: string, marketLevel: number): boolean {
  const req = REQUIRED_LEVEL[vehicleId] ?? 1; // default level 1 if unknown
  return marketLevel >= req;
}

export function requiredMarketLevel(vehicleId: string): number {
  return REQUIRED_LEVEL[vehicleId] ?? 1;
}

