'use strict';

import { P, state, applyInkHex } from './config.js';

/* ---------------- settings persistence (localStorage) ----------------
 * Paintings live in IndexedDB (see gallery.js); this only persists the
 * lightweight UI state so the app reopens exactly as the user left it.    */

const KEY = 'inkwash:settings';
export const DEFAULT_HEX = '#16161e';
let colorHex = DEFAULT_HEX;

export function getColorHex(){ return colorHex; }
export function setColorHex(hex){ colorHex = hex; }

export function loadSettings(){
  let raw;
  try { raw = localStorage.getItem(KEY); } catch (e){ return; }
  if (!raw) return;
  let s;
  try { s = JSON.parse(raw); } catch (e){ return; }
  if (s.P) for (const k of Object.keys(P)) if (typeof s.P[k] === 'number') P[k] = s.P[k];
  if (typeof s.tool === 'string') state.uiMode = s.tool;
  if (typeof s.inkWhite === 'boolean') state.inkWhite = s.inkWhite;
  if (typeof s.colorHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.colorHex)){
    colorHex = s.colorHex;
    applyInkHex(colorHex);
  }
}

export function saveSettings(){
  const data = {
    P: { ...P },
    tool: state.uiMode,
    inkWhite: state.inkWhite,
    colorHex,
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e){ /* quota / private mode */ }
}

let saveTimer = null;
export function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSettings, 250);
}
