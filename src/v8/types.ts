import * as THREE from 'three';

export type ZoneId = 'control' | 'warehouse' | 'production' | 'quality' | 'maintenance' | 'dispatch' | 'capa';

export type PlayerProfile = {
  name: string;
  team: string;
  role: 'quality' | 'process' | 'maintenance';
  accent: string;
};

export type Collider = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type WorldAction = {
  id: string;
  prompt: string;
  object: THREE.Object3D;
  radius: number;
};

export type Carryable = {
  id: string;
  label: string;
  object: THREE.Object3D;
  radius: number;
};

export type DropSocket = {
  id: string;
  label: string;
  object: THREE.Object3D;
  radius: number;
};

export type GameState = {
  chapter: number;
  zone: ZoneId;
  objective: string;
  detail: string;
  score: number;
  errors: number;
  remainingSeconds: number;
  flags: Set<string>;
  scans: Set<string>;
  measured: Set<string>;
  dispatchPlaced: Set<string>;
  production: boolean[];
  lotoStep: number;
  finished: boolean;
};
