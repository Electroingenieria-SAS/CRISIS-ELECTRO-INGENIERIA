import * as THREE from 'three';

export type ZoneId = 'control' | 'warehouse' | 'production' | 'quality' | 'dispatch' | 'capa';
export type RoleId = 'inspector' | 'analyst' | 'engineer';

export type PlayerProfile = {
  name: string;
  team: string;
  callsign: string;
  role: RoleId;
  color: string;
};

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
  marker?: THREE.Object3D;
  enabled?: () => boolean;
  onInteract: () => void | Promise<void>;
};

export type DialogueLine = {
  speaker: string;
  role?: string;
  text: string;
  tone?: 'normal' | 'warning' | 'success';
};

export type InventoryItem = {
  id: string;
  title: string;
  category: 'document' | 'evidence' | 'tool' | 'key' | 'cause';
  description: string;
  code?: string;
};

export type IshikawaCategory = 'Método' | 'Material' | 'Máquina' | 'Mano de obra' | 'Medición' | 'Entorno';

export type CauseToken = {
  id: string;
  title: string;
  category: IshikawaCategory;
  description: string;
};

export type GameProgress = {
  zone: ZoneId;
  objective: string;
  objectiveDetail: string;
  score: number;
  errors: number;
  remainingSeconds: number;
  startedAt: number | null;
  completedAt: number | null;
  scannedLots: Set<string>;
  evidence: Set<string>;
  inventory: Map<string, InventoryItem>;
  productionSequence: string[];
  causesFound: Set<string>;
  ishikawaPlaced: Map<IshikawaCategory, string>;
  fiveWhysStep: number;
  flags: Set<string>;
};

export type Choice = {
  id: string;
  text: string;
  detail?: string;
};
