// generate.js — Base 3D shape generators for the point cloud.
// Each returns an array of {x, y, z} points.
// Supports non-uniform density (rejection sampling) and multi-cluster sub-flocks.

import { simplex3, seed as noiseSeed } from './noise.js';

/**
 * Seeded PRNG (Mulberry32). Returns a function that yields [0,1) floats.
 */
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Generate the point cloud based on params. Orchestrates sub-flocks if enabled.
 */
export function generateCloud(params) {
  const { subFlocks, subFlockSpread, subFlockSizeVar, subFlockBridge, seed } = params;

  // Seed noise for density sampling
  noiseSeed(seed);

  if (!subFlocks || subFlocks <= 1) {
    return generateSingleCloud(params);
  }

  // Multi-cluster generation
  const rng = mulberry32(seed + 999);
  const maxR = Math.max(params.radiusX, params.radiusY, params.radiusZ);
  const allPoints = [];

  // Generate sub-flock centers
  const centers = [];
  for (let f = 0; f < subFlocks; f++) {
    centers.push({
      x: (rng() - 0.5) * 2 * maxR * subFlockSpread,
      y: (rng() - 0.5) * 2 * maxR * subFlockSpread,
      z: (rng() - 0.5) * 2 * maxR * subFlockSpread,
    });
  }

  // Distribute bird counts
  const bridgeCount = Math.floor(params.count * subFlockBridge);
  const flockCount = params.count - bridgeCount;
  const counts = distributeCount(flockCount, subFlocks, subFlockSizeVar, rng);

  for (let f = 0; f < subFlocks; f++) {
    const scale = 1.0 - subFlockSizeVar * rng() * 0.5;
    const subParams = {
      ...params,
      count: counts[f],
      radiusX: params.radiusX * scale,
      radiusY: params.radiusY * scale,
      radiusZ: params.radiusZ * scale,
      torusMajor: params.torusMajor * scale,
      torusMinor: params.torusMinor * scale,
      sweptRadius: (params.sweptRadius || 15) * scale,
      seed: seed + f * 1000,
    };
    const pts = generateSingleCloud(subParams);
    // Offset to sub-flock center
    for (const p of pts) {
      p.x += centers[f].x;
      p.y += centers[f].y;
      p.z += centers[f].z;
    }
    allPoints.push(...pts);
  }

  // Bridge/tendril birds between flocks
  if (bridgeCount > 0 && subFlocks > 1) {
    const bridgePoints = generateBridgePoints(centers, bridgeCount, maxR * 0.1, seed + 7777);
    allPoints.push(...bridgePoints);
  }

  return allPoints;
}

/**
 * Distribute count among n sub-flocks. First flock is largest.
 */
function distributeCount(total, n, sizeVar, rng) {
  const weights = [];
  weights[0] = 1.0;
  for (let i = 1; i < n; i++) {
    weights[i] = 0.3 + (1 - sizeVar) * 0.4 + rng() * sizeVar * 0.3;
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => Math.round(total * w / sum));
}

/**
 * Generate bridge/tendril points along paths between flock centers.
 */
function generateBridgePoints(centers, count, tubeR, seed) {
  const rng = mulberry32(seed);
  const points = [];

  // Create paths between all pairs of adjacent centers
  const paths = [];
  for (let i = 0; i < centers.length - 1; i++) {
    paths.push([centers[i], centers[i + 1]]);
  }
  // Also connect last to first if 3+ flocks
  if (centers.length >= 3) {
    paths.push([centers[centers.length - 1], centers[0]]);
  }

  const perPath = Math.floor(count / paths.length);

  for (const [a, b] of paths) {
    for (let i = 0; i < perPath; i++) {
      const t = rng();
      // Lerp between centers with some noise
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      const pz = a.z + (b.z - a.z) * t;

      // Random offset perpendicular to path (in disc)
      const angle = rng() * Math.PI * 2;
      const r = tubeR * Math.sqrt(rng());

      // Use a simple perpendicular basis
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const fwd = { x: dx / len, y: dy / len, z: dz / len };

      let up = { x: 0, y: 1, z: 0 };
      if (Math.abs(fwd.y) > 0.95) up = { x: 1, y: 0, z: 0 };
      const right = normalizeVec(crossVec(fwd, up));
      const realUp = crossVec(right, fwd);

      points.push({
        x: px + r * (Math.cos(angle) * right.x + Math.sin(angle) * realUp.x),
        y: py + r * (Math.cos(angle) * right.y + Math.sin(angle) * realUp.y),
        z: pz + r * (Math.cos(angle) * right.z + Math.sin(angle) * realUp.z),
      });
    }
  }

  return points;
}

