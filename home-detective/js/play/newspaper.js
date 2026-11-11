// "우리 집 일보" 1면. 아이가 간직할 기념품이라 사진첩에 넣을 수 있게 캔버스 한 장으로 그린다.
// 글꼴 파일을 쓰지 않으므로 기기 글꼴로 그리고, 글 길이(이름 8자 등)에 맞춰 크기를 줄여 넣는다.
//
//   renderNewspaper({ setup, cs, run, grade, usedMs, forced }) → Promise<HTMLCanvasElement>
//   grade, usedMs 는 결말 화면이 보여 준 값과 같아야 하므로 바깥에서 받는다.

import { photos } from '../shared/store.js';
import { headline, josa, itemText } from '../shared/text.js';
import { DIFFICULTY } from '../shared/content.js';
import { makeRng } from '../shared/prng.js';

export const PAPER_W = 900;
export const PAPER_H = 1200;

const SANS = '"Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans CJK KR", "Malgun Gothic", sans-serif';
const SERIF = '"AppleMyungjo", "Noto Serif KR", "Noto Serif CJK KR", "Nanum Myeongjo", "Batang", serif';
const EMOJI = '"Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif';

const INK = '#2a2118';
const INK_SOFT = '#5f5140';
const RED = '#b8321f';
const M = 50; // 바깥 여백
const W = PAPER_W - M * 2;

/** 사진 열쇠로 그림을 읽는다. 없거나 못 읽으면 null (아이콘으로 대신 그린다). */
async function loadPhoto(key) {
  if (!key) return null;
  const blob = await photos.get(key).catch(() => null);
  if (!blob) return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * 폭에 맞춰 줄을 나눈다. 한국어는 띄어쓰기에서 끊는 게 읽기 좋고,
 * 한 낱말이 폭보다 길 때만 글자 단위로 자른다.
 */
export function wrapText(ctx, text, maxW) {
  const lines = [];
  let line = '';
  const push = () => {
    if (line) lines.push(line);
    line = '';
  };
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const tryLine = line ? line + ' ' + word : word;
    if (ctx.measureText(tryLine).width <= maxW) {
      line = tryLine;
      continue;
    }
    push();
    if (ctx.measureText(word).width <= maxW) {
      line = word;
      continue;
    }
    for (const ch of word) {
      if (ctx.measureText(line + ch).width > maxW && line) push();
      line += ch;
    }
  }
  push();
  return lines;
}

function dateText(ms) {
  const d = new Date(ms);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + days[d.getDay()] + '요일';
}

function minSec(ms) {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? m + '분' + (s ? ' ' + s + '초' : '') : s + '초';
}

function rule(ctx, y, weight = 2) {
  ctx.fillStyle = INK;
  ctx.fillRect(M, y, W, weight);
}

/** 오래된 신문 종이 느낌: 누런 바탕, 가장자리 그늘, 잔 얼룩, 가운데 접힌 자국 */
function paper(ctx, seed) {
  ctx.fillStyle = '#f2e8cf';
  ctx.fillRect(0, 0, PAPER_W, PAPER_H);
  const g = ctx.createRadialGradient(PAPER_W / 2, PAPER_H / 2, PAPER_H * 0.3, PAPER_W / 2, PAPER_H / 2, PAPER_H * 0.8);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(120,90,40,0.22)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PAPER_W, PAPER_H);
  const rng = makeRng(seed >>> 0);
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = 'rgba(90,70,40,' + (0.03 + (rng.int(6) / 100)) + ')';
    ctx.fillRect(rng.int(PAPER_W), rng.int(PAPER_H), 1 + rng.int(3), 1 + rng.int(2));
  }
  const fold = ctx.createLinearGradient(0, PAPER_H / 2 - 14, 0, PAPER_H / 2 + 14);
  fold.addColorStop(0, 'rgba(0,0,0,0)');
  fold.addColorStop(0.5, 'rgba(90,70,40,0.10)');
  fold.addColorStop(0.55, 'rgba(255,255,255,0.25)');
  fold.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fold;
  ctx.fillRect(0, PAPER_H / 2 - 14, PAPER_W, 28);
}

