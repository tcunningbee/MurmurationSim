// projection.js — Camera rotation, 3D→2D projection, depth sorting.

import { rotateX, rotateY, rotateZ } from './vec3.js';
import { fbm3, curl3, simplex3 } from './noise.js';

/**
 * Orient birds (compute heading angle from noise gradient), then
 * project 3D points to 2D screen coordinates with depth sorting.
 *
 * Returns an array of { sx, sy, depth, angle, scale } sorted back-to-front.
 */
export function projectScene(points3d, params) {
  const {
    camRotX, camRotY, camRotZ, camZoom,
    projType, camFOV,
    width, height,
    birdScale, depthScale, depthOpacity,
    orientToFlow, orientJitter, seed,
    noiseFreq,
    curlFlowFreq, curlFlowOctaves,
  } = params;

  const cx = width / 2;
  const cy = height / 2;
  const camDist = 300; // Virtual camera distance for perspective

  const birds = [];

  for (let i = 0; i < points3d.length; i++) {
    const p = points3d[i];

    // Compute curl flow vector in world space
    let curlVec = null;
    const flowFreq = curlFlowFreq || noiseFreq || 0.015;
    if (orientToFlow && flowFreq > 0) {
      curlVec = curl3(p.x * flowFreq, p.y * flowFreq, p.z * flowFreq, {
        octaves: curlFlowOctaves || 2,
        frequency: 1,
      });
    }

    // Apply camera rotation to point
    let v = p;
    v = rotateX(v, camRotX);
    v = rotateY(v, camRotY);
    v = rotateZ(v, camRotZ);

    // Rotate curl vector by same camera transform, then project to 2D heading
    let angle = 0;
    if (curlVec) {
      let cv = curlVec;
      cv = rotateX(cv, camRotX);
      cv = rotateY(cv, camRotY);
      cv = rotateZ(cv, camRotZ);
      angle = Math.atan2(cv.y, cv.x);
    }
    // Add jitter
    if (orientJitter > 0) {
      angle += (seededRandom(seed + i * 7) - 0.5) * orientJitter * Math.PI * 2;
    }

    // Project to 2D
    let sx, sy, perspScale;

    if (projType === 'perspective') {
      const d = v.z + camDist;
      if (d <= 0.1) continue; // Behind camera
      perspScale = camFOV / d;
      sx = v.x * perspScale + cx;
      sy = v.y * perspScale + cy;
    } else {
      // Orthographic
      perspScale = 1;
      sx = v.x * camZoom + cx;
      sy = v.y * camZoom + cy;
    }

    // Assign pose index from noise at world position
    let poseIndex = 0;
    if (params.poseVariation && params.poseNoiseFreq > 0) {
      const poseNoise = simplex3(p.x * params.poseNoiseFreq, p.y * params.poseNoiseFreq, p.z * params.poseNoiseFreq);
      const poseVal = (poseNoise + 1) * 0.5; // [0,1]
      if (poseVal < 0.35) poseIndex = 0;
      else if (poseVal < 0.55) poseIndex = 1;
      else if (poseVal < 0.75) poseIndex = 2;
      else poseIndex = 3;
    }

    birds.push({
      sx,
      sy,
      depth: v.z,
      angle,
      perspScale,
      poseIndex,
    });
  }

  // Find depth range for normalisation
  if (birds.length === 0) return [];

  let minZ = Infinity, maxZ = -Infinity;
  for (const b of birds) {
    if (b.depth < minZ) minZ = b.depth;
    if (b.depth > maxZ) maxZ = b.depth;
  }
  const zRange = maxZ - minZ || 1;

  // Compute per-bird scale and sort back-to-front
  for (const b of birds) {
    const normDepth = (b.depth - minZ) / zRange; // 0 = farthest, 1 = nearest

    if (projType === 'perspective') {
      b.scale = birdScale * b.perspScale * 0.5;
    } else {
      // Depth-based scaling for orthographic
      const dScale = 1 - depthScale * (1 - normDepth);
      b.scale = birdScale * camZoom * 0.5 * dScale;
    }

    // Opacity from depth with non-linear curve
    const depthCurve = params.depthOpacityCurve || 1.0;
    const curvedDepth = Math.pow(normDepth, depthCurve);
    b.opacity = depthOpacity + (1 - depthOpacity) * curvedDepth;
  }

  // Dark band / edge density effect
  if (params.darkBandEnabled) {
    const gs = params.darkBandGridSize || 20;
    const cols = Math.ceil(width / gs);
    const rows = Math.ceil(height / gs);
    const grid = new Uint16Array(cols * rows);

    for (const b of birds) {
      const col = Math.floor(b.sx / gs);
      const row = Math.floor(b.sy / gs);
      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        grid[row * cols + col]++;
      }
    }

    // Find max density with 3x3 smoothing
    let maxDensity = 1;
    function smoothDensity(col, row) {
      let sum = 0, count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = row + dr, c = col + dc;
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            sum += grid[r * cols + c];
            count++;
          }
        }
      }
      return sum / count;
    }

    // Pre-scan for max smoothed density
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const d = smoothDensity(c, r);
        if (d > maxDensity) maxDensity = d;
      }
    }

    for (const b of birds) {
      const col = Math.floor(b.sx / gs);
      const row = Math.floor(b.sy / gs);
      if (col >= 0 && col < cols && row >= 0 && row < rows) {
        b.localDensity = smoothDensity(col, row) / maxDensity;
      } else {
        b.localDensity = 0;
      }
    }
  } else {
    for (const b of birds) {
      b.localDensity = 0;
    }
  }

  // Sort back-to-front (farthest first → lowest depth first)
  birds.sort((a, b) => a.depth - b.depth);

  return birds;
}


/**
 * Simple seeded random for jitter (deterministic per bird index).
 */
function seededRandom(s) {
  s = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}
