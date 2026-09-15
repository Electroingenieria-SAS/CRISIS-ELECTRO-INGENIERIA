import type { Collider } from '../types';

type ProfileBox = [id: string, minX: number, maxX: number, minZ: number, maxZ: number, label: string];

const WAREHOUSE: ProfileBox[] = [
  ['warehouse-receiving-workstation', -46.15, -42.25, 3.35, 5.05, 'Recepción workstation'],
  ['warehouse-control-cabinet', -47.86, -47.14, 4.44, 5.76, 'Control cabinet'],
  ['warehouse-quarantine-west-rail', -47.28, -47.02, 16.90, 21.10, 'Quarantine west rail'],
  ['warehouse-quarantine-east-rail', -40.18, -39.92, 16.90, 21.10, 'Quarantine east rail'],
  ['warehouse-quarantine-rear-rail', -47.20, -40.00, 20.87, 21.13, 'Quarantine rear rail'],
  ['warehouse-service-cabinet-a', -20.96, -20.24, 16.74, 18.06, 'Service cabinet A'],
  ['warehouse-service-cabinet-b', -20.96, -20.24, 18.34, 19.66, 'Service cabinet B'],
  ['warehouse-inspection-barrier-west', -47.14, -46.46, 4.68, 6.92, 'Inspection barrier west'],
  ['warehouse-inspection-barrier-east', -21.74, -21.06, 4.68, 6.92, 'Inspection barrier east']
];

const PRODUCTION: ProfileBox[] = [
  ['production-briefing-workstation', -34.95, -31.05, -35.95, -34.25, 'Production briefing workstation'],
  ['production-conveyor', -27.95, -16.45, -22.00, -19.80, 'CT-48 conveyor'],
  ['production-barrier-west', -27.34, -26.66, -25.22, -22.78, 'Cell barrier west'],
  ['production-barrier-east', -17.74, -17.06, -25.22, -22.78, 'Cell barrier east'],
  ['production-interlock-energy', -36.25, -34.55, -24.80, -23.20, 'Energy disconnect station'],
  ['production-interlock-guard', -30.55, -28.85, -18.80, -17.20, 'Guard interlock station'],
  ['production-interlock-clamp', -16.35, -14.65, -21.80, -20.20, 'Fixture clamp station'],
  ['production-interlock-hmi', -12.45, -10.75, -32.40, -30.80, 'Program HMI station'],
  ['production-status-board', -15.98, -9.62, -35.50, -34.90, 'Release status board'],
  ['production-first-piece-workstation', -14.15, -10.25, -19.25, -17.55, 'First-piece workstation']
];

const QUALITY: ProfileBox[] = [
  ['quality-control-workstation', 14.05, 17.95, -36.45, -34.75, 'Metrology workstation'],
  ['quality-control-cabinet', 10.44, 11.76, -33.15, -32.45, 'Metrology cabinet'],
  ['quality-master-pedestal', 13.42, 15.18, -28.58, -26.82, 'Master standard pedestal'],
  ['quality-bank-1', 16.42, 20.78, -23.18, -20.82, 'Measurement bank M-01'],
  ['quality-bank-2', 23.12, 27.48, -23.18, -20.82, 'Measurement bank M-02'],
  ['quality-bank-3', 29.82, 34.18, -23.18, -20.82, 'Measurement bank M-03'],
  ['quality-tag-1', 17.72, 19.48, -34.42, -33.58, 'M-01 lockout terminal'],
  ['quality-tag-2', 24.42, 26.18, -34.42, -33.58, 'M-02 lockout terminal'],
  ['quality-tag-3', 31.12, 32.88, -34.42, -33.58, 'M-03 lockout terminal'],
  ['quality-isolation-cabinet', 34.74, 36.06, -29.95, -29.25, 'Isolation cabinet'],
  ['quality-isolation-barrier', 29.64, 30.36, -31.50, -27.90, 'Isolation barrier']
];

const PROFILES = [...WAREHOUSE, ...PRODUCTION, ...QUALITY];

/**
 * Adds the audited vertical-slice furniture/equipment collision layer.
 * IDs make every body inspectable in F3 debug and prevent accidental duplicates.
 */
export function installVerticalSliceFurnitureColliders(colliders: Collider[]): void {
  const existing = new Set(colliders.map((body) => body.id).filter((id): id is string => Boolean(id)));
  for (const [id, minX, maxX, minZ, maxZ, label] of PROFILES) {
    if (existing.has(id)) continue;
    colliders.push({ id, minX, maxX, minZ, maxZ, enabled: true, debugLabel: label });
    existing.add(id);
  }
}
