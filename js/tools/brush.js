'use strict';

import { splat, ink, wet, velocity, brushNow } from '../sim.js';
import { P, ptr, inkColor, sizeMult } from '../config.js';

function radius(pr, speed){
  return (0.014 + 0.060 * pr) * (1 + Math.min(speed, 2.5) * 0.28) * sizeMult();
}

/* water brush: pushes the flow field and wets the paper; carries ink only via "brush ink" */
export default {
  id: 'brush', label: 'water', icon: 'mode-brush',
  radius,
  stroke(dt, ctx){
    const { px, py, dx, dy, dist, pr, speed } = ctx;
    const r = radius(pr, speed);
    brushNow.x = ptr.bx; brushNow.y = ptr.by; brushNow.r = r;
    const wAmp = 0.5 + 0.5 * pr;
    const force = 15 + P.FLOW * 95;
    const vmax = 240;
    let vx = (dx / Math.max(dt, 1e-4)) * force;
    let vy = (dy / Math.max(dt, 1e-4)) * force;
    const vm = Math.hypot(vx, vy);
    if (vm > vmax){ vx *= vmax / vm; vy *= vmax / vm; }
    const bdens = P.BINK * 0.10 * (0.4 + 0.6 * pr);

    if (dist < r * 0.25){
      splat(wet, ptr.bx, ptr.by, r, [wAmp, 0, 0, 0], true);
      // gentle stir while the brush dwells
      const a = Math.random() * Math.PI * 2, jm = (6 + 26 * P.FLOW) * pr;
      splat(velocity, ptr.bx, ptr.by, r * 0.9, [Math.cos(a) * jm, Math.sin(a) * jm, 0, 0], false);
      if (bdens > 0)
        splat(ink, ptr.bx, ptr.by, r * 0.8, inkColor(bdens * dt * 5), false);
      return;
    }
    const spacing = r * 0.7;
    const steps = Math.min(Math.ceil(dist / spacing), 12);
    for (let i = 1; i <= steps; i++){
      const t = i / steps;
      const x = px + dx * t, y = py + dy * t;
      splat(wet, x, y, r, [wAmp, 0, 0, 0], true);
      splat(velocity, x, y, r * 1.15, [vx, vy, 0, 0], false);
      if (bdens > 0)
        splat(ink, x, y, r * 0.8, inkColor(bdens), false);
    }
  },
};
