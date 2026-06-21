'use strict';

import { canvas } from './gl.js';
import { render } from './sim.js';

/* ---------------- share / save to device ----------------
 * Strategy: native Capacitor Share (accessed via the global bridge so the
 * web build needs no imports) → Web Share API with files → <a download>.   */

function isNative(){ return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }

function stamp(d = new Date()){
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
export function defaultName(d){ return 'inkwash-' + stamp(d) + '.png'; }

function blobToBase64(blob){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function download(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function shareNative(blob, filename){
  const { Filesystem, Share } = window.Capacitor.Plugins;
  const data = await blobToBase64(blob);
  // Cache directory = "Cache" enum value; passed as a string to avoid importing the enum.
  await Filesystem.writeFile({ path: filename, data, directory: 'CACHE' });
  const { uri } = await Filesystem.getUri({ path: filename, directory: 'CACHE' });
  await Share.share({ title: 'inkwash', url: uri, dialogTitle: 'Share painting' });
}

/* Share or save an arbitrary PNG blob. Resolves once handled; never rejects
 * to the caller for the common "user dismissed the share sheet" case.        */
export async function shareOrSaveBlob(blob, filename = defaultName()){
  if (!blob) return;
  if (isNative()){
    try { await shareNative(blob, filename); return; }
    catch (e){ if (e && /cancel/i.test(e.message || '')) return; /* fall through */ }
  }
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })){
      await navigator.share({ files: [file], title: 'inkwash' });
      return;
    }
  } catch (e){ if (e && e.name === 'AbortError') return; /* fall through to download */ }
  download(blob, filename);
}

/* Render the live canvas and share/save it. */
export function shareOrSavePNG(){
  render();
  canvas.toBlob(b => shareOrSaveBlob(b, defaultName()), 'image/png');
}
