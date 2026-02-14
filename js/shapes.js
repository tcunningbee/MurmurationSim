// shapes.js — Bird shape presets as SVG path data strings.
// All shapes are centred at origin (0,0), facing right (+x), ~10 units wide.

export const SHAPES = {
  vee: {
    name: 'V-Shape',
    path: 'M-5,-3 L0,0 L-5,3',
    filled: false,
  },

  starling: {
    name: 'Starling',
    path: 'M5,0 C3.5,0.8 1.5,1.5 -1,2.5 L-4,4 L-3,1.5 L-5,0 L-3,-1.5 L-4,-4 L-1,-2.5 C1.5,-1.5 3.5,-0.8 5,0 Z',
    filled: true,
  },

  dot: {
    name: 'Dot',
    path: 'M2,0 A2,2 0 1,1 -2,0 A2,2 0 1,1 2,0 Z',
    filled: true,
  },

  swoop: {
    name: 'Swooping',
    path: 'M5,0 C3,0.6 1,1.2 -1,2 L-4,3.5 L-2.5,0 L-4,-3.5 L-1,-2 C1,-1.2 3,-0.6 5,0 Z',
    filled: true,
  },

  starlingUp: {
    name: 'Wings Up',
    path: 'M5,0 C3.5,0.5 1.5,1 -1,1.5 L-3.5,5 L-3,1 L-5,0 L-3,-1 L-3.5,-5 L-1,-1.5 C1.5,-1 3.5,-0.5 5,0 Z',
    filled: true,
  },

  starlingDown: {
    name: 'Wings Down',
    path: 'M5,0 C3.5,0.6 1.5,1.2 -1,2 L-4,2.5 L-3,0.8 L-5,0 L-3,-0.8 L-4,-2.5 L-1,-2 C1.5,-1.2 3.5,-0.6 5,0 Z',
    filled: true,
  },

  starlingSwept: {
    name: 'Wings Swept',
    path: 'M5,0 C3,0.4 1,0.8 -2,1.2 L-5,1.5 L-4,0.5 L-5,0 L-4,-0.5 L-5,-1.5 L-2,-1.2 C1,-0.8 3,-0.4 5,0 Z',
    filled: true,
  },

  custom: {
    name: 'Custom',
    path: null,
    filled: true,
  },
};

const POSE_KEYS = ['starling', 'starlingUp', 'starlingDown', 'starlingSwept'];

/**
 * Get Path2D for a pose index (0-3).
 */
export function getPosePath2D(poseIndex) {
  const key = POSE_KEYS[poseIndex] || 'starling';
  return getPath2D(key);
}

/**
 * Get shape key string for a pose index.
 */
export function getPoseShapeKey(poseIndex) {
  return POSE_KEYS[poseIndex] || 'starling';
}

// Cache of Path2D objects, keyed by shape key
const pathCache = new Map();

/**
 * Get a Path2D object for a shape. Caches for performance.
 */
export function getPath2D(shapeKey) {
  const shape = SHAPES[shapeKey];
  if (!shape || !shape.path) return null;

  if (!pathCache.has(shapeKey) || shapeKey === 'custom') {
    pathCache.set(shapeKey, new Path2D(shape.path));
  }
  return pathCache.get(shapeKey);
}

/**
 * Register a custom shape path and rebuild its Path2D cache.
 */
export function setCustomShape(pathData, isFilled = true) {
  SHAPES.custom.path = pathData;
  SHAPES.custom.filled = isFilled;
  pathCache.set('custom', new Path2D(pathData));
}

/**
 * List available shape keys (excluding custom if it has no path).
 */
export function getAvailableShapeKeys() {
  return Object.keys(SHAPES).filter(k => k !== 'custom' || SHAPES.custom.path);
}
