// 항해 일지: 아이가 간직할 기념 카드. 사진첩에 넣을 수 있게 캔버스 한 장(900×1200, 세로 3:4)으로 그린다.
// 글꼴 파일을 쓰지 않으므로 기기 글꼴로 그리고, 글 길이(이름 8자 등)에 맞춰 크기를 줄여 넣는다.
// 그림 문자는 기기마다 모양이 달라 쓰지 않고, 잠수함과 상자는 직접 그린다 (결말 화면과 대문도 같은 그림을 쓴다).
//
//   renderLogbook({ setup, state, grade, forced, at }) → HTMLCanvasElement (canvas.layout 에 글자 배치 정보)
//   canvasBlob(canvas) → Promise<Blob|null>
//   drawSub(g, x, y, scale, opts), drawChest(g, x, y, scale, opts)

import { headline } from '../shared/text.js';
import { clock } from '../shared/score.js';
import { DIFFICULTY, STAGES } from '../shared/content.js';

export const LOG_W = 900;
export const LOG_H = 1200;

const SANS = '"Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans CJK KR", "Malgun Gothic", sans-serif';
const INK = '#17232b';
const INK_SOFT = '#5a6b75';
const NAVY = '#0f3a54';
const PAPER = '#f4ecd8';
const GRADE_COLOR = { S: '#e0a800', A: '#1f8fb8', B: '#2f9d5b', C: '#d9822b' };

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/**
 * 노란 잠수함. (x, y) 는 몸통 가운데, 몸통 길이는 220 × s. 뱃머리는 오른쪽.
 * opts: tilt(라디안), prop(프로펠러 각도)
 */
