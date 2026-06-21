'use strict';

/* ---------------- canvas + webgl2 context + gl plumbing ---------------- */

export const canvas = document.getElementById('c');

export function fitCanvas(){
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.max(2, Math.round(innerWidth * dpr));
  canvas.height = Math.max(2, Math.round(innerHeight * dpr));
}
fitCanvas();

export const gl = canvas.getContext('webgl2', { alpha:false, depth:false, stencil:false,
                                                antialias:false, preserveDrawingBuffer:true });
if (!gl){
  document.body.innerHTML = '<div class="err">webgl2 unavailable</div>';
  throw new Error('webgl2 unavailable');
}
gl.getExtension('EXT_color_buffer_float');
gl.disable(gl.BLEND);

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

export function compile(type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
  return s;
}
const quadVS = compile(gl.VERTEX_SHADER, VERT);

export function program(fsSrc){
  const p = gl.createProgram();
  gl.attachShader(p, quadVS);
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++){ const inf = gl.getActiveUniform(p, i); u[inf.name] = gl.getUniformLocation(p, inf.name); }
  return { p, u, bind(){ gl.useProgram(p); } };
}

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);
const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

export function blit(target){
  if (target == null){
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  } else {
    gl.viewport(0, 0, target.w, target.h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export function createFBO(w, h, internal, format, type, filter){
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { tex, fbo, w, h, texel: [1/w, 1/h],
           attach(unit){ gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, this.tex); return unit; } };
}

export function createDouble(w, h, internal, format, type, filter){
  let a = createFBO(w, h, internal, format, type, filter);
  let b = createFBO(w, h, internal, format, type, filter);
  return { w, h, texel: [1/w, 1/h],
           get read(){ return a; }, get write(){ return b; },
           swap(){ const t = a; a = b; b = t; } };
}

export function getRes(base){
  const ar = canvas.width / canvas.height;
  return ar > 1 ? { w: Math.round(base * ar), h: base }
                : { w: base, h: Math.round(base / ar) };
}
