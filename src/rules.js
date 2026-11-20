import contract from '../game.contract.json' with { type: 'json' };

export const tuning = Object.freeze(contract.tuning);
export const TICKS_PER_SECOND = 60;
export const STEP = 1 / TICKS_PER_SECOND;
export const CHARM_TICKS = 600;
export const CHARM_RESPAWN_TICKS = 2700;
export const DEFAULT_INPUT = Object.freeze({
  move: Object.freeze([0, 0]),
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
  pause: false,
});

export const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
export const DRIFTER_STATES = ['idle', 'chase', 'flee', 'removed'];

export function carryCapacity(player) {
  return Math.min(tuning.capacity_max, tuning.carry_capacity + 2 * player.successfulLights);
}
