// 3D 부품 모음. 모델 파일 없이 상자, 원기둥, 캔버스 텍스처만으로 시설을 만든다.

import * as T from '../lib/three.js';

/** 캔버스에 그림을 그려 텍스처로 만든다. draw(g, w, h) 가 그린다. */
export function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  draw(g, w, h);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 다시 그릴 수 있는 화면(단말기 화면, 계기판)용 텍스처. redraw(fn) 로 갱신한다. */
export function liveTexture(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return {
    texture,
    redraw(fn) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, w, h);
      fn(g, w, h);
      texture.needsUpdate = true;
    },
  };
}

/** 빛을 받는 재질. 값싼 램버트 재질만 쓴다. */
export function lit(color, opts = {}) {
  return new T.MeshLambertMaterial({ color, ...opts });
}

/** 빛과 상관없이 제 색을 내는 재질. 표식, 화면, 표시등처럼 색을 읽어야 하는 곳에 쓴다. */
export function glow(color, opts = {}) {
  return new T.MeshBasicMaterial({ color, ...opts });
}

export function box(w, h, d, material) {
  return new T.Mesh(new T.BoxGeometry(w, h, d), material);
}

export function plane(w, h, material) {
  return new T.Mesh(new T.PlaneGeometry(w, h), material);
}

/** 터치용 투명 판. 화면에는 보이지 않지만 광선 검사에는 걸린다. */
export function hitPlate(w, h, d = 0.02) {
  return new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ visible: false }));
}

/** 글자가 적힌 판. 조명과 무관하게 읽힌다. */
export function label(text, { w = 1, h = 0.25, color = '#e9eefb', bg = null, px = 96, weight = 800, border = null } = {}) {
  const ratio = w / h;
  const tex = canvasTexture(Math.round(px * ratio * 1.6), Math.round(px * 1.6), (g, cw, ch) => {
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, cw, ch);
    }
    if (border) {
      g.strokeStyle = border;
      g.lineWidth = ch * 0.06;
      g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, cw - g.lineWidth, ch - g.lineWidth);
    }
    g.fillStyle = color;
    g.font = `${weight} ${px}px "Pretendard","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // 글자가 넘치면 줄인다
    const width = g.measureText(text).width;
    const scale = Math.min(1, (cw * 0.9) / width);
    g.translate(cw / 2, ch / 2);
    g.scale(scale, scale);
    g.fillText(text, 0, 4);
  });
  return plane(w, h, glow(0xffffff, { map: tex, transparent: !bg }));
}

// ---------- 표면 텍스처 ----------

function speckle(g, w, h, count, alpha) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

/** 강철 벽판: 이음매와 리벳 */
export function wallTexture(base = '#3a465f') {
  const tex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 900, 0.06);
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 4;
    g.strokeRect(2, 2, w - 4, h - 4);
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = 2;
    g.strokeRect(7, 7, w - 14, h - 14);
    g.fillStyle = 'rgba(0,0,0,0.45)';
    for (const [x, y] of [[18, 18], [w - 18, 18], [18, h - 18], [w - 18, h - 18]]) {
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
    }
  });
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}

/** 바닥 타일 */
export function floorTexture() {
  const tex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#262d3d';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, 1400, 0.07);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, w, h);
    g.beginPath();
    g.moveTo(w / 2, 0);
    g.lineTo(w / 2, h);
    g.moveTo(0, h / 2);
    g.lineTo(w, h / 2);
    g.stroke();
  });
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}

/** 경고 줄무늬 (노랑/검정) */
export function hazardTexture() {
  const tex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#1b1b1b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2b61c';
    for (let i = -h; i < w + h; i += 48) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 24, 0);
      g.lineTo(i + 24 - h, h);
      g.lineTo(i - h, h);
      g.closePath();
      g.fill();
    }
  });
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}

/** 덕트의 주름진 금속판 */
export function ductTexture() {
  const tex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#8b94a6';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      const grad = g.createLinearGradient(x, 0, x + 32, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.22)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
      grad.addColorStop(1, 'rgba(0,0,0,0.22)');
      g.fillStyle = grad;
      g.fillRect(x, 0, 32, h);
    }
    speckle(g, w, h, 400, 0.06);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 4;
    g.strokeRect(0, 0, w, h);
  });
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}

/**
 * 직육면체 방. 바닥 가운데가 (0, 0, 0) 이고 안쪽을 향한 면 여섯 개로 이루어진다.
 * 돌려받은 그룹에 장치를 붙여 쓴다.
 */
export function room({ w, h, d, wall = '#3a465f', tile = 1.5 }) {
  const group = new T.Group();
  const wallTex = wallTexture(wall);
  const floorTex = floorTexture();
  const mkWall = (width, height) => {
    const tex = wallTex.clone();
    tex.repeat.set(width / tile, height / tile);
    tex.needsUpdate = true;
    return plane(width, height, lit(0xffffff, { map: tex }));
  };
  const back = mkWall(w, h);
  back.position.set(0, h / 2, -d / 2);
  const front = mkWall(w, h);
  front.position.set(0, h / 2, d / 2);
  front.rotation.y = Math.PI;
  const left = mkWall(d, h);
  left.position.set(-w / 2, h / 2, 0);
  left.rotation.y = Math.PI / 2;
  const right = mkWall(d, h);
  right.position.set(w / 2, h / 2, 0);
  right.rotation.y = -Math.PI / 2;

  floorTex.repeat.set(w / 2, d / 2);
  const floor = plane(w, d, lit(0xffffff, { map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  const ceilTex = wallTexture('#1d2333');
  ceilTex.repeat.set(w / 2, d / 2);
  const ceiling = plane(w, d, lit(0xffffff, { map: ceilTex }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = h;

  group.add(back, front, left, right, floor, ceiling);
  return group;
}

/** 천장의 긴 조명 (보이는 등기구 + 실제 빛) */
export function ceilingLight(group, x, y, z, { color = 0xcfe6ff, intensity = 14, length = 1.6 } = {}) {
  const tube = box(length, 0.05, 0.22, glow(color));
  tube.position.set(x, y - 0.03, z);
  const light = new T.PointLight(color, intensity, 14, 1.6);
  light.position.set(x, y - 0.35, z);
  group.add(tube, light);
  return light;
}

/** 표시등: 켜지면 제 색으로 빛나고 꺼지면 어둡다. */
export function lamp(radius, color) {
  const on = new T.Color(color);
  const off = on.clone().multiplyScalar(0.12);
  const mesh = new T.Mesh(new T.SphereGeometry(radius, 16, 12), glow(off));
  mesh.userData.set = (lit) => mesh.material.color.copy(lit ? on : off);
  return mesh;
}
