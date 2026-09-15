import * as THREE from 'three';
import type { InventoryItem, PlayerProfile } from '../v3/types';

export type V4Zone = 'control' | 'warehouse' | 'production' | 'quality' | 'maintenance' | 'dispatch' | 'capa';

export type V4Progress = {
  zone: V4Zone;
  objective: string;
  objectiveDetail: string;
  score: number;
  errors: number;
  remainingSeconds: number;
  startedAt: number | null;
  completedAt: number | null;
  flags: Set<string>;
  evidence: Set<string>;
  inventory: Map<string, InventoryItem>;
  chapter: number;
  qualitySeals: Set<string>;
  quarantinedItems: Set<string>;
  calibratedTools: Set<string>;
  dispatchSlots: Set<string>;
  puzzleState: Map<string, number>;
};

export type V4Interactable = {
  id: string;
  label: string;
  object: THREE.Object3D;
  radius: number;
  enabled?: () => boolean;
  onInteract: () => void | Promise<void>;
};

export type CarryableSpec = {
  id: string;
  label: string;
  kind: 'material' | 'sample' | 'document' | 'tool' | 'package' | 'evidence';
  object: THREE.Object3D;
  pickupRadius?: number;
  carriedScale?: number;
  metadata?: Record<string, string>;
  placed?: boolean;
};

export type DropSocket = {
  id: string;
  label: string;
  object: THREE.Object3D;
  radius: number;
  accepts: (item: CarryableSpec) => boolean;
  onPlace: (item: CarryableSpec) => void | Promise<void>;
};

export type PatrolAgent = {
  id: string;
  group: THREE.Group;
  waypoints: THREE.Vector3[];
  waypointIndex: number;
  speed: number;
};

export type V4GameContext = {
  progress: V4Progress;
  profile: PlayerProfile;
};
