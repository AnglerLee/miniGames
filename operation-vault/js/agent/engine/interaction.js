// 터치 입력. 손가락 동작을 "누르기", "끌기", "둘러보기"로 나눠 장치에 전달한다.
//
// 장치는 눈에 보이지 않는 큼직한 판(proxy)을 등록한다. 작은 버튼도 손가락으로 누르기 쉽다.
//   add({ mesh, onTap, onDrag })
//     onTap()                         짧게 눌렀을 때
//     onDrag(phase, info)             phase: 'start' | 'move' | 'end'
// 판 위에서 시작하지 않은 끌기는 카메라 둘러보기가 된다.

import * as T from '../lib/three.js';

const TAP_MOVE_PX = 10;
const TAP_TIME_MS = 700;

export function createInteraction(canvas, camera, rig) {
  const proxies = [];
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  let active = null;
  let locked = false;

  const shown = (obj) => {
    for (let o = obj; o; o = o.parent) if (!o.visible) return false;
    return true;
  };

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const usable = proxies.filter((p) => p.enabled !== false && shown(p.mesh));
    const hits = ray.intersectObjects(usable.map((p) => p.mesh), false);
    if (!hits.length) return null;
    return { proxy: usable.find((p) => p.mesh === hits[0].object), point: hits[0].point };
  }

  const info = (e) => ({
    x: e.clientX,
    y: e.clientY,
    dx: e.clientX - active.lastX,
    dy: e.clientY - active.lastY,
    startX: active.startX,
    startY: active.startY,
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (active || locked || e.isPrimary === false) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* 일부 브라우저는 캡처를 지원하지 않는다 */
    }
    active = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      time: performance.now(),
      moved: false,
      target: null,
    };
    const hit = pick(e.clientX, e.clientY);
    if (hit && hit.proxy.onDrag) {
      active.target = hit.proxy;
      hit.proxy.onDrag('start', info(e));
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== active.id) return;
    const far = Math.hypot(e.clientX - active.startX, e.clientY - active.startY) > TAP_MOVE_PX;
    if (far) active.moved = true;
    if (active.target) active.target.onDrag('move', info(e));
    else if (active.moved) rig.lookBy(e.clientX - active.lastX, e.clientY - active.lastY); // 화면을 잡아끄는 느낌
    active.lastX = e.clientX;
    active.lastY = e.clientY;
  });

  const finish = (e, cancelled) => {
    if (!active || e.pointerId !== active.id) return;
    const was = active;
    active = null;
    rig.lookEnd();
    if (was.target) {
      was.target.onDrag('end', { x: e.clientX, y: e.clientY, dx: 0, dy: 0, startX: was.startX, startY: was.startY });
      return;
    }
    if (cancelled || locked || was.moved || performance.now() - was.time > TAP_TIME_MS) return;
    const hit = pick(e.clientX, e.clientY);
    if (hit && hit.proxy.onTap) hit.proxy.onTap(hit);
  };
  canvas.addEventListener('pointerup', (e) => finish(e, false));
  canvas.addEventListener('pointercancel', (e) => finish(e, true));

  return {
    add(proxy) {
      proxies.push(proxy);
      return proxy;
    },
    remove(proxy) {
      const i = proxies.indexOf(proxy);
      if (i >= 0) proxies.splice(i, 1);
    },
    clear() {
      proxies.length = 0;
    },
    /** 입력을 잠근다 (연출 중이거나 장치를 다시 섞는 동안). */
    setLocked(v) {
      locked = v;
      if (v && active && active.target) {
        active.target.onDrag('end', { x: active.lastX, y: active.lastY, dx: 0, dy: 0 });
        active = null;
      }
    },
    get locked() {
      return locked;
    },
    /** 검증용: 판의 화면 좌표를 구한다. */
    screenPointOf(mesh) {
      const v = new T.Vector3();
      mesh.getWorldPosition(v);
      v.project(camera);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    },
  };
}
