export type WeaponId = 'ak47' | 'm4a1' | 'awp' | 'deagle' | 'knife';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  type: 'rifle' | 'sniper' | 'pistol' | 'melee';
  damage: number;
  fireRate: number; // shots per minute
  clipSize: number;
  reserveAmmo: number;
  reloadTime: number; // seconds
  moveSpeed: number; // CS2 units/s (knife = 250, ak = 215)
  price: number;
  sprayPattern: { x: number; y: number }[]; // recoil offsets per bullet
  spread: number; // base spread
  spreadMoveMult: number; // spread multiplier when moving
}

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface BotConfig {
  reactionTime: number; // seconds (0.18s to 0.8s)
  aimAccuracy: number; // 0.0 to 1.0
  recoilControl: number; // 0.0 to 1.0
  patrolSpeed: number;
  health: number;
}

export interface PlayerStats {
  health: number;
  armor: number;
  kills: number;
  deaths: number;
  money: number;
}

export type MapId = 'dust2' | 'tashkent';

export interface HitResult {
  hit: boolean;
  distance: number;
  point: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  hitbox?: 'head' | 'chest' | 'stomach' | 'legs';
  targetBotId?: string;
}
