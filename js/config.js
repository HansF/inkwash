'use strict';

/* ---------------- shared config + mutable state ---------------- *
 * This module is the dependency hub: it imports nothing, so every
 * other module can safely import the live `P`, `state`, `ptr` and
 * `brushNow` objects and mutate them in place. (ES modules forbid
 * reassigning an imported binding from another module, so shared
 * mutable values live on objects instead of bare `let`s.)            */

export const DEMO = /demo/.test(location.search);
export const TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;

export const SIM_BASE = DEMO ? 192 : 256;   // velocity / pressure grid
export const PRESSURE_ITER = 22;

export const INK_ABS = [1.00, 0.97, 0.88];  // near-black ink, faintly cool

/* user-facing parameters (bound to the sliders) */
export const P = { SIZE: 0.5, FLOW: 0.6, BLEED: 0.5, DRY: 0.45, COLOR: 0.5, BINK: 0.0 };

/* drawing-engine mode + flags shared across input / tools / ui */
export const state = {
  inkWhite: false,
  uiMode: 'pen',
  demoMode: null,            // demo override: 'pen' | 'brush' | null
  pencilSeen: false,
  strokes: 0,
  inkAbs: INK_ABS.slice(),
};

/* live pointer state */
export const ptr = {
  down: false, tx: 0.5, ty: 0.5,
  bx: 0.5, by: 0.5,
  speed: 0, simP: 0.35,
  force: 0, hasForce: false, forceT: 0,
  cx: 0, cy: 0, inWindow: false,
  barrel: false, type: 'mouse',
};

/* ---------------- pure helpers ---------------- */

export function sizeMult(){ return Math.pow(3, (P.SIZE - 0.5) * 2); }   // 1/3x .. 3x

export function inkColor(dens){
  return state.inkWhite ? [0, 0, 0, dens]
                        : [state.inkAbs[0]*dens, state.inkAbs[1]*dens, state.inkAbs[2]*dens, 0];
}

/* derive the ink absorbance tint from a hex colour (hue picker + restore) */
export function applyInkHex(hex){
  const r = parseInt(hex.slice(1, 3), 16) / 255,
        g = parseInt(hex.slice(3, 5), 16) / 255,
        b = parseInt(hex.slice(5, 7), 16) / 255;
  if (Math.max(r, g, b) < 0.09){ state.inkAbs = INK_ABS.slice(); return; }   // near-black: house ink
  const A = [r, g, b].map(v => -Math.log(Math.max(v, 0.02)));
  const m = Math.max(A[0], A[1], A[2], 0.25);
  state.inkAbs = A.map(v => v / m);
}
