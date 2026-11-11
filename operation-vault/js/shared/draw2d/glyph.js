// 게이트 문양(테두리 + 안쪽 무늬 + 아래 점)을 캔버스에 그린다.
// 부모의 문양 사전과 아이의 단말기 화면이 같은 그림을 쓴다.

import { COLORS } from '../tags.js';
import { FRAMES, MARKS } from '../puzzles/glyphgate.js';

const DEFAULT_COLOR = '#7fe9ff';

function polygon(g, cx, cy, radius, sides, startAngle) {
  g.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = startAngle + (i * Math.PI * 2) / sides;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

function line(g, x1, y1, x2, y2) {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

/**
 * (cx, cy) 를 중심으로 한 변이 size 인 정사각형 안에 문양을 그린다.
 * glyph.color 가 0 이상이면 그 색으로, 아니면 기본색으로 그린다.
 */
export function drawGlyph(g, glyph, cx, cy, size, fallbackColor = DEFAULT_COLOR) {
  const color = glyph.color >= 0 ? COLORS[glyph.color].hex : fallbackColor;
  const r = size * 0.33;
  const fy = cy - size * 0.09; // 테두리 중심 (아래에 점 자리를 남긴다)
  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = size * 0.055;
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // 테두리
  let my = fy; // 안쪽 무늬 중심
  let m = r * 0.52; // 안쪽 무늬 크기
  switch (FRAMES[glyph.frame].id) {
    case 'circle':
      g.beginPath();
      g.arc(cx, fy, r, 0, Math.PI * 2);
      break;
    case 'square':
      g.beginPath();
      g.rect(cx - r * 0.92, fy - r * 0.92, r * 1.84, r * 1.84);
      m = r * 0.56;
      break;
    case 'triangle':
      polygon(g, cx, fy + r * 0.16, r * 1.2, 3, -Math.PI / 2);
      my = fy + r * 0.2;
      m = r * 0.4;
      break;
    case 'diamond':
      polygon(g, cx, fy, r * 1.12, 4, -Math.PI / 2);
      m = r * 0.42;
      break;
    case 'hexagon':
      polygon(g, cx, fy, r * 1.06, 6, 0);
      break;
  }
  g.stroke();

  // 안쪽 무늬
  g.lineWidth = size * 0.06;
  switch (MARKS[glyph.mark].id) {
    case 'plus':
      line(g, cx - m, my, cx + m, my);
      line(g, cx, my - m, cx, my + m);
      break;
    case 'x':
      line(g, cx - m * 0.8, my - m * 0.8, cx + m * 0.8, my + m * 0.8);
      line(g, cx + m * 0.8, my - m * 0.8, cx - m * 0.8, my + m * 0.8);
      break;
    case 'hbar':
      line(g, cx - m, my, cx + m, my);
      break;
    case 'hbar2':
      line(g, cx - m, my - m * 0.45, cx + m, my - m * 0.45);
      line(g, cx - m, my + m * 0.45, cx + m, my + m * 0.45);
      break;
    case 'vbar':
      line(g, cx, my - m, cx, my + m);
      break;
    case 'vbar2':
      line(g, cx - m * 0.45, my - m, cx - m * 0.45, my + m);
      line(g, cx + m * 0.45, my - m, cx + m * 0.45, my + m);
      break;
    case 'zig':
      g.beginPath();
      g.moveTo(cx + m * 0.45, my - m);
      g.lineTo(cx - m * 0.5, my + m * 0.1);
      g.lineTo(cx + m * 0.5, my - m * 0.1);
      g.lineTo(cx - m * 0.45, my + m);
      g.stroke();
      break;
    case 'chevron':
      g.beginPath();
      g.moveTo(cx - m, my + m * 0.55);
      g.lineTo(cx, my - m * 0.65);
      g.lineTo(cx + m, my + m * 0.55);
      g.stroke();
      break;
  }

  // 아래 점
  const gap = size * 0.15;
  const py = cy + size * 0.41;
  for (let i = 0; i < glyph.pips; i++) {
    const px = cx + (i - (glyph.pips - 1) / 2) * gap;
    g.beginPath();
    g.arc(px, py, size * 0.048, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** 문양 하나가 그려진 캔버스 요소를 만든다. */
export function glyphCanvas(glyph, px = 56, fallbackColor) {
  const scale = Math.min(globalThis.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(px * scale);
  canvas.style.width = canvas.style.height = px + 'px';
  drawGlyph(canvas.getContext('2d'), glyph, canvas.width / 2, canvas.height / 2, canvas.width, fallbackColor);
  return canvas;
}
