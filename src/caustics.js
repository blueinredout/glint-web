// Caustics for the intro selection, rendered as a WebGL2 fragment shader.
//
// Four octaves of Worley F1 noise (lacunarity 2, gain 0.5, one cell per 100px)
// share a rigid drift. Each octave is ridge-shaped and weighted, which keeps
// the cell boundaries sharp at any device pixel ratio.

const VERTEX_SOURCE = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;

uniform vec2 u_viewport; // CSS pixels
uniform float u_scale;   // device pixels per CSS pixel
uniform vec4 u_rect;     // selection: x, y, width, height in CSS pixels (top-down)
uniform float u_time;    // seconds since the drag started

out vec4 outColor;

// Hash without sine: stable across drivers, no banding at large coordinates.
vec2 hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Worley F1 distance in cell units (0 at a feature point, ~1 at a far corner).
float worley(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  float best = 8.0;
  for (int y = -1; y <= 1; y += 1) {
    for (int x = -1; x <= 1; x += 1) {
      vec2 offset = vec2(float(x), float(y));
      vec2 delta = offset + hash2(cell + offset) - local;
      best = min(best, dot(delta, delta));
    }
  }
  return sqrt(best);
}

// Ridge-shaped octaves, weighted by frequency. Applying the curve per octave
// instead of once to the sum keeps the fine cells, so the result reads as a
// caustic net rather than an averaged haze.
float field(vec2 px) {
  // One cell per 100 CSS pixels.
  vec2 p = px * 0.01;
  // One shared drift keeps the octaves aligned as the net moves.
  p += u_time * vec2(0.125, 0.0833);

  float sum = 0.0;
  float freq = 1.0;
  float gain = 0.5333;
  for (int octave = 0; octave < 4; octave += 1) {
    float n = clamp(worley(p * freq), 0.0, 1.0);
    sum += gain * pow(clamp((n - 0.45) / 0.55, 0.0, 1.0), 3.0);
    freq *= 2.0;
    gain *= 0.5;
  }
  return sum;
}

void main() {
  vec2 fragCss = gl_FragCoord.xy / u_scale;
  vec2 px = vec2(fragCss.x, u_viewport.y - fragCss.y);

  float alpha = clamp(field(px) * 0.5, 0.0, 1.0);

  // Fade the net out near the border so it never crowds the glow.
  vec2 edge = min(px - u_rect.xy, u_rect.xy + u_rect.zw - px);
  alpha *= mix(0.45, 1.0, smoothstep(0.0, 22.0, min(edge.x, edge.y)));

  outColor = vec4(vec3(alpha), alpha);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || 'Shader compile failed');
  }
  return shader;
}

export function createCaustics(canvas) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
    });
  } catch {
    gl = null;
  }

  const noop = { start() {}, update() {}, stop() {}, resize() {} };
  if (!gl) return noop;

  let program;
  try {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
    }
  } catch (error) {
    console.warn('Caustics disabled:', error);
    return noop;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const uniforms = {
    viewport: gl.getUniformLocation(program, 'u_viewport'),
    scale: gl.getUniformLocation(program, 'u_scale'),
    rect: gl.getUniformLocation(program, 'u_rect'),
    time: gl.getUniformLocation(program, 'u_time'),
  };

  gl.useProgram(program);
  gl.bindVertexArray(gl.createVertexArray());
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);

  let scale = 1;
  let frame = 0;
  let running = false;
  let startedAt = 0;
  let rect = [0, 0, 0, 0];

  function resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    // Sharp up to 2x, capped by a pixel budget so a full-screen drag on a
    // high-DPI display stays inside the frame budget.
    const budget = Math.sqrt(2_800_000 / (width * height));
    scale = Math.min(window.devicePixelRatio || 1, 2, budget);
    const bufferWidth = Math.round(width * scale);
    const bufferHeight = Math.round(height * scale);
    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
    }
    gl.viewport(0, 0, bufferWidth, bufferHeight);
    gl.uniform2f(uniforms.viewport, width, height);
    gl.uniform1f(uniforms.scale, scale);
  }

  function draw(now) {
    if (!running) return;

    const [x, y, width, height] = rect;
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (width >= 1 && height >= 1) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        Math.floor(x * scale),
        Math.floor((window.innerHeight - y - height) * scale),
        Math.max(0, Math.ceil(width * scale)),
        Math.max(0, Math.ceil(height * scale)),
      );
      gl.uniform4f(uniforms.rect, x, y, width, height);
      gl.uniform1f(uniforms.time, reducedMotion.matches ? 0 : (now - startedAt) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.SCISSOR_TEST);
    }

    frame = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);

  return {
    start() {
      resize();
      if (running) return;
      running = true;
      startedAt = performance.now();
      frame = requestAnimationFrame(draw);
    },
    update(nextRect) {
      rect = [nextRect.left, nextRect.top, nextRect.width, nextRect.height];
    },
    stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(frame);
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    resize,
  };
}
