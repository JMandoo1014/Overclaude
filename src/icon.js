'use strict';

const { createCanvas } = require('@napi-rs/canvas');

// Logical size is 22 (macOS menu bar height); rendered at 2x for retina.
const LOGICAL_SIZE = 22;
const SCALE = 2;
const SIZE = LOGICAL_SIZE * SCALE;

const TRACK_COLOR = 'rgba(120, 120, 120, 0.35)';
const COLOR_LOW = '#2ecc71'; // < 50%
const COLOR_MID = '#f39c12'; // 50-79%
const COLOR_HIGH = '#e74c3c'; // >= 80%
const ERROR_COLOR = '#e74c3c';
const LOADING_COLOR = 'rgba(140, 140, 140, 0.55)';

const RING_WIDTH = SIZE * 0.16;
const RADIUS = SIZE / 2 - RING_WIDTH / 2 - SIZE * 0.06;
const CENTER = SIZE / 2;
const START_ANGLE = -Math.PI / 2; // 12 o'clock

function colorForPercent(pct) {
  if (pct >= 80) return COLOR_HIGH;
  if (pct >= 50) return COLOR_MID;
  return COLOR_LOW;
}

function drawTrack(ctx) {
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = TRACK_COLOR;
  ctx.lineWidth = RING_WIDTH;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawDot(ctx, color, radiusFraction) {
  const dotRadius = SIZE * 0.05 * radiusFraction;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Renders a circular gauge icon for the given usage percent (0-100).
 * Returns a PNG buffer sized 44x44 (2x of the 22px menu bar height).
 */
async function renderGaugeIcon(percent) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);

  const pct = Math.max(0, Math.min(100, percent));
  const color = colorForPercent(pct);

  drawTrack(ctx);

  if (pct > 0) {
    const sweep = (pct / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, RADIUS, START_ANGLE, START_ANGLE + sweep);
    ctx.strokeStyle = color;
    ctx.lineWidth = RING_WIDTH;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Small center dot that grows/darkens slightly with usage — a subtle
  // "pulse" cue without resorting to text.
  const dotFraction = 1 + pct / 100; // 1x .. 2x radius across the range
  drawDot(ctx, color, dotFraction);

  return canvas.toBuffer('image/png');
}

/**
 * Renders the "loading" state: an empty grey ring, no fill, no dot.
 */
async function renderLoadingIcon() {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);

  ctx.beginPath();
  ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = LOADING_COLOR;
  ctx.lineWidth = RING_WIDTH;
  ctx.setLineDash([SIZE * 0.09, SIZE * 0.11]);
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.setLineDash([]);

  return canvas.toBuffer('image/png');
}

/**
 * Renders the "error" state: a broken ring with a small exclamation mark,
 * so the shape itself (not color/text) signals trouble.
 */
async function renderErrorIcon() {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);

  // Ring with a visible gap at the bottom ("broken").
  const gapHalf = 0.35;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, RADIUS, START_ANGLE + gapHalf, START_ANGLE - gapHalf + Math.PI * 2);
  ctx.strokeStyle = ERROR_COLOR;
  ctx.lineWidth = RING_WIDTH;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Exclamation mark centered inside the ring.
  ctx.fillStyle = ERROR_COLOR;
  const markWidth = SIZE * 0.09;
  const markTop = CENTER - SIZE * 0.14;
  const markBottom = CENTER + SIZE * 0.02;
  ctx.beginPath();
  ctx.moveTo(CENTER - markWidth / 2, markTop);
  ctx.lineTo(CENTER + markWidth / 2, markTop);
  ctx.lineTo(CENTER + markWidth / 2 - SIZE * 0.015, markBottom);
  ctx.lineTo(CENTER - markWidth / 2 + SIZE * 0.015, markBottom);
  ctx.closePath();
  ctx.fill();

  const dotRadius = SIZE * 0.045;
  ctx.beginPath();
  ctx.arc(CENTER, CENTER + SIZE * 0.11, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderGaugeIcon,
  renderLoadingIcon,
  renderErrorIcon,
  colorForPercent,
  SIZE,
  LOGICAL_SIZE,
};
