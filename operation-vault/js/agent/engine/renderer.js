// 렌더러: 캔버스, 장면, 카메라, 그리고 휴대폰 성능에 맞춘 해상도 조절.

import * as T from '../lib/three.js';

export function createRenderer(canvas) {
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: (globalThis.devicePixelRatio || 1) <= 2,
    powerPreference: 'high-performance',
  });
  const scene = new T.Scene();
  scene.background = new T.Color(0x05070d);
  const camera = new T.PerspectiveCamera(70, 1, 0.05, 80);
  camera.rotation.order = 'YXZ';
  scene.add(camera); // 카메라에 붙인 조명이 장면에 포함되도록

  // 해상도 배율: 최대 2. 느리면 1.5, 1.0 으로 내린다.
  const steps = [Math.min(globalThis.devicePixelRatio || 1, 2), 1.5, 1].filter((v, i, a) => i === 0 || v < a[0]);
  let quality = 0;
  let slowFrames = 0;
  let frames = 0;
  let lost = false;
  const resizeListeners = [];

  function resize() {
    const w = canvas.clientWidth || 1;
    const hgt = canvas.clientHeight || 1;
    renderer.setPixelRatio(steps[quality]);
    renderer.setSize(w, hgt, false);
    camera.aspect = w / hgt;
    camera.updateProjectionMatrix();
    resizeListeners.forEach((fn) => fn());
    // 크기를 바꾸면 캔버스가 비워진다. 바로 다시 그려서 검은 화면이 한 장 끼어드는 것을 막는다.
    if (!lost) renderer.render(scene, camera);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    resize();
  });

  return {
    renderer,
    scene,
    camera,
    get lost() {
      return lost;
    },
    onResize(fn) {
      resizeListeners.push(fn);
    },

    render(dtMs) {
      if (lost) return;
      renderer.render(scene, camera);
      // 평균 프레임 시간이 길면 해상도를 한 단계 내린다
      frames++;
      if (dtMs > 28) slowFrames++;
      if (frames >= 90) {
        if (slowFrames > 45 && quality < steps.length - 1) {
          quality++;
          resize();
        }
        frames = 0;
        slowFrames = 0;
      }
    },

    info: () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      pixelRatio: steps[quality],
      size: [canvas.clientWidth, canvas.clientHeight],
    }),
  };
}

/** 그룹 아래의 도형, 재질, 텍스처를 모두 해제한다. */
export function disposeTree(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
  if (root.parent) root.parent.remove(root);
}
