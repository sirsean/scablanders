import { vehicleData } from '../../server/data/vehicles';
import type { Vehicle } from '@shared/models';

export function getVehicleData(vehicleId: string): Omit<Vehicle, 'id'> | undefined {
  return vehicleData[vehicleId];
}
