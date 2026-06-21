# Inkwash

<img width="461" height="256" alt="A few quick inkwash sketches" src="https://github.com/user-attachments/assets/89493704-4edc-4dac-b20b-139c86be1b1e" />

Pen-and-ink with living water — a WebGL2 fluid-simulation drawing app. Installable
as a PWA, fully offline after first load, and packageable as a native app with
Capacitor. Paintings are saved on-device (IndexedDB); settings persist between
sessions. No server needed once installed.

**Draw: <https://johnowhitaker.github.io/inkwash/>**

**About (WIP): <https://johnowhitaker.github.io/inkwash/about>**

Demo video of a quick sketch [here](https://x.com/johnowhitaker/status/2065118226879811737?s=20) (Thread contains more examples)

The **pen** lays down dark ink; pressure and speed shape the line. The **brush**
(hold the pen's barrel button, or press `b`) lays down water instead — ink flows,
bleeds and blends only where the paper is wet, then gradually dries in place.
Press `b` again for **fude** mode: a sumi-e / Japanese calligraphy-inspired
brush with pressure-sensitive broad strokes, tapered movement, bristle separation,
and dry-brush texture controlled by the existing flow and dry sliders.

On iPad, the Apple Pencil draws and **your finger is the water brush**.
Works on phones and tablets without a stylus too — the controls stay on screen.

Keys: `b` pen/water/fude · `w` white ink · `d` fix the drawing into the paper ·
`f` fullscreen · `c` clear · `s` share/save PNG · `g` gallery. Sliders appear at
the bottom edge.

## Running

No build step for the web app — serve the folder over HTTP and open `index.html`
(WebGL2 required). ES modules need an HTTP origin, so opening the file directly
over `file://` won't work; use any static server, e.g. `python3 -m http.server`.

## Project layout

The app is plain ES modules (no bundler):

- `index.html` — markup, styles, and the module entry point
- `js/` — `main.js` (bootstrap), `gl.js`, `shaders.js`, `sim.js` (the fluid
  engine), `input.js`, `ui.js`, `gallery.js`, `storage.js`, `share.js`,
  `native.js`, `onboarding.js`
- `js/tools/` — one file per brush (`pen.js`, `brush.js`, `fude.js`) plus a
  registry in `index.js`. **Add a tool** by writing a module that exports
  `{ id, label, icon, radius(), stroke() }` and appending it to `TOOLS`.
- `sw.js` / `manifest.json` — PWA offline shell + install metadata

## Native app (Capacitor)

The same web files wrap into an Android/iOS app via [Capacitor](https://capacitorjs.com):

```sh
npm install
npm run add:android      # or: npm run add:ios
npm run android          # copies www/ → cap sync → opens the native project
```

`scripts/copy-www.mjs` assembles the static files into `www/` (Capacitor's
`webDir`); the repo root stays the canonical web app for GitHub Pages. Native
status bar, splash screen, hardware back button, and the system share sheet are
wired in `js/native.js` and `js/share.js`, all behind `Capacitor.isNativePlatform()`
so the identical source still runs as a plain web PWA.

