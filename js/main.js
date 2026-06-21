'use strict';

import { gl } from './gl.js';
import { DEMO, TOUCH, ptr, state } from './config.js';
import { step, render, ink, brushNow, fixDrawing } from './sim.js';
import { pressureNow } from './input.js';
import { resolveActiveTool } from './tools/index.js';
import { initUI, updateCursor } from './ui.js';
import { loadSettings } from './storage.js';
import { initNative, hideSplash } from './native.js';
import { maybeShowOnboarding } from './onboarding.js';

const hintEl = document.getElementById('hint');
const uiEl = document.getElementById('ui');

if (TOUCH){
  document.body.classList.add('touch');
  uiEl.classList.add('show');
  hintEl.innerHTML = 'draw<br>pencil makes ink; finger is water; mode adds fude brush';
}

/* ---------------- stroke engine ---------------- */

function updateBrush(dt){
  brushNow.r = 0;
  const k = 1 - Math.exp(-dt * 14);
  const px = ptr.bx, py = ptr.by;
  ptr.bx += (ptr.tx - ptr.bx) * k;
  ptr.by += (ptr.ty - ptr.by) * k;
  const dx = ptr.bx - px, dy = ptr.by - py;
  const dist = Math.hypot(dx, dy);
  const inst = dist / Math.max(dt, 1e-4);
  ptr.speed += (inst - ptr.speed) * (1 - Math.exp(-dt * 10));

  const targetP = Math.min(Math.max(1.18 - ptr.speed * 0.95, 0.12), 1.0);
  ptr.simP += (targetP - ptr.simP) * (1 - Math.exp(-dt * 6));

  if (!ptr.down) return;

  const pr = pressureNow();
  const speed = ptr.speed;
  const tool = resolveActiveTool();
  tool.stroke(dt, { px, py, dx, dy, dist, pr, speed });
}

/* ---------------- demo mode (headless smoke test) ---------------- */

let demoFixed = false, demoFixed2 = false;
function demoDrive(t){
  if (t < 1.3){
    state.demoMode = 'pen'; ptr.down = true;
    const s = t / 1.3;
    ptr.tx = 0.28 + 0.46 * s;
    ptr.ty = 0.64 + 0.05 * Math.sin(s * Math.PI * 2.0);
  } else if (t < 1.55){
    ptr.down = false;
  } else if (t < 2.85){
    state.demoMode = 'pen'; ptr.down = true;
    const s = (t - 1.55) / 1.3;
    if (s < 0.04){ ptr.tx = 0.28; ptr.ty = 0.38; ptr.bx = 0.28; ptr.by = 0.38; }
    ptr.tx = 0.28 + 0.46 * s;
    ptr.ty = 0.38 - 0.05 * Math.sin(s * Math.PI * 2.0);
  } else if (t < 3.3){
    ptr.down = false;
    if (!demoFixed && t > 3.0){ demoFixed = true; fixDrawing(); }   // lock the linework
  } else if (t < 7.6){
    state.demoMode = 'brush'; ptr.down = true;
    const s = (t - 3.3) / 4.3;
    const a = s * Math.PI * 5.0;
    if (s < 0.02){ ptr.bx = 0.5; ptr.by = 0.51; }
    ptr.tx = 0.50 + 0.14 * Math.cos(a) + 0.06 * s;
    ptr.ty = 0.51 + 0.13 * Math.sin(a);
  } else if (t < 8.0){
    ptr.down = false; state.demoMode = null;
  } else if (t < 9.4){
    state.demoMode = 'pen'; state.inkWhite = true; ptr.down = true;
    const s = (t - 8.0) / 1.4;
    if (s < 0.04){ ptr.bx = 0.34; ptr.by = 0.30; }
    ptr.tx = 0.34 + 0.36 * s;
    ptr.ty = 0.30 + 0.38 * s;
  } else if (t < 10.2){
    ptr.down = false; state.demoMode = null; state.inkWhite = false;
    if (!demoFixed2 && t > 9.6){ demoFixed2 = true; fixDrawing(); }   // bake the white in
  } else if (t < 11.4){
    state.demoMode = 'pen'; ptr.down = true;     // dark over baked white must read dark
    const s = (t - 10.2) / 1.2;
    if (s < 0.04){ ptr.bx = 0.62; ptr.by = 0.26; }
    ptr.tx = 0.62 - 0.24 * s;
    ptr.ty = 0.26 + 0.36 * s;
  } else {
    ptr.down = false; state.demoMode = null;
  }
}

/* ---------------- main loop ---------------- */

let lastT = performance.now(), simTime = 0, splashHidden = false;
function frame(now){
  const dt = Math.min((now - lastT) / 1000, 1 / 30) || 1 / 60;
  lastT = now;
  simTime += dt;
  updateBrush(dt);
  step(dt);
  render();
  updateCursor();
  if (!splashHidden){ splashHidden = true; hideSplash(); }
  requestAnimationFrame(frame);
}

/* ---------------- boot ---------------- */

loadSettings();
initUI();
maybeShowOnboarding();
initNative();

if (DEMO){
  // headless smoke test: run the scripted strokes synchronously, then render once
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 12; i++){
    simTime += dt;
    demoDrive(simTime);
    updateBrush(dt);
    step(dt);
  }
  render();
  const px = new Float32Array(4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, ink.read.fbo);
  gl.readPixels(Math.floor(ink.w * 0.5), Math.floor(ink.h * 0.5), 1, 1, gl.RGBA, gl.FLOAT, px);
  console.log('[demo] done t=' + simTime.toFixed(1), 'ink@center=' + px[0].toFixed(3), 'glErr=' + gl.getError());
} else {
  requestAnimationFrame(frame);
}