/** 사진 칸: 사진이 있으면 흑백 인쇄처럼, 없으면 아이콘을 크게 */
function pictureBox(ctx, x, y, w, h, img, icon) {
  ctx.save();
  ctx.fillStyle = '#e2d6b8';
  ctx.fillRect(x, y, w, h);
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (img) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    // ctx.filter 를 모르는 브라우저는 그냥 컬러로 그린다
    ctx.filter = 'grayscale(1) contrast(1.15) sepia(0.2)';
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.filter = 'none';
  } else {
    // 망점 무늬 위에 아이콘
    ctx.fillStyle = 'rgba(90,70,40,0.12)';
    for (let yy = y + 6; yy < y + h; yy += 14) {
      for (let xx = x + ((yy - y) % 28 ? 13 : 6); xx < x + w; xx += 14) {
        ctx.beginPath();
        ctx.arc(xx, yy, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.font = Math.round(Math.min(w, h) * 0.6) + 'px ' + EMOJI;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    ctx.fillText(icon || '🧸', x + w / 2, y + h / 2 + 6);
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
}

function gradeStamp(ctx, cx, cy, grade) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.2);
  ctx.globalAlpha = 0.86;
  ctx.strokeStyle = RED;
  ctx.fillStyle = RED;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, 0, 78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 66, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '900 84px ' + SANS;
  ctx.fillText(grade, 0, 26);
  ctx.font = '800 20px ' + SANS;
  ctx.fillText('수사 등급', 0, 52);
  ctx.restore();
}

/** 줄들을 그리고 마지막 줄 아래 y 를 돌려준다 */
function drawLines(ctx, lines, x, y, lh, align = 'left') {
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + lh * (i + 1) - lh * 0.24));
  return y + lh * lines.length;
}

/** 기사 글. forced(부모가 끝냄)면 범인을 밝히지 않는다 (자백이 없었으므로). */
function articleOf({ setup, cs, run, grade, usedMs, forced }) {
  const who = setup.detective ? setup.detective + ' 탐정' : '꼬마 탐정';
  const crimeRoom = cs.rooms[cs.crimeRoom].name;
  if (forced) {
    // 부모가 "찾은 것으로 처리"한 쪽지는 아이가 찾은 것으로 세지 않는다
    const rescued = new Set((run.events || []).filter((e) => e.type === 'rescue').map((e) => e.tag));
    const found = Object.keys(run.found || {}).filter((id) => !rescued.has(id)).length;
    // run.asked 에는 부모가 처리한 용의자의 진술도 들어가므로, 아이가 실제로 물어본 기록(asked)으로 센다
    const asked = new Set((run.events || []).filter((e) => e.type === 'asked').map((e) => e.s + ':' + e.t)).size;
    return {
      head: who + ', 끝까지 포기하지 않은 수사!',
      paras: [
        crimeRoom + '에서 간식 상자가 사라진 사건.',
        josa(who, '은/는') + ' ' + minSec(usedMs) + ' 동안 쪽지 ' + found + '장을 찾고 진술 ' + asked + '개를 들으며 끈질기게 수사했다.',
        '수사는 부모님과 함께 마무리했다. 탐정의 다음 활약이 기대된다.',
      ],
      boxLabel: '수사 기록',
      boxText: '찾은 쪽지 ' + found + '/' + cs.tags.length + '장 · 들은 진술 ' + asked + '개',
      caption: '▲ 사건 현장 ' + crimeRoom,
      icon: cs.rooms[cs.crimeRoom].icon,
      photoKey: null,
    };
  }
  const culprit = cs.suspects[cs.culprit];
  const solved = (run.accusations || []).filter((a) => a.result === 'solved').pop();
  return {
    head: headline(cs, setup.detective),
    paras: [
      crimeRoom + '에서 간식 상자가 감쪽같이 사라진 사건의 범인이 잡혔다.',
      '범인 ' + josa(culprit.name, '은/는') + ' ' + cs.slots[cs.crimeSlot] + '에 ' + crimeRoom + '에서 간식 상자를 몰래 들고 나왔다고 털어놓았다.',
      josa(who, '은/는') + ' ' + minSec(usedMs) + ' 만에 사건을 해결했다. 수사 등급은 ' + grade + '.',
    ],
    boxLabel: '결정적 증거',
    boxText: solved && solved.item ? itemText(cs, solved.item) : '',
    caption: '▲ 붙잡힌 간식 도둑 ' + culprit.name,
    icon: culprit.icon,
    photoKey: culprit.photo,
  };
}

