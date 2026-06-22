# inkwash — agent guide

A WebGL2 watercolor/ink fluid-simulation drawing app. Ships three ways from one
source: a static **web app**, an installable **PWA** (offline after first load),
and a **native Android/iOS app** via Capacitor. MVP scope: everything is
client-side — no server, no accounts, no cloud. Near-zero server load after install.

## Run it

The web app is **buildless ES modules**, but ES modules need an HTTP origin
(`file://` won't load them):

```sh
python3 -m http.server 8123        # then open http://localhost:8123
```

`?demo` runs a scripted headless smoke test (draws strokes, then logs
`[demo] done … glErr=0`). Keep it working through any refactor — it's the
cheapest regression check.

## Native builds (Capacitor)

`android/` and `ios/` are **gitignored and regenerated** by `cap add`. CI and
local builds recreate them each time, so don't hand-edit them expecting it to
persist (see "Status bar" gotcha below).

```sh
npm install
npm run build:www        # node scripts/copy-www.mjs -> assembles www/ (Capacitor webDir)
npm run sync             # build:www + cap sync
npm run android          # sync + cap open android   (or: ios)
```

**JDK 21 is required** for the Gradle build. The machine default may be newer
(e.g. 26) which Gradle/AGP reject. Set it inline:

```sh
export JAVA_HOME=/usr/lib/jvm/java-21-temurin ANDROID_SDK_ROOT=/opt/android-sdk ANDROID_HOME=/opt/android-sdk
npm run build:www && npx cap add android && npx cap sync android
cd android && ./gradlew assembleDebug --no-daemon
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p com.hansf.inkwash -c android.intent.category.LAUNCHER 1
```

appId `com.hansf.inkwash`. The repo **root stays the canonical web app** (GitHub
Pages serves `/inkwash/`); `www/` is a disposable copy only for Capacitor.

## Architecture

Plain ES modules, no bundler. `index.html` holds markup + styles and loads
`js/main.js` as a module.

- `js/config.js` — **dependency hub, imports nothing**. Exports the shared
  *mutable* objects (`P` params, `state`, `ptr`) plus pure helpers
  (`inkColor`, `sizeMult`, `applyInkHex`). Shared state lives on objects because
  ES modules forbid reassigning an imported binding from another module.
- `js/gl.js` — canvas + WebGL2 context + plumbing (compile/program/blit/FBOs).
- `js/shaders.js` — all GLSL + compiled programs.
- `js/sim.js` — the fluid engine: targets, `step(dt)`, `render()`, `splat()`,
  `brushNow`, `fixDrawing()`. Targets are `export let` (live bindings,
  reassigned on resize).
- `js/input.js` — pointer/pressure handlers, `pressureNow()`.
- `js/tools/` — **tool registry**. `pen.js`, `brush.js`, `fude.js` each
  `export default { id, label, icon, radius(pr,speed), stroke(dt, ctx) }`;
  `index.js` holds `TOOLS` + `resolveActiveTool()`. **Add a brush = new file +
  one line in `TOOLS`.** `stroke` gets `ctx = {px,py,dx,dy,dist,pr,speed}` and
  imports `splat`/targets/`inkColor` itself.
- `js/ui.js` — sliders, mode button, menu, keyboard, cursor ring.
- `js/gallery.js` — IndexedDB paintings + the modal.
- `js/storage.js` — settings persistence (localStorage).
- `js/share.js` — share/save PNG.
- `js/native.js` — Capacitor-only shell behaviour.
- `js/onboarding.js` — first-run overlay.
- `js/main.js` — bootstrap: `loadSettings → initUI → maybeShowOnboarding →
  initNative`, the `frame()` loop, the slimmed `updateBrush`, and the `?demo` path.

## Storage

- **Paintings** → IndexedDB (`gallery.js`, db `inkwash`, store `paintings`).
- **Settings** (params, tool, ink, hue) → localStorage key `inkwash:settings`,
  hydrated before the first frame.
- **Onboarding seen** → localStorage `inkwash:onboarded`.

## PWA / offline

`sw.js` (cache `inkwash-v2`) cache-firsts the whole app shell including every
`js/` module — **add new modules to its `SHELL` list**. SW registration is
skipped under Capacitor (assets are already local).

## Buildless Capacitor (key pattern)

Native features are reached through the runtime-injected
`window.Capacitor.Plugins.*` bridge, guarded by `Capacitor.isNativePlatform()` —
**no `@capacitor/*` imports in source**, so no bundler and the identical files
run as both PWA and native app. Verified on-device: `native:true`,
`platform:android`, all plugins present on the bridge.

## Conventions

- Carried over from the app's single-file origin: sparse uppercase UI labels,
  paper `#f1efe8` + charcoal `rgba(38,38,48,…)` palette, no external deps.
- When refactoring the engine, **move code verbatim** and lean on `?demo`.
- Match surrounding style; keep things light (MVP).

## CI

`.github/workflows/`: `pages.yml` (deploy PWA — needs Pages source = "GitHub
Actions"), `android.yml` (debug APK artifact), `ios.yml` (unsigned simulator
build), `android-release.yml` (signed APK on `v*` tag; needs secrets
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`).

## Known gotchas

- **Android 15+ edge-to-edge status bar** (test device is Android 16 / SDK 36):
  `StatusBar.setBackgroundColor` is a no-op; the OS shows the *window
  background* (black) behind a transparent bar. Goal is a paper bar with dark
  icons — in progress in `native.js` (overlay + `setStyle`); a durable fix may
  require committing `android/` to theme `windowBackground`, or lowering
  targetSdk. CSS already uses `viewport-fit=cover` + `env(safe-area-inset-*)`.
- **Chromatic bleed looks like colored (red) halos** around heavy wet strokes —
  this is the intended per-channel differential bleed, not a bug. Subtle on real
  strokes; pronounced when over-wetting (e.g. automated swipes).
- **On-device debugging**: enable USB debugging; the WebView exposes
  `webview_devtools_remote_<pid>`. `adb forward tcp:9333 localabstract:webview_devtools_remote_<pid>`
  then drive CDP over the page's `webSocketDebuggerUrl` (Node 20+ has a global
  `WebSocket`). `adb shell svc power stayon usb` keeps the screen awake.
- **Headless web testing**: puppeteer with
  `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL2.
```
