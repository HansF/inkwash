'use strict';

import { splat, ink, wet, brushNow } from '../sim.js';
import { P, ptr, inkColor, sizeMult } from '../config.js';

function radius(pr, speed){
  // Fude / sumi-e brush: broad at pressure, tapering with faster movement.
  return (0.004 + 0.036 * Math.pow(pr, 1.35)) * Math.min(Math.max(1.35 - speed * 0.22, 0.45), 1.35) * sizeMult();
}

/* fude: a soft calligraphy brush — many bristles, directional stretch, dry-brush scatter */
export default {
  id: 'fude', label: 'fude', icon: 'mode-fude',
  radius,
  stroke(dt, ctx){
    const { px, py, dx, dy, dist, pr, speed } = ctx;
    const r = radius(pr, speed);
    // smudge footprint kept close to the brush so bleed stays local (was r*1.7,
    // which boosted bleed over a wide area and made the stroke bloom outward)
    brushNow.x = ptr.bx; brushNow.y = ptr.by; brushNow.r = r * 0.9;
    const angle = Math.atan2(dy, dx || 1e-6);
    // directional elongation, but reined in so fast strokes don't fan out huge
    const stretch = 1.4 + 1.6 * Math.min(speed, 1.8) + 0.6 * pr;
    const dens = (0.95 + 1.85 * pr) * Math.min(Math.max(1.35 - speed * 0.38, 0.45), 1.35) * (0.45 + 0.55 * P.FLOW);
    // low wetness: sumi ink sets where it is laid, with only a hint of bleed —
    // keeps crisp, textured calligraphy strokes instead of an ever-spreading cloud
    const wetAmp = 0.06 + 0.08 * pr;
    const dryBrush = P.DRY * Math.min(Math.max(speed * 0.7 + (1 - pr) * 0.9, 0), 1);
    const bristles = 3 + Math.round(dryBrush * 5);
    const spacing = Math.max(r * 0.38, 0.0015);
    const steps = dist < r * 0.22 ? 1 : Math.min(Math.ceil(dist / spacing), 28);
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    for (let i = 1; i <= steps; i++){
      const t = steps === 1 ? 1 : i / steps;
      const x = px + dx * t, y = py + dy * t;
      splat(wet, x, y, r * 1.05, [wetAmp, 0, 0, 0], true, angle, stretch * 0.6);
      for (let j = 0; j < bristles; j++){
        const u = bristles === 1 ? 0 : (j / (bristles - 1) - 0.5);
        const skip = dryBrush > 0.35 && ((i + j * 3) % 7 === 0);
        if (skip) continue;
        const off = u * r * stretch * 0.4;
        const strand = 1 - Math.abs(u) * (0.45 + dryBrush * 0.35);
        const strandR = r * (0.78 - dryBrush * 0.38) * (0.82 + 0.18 * strand);
        splat(ink, x + nx * off, y + ny * off, strandR, inkColor(dens * strand * (1 - dryBrush * 0.45)), false, angle, stretch);
      }
    }
  },
};
