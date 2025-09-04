import type { Vehicle } from '@shared/models';

export const vehicleData: Record<string, Omit<Vehicle, 'id'>> = {
	'dune-buggy': {
		name: 'Dune Buggy',
		description: 'A light, fast vehicle perfect for scouting, but with limited capacity.',
		speed: 30, // fast
		combat: 5,
		scavenging: 10,
		tech: 5,
		maxDrifters: 1,
		maxCargo: 100,
		cost: 2500,
	},
	'sand-skimmer': {
		name: 'Sand Skimmer',
		description: 'A balanced, all-around vehicle for small crews.',
		speed: 24,
		combat: 10,
		scavenging: 15,
		tech: 10,
		maxDrifters: 2,
		maxCargo: 250,
		cost: 5000,
	},
	'cargo-hauler': {
		name: 'Cargo Hauler',
		description: 'Slow and steady, this beast can carry a massive payload.',
		speed: 16, // slower
		combat: 0,
		scavenging: 30,
		tech: 0,
		maxDrifters: 2,
		maxCargo: 1000,
		cost: 7500,
	},
	'personnel-carrier': {
		name: 'Personnel Carrier',
		description: 'Designed to move a full squad of drifters, with moderate cargo space.',
		speed: 20,
		combat: 15,
		scavenging: 10,
		tech: 10,
		maxDrifters: 4,
		maxCargo: 400,
		cost: 10000,
	},
	'war-rig': {
		name: 'War Rig',
		description: 'A formidable vehicle that balances speed, crew, and cargo for combat patrols.',
		speed: 22,
		combat: 35,
		scavenging: 10,
		tech: 5,
		maxDrifters: 3,
		maxCargo: 500,
		cost: 15000,
	},
	'sand-crawler': {
		name: 'Sand Crawler',
		description: 'The ultimate mobile base of operations. Slow, but carries a huge crew and cargo.',
		speed: 12,
		combat: 5,
		scavenging: 40,
		tech: 20,
		maxDrifters: 5,
		maxCargo: 2000,
		cost: 25000,
	},
};

export const getVehicleRegistry = (): Record<string, Vehicle> => {
	const registry: Record<string, Vehicle> = {};
	for (const id in vehicleData) {
		registry[id] = {
			id,
			...vehicleData[id],
		};
	}
	return registry;
};
