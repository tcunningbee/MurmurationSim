// svg-export.js — Generate clean SVG from projected bird data for pen plotting.

import { SHAPES, getPoseShapeKey } from './shapes.js';

const PAPER_SIZES = {
  A4: { w: 210, h: 297 },
  'A4 Landscape': { w: 297, h: 210 },
  A3: { w: 297, h: 420 },
  'A3 Landscape': { w: 420, h: 297 },
  Letter: { w: 215.9, h: 279.4 },
};

function r2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Generate an SVG string from projected bird data (already depth-sorted).
 * @param {Array} projectedBirds - [{sx, sy, angle, scale, opacity, localDensity, poseIndex}, ...]
 * @param {object} params - Shared params (shapeKey, width, height, poseVariation, darkBandEnabled, darkBandStrength)
 * @param {object} options - Export options
 */
export function generateSVG(projectedBirds, params, options = {}) {
  const {
    strokeOnly = true,
    strokeWidth = 0.5,
    strokeColor = '#000000',
    paperSize = null,
    depthStroke = false,
  } = options;

  const shape = SHAPES[params.shapeKey];
  const defaultPath = shape ? shape.path : 'M4,0 L-3,-2.5 L-3,2.5 Z';

  const viewW = params.width;
  const viewH = params.height;

  let svgW, svgH, units;
  if (paperSize && PAPER_SIZES[paperSize]) {
    svgW = PAPER_SIZES[paperSize].w;
    svgH = PAPER_SIZES[paperSize].h;
    units = 'mm';
  } else {
    svgW = viewW;
    svgH = viewH;
    units = '';
  }

  const fillAttr = strokeOnly ? 'fill="none"' : `fill="${strokeColor}"`;
  const strokeAttr = strokeOnly
    ? `stroke="${strokeColor}" stroke-width="${strokeWidth}"`
    : 'stroke="none"';

  // Precompute max scale for depth-varying stroke width
  let maxScale = 0;
  if (depthStroke) {
    for (const b of projectedBirds) {
      if (b.scale > maxScale) maxScale = b.scale;
    }
    maxScale = maxScale || 1;
  }

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg"`;
  svg += ` width="${svgW}${units}" height="${svgH}${units}"`;
  svg += ` viewBox="0 0 ${viewW} ${viewH}">\n`;
  svg += `<g id="murmuration" ${fillAttr} ${strokeAttr}`;
  svg += ` stroke-linecap="round" stroke-linejoin="round">\n`;

  for (const bird of projectedBirds) {
    if (bird.scale <= 0.01) continue;

    const x = r2(bird.sx);
    const y = r2(bird.sy);
    const angle = r2(bird.angle * 180 / Math.PI);
    const s = r2(bird.scale);

    // Select path based on pose
    const usePose = params.poseVariation && params.shapeKey === 'starling' && bird.poseIndex !== undefined;
    const birdPath = usePose
      ? SHAPES[getPoseShapeKey(bird.poseIndex)].path
      : defaultPath;

    // Compute per-bird stroke width overrides
    let swAttr = '';
    if (strokeOnly) {
      let birdSW = strokeWidth;

      // Depth-based stroke width
      if (depthStroke) {
        birdSW = strokeWidth * (bird.scale / maxScale);
      }

      // Dark band density boost
      if (params.darkBandEnabled && bird.localDensity > 0) {
        birdSW *= 1.0 + params.darkBandStrength * bird.localDensity;
      }

      birdSW = Math.max(0.1, r2(birdSW));

      // Only override if different from group default
      if (depthStroke || (params.darkBandEnabled && bird.localDensity > 0)) {
        swAttr = ` stroke-width="${birdSW}"`;
      }
    }

    svg += `  <g transform="translate(${x},${y}) rotate(${angle}) scale(${s})"${swAttr}>\n`;
    svg += `    <path d="${birdPath}"/>\n`;
    svg += `  </g>\n`;
  }

  svg += `</g>\n</svg>`;
  return svg;
}

/**
 * Trigger a browser download of an SVG string.
 */
export function downloadSVG(svgString, filename = 'murmuration.svg') {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export { PAPER_SIZES };
