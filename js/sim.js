'use strict';

import { gl, canvas, fitCanvas, blit, createFBO, createDouble, getRes } from './gl.js';
import {
  progCopy, progSplat, progAdvVel, progAdvWet, progAdvInk, progExch,
  progDiv, progPressure, progGradSub, progCurl, progVort, progDisplay,
} from './shaders.js';
import { P, SIM_BASE, PRESSURE_ITER, DEMO } from './config.js';

/* ---------------- targets ---------------- */

const HF = gl.HALF_FLOAT;
// live bindings: reassigned by initTargets() on resize; importers see the latest
export let velocity, divergence, curl, pressure, ink, fixed, wet;

export function initTargets(){
  const dyeBase = DEMO ? 1024 : Math.min(2048, Math.min(canvas.width, canvas.height));
  const sim = getRes(SIM_BASE), dye = getRes(dyeBase);
  velocity  = createDouble(sim.w, sim.h, gl.RG16F, gl.RG, HF, gl.LINEAR);
  divergence= createFBO(sim.w, sim.h, gl.R16F, gl.RED, HF, gl.NEAREST);
  curl      = createFBO(sim.w, sim.h, gl.R16F, gl.RED, HF, gl.NEAREST);
  pressure  = createDouble(sim.w, sim.h, gl.R16F, gl.RED, HF, gl.NEAREST);
  ink       = createDouble(dye.w, dye.h, gl.RGBA16F, gl.RGBA, HF, gl.LINEAR);
  fixed     = createDouble(dye.w, dye.h, gl.RGBA16F, gl.RGBA, HF, gl.LINEAR);
  wet       = createDouble(dye.w, dye.h, gl.R16F, gl.RED, HF, gl.LINEAR);
}
initTargets();

function copyInto(srcTex, dst){
  progCopy.bind();
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.uniform1i(progCopy.u.uTex, 0);
  gl.uniform1f(progCopy.u.uValue, 1.0);
  blit(dst);
}

