// 2단계 환기 덕트 매뉴얼: 설계도.
// 벽, 표식, 감지선, 출구가 그려져 있다. 아이의 위치와 방향은 그려져 있지 않다.

import { h } from '../../shared/dom.js';
import { DIRS, isOpen } from '../../shared/puzzles/ductmaze.js';
import { COLORS } from '../../shared/tags.js';
import { drawTag } from '../../shared/draw2d/tags.js';
import { manualHeader } from './common.js';

export function renderDuct(view, manual) {
  manualHeader(view, {
    script: '환기 덕트로 진입했다. 정면 벽에 보이는 표식을 말해라.',
    steps: [
      '아이가 말한 <b>표식</b>을 설계도에서 찾으세요. 아이는 그 표식이 붙은 벽을 <b>정면으로 보고</b> 있습니다.',
      '<b>출구</b>까지, 붉은 점선(<b>감지선</b>)을 지나지 않는 길을 찾으세요.',
      '"뒤로 돌아", "앞으로 두 칸", "오른쪽으로 돌아"처럼 <b>아이 기준</b>으로 불러 주세요.',
      '길을 잃으면 정면에 보이는 표식을 다시 물어보세요. 감지선을 밟으면 경보가 오르고 다른 곳으로 옮겨집니다.',
      `아이에게는 근처 감지선을 잠깐 보여 주는 스프레이가 ${manual.sprays}번 있습니다.`,
    ],
  });

  const width = Math.min(view.clientWidth || 340, 420);
  view.append(
    h('div', { class: 'card' },
      h('div', { class: 'section-title', text: '덕트 설계도' }),
      blueprint(manual, width - 34),
      h(
        'div',
        { class: 'legend', style: { marginTop: '10px' } },
        h('span', {}, h('i', { style: { borderTop: '3px solid #cfe3ff' } }), '벽'),
        h('span', {}, h('i', { style: { borderTop: '3px dashed #ff4d5e' } }), '감지선'),
        h('span', {}, h('i', { style: { borderTop: '10px solid #3ddc84' } }), '출구'),
        h('span', { text: '표식은 색칠된 벽에 붙어 있음' })
      )
    )
  );
}

/** 설계도를 캔버스에 그린다. */
export function blueprint(m, widthPx) {
  const scale = Math.min(globalThis.devicePixelRatio || 1, 2);
  const cell = Math.floor(widthPx / m.w);
  const pad = 8;
  const canvas = h('canvas', { class: 'blueprint', id: 'blueprint' });
  canvas.width = (cell * m.w + pad * 2) * scale;
  canvas.height = (cell * m.h + pad * 2) * scale;
  canvas.style.width = cell * m.w + pad * 2 + 'px';
  canvas.style.height = cell * m.h + pad * 2 + 'px';
  const g = canvas.getContext('2d');
  g.scale(scale, scale);
  g.translate(pad, pad);

  g.fillStyle = '#0a1a3a';
  g.fillRect(-pad, -pad, cell * m.w + pad * 2, cell * m.h + pad * 2);

  // 칸 격자 (옅게)
  g.strokeStyle = 'rgba(120,160,255,0.16)';
  g.lineWidth = 1;
  for (let x = 0; x <= m.w; x++) {
    g.beginPath();
    g.moveTo(x * cell, 0);
    g.lineTo(x * cell, m.h * cell);
    g.stroke();
  }
  for (let y = 0; y <= m.h; y++) {
    g.beginPath();
    g.moveTo(0, y * cell);
    g.lineTo(m.w * cell, y * cell);
    g.stroke();
  }

  // 출구
  g.fillStyle = 'rgba(61,220,132,0.35)';
  g.fillRect(m.exit.x * cell + 3, m.exit.y * cell + 3, cell - 6, cell - 6);
  g.fillStyle = '#3ddc84';
  g.font = `700 ${Math.round(cell * 0.26)}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('출구', m.exit.x * cell + cell / 2, m.exit.y * cell + cell / 2);

  // 벽
  g.strokeStyle = '#cfe3ff';
  g.lineWidth = 3;
  g.lineCap = 'round';
  const wallLine = (x, y, d) => {
    const x0 = x * cell;
    const y0 = y * cell;
    g.beginPath();
    if (d === 0) (g.moveTo(x0, y0), g.lineTo(x0 + cell, y0));
    if (d === 1) (g.moveTo(x0 + cell, y0), g.lineTo(x0 + cell, y0 + cell));
    if (d === 2) (g.moveTo(x0, y0 + cell), g.lineTo(x0 + cell, y0 + cell));
    if (d === 3) (g.moveTo(x0, y0), g.lineTo(x0, y0 + cell));
    g.stroke();
  };
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      for (let d = 0; d < 4; d++) if (!isOpen(m, x, y, d)) wallLine(x, y, d);
    }
  }

  // 감지선: 두 칸 사이 경계에 붉은 점선
  g.strokeStyle = '#ff4d5e';
  g.lineWidth = 3;
  g.setLineDash([5, 4]);
  for (const w of m.wires) {
    const inset = cell * 0.14;
    g.beginPath();
    if (w.dir === 1) {
      g.moveTo((w.x + 1) * cell, w.y * cell + inset);
      g.lineTo((w.x + 1) * cell, (w.y + 1) * cell - inset);
    } else {
      g.moveTo(w.x * cell + inset, (w.y + 1) * cell);
      g.lineTo((w.x + 1) * cell - inset, (w.y + 1) * cell);
    }
    g.stroke();
  }
  g.setLineDash([]);

  // 표식: 붙어 있는 벽 쪽으로 붙여서 그린다
  const size = Math.min(cell * 0.4, 26);
  for (const t of m.tags) {
    const mx = t.x * cell + cell / 2;
    const my = t.y * cell + cell / 2;
    const dx = DIRS[t.dir].dx;
    const dy = DIRS[t.dir].dy;
    // 표식이 붙은 벽을 표식 색으로 굵게 칠해 어느 벽인지 분명히 한다
    g.strokeStyle = COLORS[t.c].hex;
    g.lineWidth = 6;
    g.lineCap = 'butt';
    g.beginPath();
    g.moveTo(mx + dx * (cell / 2) - dy * cell * 0.3, my + dy * (cell / 2) - dx * cell * 0.3);
    g.lineTo(mx + dx * (cell / 2) + dy * cell * 0.3, my + dy * (cell / 2) + dx * cell * 0.3);
    g.stroke();
    drawTag(g, t, mx + dx * (cell / 2 - size * 0.72), my + dy * (cell / 2 - size * 0.72), size);
  }
  return canvas;
}
