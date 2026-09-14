import * as THREE from 'three';

export type Collider = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  enabled?: () => boolean;
};

export type Interactable = {
  id: string;
  label: string;
  object: THREE.Object3D;
  radius: number;
  enabled?: () => boolean;
  once?: boolean;
  consumed?: boolean;
  onInteract: () => void | Promise<void>;
};

export type GameStats = {
  remainingSeconds: number;
  errors: number;
  hints: number;
  evidence: Set<string>;
  keys: Set<string>;
  startedAt: number | null;
  finishedAt: number | null;
};

export type Choice = {
  id: string;
  text: string;
};
