// presets.js — Built-in and custom preset system for MurmurationIO.

export const BUILT_IN_PRESETS = {
  'Classic Murmuration': {
    shapeType: 'ellipsoid',
    count: 1200,
    radiusX: 50, radiusY: 35, radiusZ: 120,
    fillMode: 'volume',
    densityFalloff: 2.5,
    densityNoise: 0.4,
    densityNoiseFreq: 0.02,
    noiseAmp: 25,
    noiseFreq: 0.015,
    noiseOctaves: 3,
    smoothEnabled: true,
    smoothFreq: 0.005,
    smoothAmp: 35,
    subFlocks: 2,
    subFlockSpread: 0.5,
    subFlockSizeVar: 0.3,
    subFlockBridge: 0.1,
    curlFlowFreq: 0.012,
    curlFlowOctaves: 2,
    darkBandEnabled: true,
    darkBandStrength: 0.6,
    birdScale: 1.0,
    poseVariation: true,
    depthOpacity: 0.2,
    depthOpacityCurve: 1.8,
    orientToFlow: true,
    orientJitter: 0.15,
  },
  'Tornado': {
    shapeType: 'ellipsoid',
    count: 1500,
    radiusX: 20, radiusY: 20, radiusZ: 100,
    fillMode: 'volume',
    densityFalloff: 1.5,
    densityNoise: 0.2,
    noiseAmp: 15,
    noiseFreq: 0.02,
    noiseOctaves: 3,
    twistEnabled: true,
    twistAmount: 2.0,
    twistAxis: 'z',
    taperEnabled: true,
    taperStart: 1.5,
    taperEnd: 0.2,
    taperAxis: 'z',
    subFlocks: 1,
    darkBandEnabled: true,
    darkBandStrength: 0.5,
    smoothEnabled: false,
    curlFlowFreq: 0.015,
    orientToFlow: true,
  },
  'River': {
    shapeType: 'swept',
    count: 1000,
    sweptRadius: 12,
    densityFalloff: 2.0,
    densityNoise: 0.3,
    noiseAmp: 15,
    noiseFreq: 0.02,
    noiseOctaves: 3,
    smoothEnabled: true,
    smoothFreq: 0.008,
    smoothAmp: 20,
    subFlocks: 1,
    curlFlowFreq: 0.015,
    darkBandEnabled: true,
    darkBandStrength: 0.4,
    orientToFlow: true,
    poseVariation: true,
  },
  'Explosion': {
    shapeType: 'sphere',
    count: 2000,
    radiusX: 80, radiusY: 80, radiusZ: 80,
    fillMode: 'volume',
    densityFalloff: 0.8,
    densityNoise: 0.6,
    densityNoiseFreq: 0.015,
    noiseAmp: 40,
    noiseFreq: 0.02,
    noiseOctaves: 5,
    smoothEnabled: false,
    subFlocks: 3,
    subFlockSpread: 1.2,
    subFlockSizeVar: 0.4,
    subFlockBridge: 0.08,
    darkBandEnabled: true,
    darkBandStrength: 0.4,
    curlFlowFreq: 0.01,
    orientToFlow: true,
    poseVariation: true,
  },
  'Ribbon': {
    shapeType: 'torus',
    count: 800,
    torusMajor: 70,
    torusMinor: 8,
    fillMode: 'surface',
    densityFalloff: 1.0,
    densityNoise: 0.2,
    noiseAmp: 10,
    noiseFreq: 0.02,
    noiseOctaves: 3,
    smoothEnabled: true,
    smoothFreq: 0.006,
    smoothAmp: 20,
    subFlocks: 1,
    curlFlowFreq: 0.01,
    darkBandEnabled: true,
    darkBandStrength: 0.5,
    orientToFlow: true,
    poseVariation: true,
  },
};

/**
 * Apply a preset to the params object (merges, doesn't replace).
 */
export function applyPreset(presetName, params) {
  const preset = BUILT_IN_PRESETS[presetName];
  if (!preset) return false;
  Object.assign(params, preset);
  return true;
}

/**
 * Export current params as a JSON string.
 */
export function exportParams(params) {
  const exclude = ['width', 'height', '_selectedPreset'];
  const obj = {};
  for (const [k, v] of Object.entries(params)) {
    if (!exclude.includes(k)) obj[k] = v;
  }
  return JSON.stringify(obj, null, 2);
}

/**
 * Import params from a JSON string.
 */
export function importParams(json, params) {
  try {
    const obj = JSON.parse(json);
    Object.assign(params, obj);
    return true;
  } catch {
    return false;
  }
}
