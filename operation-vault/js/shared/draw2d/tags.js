// 표식(색 + 도형)을 캔버스에 그린다. 부모 매뉴얼과 아이의 3D 화면이 같은 그림을 쓴다.

import { COLORS, SHAPES } from '../tags.js';

/** (cx, cy) 를 중심으로 크기 size 인 표식을 그린다. */
export function drawTag(g, tag, cx, cy, size) {
  const r = size / 2;
  g.save();
  g.fillStyle = COLORS[tag.c].hex;
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = Math.max(1, size * 0.05);
  g.lineJoin = 'round';
  g.beginPath();
  switch (SHAPES[tag.s].id) {
    case 'circle':
      g.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
      break;
    case 'tri':
      g.moveTo(cx, cy - r * 0.95);
      g.lineTo(cx + r * 0.95, cy + r * 0.78);
      g.lineTo(cx - r * 0.95, cy + r * 0.78);
      g.closePath();
      break;
    case 'square':
      g.rect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6);
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r : r * 0.42;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = cx + Math.cos(a) * radius;
        const y = cy + Math.sin(a) * radius;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      break;
    case 'cross': {
      const a = r * 0.92;
      const b = r * 0.32;
      g.moveTo(cx - b, cy - a);
      g.lineTo(cx + b, cy - a);
      g.lineTo(cx + b, cy - b);
      g.lineTo(cx + a, cy - b);
      g.lineTo(cx + a, cy + b);
      g.lineTo(cx + b, cy + b);
      g.lineTo(cx + b, cy + a);
      g.lineTo(cx - b, cy + a);
      g.lineTo(cx - b, cy + b);
      g.lineTo(cx - a, cy + b);
      g.lineTo(cx - a, cy - b);
      g.lineTo(cx - b, cy - b);
      g.closePath();
      break;
    }
  }
  g.fill();
  g.stroke();
  g.restore();
}

/** 표식 하나가 그려진 캔버스 요소를 만든다 (화면에 바로 넣을 수 있다). */
export function tagCanvas(tag, px = 40) {
  const scale = Math.min(globalThis.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(px * scale);
  canvas.style.width = canvas.style.height = px + 'px';
  drawTag(canvas.getContext('2d'), tag, canvas.width / 2, canvas.height / 2, canvas.width * 0.84);
  return canvas;
}
