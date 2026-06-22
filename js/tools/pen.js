'use strict';

import { splat, ink, wet } from '../sim.js';
import { ptr, inkColor, sizeMult } from '../config.js';

function radius(pr, speed){
  return (0.0016 + 0.0042 * pr) * Math.min(Math.max(1.12 - speed * 0.3, 0.55), 1.12) * sizeMult();
}

/* pen: a fine nib laying near-dry ink that pools when it rests */
export default {
  id: 'pen', label: 'pen', icon: 'mode-pen',
  radius,
  stroke(dt, ctx){
    const { px, py, dx, dy, dist, pr, speed } = ctx;
    const r = radius(pr, speed);
    const dens = (0.55 + 1.05 * pr) * Math.min(Math.max(1.25 - speed * 0.45, 0.6), 1.25);
    // fresh ink carries enough water that strokes feather and overlapping
    // colours mingle wet-in-wet without reaching for the water brush
    const WET = 0.28;
    if (dist < r * 0.4){
      // ink pools while the pen rests
      splat(ink, ptr.bx, ptr.by, r * 1.15, inkColor(dens * dt * 4), false);
      splat(wet, ptr.bx, ptr.by, r * 2.8, [WET, 0, 0, 0], true);
      return;
    }
    const spacing = r * 0.6;
    const steps = Math.min(Math.ceil(dist / spacing), 60);
    for (let i = 1; i <= steps; i++){
      const t = i / steps;
      const x = px + dx * t, y = py + dy * t;
      splat(ink, x, y, r, inkColor(dens), false);
      splat(wet, x, y, r * 2.8, [WET, 0, 0, 0], true);
    }
  },
};
