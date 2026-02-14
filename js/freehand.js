// freehand.js — Freehand drawing modal for custom bird shapes.
// User draws a shape, it is simplified, normalised, and registered.

import { setCustomShape } from './shapes.js';

/**
 * Open the freehand drawing overlay.
 * Calls onComplete(pathData) when done, onCancel() when cancelled.
 */
export function openFreehandEditor(onComplete, onCancel) {
  const overlay = document.getElementById('freehand-overlay');
  const drawCanvas = document.getElementById('draw-canvas');
  const ctx = drawCanvas.getContext('2d');

  overlay.classList.remove('hidden');

  let points = [];
  let isDrawing = false;

  // Draw background grid + crosshair
  function drawGuide() {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);

    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= drawCanvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, drawCanvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= drawCanvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(drawCanvas.width, y);
      ctx.stroke();
    }

    // Crosshair at centre
    const cx = drawCanvas.width / 2;
    const cy = drawCanvas.height / 2;
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, drawCanvas.height);
    ctx.moveTo(0, cy);
    ctx.lineTo(drawCanvas.width, cy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function redraw() {
    drawGuide();
    if (points.length < 2) return;
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  drawGuide();

  function onPointerDown(e) {
    isDrawing = true;
    points = [{ x: e.offsetX, y: e.offsetY }];
  }

  function onPointerMove(e) {
    if (!isDrawing) return;
    points.push({ x: e.offsetX, y: e.offsetY });
    redraw();
  }

  function onPointerUp() {
    isDrawing = false;
  }

  drawCanvas.addEventListener('pointerdown', onPointerDown);
  drawCanvas.addEventListener('pointermove', onPointerMove);
  drawCanvas.addEventListener('pointerup', onPointerUp);

  function cleanup() {
    drawCanvas.removeEventListener('pointerdown', onPointerDown);
    drawCanvas.removeEventListener('pointermove', onPointerMove);
    drawCanvas.removeEventListener('pointerup', onPointerUp);
    overlay.classList.add('hidden');
  }

  // Button handlers
  const clearBtn = document.getElementById('freehand-clear');
  const doneBtn = document.getElementById('freehand-done');
  const cancelBtn = document.getElementById('freehand-cancel');

  function onClear() {
    points = [];
    drawGuide();
  }

  function onDone() {
    if (points.length < 3) {
      cleanup();
      removeButtonListeners();
      if (onCancel) onCancel();
      return;
    }

    const simplified = simplifyRDP(points, 3);
    const normalised = normaliseShape(simplified, drawCanvas.width, drawCanvas.height, 10);
    const pathData = pointsToSmoothPath(normalised, true);

    setCustomShape(pathData, true);
    cleanup();
    removeButtonListeners();
    if (onComplete) onComplete(pathData);
  }

  function onCancelClick() {
    cleanup();
    removeButtonListeners();
    if (onCancel) onCancel();
  }

  clearBtn.addEventListener('click', onClear);
  doneBtn.addEventListener('click', onDone);
  cancelBtn.addEventListener('click', onCancelClick);

  function removeButtonListeners() {
    clearBtn.removeEventListener('click', onClear);
    doneBtn.removeEventListener('click', onDone);
    cancelBtn.removeEventListener('click', onCancelClick);
  }
}

// --- Path simplification (Ramer-Douglas-Peucker) ---

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = point.x - lineStart.x;
    const ey = point.y - lineStart.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  const ex = point.x - projX;
  const ey = point.y - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

function simplifyRDP(points, epsilon) {
  if (points.length <= 2) return points.slice();

  let maxDist = 0;
  let maxIdx = 0;
  const last = points.length - 1;

  for (let i = 1; i < last; i++) {
    const d = perpendicularDistance(points[i], points[0], points[last]);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyRDP(points.slice(0, maxIdx + 1), epsilon);
    const right = simplifyRDP(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [points[0], points[last]];
}

// --- Normalise and convert to SVG path ---

function normaliseShape(points, canvasW, canvasH, targetSize) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const w = maxX - minX;
  const h = maxY - minY;
  const scale = targetSize / Math.max(w, h, 1);

  return points.map(p => ({
    x: (p.x - cx) * scale,
    y: (p.y - cy) * scale,
  }));
}

function r(n) {
  return Math.round(n * 100) / 100;
}

function pointsToSmoothPath(points, closed) {
  if (points.length === 0) return '';
  if (points.length < 3) {
    let d = `M${r(points[0].x)},${r(points[0].y)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L${r(points[i].x)},${r(points[i].y)}`;
    }
    if (closed) d += ' Z';
    return d;
  }

  // Quadratic bezier smoothing
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let d = `M${r(points[0].x)},${r(points[0].y)}`;

  for (let i = 1; i < points.length - 1; i++) {
    const m = mid(points[i], points[i + 1]);
    d += ` Q${r(points[i].x)},${r(points[i].y)} ${r(m.x)},${r(m.y)}`;
  }

  const last = points[points.length - 1];
  d += ` L${r(last.x)},${r(last.y)}`;
  if (closed) d += ' Z';
  return d;
}
