// noise.js — 3D Simplex noise + fractal Brownian motion (fBm).
// Based on Stefan Gustavson's simplex noise (public domain).
// Self-contained, no dependencies.

// --- Simplex 3D noise ---

// Permutation table (doubled to avoid wrapping)
const perm = new Uint8Array(512);
const grad3 = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
];

let _seeded = false;

/**
 * Seed the noise permutation table. Call before using noise functions.
 */
export function seed(s) {
  // Simple seeded shuffle (Mulberry32-based PRNG)
  function mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const rng = mulberry32(s);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;

  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }

  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
  }
  _seeded = true;
}

// Ensure default seed on first use
function ensureSeeded() {
  if (!_seeded) seed(0);
}

const F3 = 1 / 3;
const G3 = 1 / 6;

function dot3(g, x, y, z) {
  return g[0] * x + g[1] * y + g[2] * z;
}

/**
 * 3D Simplex noise. Returns value in [-1, 1].
 */
export function simplex3(xin, yin, zin) {
  ensureSeeded();

  // Skew input space to determine which simplex cell we're in
  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const k = Math.floor(zin + s);

  const t = (i + j + k) * G3;
  const X0 = i - t;
  const Y0 = j - t;
  const Z0 = k - t;

  const x0 = xin - X0;
  const y0 = yin - Y0;
  const z0 = zin - Z0;

  // Determine which simplex we are in
  let i1, j1, k1; // Offsets for second corner
  let i2, j2, k2; // Offsets for third corner

  if (x0 >= y0) {
    if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
    else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
    else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
  } else {
    if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
    else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
    else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2.0 * G3;
  const y2 = y0 - j2 + 2.0 * G3;
  const z2 = z0 - k2 + 2.0 * G3;
  const x3 = x0 - 1.0 + 3.0 * G3;
  const y3 = y0 - 1.0 + 3.0 * G3;
  const z3 = z0 - 1.0 + 3.0 * G3;

  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;

  const gi0 = perm[ii + perm[jj + perm[kk]]] % 12;
  const gi1 = perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] % 12;
  const gi2 = perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] % 12;
  const gi3 = perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] % 12;

  let n0, n1, n2, n3;

  let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
  if (t0 < 0) n0 = 0;
  else { t0 *= t0; n0 = t0 * t0 * dot3(grad3[gi0], x0, y0, z0); }

  let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
  if (t1 < 0) n1 = 0;
  else { t1 *= t1; n1 = t1 * t1 * dot3(grad3[gi1], x1, y1, z1); }

  let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
  if (t2 < 0) n2 = 0;
  else { t2 *= t2; n2 = t2 * t2 * dot3(grad3[gi2], x2, y2, z2); }

  let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
  if (t3 < 0) n3 = 0;
  else { t3 *= t3; n3 = t3 * t3 * dot3(grad3[gi3], x3, y3, z3); }

  // Scale to [-1, 1]
  return 32.0 * (n0 + n1 + n2 + n3);
}

// --- Fractal Brownian Motion ---

/**
 * Scalar fBm (layered 3D simplex noise).
 */
export function fbm3(x, y, z, opts = {}) {
  const {
    octaves = 4,
    persistence = 0.5,
    lacunarity = 2.0,
    frequency = 1.0,
    amplitude = 1.0,
  } = opts;

  let value = 0;
  let amp = amplitude;
  let freq = frequency;
  let maxAmp = 0;

  for (let i = 0; i < octaves; i++) {
    value += simplex3(x * freq, y * freq, z * freq) * amp;
    maxAmp += amp;
    amp *= persistence;
    freq *= lacunarity;
  }

  return value / maxAmp;
}

/**
 * 3-channel vector fBm — three independent noise samples for x/y/z displacement.
 * Uses offset coordinates so the three channels are uncorrelated.
 */
export function fbm3vec(x, y, z, opts = {}) {
  return {
    x: fbm3(x, y, z, opts),
    y: fbm3(x + 31.416, y + 47.853, z + 12.679, opts),
    z: fbm3(x + 74.205, y + 13.842, z + 56.917, opts),
  };
}

/**
 * 3D curl noise — divergence-free vector field from the curl of a 3-channel noise potential.
 * Uses central finite differences to compute partial derivatives.
 */
export function curl3(x, y, z, opts = {}) {
  const eps = 0.001;

  // Offset constants for uncorrelated noise channels (same as fbm3vec)
  const OX = 31.416, OY = 47.853, OZ = 12.679;
  const PX = 74.205, PY = 13.842, PZ = 56.917;

  // dNz/dy - dNy/dz
  const dNz_dy = (fbm3(x + PX, (y + eps) + PY, z + PZ, opts) - fbm3(x + PX, (y - eps) + PY, z + PZ, opts)) / (2 * eps);
  const dNy_dz = (fbm3(x + OX, y + OY, (z + eps) + OZ, opts) - fbm3(x + OX, y + OY, (z - eps) + OZ, opts)) / (2 * eps);

  // dNx/dz - dNz/dx
  const dNx_dz = (fbm3(x, y, z + eps, opts) - fbm3(x, y, z - eps, opts)) / (2 * eps);
  const dNz_dx = (fbm3((x + eps) + PX, y + PY, z + PZ, opts) - fbm3((x - eps) + PX, y + PY, z + PZ, opts)) / (2 * eps);

  // dNy/dx - dNx/dy
  const dNy_dx = (fbm3((x + eps) + OX, y + OY, z + OZ, opts) - fbm3((x - eps) + OX, y + OY, z + OZ, opts)) / (2 * eps);
  const dNx_dy = (fbm3(x, y + eps, z, opts) - fbm3(x, y - eps, z, opts)) / (2 * eps);

  return {
    x: dNz_dy - dNy_dz,
    y: dNx_dz - dNz_dx,
    z: dNy_dx - dNx_dy,
  };
}
