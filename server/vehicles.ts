import { vehicleData } from './data/vehicles';
import type { Vehicle } from '@shared/models';

export function getVehicle(vehicleId: string): Vehicle | undefined {
  const vehicle = vehicleData[vehicleId];
  if (!vehicle) {
    return undefined;
  }
  return {
    id: vehicleId,
    ...vehicle,
  };
}