export function drawSub(g, x, y, s = 1, { tilt = 0, prop = 0 } = {}) {
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  g.scale(s, s);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = INK;
  g.lineWidth = 5;

  // 꼬리 지느러미
  g.fillStyle = '#ff9f43';
  for (const sign of [-1, 1]) {
    g.beginPath();
    g.moveTo(-96, sign * 14);
    g.lineTo(-132, sign * 46);
    g.lineTo(-120, sign * 8);
    g.closePath();
    g.fill();
    g.stroke();
  }
  // 프로펠러
  g.fillStyle = '#9cc3d5';
  for (let k = 0; k < 2; k++) {
    const a = prop + k * Math.PI;
    g.save();
    g.translate(-126, 0);
    g.scale(1, Math.cos(a));
    g.beginPath();
    g.ellipse(0, -13, 6, 13, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }
  // 탑과 잠망경
  g.beginPath();
  g.moveTo(10, -70);
  g.lineTo(10, -96);
  g.lineTo(28, -96);
  g.lineWidth = 7;
  g.stroke();
  g.lineWidth = 5;
  const towerGrad = g.createLinearGradient(0, -74, 0, -30);
  towerGrad.addColorStop(0, '#ffe68a');
  towerGrad.addColorStop(1, '#f5b829');
  g.fillStyle = towerGrad;
  roundRect(g, -48, -74, 76, 48, 14);
  g.fill();
  g.stroke();
  // 몸통
  const hullGrad = g.createLinearGradient(0, -38, 0, 38);
  hullGrad.addColorStop(0, '#ffe680');
  hullGrad.addColorStop(0.5, '#ffc93a');
  hullGrad.addColorStop(1, '#e39a1c');
  g.fillStyle = hullGrad;
  roundRect(g, -110, -38, 220, 76, 38);
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = '#ff6b81';
  g.fillRect(-120, 16, 240, 9);
  g.fillStyle = 'rgba(255, 255, 255, 0.35)';
  g.beginPath();
  g.ellipse(-10, -24, 80, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  roundRect(g, -110, -38, 220, 76, 38);
  g.stroke();
  // 리벳
  g.fillStyle = 'rgba(23, 35, 43, 0.45)';
  for (let rx = -80; rx <= 80; rx += 20) {
    g.beginPath();
    g.arc(rx, -30, 2.2, 0, Math.PI * 2);
    g.fill();
  }
  // 둥근 창
  for (const cx of [-56, -10, 36]) {
    g.fillStyle = '#d6dde2';
    g.beginPath();
    g.arc(cx, -2, 15, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#4cc9f0';
    g.beginPath();
    g.arc(cx, -2, 9.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, 0.85)';
    g.beginPath();
    g.arc(cx - 3, -5, 3.2, 0, Math.PI * 2);
    g.fill();
  }
  // 뱃머리 불빛
  g.fillStyle = '#fff7c2';
  g.beginPath();
  g.arc(98, 4, 6, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.restore();
}

/**
 * 보물 상자. (x, y) 는 상자 가운데, 폭 100 × s.
 * opts: glow 0~1 (뒤에서 나오는 금빛)
 */
export function drawChest(g, x, y, s = 1, { glow = 0 } = {}) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (glow > 0) {
    const rg = g.createRadialGradient(0, -6, 6, 0, -6, 96);
    rg.addColorStop(0, 'rgba(255, 217, 90, ' + 0.85 * glow + ')');
    rg.addColorStop(1, 'rgba(255, 217, 90, 0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(0, -6, 96, 0, Math.PI * 2);
    g.fill();
  }
  g.lineJoin = 'round';
  g.strokeStyle = INK;
  g.lineWidth = 4;
  // 몸통
  g.fillStyle = '#9a5b2a';
  roundRect(g, -50, -8, 100, 46, 6);
  g.fill();
  g.strokeStyle = 'rgba(23, 35, 43, 0.35)';
  g.lineWidth = 2;
  for (const py of [7, 22]) {
    g.beginPath();
    g.moveTo(-48, py);
    g.lineTo(48, py);
    g.stroke();
  }
  g.strokeStyle = INK;
  g.lineWidth = 4;
  roundRect(g, -50, -8, 100, 46, 6);
  g.stroke();
  // 뚜껑
  g.fillStyle = '#b8702f';
  g.beginPath();
  g.moveTo(-50, -8);
  g.lineTo(-50, -22);
  g.quadraticCurveTo(0, -50, 50, -22);
  g.lineTo(50, -8);
  g.closePath();
  g.fill();
  g.stroke();
  // 금띠
  g.fillStyle = '#f6d365';
  for (const bx of [-38, 28]) {
    g.fillRect(bx, -28, 10, 64);
    g.strokeRect(bx, -28, 10, 64);
  }
  // 자물쇠
  roundRect(g, -10, -16, 20, 22, 4);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(0, -8, 3, 0, Math.PI * 2);
  g.fill();
  g.fillRect(-1.5, -7, 3, 8);
  // 바다에서 건져 온 표시: 따개비와 해초
  g.fillStyle = '#e8e0cf';
  for (const [bx, by, br] of [[-44, 32, 4], [-36, 34, 3], [42, 30, 3.5]]) {
    g.beginPath();
    g.arc(bx, by, br, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = '#3f9d6b';
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-50, 30);
  g.quadraticCurveTo(-62, 14, -54, -2);
  g.moveTo(-50, 34);
  g.quadraticCurveTo(-68, 30, -66, 12);
  g.stroke();
  g.restore();
}

/**
 * 폭에 맞춰 줄을 나눈다. 띄어쓰기에서 끊고, 한 낱말이 폭보다 길 때만 글자 단위로 자른다.
 */
export function wrapText(g, text, maxW) {
  const lines = [];
  let line = '';
  const push = () => {
    if (line) lines.push(line);
    line = '';
  };
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const tryLine = line ? line + ' ' + word : word;
    if (g.measureText(tryLine).width <= maxW) {
      line = tryLine;
      continue;
    }
    push();
    if (g.measureText(word).width <= maxW) {
      line = word;
      continue;
    }
    for (const ch of Array.from(word)) {
      if (g.measureText(line + ch).width > maxW && line) push();
      line += ch;
    }
  }
  push();
  return lines;
}

/** 한 줄 글을 폭에 맞을 때까지 줄인다. 돌려주는 값: 정한 글자 크기 */
function fitFont(g, text, maxW, size, min, weight = 800) {
  let px = size;
  for (; px > min; px -= 2) {
    g.font = weight + ' ' + px + 'px ' + SANS;
    if (g.measureText(text).width <= maxW) return px;
  }
  g.font = weight + ' ' + min + 'px ' + SANS;
  return min;
}

function dateText(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}

/** 부모가 끝낸 임무는 실제로 내려간 데까지만 (끝낸 단계들의 가장 깊은 수심) */
export function reachedDepth(state, forced) {
  if (!forced) return 1000;
  let m = 0;
  for (const st of (state.stats && state.stats.stages) || []) {
    const def = STAGES.find((x) => x.id === st.id);
    if (def) m = Math.max(m, def.depth);
  }
  return m;
}

export function renderLogbook({ setup, state, grade, forced, at }) {
  const canvas = document.createElement('canvas');
  canvas.width = LOG_W;
  canvas.height = LOG_H;
  const g = canvas.getContext('2d');
  const layout = { overflow: [] };
  const L = 64;
  const R = LOG_W - 64;
  const CW = R - L;
  const note = (name, w, max) => {
    if (w > max + 0.5) layout.overflow.push(name);
  };

  // 바탕: 항해 지도처럼 모눈을 깐 종이
  g.fillStyle = PAPER;
  g.fillRect(0, 0, LOG_W, LOG_H);
  g.strokeStyle = 'rgba(15, 58, 84, 0.07)';
  g.lineWidth = 1;
  for (let x = 30; x < LOG_W; x += 40) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, LOG_H);
    g.stroke();
  }
  for (let y = 30; y < LOG_H; y += 40) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(LOG_W, y);
    g.stroke();
  }
  g.strokeStyle = NAVY;
  g.lineWidth = 6;
  g.strokeRect(24, 24, LOG_W - 48, LOG_H - 48);
  g.lineWidth = 1.5;
  g.strokeRect(36, 36, LOG_W - 72, LOG_H - 72);

  // 머리띠: 이름과 임무 번호, 날짜
  g.fillStyle = NAVY;
  g.fillRect(36, 36, LOG_W - 72, 140);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = '#4cc9f0';
  g.font = '800 28px ' + SANS;
  g.fillText('잠수함 간식호', L, 86);
  g.fillStyle = '#fdf6e3';
  g.font = '900 58px ' + SANS;
  g.fillText('항해 일지', L, 150);
  g.textAlign = 'right';
  const no = '임무 No.' + (setup.missionNo || 1);
  fitFont(g, no, 330, 42, 26, 900);
  g.fillStyle = '#ffd95a';
  g.fillText(no, R, 100);
  g.fillStyle = '#cfe6f0';
  g.font = '700 26px ' + SANS;
  g.fillText(dateText(at || Date.now()), R, 146);
  g.textAlign = 'left';

  // 머리말: 2줄 안에 들도록 글자를 줄이고, 그래도 넘치면 3줄
  const who = String(setup.captain || '').trim();
  const head = forced ? (who ? who + ' 함장' : '꼬마 함장') + ', 부모님과 함께 간식 상자 인양!' : headline(who);
  let hs = 56;
  let lines;
  for (;;) {
    g.font = '900 ' + hs + 'px ' + SANS;
    lines = wrapText(g, head, CW);
    if (lines.length <= 2 || hs <= 40) break;
    hs -= 2;
  }
  g.fillStyle = INK;
  const lh = Math.round(hs * 1.28);
  let y = 214 + hs;
  for (const ln of lines) {
    note('headline', g.measureText(ln).width, CW);
    g.fillText(ln, L, y);
    y += lh;
  }
  layout.headline = { size: hs, lines: lines.length };
  const headBottom = y - lh + Math.round(hs * 0.3);

  // 잠항 그래프: 단계마다 내려간 수심. 부모가 끝낸 임무는 못 간 구간을 흐리게.
  const cTop = Math.max(headBottom + 26, 352);
  const cH = 320;
  const cBot = cTop + cH;
  g.save();
  roundRect(g, L, cTop, CW, cH, 18);
  g.clip();
  const sea = g.createLinearGradient(0, cTop, 0, cBot);
  sea.addColorStop(0, '#bfe9f7');
  sea.addColorStop(0.22, '#5cc0e6');
  sea.addColorStop(1, '#0b2f47');
  g.fillStyle = sea;
  g.fillRect(L, cTop, CW, cH);
  // 바닥 모래
  g.fillStyle = '#c9a66b';
  g.beginPath();
  g.moveTo(L, cBot);
  for (let x = L; x <= R; x += 30) g.lineTo(x, cBot - 16 - 6 * Math.sin(x / 37));
  g.lineTo(R, cBot);
  g.closePath();
  g.fill();
  g.restore();
  g.strokeStyle = NAVY;
  g.lineWidth = 3;
  roundRect(g, L, cTop, CW, cH, 18);
  g.stroke();

  const top = cTop + 40;
  const bottom = cBot - 54;
  const yOf = (d) => top + (d / 1000) * (bottom - top);
  const step = (CW - 150) / STAGES.length;
  const xOf = (i) => L + 100 + i * step;
  const pts = [{ x: xOf(0), y: yOf(0) }].concat(STAGES.map((st, i) => ({ x: xOf(i + 1), y: yOf(st.depth), st })));
  const doneStages = forced ? ((state.stats && state.stats.stages) || []).length : STAGES.length;
  // 수면 선
  g.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  g.lineWidth = 3;
  g.beginPath();
  for (let x = L; x <= R; x += 12) g.lineTo(x, yOf(0) - 2 + 3 * Math.sin(x / 14));
  g.stroke();
  // 수심 눈금
  g.font = '700 20px ' + SANS;
  g.fillStyle = 'rgba(255, 255, 255, 0.85)';
  for (const d of [0, 300, 800, 1000]) {
    g.fillText(d + 'm', L + 14, yOf(d) + (d ? 7 : 26));
    g.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(L + 76, yOf(d));
    g.lineTo(R - 10, yOf(d));
    g.stroke();
  }
  // 지나온 길
  g.lineWidth = 6;
  g.setLineDash([14, 10]);
  for (let i = 1; i < pts.length; i++) {
    g.strokeStyle = i <= doneStages ? '#fff7c2' : 'rgba(255, 255, 255, 0.28)';
    g.beginPath();
    g.moveTo(pts[i - 1].x, pts[i - 1].y);
    g.lineTo(pts[i].x, pts[i].y);
    g.stroke();
  }
  g.setLineDash([]);
  for (let i = 1; i < pts.length - 1; i++) {
    if (pts[i].st.id === 'salvage') continue; // 바닥 점 자리에는 보물 상자를 그린다
    g.fillStyle = i <= doneStages ? '#ffd95a' : 'rgba(255, 255, 255, 0.4)';
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(pts[i].x, pts[i].y, 9, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  // 단계 이름 (점 아래, 바닥 점은 위로)
  g.textAlign = 'center';
  g.font = '800 21px ' + SANS;
  STAGES.forEach((st, i) => {
    if (st.id === 'dock' || st.id === 'rise') return;
    const p = pts[i + 1];
    const label = st.name;
    const w = g.measureText(label).width + 16;
    // 바닥(보물 인양)은 상자 오른쪽에, 나머지는 점 아래에
    const lx = st.id === 'salvage' ? p.x + 40 + w / 2 : p.x;
    const ly = st.id === 'salvage' ? p.y + 26 : p.y + 34;
    g.fillStyle = 'rgba(4, 18, 29, 0.62)';
    roundRect(g, lx - w / 2, ly - 22, w, 30, 8);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillText(label, lx, ly);
  });
  // 바닥의 보물 상자와 수면 위 잠수함
  const deepest = pts[STAGES.findIndex((s) => s.id === 'salvage') + 1];
  drawChest(g, deepest.x, deepest.y + 6, 0.5, { glow: 0.9 });
  const end = pts[pts.length - 1];
  drawSub(g, Math.min(end.x - 4, R - 92), yOf(0) - 8, 0.36, { tilt: -0.05 });
  g.textAlign = 'left';

  // 기록 칸 3 × 2
  const sTop = cBot + 30;
  const gap = 16;
  const cw = (CW - gap * 2) / 3;
  const ch = 118;
  const D = DIFFICULTY[state.difficulty] || DIFFICULTY[1];
  const resolved = ((state.stats && state.stats.resolved) || []).length;
  const cells = [
    { label: '도달 수심', value: reachedDepth(state, forced) + 'm' },
    { label: '등급', value: grade, color: GRADE_COLOR[grade] },
    { label: '걸린 시간', value: clock(state.clock) },
    { label: '고친 고장', value: resolved + '개' },
    { label: '남은 선체', hull: true },
    { label: '난이도', value: D.name },
  ];
  cells.forEach((c, i) => {
    const cx = L + (i % 3) * (cw + gap);
    const cy = sTop + Math.floor(i / 3) * (ch + gap);
    g.fillStyle = 'rgba(255, 255, 255, 0.55)';
    roundRect(g, cx, cy, cw, ch, 14);
    g.fill();
    g.strokeStyle = 'rgba(15, 58, 84, 0.35)';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = INK_SOFT;
    g.font = '700 22px ' + SANS;
    g.fillText(c.label, cx + 18, cy + 36);
    if (c.hull) {
      const max = state.hullMax || 1;
      const sz = Math.min(26, (cw - 36 - (max - 1) * 6) / max);
      for (let k = 0; k < max; k++) {
        g.fillStyle = k < state.hull ? '#2f9d5b' : 'rgba(23, 35, 43, 0.15)';
        roundRect(g, cx + 18 + k * (sz + 6), cy + 52, sz, sz, 5);
        g.fill();
      }
      g.fillStyle = INK;
      g.font = '900 30px ' + SANS;
      g.fillText(state.hull + ' / ' + max + '칸', cx + 18, cy + 106);
      return;
    }
    fitFont(g, c.value, cw - 36, 50, 30, 900);
    g.fillStyle = c.color || INK;
    note(c.label, g.measureText(c.value).width, cw - 36);
    g.fillText(c.value, cx + 18, cy + 98);
  });

  // 아래: 함장 서명과 도장
  const fTop = sTop + ch * 2 + gap + 34;
  g.fillStyle = INK_SOFT;
  g.font = '700 22px ' + SANS;
  g.fillText('함장', L, fTop + 26);
  const sign = who ? who + ' 함장' : '꼬마 함장';
  fitFont(g, sign, 420, 46, 28, 800);
  g.fillStyle = NAVY;
  note('sign', g.measureText(sign).width, 420);
  g.fillText(sign, L, fTop + 84);
  g.strokeStyle = 'rgba(15, 58, 84, 0.5)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(L, fTop + 100);
  g.lineTo(L + 440, fTop + 100);
  g.stroke();

  const stamp = forced ? ['부모님과', '함께'] : ['임무', '완료'];
  g.save();
  g.translate(R - 96, fTop + 50);
  g.rotate(-0.2);
  g.strokeStyle = '#c9184a';
  g.fillStyle = '#c9184a';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(0, 0, 82, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, 0, 70, 0, Math.PI * 2);
  g.stroke();
  g.textAlign = 'center';
  g.font = '900 ' + (forced ? 30 : 38) + 'px ' + SANS;
  g.fillText(stamp[0], 0, -6);
  g.fillText(stamp[1], 0, forced ? 34 : 38);
  g.restore();
  layout.bottom = fTop + 132;
  if (layout.bottom > LOG_H - 36) layout.overflow.push('bottom');

  canvas.layout = layout;
  return canvas;
}

export function canvasBlob(canvas) {
  return new Promise((resolve) => {
    try {
      if (canvas.toBlob) {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
        return;
      }
      const data = canvas.toDataURL('image/png');
      const bin = atob(data.split(',')[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      resolve(new Blob([bytes], { type: 'image/png' }));
    } catch (e) {
      resolve(null);
    }
  });
}
