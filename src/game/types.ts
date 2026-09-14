import * as THREE from 'three';

export type CharacterClass = 'inspector' | 'analyst' | 'engineer';

export type PlayerProfile = {
  playerName: string;
  teamName: string;
  callsign: string;
  characterClass: CharacterClass;
  accent: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  description: string;
  icon: string;
  kind: 'evidence' | 'key' | 'tool' | 'cause' | 'mission';
};

export type MissionStage =
  | 'briefing'
  | 'evidence'
  | 'traceability'
  | 'risk'
  | 'ishikawa'
  | 'five-whys'
  | 'containment'
  | 'complete';

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

export type EnemyState = {
  id: string;
  object: THREE.Object3D;
  velocity: THREE.Vector3;
  home: THREE.Vector3;
  hp: number;
  active: boolean;
  hitCooldown: number;
  phase: number;
};

export type GameStats = {
  remainingSeconds: number;
  maxSeconds: number;
  errors: number;
  hints: number;
  score: number;
  health: number;
  evidence: Set<string>;
  keys: Set<string>;
  inventory: InventoryItem[];
  defeatedErrors: number;
  ishikawaTokens: Set<string>;
  stage: MissionStage;
  objective: string;
  startedAt: number | null;
  finishedAt: number | null;
  pausedByGameMaster: boolean;
  sessionStatus: 'playing' | 'paused' | 'completed' | 'failed';
};

export type Choice = {
  id: string;
  text: string;
};

export type FiveWhyStep = {
  why: string;
  choices: Choice[];
  correct: string;
  explanation: string;
};

export type GameMasterCommand = {
  id: number;
  command: 'pause' | 'resume' | 'add_time' | 'remove_time' | 'message' | 'finish';
  payload: Record<string, unknown>;
};
