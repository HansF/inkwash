'use strict';

import { P, state, ptr, applyInkHex } from './config.js';
import { toolById, nextToolId, resolveActiveTool } from './tools/index.js';
import { pressureNow } from './input.js';
import { fixDrawing, clearAll } from './sim.js';
import { shareOrSavePNG } from './share.js';
import { openGallery, closeGallery } from './gallery.js';
import { scheduleSave, getColorHex } from './storage.js';

const cursorEl = document.getElementById('cursor');
const uiEl = document.getElementById('ui');
const modeBtn = document.getElementById('bMode');
const menuBtn = document.getElementById('bMenu');
const inkBtn = document.getElementById('bInk');

/* ---------------- mode / tool button ---------------- */

export function setMode(id){
  const tool = toolById(id);
  state.uiMode = tool.id;
  modeBtn.textContent = tool.label;
  modeBtn.classList.remove('mode-pen', 'mode-brush', 'mode-fude');
  modeBtn.classList.add(tool.icon);
  modeBtn.setAttribute('aria-label', 'Mode: ' + tool.label);
  scheduleSave();
}
export function nextMode(){ setMode(nextToolId(state.uiMode)); }

export function setMenuOpen(open){
  uiEl.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  menuBtn.setAttribute('aria-label', open ? 'Hide controls' : 'Show controls');
}
export function menuOpen(){ return uiEl.classList.contains('open'); }

export function setInkWhite(v){
  state.inkWhite = v;
  inkBtn.textContent = v ? 'white' : 'black';
  scheduleSave();
}

function toggleFullscreen(){
  const el = document.documentElement;
  if (!document.fullscreenElement && !document.webkitFullscreenElement){
    (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  }
}

/* ---------------- sliders ---------------- */

function bindSlider(id, key){
  const el = document.getElementById(id);
  el.value = P[key];
  el.addEventListener('input', () => { P[key] = parseFloat(el.value); scheduleSave(); });
}

/* ---------------- cursor ring ---------------- */

export function updateCursor(){
  if (ptr.type === 'touch'){ cursorEl.style.opacity = 0; return; }   // ring under a finger is noise
  if (!ptr.inWindow && !ptr.down){ cursorEl.style.opacity = 0; return; }
  cursorEl.style.opacity = 1;
  const tool = resolveActiveTool();
  const pr = ptr.down ? pressureNow() : 0.3;
  const speed = tool.id === 'pen' ? 0 : (ptr.down ? ptr.speed : 0);
  const radius = tool.radius(pr, speed);
  const d = Math.max(radius * 2 * innerHeight, 4);
  cursorEl.style.width = d + 'px';
  cursorEl.style.height = d + 'px';
  cursorEl.style.left = ptr.cx + 'px';
  cursorEl.style.top = ptr.cy + 'px';
  cursorEl.classList.toggle('brush', tool.id === 'brush' || tool.id === 'fude');
  cursorEl.classList.toggle('white', state.inkWhite);
}

/* ---------------- wire everything ---------------- */

export function initUI(){
  bindSlider('sSize', 'SIZE');
  bindSlider('sFlow', 'FLOW');
  bindSlider('sBleed', 'BLEED');
  bindSlider('sDry', 'DRY');
  bindSlider('sColor', 'COLOR');
  bindSlider('sBink', 'BINK');

  modeBtn.addEventListener('click', nextMode);
  menuBtn.addEventListener('click', () => setMenuOpen(!menuOpen()));
  inkBtn.addEventListener('click', () => setInkWhite(!state.inkWhite));

  /* --- ink hue picker (delete this block + the #cInk element for pure b&w) --- */
  const cInk = document.getElementById('cInk');
  cInk.value = getColorHex();
  cInk.addEventListener('input', e => { applyInkHex(e.target.value); scheduleSave(); });
  /* --- end ink hue picker --- */

  document.getElementById('bFix').addEventListener('click', () => { fixDrawing(); setMenuOpen(false); });
  document.getElementById('bClear').addEventListener('click', () => { clearAll(); setMenuOpen(false); });
  document.getElementById('bSave').addEventListener('click', () => { shareOrSavePNG(); setMenuOpen(false); });
  document.getElementById('bGallery').addEventListener('click', () => { openGallery(); setMenuOpen(false); });

  window.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'b') nextMode();
    if (e.key === 'w') setInkWhite(!state.inkWhite);
    if (e.key === 'd') fixDrawing();
    if (e.key === 'f') toggleFullscreen();
    if (e.key === 'c') clearAll();
    if (e.key === 's') shareOrSavePNG();
    if (e.key === 'g') openGallery();
    if (e.key === 'Escape') closeGallery();
  });

  // reflect restored state into the controls
  setMode(state.uiMode);
  setInkWhite(state.inkWhite);
}