export async function renderNewspaper(opts) {
  const { setup, cs, run, grade } = opts;
  const art = articleOf(opts);
  const img = await loadPhoto(art.photoKey);

  const canvas = document.createElement('canvas');
  canvas.width = PAPER_W;
  canvas.height = PAPER_H;
  const ctx = canvas.getContext('2d');
  paper(ctx, cs.seed ^ 0x51ed);
  ctx.fillStyle = INK;

  // 머리: 사건 번호 · 날짜
  ctx.font = '700 24px ' + SANS;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText('사건 No.' + (setup.caseNo || 1), M, 70);
  ctx.textAlign = 'right';
  ctx.fillText(dateText(run.solvedAt || Date.now()), PAPER_W - M, 70);
  rule(ctx, 86, 3);

  // 제호
  ctx.textAlign = 'center';
  ctx.font = '900 118px ' + SERIF;
  ctx.fillText('우리 집 일보', PAPER_W / 2, 214);
  ctx.font = '500 23px ' + SANS;
  ctx.fillStyle = INK_SOFT;
  const level = (DIFFICULTY[cs.difficulty] || DIFFICULTY[1]).name;
  ctx.fillText('집 안의 모든 사건을 가장 먼저 전합니다 · 난이도 ' + level, PAPER_W / 2, 256);
  ctx.fillStyle = INK;
  rule(ctx, 276, 5);
  rule(ctx, 286, 1.5);

  // 머리기사 · 사진과 기사 · 증거 상자가 모두 바닥 글 위에 들어가도록 머리기사와 본문 크기를 함께 고른다.
  // 이름이 길면(8자 두 개) 머리기사가 세 줄이 되므로, 크게 보이는 조합부터 차례로 맞춰 본다.
  const picW = 360;
  const colX = M + picW + 34;
  const colW = PAPER_W - M - colX;
  const footTop = PAPER_H - 92;
  const headTop = 356;
  const plan = (hs, size) => {
    ctx.font = '900 ' + hs + 'px ' + SANS;
    const headLines = wrapText(ctx, art.head, W);
    if (headLines.length > 3) return null;
    const headLh = Math.round(hs * 1.22);
    const rowTop = headTop + headLines.length * headLh + 46;
    ctx.font = '500 ' + size + 'px ' + SANS;
    const lh = Math.round(size * 1.5);
    const paras = art.paras.map((p) => wrapText(ctx, p, colW));
    const textH = paras.reduce((n, ls) => n + ls.length * lh, 0) + (paras.length - 1) * Math.round(size * 0.6);
    ctx.font = '500 ' + (size - 4) + 'px ' + SANS;
    const capLines = wrapText(ctx, art.caption, picW);
    const capH = capLines.length * (size + 4);
    const picH = Math.max(240, Math.min(380, textH - capH - 14));
    const rowH = Math.max(textH, picH + 14 + capH);
    ctx.font = '600 ' + (size - 2) + 'px ' + SANS;
    const boxLines = art.boxText ? wrapText(ctx, art.boxText, W - 48) : [];
    const boxH = boxLines.length ? 64 + boxLines.length * Math.round((size - 2) * 1.45) + 20 : 0;
    const fits = rowTop + rowH + 34 + boxH <= footTop;
    return { hs, headLines, headLh, rowTop, size, lh, paras, capLines, picH, rowH, boxLines, boxH, fits };
  };
  // 본문은 26px 아래로 내리지 않는 것을 먼저 지키고(아이가 읽어야 하므로), 그 안에서 머리기사와 본문을 함께 따진다.
  // 그래도 안 들어갈 때만 본문을 24, 22 로 줄인다.
  const byScore = (a, b) => b[0] + b[1] * 2.5 - (a[0] + a[1] * 2.5) || b[0] - a[0];
  const HEADS = [76, 70, 64, 58, 52, 46, 42];
  const first = [];
  const later = [];
  for (const hs of HEADS) for (const size of [30, 28, 26]) first.push([hs, size]);
  for (const hs of HEADS) for (const size of [24, 22]) later.push([hs, size]);
  const tries = first.sort(byScore).concat(later.sort(byScore));
  let L = null;
  for (const [hs, size] of tries) {
    const c = plan(hs, size);
    if (!c) continue;
    if (!L || c.fits) L = c;
    if (c.fits) break;
  }
  if (!L.fits) L = plan(42, 22) || L;

  // 머리기사
  let y = 306;
  ctx.fillStyle = RED;
  ctx.fillRect(M, y, 92, 38);
  ctx.fillStyle = '#fff';
  ctx.font = '900 24px ' + SANS;
  ctx.textAlign = 'center';
  ctx.fillText(opts.forced ? '화제' : '특종', M + 46, y + 28);
  ctx.fillStyle = INK;
  ctx.font = '900 ' + L.hs + 'px ' + SANS;
  y = drawLines(ctx, L.headLines, M, headTop, L.headLh);
  y += 16;
  rule(ctx, y, 2);
  y = L.rowTop;

  pictureBox(ctx, M, y, picW, L.picH, img, art.icon);
  ctx.fillStyle = INK_SOFT;
  ctx.font = '500 ' + (L.size - 4) + 'px ' + SANS;
  drawLines(ctx, L.capLines, M, y + L.picH + 10, L.size + 4);

  ctx.fillStyle = INK;
  ctx.font = '500 ' + L.size + 'px ' + SANS;
  let ty = y;
  L.paras.forEach((ls) => {
    ty = drawLines(ctx, ls, colX, ty, L.lh) + Math.round(L.size * 0.6);
  });
  // 세로 단 구분선
  ctx.fillStyle = 'rgba(42,33,24,0.35)';
  ctx.fillRect(colX - 18, y, 1.5, L.rowH);
  // 등급 도장: 기사 아래 빈자리가 넉넉하면 거기에, 아니면 사진 위 귀퉁이에 찍는다 (글자와 사진 설명을 가리지 않게)
  const rowBottom = y + L.rowH;
  if (rowBottom - ty >= 172) gradeStamp(ctx, colX + colW / 2, ty + (rowBottom - ty) / 2, grade);
  else gradeStamp(ctx, M + picW - 62, y + 66, grade);
  y += L.rowH + 34;

  // 결정적 증거 상자
  if (L.boxH) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(M, y, W, L.boxH);
    ctx.fillStyle = INK;
    ctx.fillRect(M, y, W, 46);
    ctx.fillStyle = '#f2e8cf';
    ctx.font = '900 24px ' + SANS;
    ctx.textAlign = 'left';
    ctx.fillText('🔍 ' + art.boxLabel, M + 20, y + 32);
    ctx.fillStyle = INK;
    ctx.font = '600 ' + (L.size - 2) + 'px ' + SANS;
    drawLines(ctx, L.boxLines, M + 24, y + 60, Math.round((L.size - 2) * 1.45));
  }
  // 검증용: 내용이 바닥 글 위에서 끝났는지 확인할 수 있게 고른 크기와 끝 위치를 남긴다
  canvas.layout = { bottom: y + L.boxH, footTop, headSize: L.hs, headLines: L.headLines.length, bodySize: L.size };

  // 바닥: 발행 문구
  rule(ctx, PAPER_H - 70, 3);
  ctx.fillStyle = INK_SOFT;
  ctx.font = '500 22px ' + SANS;
  ctx.textAlign = 'left';
  const who = setup.detective ? setup.detective + ' 탐정' : '꼬마 탐정';
  const footer = wrapText(ctx, who + '의 활약을 기념하며 · 우리 집 일보 · 사건 No.' + (setup.caseNo || 1), W);
  drawLines(ctx, footer.slice(0, 2), M, PAPER_H - 62, 30);
  return canvas;
}

/** 캔버스를 PNG Blob 으로 (toBlob 이 없는 옛 브라우저는 dataURL 로 대신) */
export function canvasBlob(canvas) {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
      return;
    }
    const data = canvas.toDataURL('image/png');
    const bin = atob(data.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    resolve(new Blob([bytes], { type: 'image/png' }));
  });
}
