// main.js — Application entry point.
// Pipeline: generate 3D cloud → deform → project to 2D → render.

import { generateCloud } from './generate.js';
import { applyDeformers } from './deformers.js';
import { projectScene } from './projection.js';
import { render } from './renderer.js';
import { generateSVG, downloadSVG } from './svg-export.js';
import { createUI } from './ui.js';
import { openFreehandEditor } from './freehand.js';
import { applyPreset, exportParams, importParams } from './presets.js';

// --- Canvas setup ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  params.width = canvas.width;
  params.height = canvas.height;
  dirty.camera = true;
}

// --- Shared params object (Tweakpane binds directly to this) ---
const params = {
  // Shape
  shapeType: 'ellipsoid',
  count: 800,
  radiusX: 40,
  radiusY: 30,
  radiusZ: 100,
  torusMajor: 60,
  torusMinor: 20,
  sweptRadius: 15,
  fillMode: 'surface',
  seed: 42,
  densityFalloff: 2.0,
  densityNoise: 0.3,
  densityNoiseFreq: 0.02,
  subFlocks: 1,
  subFlockSpread: 0.6,
  subFlockSizeVar: 0.3,
  subFlockBridge: 0.15,

  // Noise
  noiseFreq: 0.02,
  noiseAmp: 20,
  noiseOctaves: 4,
  noisePersistence: 0.5,
  noiseLacunarity: 2.0,
  noiseOffsetX: 0,
  noiseOffsetY: 0,
  noiseOffsetZ: 0,
  smoothEnabled: false,
  smoothFreq: 0.005,
  smoothAmp: 30,

  // Deformers
  twistEnabled: false,
  twistAmount: 0.5,
  twistAxis: 'z',
  taperEnabled: false,
  taperStart: 1.0,
  taperEnd: 0.3,
  taperAxis: 'z',
  bendEnabled: false,
  bendAngle: 0.5,
  bendAxis: 'x',
  waveEnabled: false,
  waveFreq: 0.05,
  waveAmp: 10,
  waveAxis: 'z',
  wavePhase: 0,

  // Camera
  camRotX: 0.3,
  camRotY: 0.5,
  camRotZ: 0,
  camZoom: 2.5,
  projType: 'ortho',
  camFOV: 400,

  // Bird appearance
  shapeKey: 'starling',
  birdScale: 1.0,
  depthScale: 0.5,
  orientToFlow: true,
  orientJitter: 0.2,
  curlFlowFreq: 0.015,
  curlFlowOctaves: 2,
  poseVariation: true,
  poseNoiseFreq: 0.01,
  depthOpacity: 0.3,
  depthOpacityCurve: 1.0,
  darkBandEnabled: true,
  darkBandStrength: 0.5,
  darkBandGridSize: 20,

  // Export
  exportStrokeOnly: true,
  exportStrokeWidth: 0.5,
  exportPaperSize: 'none',
  exportDepthStroke: true,

  // Display
  darkMode: false,
  autoRotate: false,
  autoRotateSpeed: 0.003,
  width: window.innerWidth,
  height: window.innerHeight,
  _selectedPreset: 'Classic Murmuration',
};

// --- Dirty flags for incremental regeneration ---
const dirty = {
  shape: true,     // Regenerate base cloud
  deform: true,    // Re-deform (reuse base cloud)
  camera: true,    // Re-project (reuse deformed cloud)
};

// --- Cached pipeline stages ---
let baseCloud = [];
let deformedCloud = [];
let projectedBirds = [];

// --- Pipeline ---
function regenerate() {
  if (dirty.shape) {
    baseCloud = generateCloud(params);
    dirty.deform = true;
  }

  if (dirty.deform) {
    deformedCloud = applyDeformers(baseCloud, params);
    dirty.camera = true;
  }

  if (dirty.camera) {
    projectedBirds = projectScene(deformedCloud, params);
  }

  dirty.shape = false;
  dirty.deform = false;
  dirty.camera = false;
}

