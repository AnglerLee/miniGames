// 발자국 무늬와 지문 모양 그리기. 용의자 카드와 증거 장면이 같은 그림을 써야
// 아이가 둘을 맞춰 볼 수 있으므로 한곳에 모아 둔다. 번호는 content.js 의 이름표와 같다.

/**
 * 신발 바닥 모양의 발자국을 그린다.
 * pattern: 0 줄무늬, 1 물방울무늬, 2 별무늬, 3 지그재그
 * size: 발자국 길이(px). opts: { color, angle(라디안), alpha }
 */
export function drawFootprint(ctx, pattern, cx, cy, size, opts = {}) {
  const color = opts.color || '#3b2a1a';
  const w = size * 0.42;
  const h = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(opts.angle || 0);
  ctx.globalAlpha *= opts.alpha === undefined ? 1 : opts.alpha;

  // 앞창과 뒤꿈치
  const sole = new Path2D();
  sole.ellipse(0, -h * 0.17, w * 0.5, h * 0.33, 0, 0, Math.PI * 2);
  const heel = new Path2D();
  heel.ellipse(0, h * 0.33, w * 0.38, h * 0.17, 0, 0, Math.PI * 2);

  for (const part of [sole, heel]) {
    ctx.save();
    ctx.clip(part);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, size * 0.035);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const step = size * 0.105;
    if (pattern === 0) {
      for (let y = -h * 0.55; y < h * 0.55; y += step) ctx.fillRect(-w, y, w * 2, step * 0.5);
    } else if (pattern === 1) {
      let row = 0;
      for (let y = -h * 0.52; y < h * 0.55; y += step * 0.95, row++) {
        for (let x = -w * 0.5 + (row % 2 ? step * 0.5 : 0); x < w * 0.6; x += step) {
          ctx.beginPath();
          ctx.arc(x, y, step * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (pattern === 2) {
      let row = 0;
      for (let y = -h * 0.48; y < h * 0.55; y += step * 1.45, row++) {
        for (let x = -w * 0.36 + (row % 2 ? step * 0.7 : 0); x < w * 0.6; x += step * 1.5) star(ctx, x, y, step * 0.62);
      }
    } else {
      for (let y = -h * 0.55; y < h * 0.6; y += step * 1.05) {
        ctx.beginPath();
        let up = true;
        for (let x = -w * 0.6; x <= w * 0.6 + 1; x += step * 0.55, up = !up) {
          const yy = y + (up ? -step * 0.28 : step * 0.28);
          if (x === -w * 0.6) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, size * 0.03);
    ctx.stroke(part);
  }
  ctx.restore();
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * 지문을 그린다.
 * type: 0 소용돌이형(가운데가 동그랗게 말림), 1 고리형(한쪽으로 휘어 돌아 나옴), 2 활형(언덕처럼 넘어감)
 * size: 지문 높이(px). opts: { color, angle(라디안), alpha }
 */
export function drawFingerprint(ctx, type, cx, cy, size, opts = {}) {
  const color = opts.color || '#3b2a1a';
  const w = size * 0.72;
  const h = size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(opts.angle || 0);
  ctx.globalAlpha *= opts.alpha === undefined ? 1 : opts.alpha;
  const oval = new Path2D();
  oval.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.save();
  ctx.clip(oval);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, size * 0.022);
  ctx.lineCap = 'round';
  const gap = size * 0.058;

  if (type === 0) {
    // 소용돌이: 가운데 점을 둘러싼 동심 타원
    for (let r = gap * 0.6; r < h; r += gap) {
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.04, r * 0.86, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (type === 1) {
    // 고리: 왼쪽 아래에서 들어와 위에서 돌아 다시 왼쪽 아래로 나간다
    for (let i = 0; i < 12; i++) {
      const r = gap * (0.7 + i);
      ctx.beginPath();
      ctx.moveTo(-w, h * 0.5 + r * 0.25);
      ctx.bezierCurveTo(-w * 0.2, h * 0.2 - r * 0.2, r * 0.9, r * 0.5, r * 0.75, -h * 0.05);
      ctx.bezierCurveTo(r * 0.6, -h * 0.05 - r * 1.25, -r * 1.15, -h * 0.05 - r * 1.1, -r * 0.9, -h * 0.02);
      ctx.bezierCurveTo(-r * 0.8, h * 0.12, -w * 0.5, h * 0.2 + r * 0.5, -w, h * 0.34 + r * 0.9);
      ctx.stroke();
    }
  } else {
    // 활: 왼쪽에서 오른쪽으로 언덕을 넘는 선들
    for (let i = -3; i < 14; i++) {
      const y = h * 0.5 - i * gap;
      const lift = Math.max(0, Math.min(1, (i + 1) / 9)) * h * 0.36;
      ctx.beginPath();
      ctx.moveTo(-w * 0.6, y);
      ctx.bezierCurveTo(-w * 0.2, y - lift * 0.2, -w * 0.12, y - lift, 0, y - lift);
      ctx.bezierCurveTo(w * 0.12, y - lift, w * 0.2, y - lift * 0.2, w * 0.6, y);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, size * 0.02);
  ctx.globalAlpha *= 0.55;
  ctx.stroke(oval);
  ctx.restore();
}

/**
 * 무늬나 지문을 담은 작은 캔버스를 만든다 (카드와 보기 버튼에 쓴다).
 * kind: 'foot' | 'print', value: 번호, px: 한 변 길이(CSS px)
 */
export function traitCanvas(kind, value, px = 56, opts = {}) {
  const ratio = Math.min(3, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(px * ratio);
  canvas.height = Math.round(px * ratio);
  canvas.style.width = px + 'px';
  canvas.style.height = px + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  if (kind === 'foot') drawFootprint(ctx, value, px / 2, px / 2, px * 0.9, opts);
  else drawFingerprint(ctx, value, px / 2, px / 2, px * 0.92, opts);
  return canvas;
}
