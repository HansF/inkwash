'use strict';

import { ptr, state } from '../config.js';
import pen from './pen.js';
import brush from './brush.js';
import fude from './fude.js';

/* Tool registry. Add a new tool = create a module and append it here. */
export const TOOLS = [pen, brush, fude];

const byId = Object.fromEntries(TOOLS.map(t => [t.id, t]));
export function toolById(id){ return byId[id] || TOOLS[0]; }

/* the cycle order for the mode button / 'b' key */
export function nextToolId(id){
  const i = TOOLS.findIndex(t => t.id === id);
  return TOOLS[(i + 1) % TOOLS.length].id;
}

/* resolve which tool is actually active right now (was activeMode()) */
export function resolveActiveTool(){
  if (state.demoMode) return toolById(state.demoMode);
  if (ptr.type === 'touch' && state.pencilSeen) return brush;   // pencil draws, finger is water
  if (ptr.barrel) return toolById(state.uiMode === 'pen' ? 'brush' : 'pen');
  return toolById(state.uiMode);
}