function markDirty(level) {
  if (level === 'shape') dirty.shape = true;
  if (level === 'shape' || level === 'deform') dirty.deform = true;
  dirty.camera = true;
}

// --- Initialise ---
resizeCanvas();
regenerate();

window.addEventListener('resize', () => {
  resizeCanvas();
  regenerate();
  render(ctx, projectedBirds, params);
});

// --- Mouse orbit interaction ---
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let paneInstance = null;

canvas.addEventListener('pointerdown', (e) => {
  isDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  params.camRotY += dx * 0.005;
  params.camRotX += dy * 0.005;

  dirty.camera = true;

  // Sync Tweakpane sliders
  if (paneInstance) paneInstance.refresh();
});

canvas.addEventListener('pointerup', () => {
  isDragging = false;
});

// --- Scroll zoom ---
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const zoomDelta = e.deltaY * -0.001;
  params.camZoom = Math.max(0.5, Math.min(10, params.camZoom + zoomDelta * params.camZoom));
  dirty.camera = true;
  if (paneInstance) paneInstance.refresh();
}, { passive: false });

// --- Callbacks for UI ---
const callbacks = {
  onParamChange(level) {
    markDirty(level);
    regenerate();
    render(ctx, projectedBirds, params);
  },

  exportSVG() {
    const svg = generateSVG(projectedBirds, params, {
      strokeOnly: params.exportStrokeOnly,
      strokeWidth: params.exportStrokeWidth,
      paperSize: params.exportPaperSize === 'none' ? null : params.exportPaperSize,
      depthStroke: params.exportDepthStroke,
    });
    downloadSVG(svg, 'murmuration.svg');
  },

  openFreehand() {
    openFreehandEditor(
      (pathData) => {
        params.shapeKey = 'custom';
        dirty.camera = true;
        regenerate();
        render(ctx, projectedBirds, params);
        if (paneInstance) paneInstance.refresh();
      },
      () => {
        // Cancel — do nothing
      }
    );
  },

  randomiseSeed() {
    params.seed = Math.floor(Math.random() * 100000);
    markDirty('shape');
    regenerate();
    render(ctx, projectedBirds, params);
    if (paneInstance) paneInstance.refresh();
  },

  loadPreset(name) {
    applyPreset(name, params);
    markDirty('shape');
    regenerate();
    render(ctx, projectedBirds, params);
    if (paneInstance) paneInstance.refresh();
  },

  exportJSON() {
    const json = exportParams(params);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'murmuration-preset.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (importParams(reader.result, params)) {
          markDirty('shape');
          regenerate();
          render(ctx, projectedBirds, params);
          if (paneInstance) paneInstance.refresh();
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },
};

// --- Load Tweakpane from CDN and create UI ---
const TWEAKPANE_URLS = [
  'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js',
  'https://esm.sh/tweakpane@4.0.5',
  'https://unpkg.com/tweakpane@4.0.5/dist/tweakpane.min.js',
];

async function initUI() {
  for (const url of TWEAKPANE_URLS) {
    try {
      const Tweakpane = await import(url);
      paneInstance = createUI(Tweakpane, params, callbacks);
      return;
    } catch (err) {
      console.warn(`Failed to load Tweakpane from ${url}:`, err);
    }
  }
  console.error('Could not load Tweakpane from any CDN. Controls unavailable.');
}

initUI();

// --- Render loop (for smooth mouse orbit dragging) ---
function loop() {
  requestAnimationFrame(loop);

  if (params.autoRotate) {
    params.camRotY += params.autoRotateSpeed;
    dirty.camera = true;
    if (paneInstance) paneInstance.refresh();
  }

  if (dirty.shape || dirty.deform || dirty.camera) {
    regenerate();
    render(ctx, projectedBirds, params);
  }
}

// Initial render
regenerate();
render(ctx, projectedBirds, params);

requestAnimationFrame(loop);