let resizeTimer = null;
function onResize(){
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const oldInk = ink.read.tex, oldFix = fixed.read.tex, oldWet = wet.read.tex, oldVel = velocity.read.tex;
    fitCanvas();
    initTargets();
    copyInto(oldVel, velocity.write); velocity.swap();
    copyInto(oldInk, ink.write); ink.swap();
    copyInto(oldFix, fixed.write); fixed.swap();
    copyInto(oldWet, wet.write); wet.swap();
  }, 180);
}
window.addEventListener('resize', onResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

export function clearAll(){
  for (const d of [velocity, pressure, ink, fixed, wet]){
    for (const f of [d.read, d.write]){
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }
}

/* ---------------- splats (blended, scissored) ---------------- */

export function splat(target, x, y, r, c, useMax, angle = 0, stretch = 1){
  const f = target.read;
  gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
  gl.viewport(0, 0, f.w, f.h);
  const ex = Math.ceil(r * 4.5 * f.h) + 2;
  const cx = Math.round(x * f.w), cy = Math.round(y * f.h);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(Math.max(cx - ex, 0), Math.max(cy - ex, 0), ex * 2, ex * 2);
  gl.enable(gl.BLEND);
  if (useMax) gl.blendEquation(gl.MAX);
  else { gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE); }
  progSplat.bind();
  gl.uniform1f(progSplat.u.uAspect, canvas.width / canvas.height);
  gl.uniform2f(progSplat.u.uPoint, x, y);
  gl.uniform4f(progSplat.u.uColor, c[0], c[1], c[2], c[3]);
  gl.uniform1f(progSplat.u.uRadius, r * r);
  gl.uniform2f(progSplat.u.uShape, angle, stretch);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.blendEquation(gl.FUNC_ADD);
  gl.disable(gl.BLEND);
  gl.disable(gl.SCISSOR_TEST);
}

/* ---------------- brush footprint + fixing state ---------------- */

export const brushNow = { x: 0, y: 0, r: 0 };   // active brush footprint this frame, for smudge
let fixTimer = 0;                                // > 0 while pigment is settling into the paper

export function fixDrawing(){ fixTimer = 1.2; }

/* ---------------- simulation step ---------------- */

export function step(dt){
  const fixing = fixTimer > 0;
  if (fixing) fixTimer -= dt;

  // velocity: advect + damp, confined to wet paper (frozen hard while fixing)
  progAdvVel.bind();
  gl.uniform1i(progAdvVel.u.uVelocity, velocity.read.attach(0));
  gl.uniform1i(progAdvVel.u.uWet, wet.read.attach(1));
  gl.uniform2f(progAdvVel.u.uTexel, velocity.texel[0], velocity.texel[1]);
  gl.uniform1f(progAdvVel.u.uDt, dt);
  gl.uniform1f(progAdvVel.u.uDissipation,
               Math.exp(-dt * (3.0 - P.FLOW * 2.4)) * (fixing ? Math.exp(-dt * 7) : 1));
  blit(velocity.write); velocity.swap();

  progCurl.bind();
  gl.uniform1i(progCurl.u.uVelocity, velocity.read.attach(0));
  gl.uniform2f(progCurl.u.uTexel, velocity.texel[0], velocity.texel[1]);
  blit(curl);

  progVort.bind();
  gl.uniform1i(progVort.u.uVelocity, velocity.read.attach(0));
  gl.uniform1i(progVort.u.uCurl, curl.attach(1));
  gl.uniform2f(progVort.u.uTexel, velocity.texel[0], velocity.texel[1]);
  gl.uniform1f(progVort.u.uCurlAmt, 4 + P.FLOW * 22);
  gl.uniform1f(progVort.u.uDt, dt);
  blit(velocity.write); velocity.swap();

  progDiv.bind();
  gl.uniform1i(progDiv.u.uVelocity, velocity.read.attach(0));
  gl.uniform2f(progDiv.u.uTexel, velocity.texel[0], velocity.texel[1]);
  blit(divergence);

  progCopy.bind();
  gl.uniform1i(progCopy.u.uTex, pressure.read.attach(0));
  gl.uniform1f(progCopy.u.uValue, 0.8);
  blit(pressure.write); pressure.swap();

  progPressure.bind();
  gl.uniform1i(progPressure.u.uDivergence, divergence.attach(1));
  gl.uniform2f(progPressure.u.uTexel, velocity.texel[0], velocity.texel[1]);
  for (let i = 0; i < PRESSURE_ITER; i++){
    gl.uniform1i(progPressure.u.uPressure, pressure.read.attach(0));
    blit(pressure.write); pressure.swap();
  }

  progGradSub.bind();
  gl.uniform1i(progGradSub.u.uPressure, pressure.read.attach(0));
  gl.uniform1i(progGradSub.u.uVelocity, velocity.read.attach(1));
  gl.uniform2f(progGradSub.u.uTexel, velocity.texel[0], velocity.texel[1]);
  blit(velocity.write); velocity.swap();

  // water dries; DRY slider sets the timescale (flash-dries while fixing)
  const dryTau = fixing ? 0.25 : 2 + (1 - P.DRY) * 16;
  progAdvWet.bind();
  gl.uniform1i(progAdvWet.u.uVelocity, velocity.read.attach(0));
  gl.uniform1i(progAdvWet.u.uWet, wet.read.attach(1));
  gl.uniform2f(progAdvWet.u.uTexel, velocity.texel[0], velocity.texel[1]);
  gl.uniform2f(progAdvWet.u.uSrcTexel, wet.texel[0], wet.texel[1]);
  gl.uniform1f(progAdvWet.u.uDt, dt);
  gl.uniform1f(progAdvWet.u.uDecay, Math.exp(-dt / dryTau));
  gl.uniform1f(progAdvWet.u.uSpread, 0.12);
  blit(wet.write); wet.swap();

  // pigment: flows and bleeds only where wet
  const C = P.COLOR;
  progAdvInk.bind();
  gl.uniform1i(progAdvInk.u.uVelocity, velocity.read.attach(0));
  gl.uniform1i(progAdvInk.u.uSource, ink.read.attach(1));
  gl.uniform1i(progAdvInk.u.uWet, wet.read.attach(2));
  gl.uniform2f(progAdvInk.u.uTexel, velocity.texel[0], velocity.texel[1]);
  gl.uniform2f(progAdvInk.u.uSrcTexel, ink.texel[0], ink.texel[1]);
  gl.uniform1f(progAdvInk.u.uDt, dt);
  gl.uniform1f(progAdvInk.u.uBleed, P.BLEED);
  gl.uniform1f(progAdvInk.u.uAspect, canvas.width / canvas.height);
  gl.uniform3f(progAdvInk.u.uChroma, 1.0 + 0.85 * C, 1.0 + 0.15 * C, Math.max(0.25, 1.0 - 0.65 * C));
  gl.uniform3f(progAdvInk.u.uBrush, brushNow.x, brushNow.y, brushNow.r);
  blit(ink.write); ink.swap();

  // exchange with the fixed layer: settle down while fixing, lift up under water/scrubbing
  const settle = fixing ? 1 - Math.exp(-dt * 5) : 0;
  progExch.bind();
  gl.uniform1i(progExch.u.uFixed, fixed.read.attach(0));
  gl.uniform1i(progExch.u.uInk, ink.read.attach(1));
  gl.uniform1i(progExch.u.uWet, wet.read.attach(2));
  gl.uniform1f(progExch.u.uSettle, settle);
  gl.uniform1f(progExch.u.uDt, dt);
  gl.uniform1f(progExch.u.uAspect, canvas.width / canvas.height);
  gl.uniform3f(progExch.u.uBrush, brushNow.x, brushNow.y, brushNow.r);
  gl.uniform1f(progExch.u.uMode, 0);
  blit(fixed.write);
  gl.uniform1f(progExch.u.uMode, 1);
  blit(ink.write);
  fixed.swap(); ink.swap();
}

export function render(){
  progDisplay.bind();
  gl.uniform1i(progDisplay.u.uInk, ink.read.attach(0));
  gl.uniform1i(progDisplay.u.uWet, wet.read.attach(1));
  gl.uniform1i(progDisplay.u.uFixed, fixed.read.attach(2));
  gl.uniform2f(progDisplay.u.uTexel, ink.texel[0], ink.texel[1]);
  gl.uniform2f(progDisplay.u.uRes, canvas.width, canvas.height);
  gl.uniform1f(progDisplay.u.uInkStrength, 1.9);
  gl.uniform1f(progDisplay.u.uEdge, 1.35);
  gl.uniform1f(progDisplay.u.uGrain, 0.55);
  gl.uniform1f(progDisplay.u.uWhiteTint, P.COLOR * 0.35);
  blit(null);
}
