// deformers.js — Noise displacement, twist, taper, bend, wave deformers.
// Each takes a point array and returns a new deformed point array.

import { fbm3vec } from './noise.js';
import { seed as noiseSeed } from './noise.js';

/**
 * Run all enabled deformers in sequence: noise → twist → taper → bend → wave.
 */
export function applyDeformers(points, params) {
  let pts = points;

  // Seed noise from params
  noiseSeed(params.seed);

  // Smooth organic pre-deformation (very low frequency, single octave)
  if (params.smoothEnabled && params.smoothAmp > 0) {
    pts = noiseDisplace(pts, {
      frequency: params.smoothFreq,
      amplitude: params.smoothAmp,
      octaves: 1,
      persistence: 0.5,
      lacunarity: 2.0,
      offsetX: (params.noiseOffsetX || 0) + 200,
      offsetY: (params.noiseOffsetY || 0) + 200,
      offsetZ: (params.noiseOffsetZ || 0) + 200,
    });
  }

  // Noise displacement (always applied if amplitude > 0)
  if (params.noiseAmp > 0) {
    pts = noiseDisplace(pts, {
      frequency: params.noiseFreq,
      amplitude: params.noiseAmp,
      octaves: params.noiseOctaves,
      persistence: params.noisePersistence,
      lacunarity: params.noiseLacunarity,
      offsetX: params.noiseOffsetX,
      offsetY: params.noiseOffsetY,
      offsetZ: params.noiseOffsetZ,
    });
  }

  if (params.twistEnabled) {
    pts = twist(pts, params.twistAmount, params.twistAxis);
  }

  if (params.taperEnabled) {
    pts = taper(pts, params.taperStart, params.taperEnd, params.taperAxis);
  }

  if (params.bendEnabled) {
    pts = bend(pts, params.bendAngle, params.bendAxis);
  }

  if (params.waveEnabled) {
    pts = wave(pts, params.waveFreq, params.waveAmp, params.waveAxis, params.wavePhase);
  }

  return pts;
}

/**
 * Displace each point by a 3D noise vector field.
 */
function noiseDisplace(points, opts) {
  const { frequency, amplitude, octaves, persistence, lacunarity, offsetX, offsetY, offsetZ } = opts;

  return points.map(p => {
    const nx = p.x * frequency + offsetX;
    const ny = p.y * frequency + offsetY;
    const nz = p.z * frequency + offsetZ;

    const disp = fbm3vec(nx, ny, nz, {
      octaves,
      persistence,
      lacunarity,
      frequency: 1, // Already applied via nx/ny/nz
      amplitude: 1,
    });

    return {
      x: p.x + disp.x * amplitude,
      y: p.y + disp.y * amplitude,
      z: p.z + disp.z * amplitude,
    };
  });
}

/**
 * Twist: rotate cross-section around an axis, angle proportional to position along axis.
 */
function twist(points, amount, axis) {
  const { getBounds, getAxisVal, setFromRotation } = axisHelpers(axis);
  const bounds = getBounds(points);

  return points.map(p => {
    const t = (getAxisVal(p) - bounds.min) / (bounds.max - bounds.min || 1);
    const angle = (t - 0.5) * amount * Math.PI * 2;
    return setFromRotation(p, angle, axis);
  });
}

/**
 * Taper: scale cross-section based on position along axis.
 */
function taper(points, startScale, endScale, axis) {
  const { getBounds, getAxisVal } = axisHelpers(axis);
  const bounds = getBounds(points);

  return points.map(p => {
    const t = (getAxisVal(p) - bounds.min) / (bounds.max - bounds.min || 1);
    const s = startScale + (endScale - startScale) * t;
    return scalePerp(p, s, axis);
  });
}

/**
 * Bend: curve the shape into an arc along an axis.
 */
function bend(points, angle, axis) {
  const { getBounds, getAxisVal } = axisHelpers(axis);
  const bounds = getBounds(points);
  const len = bounds.max - bounds.min || 1;

  if (Math.abs(angle) < 0.001) return points.slice();

  const radius = len / angle;

  return points.map(p => {
    const axisPos = getAxisVal(p);
    const t = (axisPos - bounds.min) / len;
    const theta = (t - 0.5) * angle;

    // Get perpendicular components
    const perp = getPerpComponents(p, axis);

    if (axis === 'x') {
      return {
        x: (radius + perp.p1) * Math.sin(theta) + bounds.min + len * 0.5,
        y: p.y,
        z: (radius + perp.p1) * Math.cos(theta) - radius,
      };
    } else if (axis === 'y') {
      return {
        x: p.x,
        y: (radius + perp.p1) * Math.sin(theta) + bounds.min + len * 0.5,
        z: (radius + perp.p1) * Math.cos(theta) - radius,
      };
    } else {
      return {
        x: p.x,
        y: (radius + perp.p1) * Math.sin(theta),
        z: (radius + perp.p1) * Math.cos(theta) - radius + bounds.min + len * 0.5,
      };
    }
  });
}

/**
 * Wave: sinusoidal displacement perpendicular to axis.
 */
function wave(points, freq, amp, axis, phase) {
  return points.map(p => {
    const axisVal = axis === 'x' ? p.x : axis === 'y' ? p.y : p.z;
    const displacement = amp * Math.sin(axisVal * freq + phase);

    // Displace perpendicular to axis
    if (axis === 'x') return { x: p.x, y: p.y + displacement, z: p.z };
    if (axis === 'y') return { x: p.x + displacement, y: p.y, z: p.z };
    return { x: p.x, y: p.y + displacement, z: p.z };
  });
}

// --- Helpers ---

function axisHelpers(axis) {
  const getAxisVal = axis === 'x' ? p => p.x : axis === 'y' ? p => p.y : p => p.z;

  function getBounds(points) {
    let min = Infinity, max = -Infinity;
    for (const p of points) {
      const v = getAxisVal(p);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { min, max };
  }

  function setFromRotation(p, angle, ax) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    if (ax === 'x') return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
    if (ax === 'y') return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
  }

  return { getBounds, getAxisVal, setFromRotation };
}

function scalePerp(p, s, axis) {
  if (axis === 'x') return { x: p.x, y: p.y * s, z: p.z * s };
  if (axis === 'y') return { x: p.x * s, y: p.y, z: p.z * s };
  return { x: p.x * s, y: p.y * s, z: p.z };
}

function getPerpComponents(p, axis) {
  if (axis === 'x') return { p1: p.z, p2: p.y };
  if (axis === 'y') return { p1: p.z, p2: p.x };
  return { p1: p.y, p2: p.x };
}
