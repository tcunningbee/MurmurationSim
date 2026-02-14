// renderer.js — Canvas 2D rendering of projected bird data.

import { SHAPES, getPath2D, getPosePath2D } from './shapes.js';

/**
 * Render projected birds to a Canvas 2D context.
 * Birds array must be pre-sorted back-to-front (by projectScene).
 */
export function render(ctx, projectedBirds, params) {
  const { width, height, shapeKey, darkMode } = params;

  // Clear canvas
  ctx.fillStyle = darkMode ? '#141423' : '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const shape = SHAPES[shapeKey];
  const path = getPath2D(shapeKey);
  const useFallback = !path;

  const fillColor = darkMode ? '#e0e0e0' : '#1a1a2e';
  const strokeColor = darkMode ? '#e0e0e0' : '#1a1a2e';

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;

  for (let i = 0; i < projectedBirds.length; i++) {
    const bird = projectedBirds[i];

    if (bird.scale <= 0.01) continue; // Too small to see

    // Dark band opacity boost
    const darkBoost = params.darkBandEnabled
      ? 1.0 + params.darkBandStrength * (bird.localDensity || 0)
      : 1.0;

    ctx.save();
    ctx.globalAlpha = Math.min(1.0, bird.opacity * darkBoost);
    ctx.translate(bird.sx, bird.sy);
    ctx.rotate(bird.angle);
    ctx.scale(bird.scale, bird.scale);

    // Select path: pose variation or default
    const usePose = params.poseVariation && shapeKey === 'starling' && bird.poseIndex !== undefined;
    const drawPath = usePose ? getPosePath2D(bird.poseIndex) : path;
    const drawFallback = !drawPath;

    if (drawFallback) {
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-3, -2.5);
      ctx.lineTo(-3, 2.5);
      ctx.closePath();
      ctx.fill();
    } else if (shape.filled || usePose) {
      ctx.fillStyle = fillColor;
      ctx.fill(drawPath);
    } else {
      ctx.strokeStyle = strokeColor;
      ctx.stroke(drawPath);
    }

    ctx.restore();
  }
}
