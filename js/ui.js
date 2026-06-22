'use strict';

import { P, state, ptr, TOUCH, applyInkHex } from './config.js';
import { toolById, nextToolId, resolveActiveTool } from './tools/index.js';
import { pressureNow } from './input.js';
import { fixDrawing, clearAll } from './sim.js';
import { shareOrSavePNG } from './share.js';
import { openGallery, closeGallery } from './gallery.js';
import { scheduleSave, getColorHex, setColorHex } from './storage.js';

const cursorEl = document.getElementById('cursor');
const uiEl = document.getElementById('ui');
const modeBtn = document.getElementById('bMode');
const menuBtn = document.getElementById('bMenu');

/* ---------------- ink palette ---------------- *
 * One control for ink colour: a row of swatches. White is just the last
 * swatch (it paints opaque gouache rather than absorptive ink).            */
const INK_SWATCHES = [
  { id: 'black',   hex: '#16161e' },
  { id: 'indigo',  hex: '#26356b' },
  { id: 'sepia',   hex: '#5b3a23' },
  { id: 'crimson', hex: '#8d1f2b' },
  { id: 'white',   white: true },
];
const swatchEls = [];

function refreshSwatchActive(){
  const hex = getColorHex().toLowerCase();
  for (const el of swatchEls){
    const isWhite = el.dataset.white === '1';
    const on = state.inkWhite ? isWhite : (!isWhite && el.dataset.hex === hex);
    el.classList.toggle('active', on);
  }
}

function selectSwatch(el){
  if (el.dataset.white === '1'){
    setInkWhite(true);
  } else {
    applyInkHex(el.dataset.hex);
    setColorHex(el.dataset.hex);
    setInkWhite(false);   // also refreshes active swatch + saves
  }
}

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
  menuBtn.textContent = open ? 'less' : 'more';
  menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  menuBtn.setAttribute('aria-label', open ? 'Fewer controls' : 'More controls');
}
export function menuOpen(){ return uiEl.classList.contains('open'); }

export function setInkWhite(v){
  state.inkWhite = v;
  refreshSwatchActive();
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
  // Ambient control visibility: the bar gets out of the way while you draw.
  // On desktop it surfaces only when you reach toward it (lower screen edge);
  // on touch it rests in view and fades only during a stroke.
  let show;
  if (ptr.down) show = false;
  else if (TOUCH) show = true;
  else show = ptr.cy > innerHeight - 140;
  uiEl.classList.toggle('show', show);

  if (ptr.type === 'touch' || ptr.down){ cursorEl.style.opacity = 0; return; }   // fade ring while drawing / under a finger
  if (!ptr.inWindow){ cursorEl.style.opacity = 0; return; }
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

  /* build the ink swatch palette */
  const swRoot = document.getElementById('swatches');
  for (const s of INK_SWATCHES){
    const b = document.createElement('button');
    b.className = 'swatch' + (s.white ? ' swatch-white' : '');
    if (s.white) b.dataset.white = '1';
    else { b.dataset.hex = s.hex; b.style.background = s.hex; }
    b.setAttribute('aria-label', 'Ink: ' + s.id);
    b.addEventListener('click', () => selectSwatch(b));
    swRoot.appendChild(b);
    swatchEls.push(b);
  }

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
  setMenuOpen(false);   // start calm: advanced controls tucked away
}
