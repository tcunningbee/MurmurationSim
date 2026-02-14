// ui.js — Tweakpane parameter controls for 3D sculptural murmuration tool.

import { BUILT_IN_PRESETS } from './presets.js';

/**
 * Create the Tweakpane UI panel and bind to the shared params object.
 * Returns the pane instance.
 */
export function createUI(Tweakpane, params, callbacks) {
  const pane = new Tweakpane.Pane({ title: 'MurmurationIO' });

  // Helper: bind a param and trigger dirty regeneration on change
  function bind(folder, key, opts, dirtyLevel) {
    folder.addBinding(params, key, opts).on('change', () => {
      callbacks.onParamChange(dirtyLevel);
    });
  }

  // --- Presets ---
  const presetFolder = pane.addFolder({ title: 'Presets' });
  const presetOptions = {};
  for (const name of Object.keys(BUILT_IN_PRESETS)) {
    presetOptions[name] = name;
  }
  presetFolder.addBinding(params, '_selectedPreset', {
    options: presetOptions,
    label: 'Preset',
  }).on('change', (ev) => {
    callbacks.loadPreset(ev.value);
  });

  const presetActions = presetFolder.addFolder({ title: 'Import / Export', expanded: false });
  presetActions.addButton({ title: 'Export JSON' }).on('click', callbacks.exportJSON);
  presetActions.addButton({ title: 'Import JSON' }).on('click', callbacks.importJSON);

  // --- Shape ---
  const shape = pane.addFolder({ title: 'Shape' });
  bind(shape, 'shapeType', {
    options: { Ellipsoid: 'ellipsoid', Sphere: 'sphere', Torus: 'torus', 'Swept Curve': 'swept' },
    label: 'Type',
  }, 'shape');
  bind(shape, 'count', { min: 50, max: 3000, step: 10, label: 'Birds' }, 'shape');
  bind(shape, 'fillMode', {
    options: { Surface: 'surface', Volume: 'volume' },
    label: 'Fill',
  }, 'shape');
  bind(shape, 'seed', { min: 0, max: 99999, step: 1, label: 'Seed' }, 'shape');
  bind(shape, 'densityFalloff', { min: 0.5, max: 8, step: 0.1, label: 'Density Falloff' }, 'shape');
  bind(shape, 'densityNoise', { min: 0, max: 1, step: 0.05, label: 'Density Noise' }, 'shape');
  bind(shape, 'densityNoiseFreq', { min: 0.005, max: 0.1, step: 0.001, label: 'Density Noise Freq' }, 'shape');

  const dims = shape.addFolder({ title: 'Dimensions', expanded: false });
  bind(dims, 'radiusX', { min: 5, max: 200, step: 1, label: 'Radius X' }, 'shape');
  bind(dims, 'radiusY', { min: 5, max: 200, step: 1, label: 'Radius Y' }, 'shape');
  bind(dims, 'radiusZ', { min: 5, max: 200, step: 1, label: 'Radius Z' }, 'shape');
  bind(dims, 'torusMajor', { min: 10, max: 150, step: 1, label: 'Torus Major' }, 'shape');
  bind(dims, 'torusMinor', { min: 5, max: 80, step: 1, label: 'Torus Minor' }, 'shape');
  bind(dims, 'sweptRadius', { min: 5, max: 60, step: 1, label: 'Swept Radius' }, 'shape');

  const flockFolder = shape.addFolder({ title: 'Sub-Flocks', expanded: false });
  bind(flockFolder, 'subFlocks', { min: 1, max: 5, step: 1, label: 'Count' }, 'shape');
  bind(flockFolder, 'subFlockSpread', { min: 0, max: 2, step: 0.05, label: 'Spread' }, 'shape');
  bind(flockFolder, 'subFlockSizeVar', { min: 0, max: 1, step: 0.05, label: 'Size Variation' }, 'shape');
  bind(flockFolder, 'subFlockBridge', { min: 0, max: 0.5, step: 0.01, label: 'Bridge Density' }, 'shape');

  // --- Noise ---
  const noise = pane.addFolder({ title: 'Noise' });
  bind(noise, 'noiseAmp', { min: 0, max: 100, step: 1, label: 'Amplitude' }, 'deform');
  bind(noise, 'noiseFreq', { min: 0.001, max: 0.15, step: 0.001, label: 'Frequency' }, 'deform');
  bind(noise, 'noiseOctaves', { min: 1, max: 8, step: 1, label: 'Octaves' }, 'deform');
  bind(noise, 'noisePersistence', { min: 0.1, max: 0.9, step: 0.05, label: 'Persistence' }, 'deform');
  bind(noise, 'noiseLacunarity', { min: 1.5, max: 3.5, step: 0.1, label: 'Lacunarity' }, 'deform');

  const noiseOffset = noise.addFolder({ title: 'Offset', expanded: false });
  bind(noiseOffset, 'noiseOffsetX', { min: -100, max: 100, step: 0.5, label: 'X' }, 'deform');
  bind(noiseOffset, 'noiseOffsetY', { min: -100, max: 100, step: 0.5, label: 'Y' }, 'deform');
  bind(noiseOffset, 'noiseOffsetZ', { min: -100, max: 100, step: 0.5, label: 'Z' }, 'deform');

  const smoothFolder = noise.addFolder({ title: 'Smooth Pre-Deform', expanded: false });
  bind(smoothFolder, 'smoothEnabled', { label: 'Enable' }, 'deform');
  bind(smoothFolder, 'smoothFreq', { min: 0.001, max: 0.02, step: 0.001, label: 'Frequency' }, 'deform');
  bind(smoothFolder, 'smoothAmp', { min: 0, max: 80, step: 1, label: 'Amplitude' }, 'deform');

  // --- Twist ---
  const twistFolder = pane.addFolder({ title: 'Twist', expanded: false });
  bind(twistFolder, 'twistEnabled', { label: 'Enable' }, 'deform');
  bind(twistFolder, 'twistAmount', { min: -3, max: 3, step: 0.05, label: 'Amount' }, 'deform');
  bind(twistFolder, 'twistAxis', {
    options: { X: 'x', Y: 'y', Z: 'z' }, label: 'Axis',
  }, 'deform');

  // --- Taper ---
  const taperFolder = pane.addFolder({ title: 'Taper', expanded: false });
  bind(taperFolder, 'taperEnabled', { label: 'Enable' }, 'deform');
  bind(taperFolder, 'taperStart', { min: 0.1, max: 3, step: 0.05, label: 'Start Scale' }, 'deform');
  bind(taperFolder, 'taperEnd', { min: 0.0, max: 3, step: 0.05, label: 'End Scale' }, 'deform');
  bind(taperFolder, 'taperAxis', {
    options: { X: 'x', Y: 'y', Z: 'z' }, label: 'Axis',
  }, 'deform');

  // --- Bend ---
  const bendFolder = pane.addFolder({ title: 'Bend', expanded: false });
  bind(bendFolder, 'bendEnabled', { label: 'Enable' }, 'deform');
  bind(bendFolder, 'bendAngle', { min: -3, max: 3, step: 0.05, label: 'Angle' }, 'deform');
  bind(bendFolder, 'bendAxis', {
    options: { X: 'x', Y: 'y', Z: 'z' }, label: 'Axis',
  }, 'deform');

  // --- Wave ---
  const waveFolder = pane.addFolder({ title: 'Wave', expanded: false });
  bind(waveFolder, 'waveEnabled', { label: 'Enable' }, 'deform');
  bind(waveFolder, 'waveFreq', { min: 0.01, max: 0.5, step: 0.005, label: 'Frequency' }, 'deform');
  bind(waveFolder, 'waveAmp', { min: 0, max: 50, step: 1, label: 'Amplitude' }, 'deform');
  bind(waveFolder, 'waveAxis', {
    options: { X: 'x', Y: 'y', Z: 'z' }, label: 'Axis',
  }, 'deform');
  bind(waveFolder, 'wavePhase', { min: 0, max: Math.PI * 2, step: 0.1, label: 'Phase' }, 'deform');

  // --- Camera ---
  const camera = pane.addFolder({ title: 'Camera' });
  bind(camera, 'camRotX', { min: -Math.PI, max: Math.PI, step: 0.01, label: 'Rotation X' }, 'camera');
  bind(camera, 'camRotY', { min: -Math.PI, max: Math.PI, step: 0.01, label: 'Rotation Y' }, 'camera');
  bind(camera, 'camRotZ', { min: -Math.PI, max: Math.PI, step: 0.01, label: 'Rotation Z' }, 'camera');
  bind(camera, 'camZoom', { min: 0.5, max: 10, step: 0.1, label: 'Zoom' }, 'camera');
  bind(camera, 'projType', {
    options: { Orthographic: 'ortho', Perspective: 'perspective' }, label: 'Projection',
  }, 'camera');
  bind(camera, 'camFOV', { min: 100, max: 1000, step: 10, label: 'FOV' }, 'camera');
  bind(camera, 'autoRotate', { label: 'Auto Rotate' }, 'camera');
  bind(camera, 'autoRotateSpeed', { min: 0.001, max: 0.02, step: 0.001, label: 'Rotate Speed' }, 'camera');

  // --- Birds ---
  const birds = pane.addFolder({ title: 'Birds' });
  bind(birds, 'shapeKey', {
    options: { 'V-Shape': 'vee', Starling: 'starling', Dot: 'dot', Swooping: 'swoop' },
    label: 'Shape',
  }, 'camera');
  bind(birds, 'poseVariation', { label: 'Pose Variation' }, 'camera');
  bind(birds, 'poseNoiseFreq', { min: 0.001, max: 0.05, step: 0.001, label: 'Pose Coherence' }, 'camera');
  bind(birds, 'birdScale', { min: 0.2, max: 5, step: 0.1, label: 'Scale' }, 'camera');
  bind(birds, 'depthScale', { min: 0, max: 1, step: 0.05, label: 'Depth Scaling' }, 'camera');
  bind(birds, 'orientToFlow', { label: 'Orient to Flow' }, 'camera');
  bind(birds, 'curlFlowFreq', { min: 0.001, max: 0.1, step: 0.001, label: 'Flow Frequency' }, 'camera');
  bind(birds, 'curlFlowOctaves', { min: 1, max: 4, step: 1, label: 'Flow Detail' }, 'camera');
  bind(birds, 'orientJitter', { min: 0, max: 1, step: 0.05, label: 'Rotation Jitter' }, 'camera');
  bind(birds, 'depthOpacity', { min: 0, max: 1, step: 0.05, label: 'Min Opacity' }, 'camera');
  bind(birds, 'depthOpacityCurve', { min: 0.2, max: 4, step: 0.1, label: 'Opacity Curve' }, 'camera');
  bind(birds, 'darkBandEnabled', { label: 'Dark Band Effect' }, 'camera');
  bind(birds, 'darkBandStrength', { min: 0, max: 2, step: 0.05, label: 'Dark Band Strength' }, 'camera');
  bind(birds, 'darkBandGridSize', { min: 5, max: 60, step: 1, label: 'Dark Band Grid' }, 'camera');
  bind(birds, 'darkMode', { label: 'Dark Mode' }, 'camera');

  // --- SVG Export ---
  const exportFolder = pane.addFolder({ title: 'SVG Export', expanded: false });
  exportFolder.addBinding(params, 'exportStrokeOnly', { label: 'Stroke Only' });
  exportFolder.addBinding(params, 'exportStrokeWidth', { min: 0.1, max: 3, step: 0.1, label: 'Stroke Width' });
  exportFolder.addBinding(params, 'exportDepthStroke', { label: 'Depth Stroke Width' });
  exportFolder.addBinding(params, 'exportPaperSize', {
    options: {
      'Screen Size': 'none', A4: 'A4', 'A4 Landscape': 'A4 Landscape',
      A3: 'A3', 'A3 Landscape': 'A3 Landscape', Letter: 'Letter',
    },
    label: 'Paper Size',
  });

  // --- Actions ---
  const actions = pane.addFolder({ title: 'Actions' });
  actions.addButton({ title: 'Export SVG' }).on('click', callbacks.exportSVG);
  actions.addButton({ title: 'Draw Custom Shape' }).on('click', callbacks.openFreehand);
  actions.addButton({ title: 'Randomise Seed' }).on('click', callbacks.randomiseSeed);

  return pane;
}
