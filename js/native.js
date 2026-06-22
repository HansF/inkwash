'use strict';

import { galleryOpen, closeGallery } from './gallery.js';
import { menuOpen, setMenuOpen } from './ui.js';

/* ---------------- Capacitor native shell ----------------
 * Everything here is a no-op in a plain browser. Plugins are reached through
 * the auto-injected `window.Capacitor.Plugins.*` bridge, so the web build
 * needs no Capacitor imports and ships unchanged.                            */

function cap(){ return window.Capacitor; }
export function isNative(){ const c = cap(); return !!(c && c.isNativePlatform && c.isNativePlatform()); }
function plugin(name){ const c = cap(); return c && c.Plugins ? c.Plugins[name] : null; }

export function hideSplash(){
  if (!isNative()) return;
  const SplashScreen = plugin('SplashScreen');
  if (SplashScreen) SplashScreen.hide().catch(() => {});
}

export function initNative(){
  if (!isNative()) return;

  const StatusBar = plugin('StatusBar');
  if (StatusBar){
    // Android 15+ (edge-to-edge) ignores setBackgroundColor, so instead let the
    // WebView draw under the status bar — the paper page background shows through.
    // viewport-fit=cover + the safe-area insets in CSS keep content clear of it.
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    StatusBar.setStyle({ style: 'LIGHT' }).catch(() => {});   // LIGHT = dark icons for light bg
  }

  const App = plugin('App');
  if (App){
    App.addListener('backButton', () => {
      if (galleryOpen()) { closeGallery(); return; }
      if (menuOpen()) { setMenuOpen(false); return; }
      App.exitApp();
    });
  }
}
