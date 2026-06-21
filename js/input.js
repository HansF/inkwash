'use strict';

import { canvas } from './gl.js';
import { ptr, state, TOUCH } from './config.js';

/* ---------------- input ---------------- */

const hintEl = document.getElementById('hint');
const uiEl = document.getElementById('ui');

let activePointerId = null;

export function toUv(e){ return [e.clientX / innerWidth, 1 - e.clientY / innerHeight]; }

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (ptr.down && e.pointerId !== activePointerId) return;   // one stroke at a time
  activePointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  if (e.pointerType === 'pen') state.pencilSeen = true;
  const [x, y] = toUv(e);
  ptr.down = true; ptr.tx = x; ptr.ty = y; ptr.bx = x; ptr.by = y;
  ptr.speed = 0; ptr.simP = 0.35;
  ptr.type = e.pointerType;
  ptr.barrel = (e.buttons & 34) !== 0;     // barrel button (2) or eraser (32)
  readPressure(e);
  if (state.strokes++ === 0) hintEl.classList.add('gone');
});
canvas.addEventListener('pointermove', e => {
  if (ptr.down && e.pointerId !== activePointerId) return;   // ignore palm / second finger
  if (e.pointerType === 'pen') state.pencilSeen = true;
  const [x, y] = toUv(e);
  ptr.tx = x; ptr.ty = y;
  ptr.cx = e.clientX; ptr.cy = e.clientY;
  ptr.inWindow = true;
  if (!ptr.down) ptr.type = e.pointerType;
  if (ptr.down) ptr.barrel = (e.buttons & 34) !== 0;
  readPressure(e);
  if (!ptr.down && !TOUCH) uiEl.classList.toggle('show', e.clientY > innerHeight - 110);
});
function endStroke(e){
  if (e && e.pointerId !== undefined && e.pointerId !== activePointerId) return;
  ptr.down = false; ptr.barrel = false; activePointerId = null;
}
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
window.addEventListener('blur', endStroke);
canvas.addEventListener('pointerleave', () => { ptr.inWindow = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

function readPressure(e){
  if (e.pointerType === 'touch') return;   // finger "pressure" is unreliable; speed sim instead
  if (e.pointerType === 'pen' || (e.pressure > 0 && Math.abs(e.pressure - 0.5) > 0.001)){
    ptr.force = e.pressure; ptr.hasForce = true; ptr.forceT = performance.now();
  }
}
canvas.addEventListener('webkitmouseforcechanged', e => {
  if (typeof e.webkitForce === 'number'){
    ptr.force = Math.min(Math.max((e.webkitForce - 1) / 1.7, 0.04), 1);
    ptr.hasForce = true; ptr.forceT = performance.now();
  }
});

export function pressureNow(){
  if (ptr.type === 'touch') return ptr.simP;
  if (ptr.hasForce && performance.now() - ptr.forceT < 3000) return ptr.force;
  return ptr.simP;
}
