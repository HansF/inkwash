'use strict';

import { canvas } from './gl.js';
import { render } from './sim.js';
import { shareOrSaveBlob } from './share.js';

/* ---------------- gallery (IndexedDB) ---------------- */

export function openGallery(){
  document.getElementById('gallery').classList.add('open');
  loadGallery();
}
export function closeGallery(){
  document.getElementById('gallery').classList.remove('open');
}
export function galleryOpen(){
  return document.getElementById('gallery').classList.contains('open');
}

function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('inkwash', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('paintings')){
        const store = db.createObjectStore('paintings', { keyPath: 'id' });
        store.createIndex('ts', 'ts', { unique: false });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function makeThumbnail(sourceCanvas, maxW){
  return new Promise(resolve => {
    const ar = sourceCanvas.width / sourceCanvas.height;
    const tw = maxW, th = Math.round(maxW / ar);
    const tc = document.createElement('canvas');
    tc.width = tw; tc.height = th;
    tc.getContext('2d').drawImage(sourceCanvas, 0, 0, tw, th);
    tc.toBlob(resolve, 'image/jpeg', 0.82);
  });
}

export function savePainting(){
  render();
  return Promise.all([
    new Promise(r => canvas.toBlob(r, 'image/png')),
    makeThumbnail(canvas, 640),
  ]).then(([full, thumb]) => openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('paintings', 'readwrite');
    tx.objectStore('paintings').add({
      id: crypto.randomUUID(),
      ts: Date.now(),
      full,
      thumb,
    });
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  })));
}

function blobToDataURL(blob){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export function loadGallery(){
  const grid = document.getElementById('gallery-grid');
  openDB().then(db => {
    const tx = db.transaction('paintings', 'readonly');
    const req = tx.objectStore('paintings').index('ts').getAll();
    req.onsuccess = e => {
      const items = e.target.result.reverse();
      grid.innerHTML = '';
      if (!items.length){
        const d = document.createElement('div');
        d.id = 'gallery-empty';
        d.textContent = 'no saved paintings yet';
        grid.appendChild(d);
        return;
      }
      items.forEach(item => {
        const date = new Date(item.ts);
        const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    + ' · ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const card = document.createElement('div');
        card.className = 'gal-card';
        card.innerHTML = `
          <img alt="painting from ${label}">
          <div class="gal-card-foot">
            <span class="gal-card-date">${label}</span>
            <button data-id="${item.id}" data-action="dl">share</button>
            <button data-id="${item.id}" data-action="del">delete</button>
          </div>`;
        grid.appendChild(card);
        blobToDataURL(item.thumb).then(url => { card.querySelector('img').src = url; });
      });
      grid.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          if (btn.dataset.action === 'dl') exportPainting(id);
          else deletePainting(id);
        });
      });
    };
  });
}

function exportPainting(id){
  openDB().then(db => {
    const req = db.transaction('paintings', 'readonly').objectStore('paintings').get(id);
    req.onsuccess = e => {
      const item = e.target.result;
      if (!item) return;
      const name = 'inkwash-' + new Date(item.ts).toISOString().slice(0, 16).replace(/[T:]/g, '-') + '.png';
      shareOrSaveBlob(item.full, name);
    };
  });
}

function deletePainting(id){
  openDB().then(db => {
    const tx = db.transaction('paintings', 'readwrite');
    tx.objectStore('paintings').delete(id);
    tx.oncomplete = () => loadGallery();
  });
}

/* wire the modal chrome */
document.getElementById('bGalClose').addEventListener('click', closeGallery);
document.getElementById('bGalSave').addEventListener('click', () => {
  const btn = document.getElementById('bGalSave');
  btn.textContent = 'saving…';
  btn.classList.add('gal-saving');
  savePainting().then(() => {
    loadGallery();
  }).finally(() => {
    btn.textContent = 'save current';
    btn.classList.remove('gal-saving');
  });
});