/**
 * Generate a single point cloud for one shape type.
 */
function generateSingleCloud(params) {
  const { shapeType, count, seed } = params;

  switch (shapeType) {
    case 'ellipsoid':
      return generateEllipsoid(count, params.radiusX, params.radiusY, params.radiusZ, params.fillMode, seed, params);
    case 'sphere':
      return generateSphere(count, Math.max(params.radiusX, params.radiusY, params.radiusZ), params.fillMode, seed, params);
    case 'torus':
      return generateTorus(count, params.torusMajor, params.torusMinor, params.fillMode, seed, params);
    case 'swept':
      return generateSweptCurve(count, params.sweptRadius || 15, seed, params);
    default:
      return generateEllipsoid(count, params.radiusX, params.radiusY, params.radiusZ, params.fillMode, seed, params);
  }
}

/**
 * Compute density acceptance probability for a point.
 */
function densityAcceptance(p, distFromCenter, fillMode, densityParams, rng) {
  const densityFalloff = densityParams.densityFalloff || 0;
  const densityNoise = densityParams.densityNoise || 0;
  const densityNoiseFreq = densityParams.densityNoiseFreq || 0;

  // Default: no rejection
  if (densityFalloff <= 0 && densityNoise <= 0) return true;

  let prob = 1.0;

  // Distance-based falloff (only meaningful for volume fill)
  if (fillMode === 'volume' && densityFalloff > 0 && distFromCenter >= 0) {
    prob *= Math.pow(Math.max(0, 1 - distFromCenter), densityFalloff);
  }

  // Noise-based density modulation (works for both surface and volume)
  if (densityNoise > 0 && densityNoiseFreq > 0) {
    const nval = simplex3(p.x * densityNoiseFreq, p.y * densityNoiseFreq, p.z * densityNoiseFreq);
    const noiseP = 1.0 - densityNoise + densityNoise * (0.5 + 0.5 * nval);
    prob *= noiseP;
  }

  return rng() < prob;
}

/**
 * Ellipsoid — density-controlled sampling on surface or inside volume.
 */
function generateEllipsoid(count, rx, ry, rz, fillMode, seed, densityParams) {
  const rng = mulberry32(seed);
  const points = [];
  const maxAttempts = count * 20;
  let attempts = 0;

  while (points.length < count && attempts < maxAttempts) {
    attempts++;

    // Uniform point on unit sphere (Marsaglia method)
    let u, v, s;
    do {
      u = rng() * 2 - 1;
      v = rng() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);

    const factor = 2 * Math.sqrt(1 - s);
    let nx = u * factor;
    let ny = v * factor;
    let nz = 1 - 2 * s;

    // For volume fill, scale by cube root of random radius
    let r = 1;
    if (fillMode === 'volume') {
      r = Math.cbrt(rng());
    }

    const p = {
      x: nx * rx * r,
      y: ny * ry * r,
      z: nz * rz * r,
    };

    // Compute normalized distance from center for density
    const distFromCenter = fillMode === 'volume' ? r : 0;

    if (densityAcceptance(p, distFromCenter, fillMode, densityParams || {}, rng)) {
      points.push(p);
    }
  }

  return points;
}

/**
 * Sphere — shortcut for equal-radius ellipsoid.
 */
