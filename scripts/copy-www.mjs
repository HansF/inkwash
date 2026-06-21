#!/usr/bin/env node
'use strict';

/* Assemble the Capacitor web directory (www/) from the static source files.
 * The app's canonical home stays at the repo root (so GitHub Pages keeps
 * serving it); www/ is a disposable copy that `cap sync` packages.          */

import { rm, mkdir, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const www = join(root, 'www');

const ENTRIES = [
  'index.html',
  'about.html',
  'sw.js',
  'manifest.json',
  'icons',
  'images',
  'js',
];

await rm(www, { recursive: true, force: true });
await mkdir(www, { recursive: true });

for (const entry of ENTRIES){
  await cp(join(root, entry), join(www, entry), { recursive: true });
}

console.log(`[copy-www] copied ${ENTRIES.length} entries into www/`);
