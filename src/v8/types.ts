import * as THREE from 'three';
import type { CarryConfig, DamageConfig, InteractionConfig, PhysicsBodyType, WorldObjectCategory } from './gameplay/GameplayComponents';

export type ZoneId = 'control' | 'warehouse' | 'production' | 'quality' | 'maintenance' | 'dispatch' | 'capa';

export type HeroBase = 'knight' | 'rogue' | 'mage';
export type HeroHairStyle = 'short' | 'side' | 'buzz' | 'wave';
export type HeroBuild = 'slim' | 'standard' | 'athletic';
export type HeroUniform = 'navy' | 'graphite' | 'teal';
export type HeroFace = 'soft' | 'balanced' | 'angular';
export type HeroTopStyle = 'workshirt' | 'polo' | 'coverall';
export type HeroPantsStyle = 'cargo' | 'technical' | 'graphite';
export type HeroBootStyle = 'black' | 'yellow' | 'steel';
export type HeroPpeStyle = 'harness' | 'vest' | 'id-only';

export type HeroAppearance = {
  base: HeroBase;
  build: HeroBuild;
  face: HeroFace;
  skin: string;
  hair: string;
  hairStyle: HeroHairStyle;
  uniform: HeroUniform;
  topStyle: HeroTopStyle;
  pantsStyle: HeroPantsStyle;
  bootStyle: HeroBootStyle;
  ppeStyle: HeroPpeStyle;
  vest: string;
  helmet: string;
  glasses: boolean;
  gloves: boolean;
};

export type PlayerProfile = {
  name: string;
  team: string;
  role: 'quality' | 'process' | 'maintenance';
  accent: string;
  appearance: HeroAppearance;
};

/** 2D ground-plane collision body. Dynamic bodies can be enabled/disabled or pushed. */
export type Collider = {
  id?: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  enabled?: boolean;
  pushable?: boolean;
  object?: THREE.Object3D;
  debugLabel?: string;
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
  home?: [number, number, number];
  carryConfig?: Partial<CarryConfig>;
  bodyType?: PhysicsBodyType;
};

export type DropSocket = {
  id: string;
  label: string;
  object: THREE.Object3D;
  radius: number;
};

export type WorldObjectKind =
  | 'static'
  | 'interactable'
  | 'pickup'
  | 'carryable'
  | 'movable'
  | 'breakable'
  | 'container'
  | 'puzzle'
  | 'door'
  | 'npc'
  | 'combat-zone'
  | 'trigger';

export type InventoryItem = {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  quantity?: number;
};

export type WorldObjectDefinition = {
  id: string;
  kind: WorldObjectKind;
  label: string;
  prompt?: string;
  object: THREE.Object3D;
  radius?: number;
  key?: 'E' | 'F' | 'SPACE';
  colliderId?: string;
  enabled?: boolean;
  inventoryItem?: InventoryItem;
  contents?: InventoryItem[];
  health?: number;
  maxHealth?: number;
  state?: Record<string, unknown>;
  category?: WorldObjectCategory;
  bodyType?: PhysicsBodyType;
  carryConfig?: Partial<CarryConfig>;
  interaction?: InteractionConfig;
  damage?: DamageConfig;
};

export type WorldContextTarget = {
  id: string;
  kind: WorldObjectKind;
  label: string;
  prompt: string;
  key: 'E' | 'F' | 'SPACE';
  object: THREE.Object3D;
  distance: number;
  interactionPoint?: THREE.Object3D;
};

export type WorldInteractionResult = {
  handled: boolean;
  title?: string;
  message?: string;
  tone?: 'normal' | 'success' | 'danger';
  items?: InventoryItem[];
};

export type CombatHitResult = {
  hit: boolean;
  destroyedIds: string[];
  damagedIds: string[];
  reactedIds?: string[];
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