function generateSphere(count, radius, fillMode, seed, densityParams) {
  return generateEllipsoid(count, radius, radius, radius, fillMode, seed, densityParams);
}

/**
 * Torus — density-controlled sampling.
 */
function generateTorus(count, majorR, minorR, fillMode, seed, densityParams) {
  const rng = mulberry32(seed);
  const points = [];
  const maxAttempts = count * 20;
  let attempts = 0;

  while (points.length < count && attempts < maxAttempts) {
    attempts++;

    const u = rng() * Math.PI * 2;
    const v = rng() * Math.PI * 2;

    let r = minorR;
    let distFromCenter = 0;
    if (fillMode === 'volume') {
      const rNorm = Math.sqrt(rng());
      r = minorR * rNorm;
      distFromCenter = rNorm; // normalized [0,1] distance from tube center
    }

    const p = {
      x: (majorR + r * Math.cos(v)) * Math.cos(u),
      y: (majorR + r * Math.cos(v)) * Math.sin(u),
      z: r * Math.sin(v),
    };

    if (densityAcceptance(p, distFromCenter, fillMode, densityParams || {}, rng)) {
      points.push(p);
    }
  }

  return points;
}

/**
 * Swept curve — density-controlled sampling along a Catmull-Rom spline tube.
 */
function generateSweptCurve(count, crossSectionR, seed, densityParams) {
  const rng = mulberry32(seed);
  const points = [];
  const maxAttempts = count * 20;
  let attempts = 0;

  // Default spine: an S-curve through 3D space
  const spine = [
    { x: -60, y: 0, z: -80 },
    { x: -30, y: 30, z: -30 },
    { x: 0, y: -20, z: 0 },
    { x: 30, y: 25, z: 30 },
    { x: 60, y: -10, z: 80 },
  ];

  while (points.length < count && attempts < maxAttempts) {
    attempts++;

    const t = rng();
    const pos = catmullRomPoint(spine, t);
    const tangent = catmullRomTangent(spine, t);

    const forward = normalizeVec(tangent);
    let up = { x: 0, y: 1, z: 0 };
    if (Math.abs(forward.y) > 0.95) {
      up = { x: 1, y: 0, z: 0 };
    }
    const right = normalizeVec(crossVec(forward, up));
    const realUp = crossVec(right, forward);

    const angle = rng() * Math.PI * 2;
    const rNorm = Math.sqrt(rng());
    const r = crossSectionR * rNorm;

    const p = {
      x: pos.x + r * (Math.cos(angle) * right.x + Math.sin(angle) * realUp.x),
      y: pos.y + r * (Math.cos(angle) * right.y + Math.sin(angle) * realUp.y),
      z: pos.z + r * (Math.cos(angle) * right.z + Math.sin(angle) * realUp.z),
    };

    if (densityAcceptance(p, rNorm, 'volume', densityParams || {}, rng)) {
      points.push(p);
    }
  }

  return points;
}

// --- Catmull-Rom spline helpers ---

function catmullRomPoint(spine, t) {
  const n = spine.length - 1;
  const f = t * n;
  const i = Math.min(Math.floor(f), n - 1);
  const local = f - i;

  const p0 = spine[Math.max(0, i - 1)];
  const p1 = spine[i];
  const p2 = spine[Math.min(n, i + 1)];
  const p3 = spine[Math.min(n, i + 2)];

  return {
    x: crInterp(p0.x, p1.x, p2.x, p3.x, local),
    y: crInterp(p0.y, p1.y, p2.y, p3.y, local),
    z: crInterp(p0.z, p1.z, p2.z, p3.z, local),
  };
}

function catmullRomTangent(spine, t) {
  const eps = 0.001;
  const a = catmullRomPoint(spine, Math.max(0, t - eps));
  const b = catmullRomPoint(spine, Math.min(1, t + eps));
  return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
}

function crInterp(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

// --- Inline vec helpers (avoid circular dep with vec3.js) ---

function normalizeVec(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function crossVec(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
