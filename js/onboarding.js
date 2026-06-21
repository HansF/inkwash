'use strict';

import { TOUCH } from './config.js';

/* ---------------- first-run onboarding ---------------- */

const KEY = 'inkwash:onboarded';

const ROWS = TOUCH
  ? [
      ['pencil / finger', 'pencil lays ink · finger spreads water'],
      ['mode', 'tap mode to cycle pen · water · fude'],
      ['fix', 'fix settles the ink so you can layer over it'],
      ['gallery', 'gallery keeps your paintings on this device'],
    ]
  : [
      ['draw', 'click-drag lays ink · hold the pen/barrel button for water'],
      ['mode', 'press B (or tap mode) to cycle pen · water · fude'],
      ['fix', 'press D to settle the ink so you can layer over it'],
      ['gallery', 'press G — your paintings are saved on this device'],
    ];

export function maybeShowOnboarding(){
  let seen;
  try { seen = localStorage.getItem(KEY); } catch (e){ seen = '1'; }   // private mode: skip
  if (seen) return;

  const ov = document.createElement('div');
  ov.id = 'onboard';
  ov.innerHTML = `
    <div id="onboard-card">
      <h1>inkwash</h1>
      <p class="onboard-sub">pen-and-ink with living water</p>
      <dl>${ROWS.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <button id="onboard-go">begin</button>
    </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  const dismiss = () => {
    ov.classList.remove('show');
    try { localStorage.setItem(KEY, '1'); } catch (e){ /* ignore */ }
    setTimeout(() => ov.remove(), 400);
  };
  document.getElementById('onboard-go').addEventListener('click', dismiss);
}
