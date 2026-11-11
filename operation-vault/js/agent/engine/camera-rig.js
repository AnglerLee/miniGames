// 카메라 받침대. 자유롭게 걸어 다니지 않고 정해진 "자리(station)" 사이를 부드럽게 옮겨 다닌다.
//
// 자리는 두 가지 방식으로 적는다.
//   { pos: [x, y, z], yaw, pitch, fov }                      정확한 위치
//   { frame: { center: [x, y, z], yaw, width, height }, fov }  이 넓이가 화면에 꽉 차게
// 공통: look(끌어서 둘러보기 허용 범위 { yaw, pitch }), spring(손을 떼면 되돌아옴)
//
// yaw 0 은 -Z 쪽을 본다. yaw 가 커지면 왼쪽으로 돈다.

import * as T from '../lib/three.js';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

/** 각도 차이를 -PI ~ PI 로 맞춘다 (가까운 쪽으로 돌도록). */
function shortAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d;
}

export function createRig(camera) {
  const cur = { x: 0, y: 1.5, z: 3, yaw: 0, pitch: 0, fov: 70 };
  let station = null;
  let tween = null;
  let look = { yaw: 0, pitch: 0 };
  let dragging = false;
  let shake = { amp: 0, left: 0, total: 1 };
  let bob = 0;

  /** 자리를 실제 카메라 자세로 바꾼다. 화면 비율에 따라 거리가 달라진다. */
  function poseOf(st) {
    const fov = st.fov || 70;
    if (!st.frame) {
      return { x: st.pos[0], y: st.pos[1], z: st.pos[2], yaw: st.yaw || 0, pitch: st.pitch || 0, fov };
    }
    const f = st.frame;
    const vHalf = Math.tan(T.MathUtils.degToRad(fov) / 2);
    const hHalf = vHalf * camera.aspect;
    // 위아래는 HUD 가 가리므로 화면의 일부만 쓸 수 있다고 본다
    const usable = f.usable || 0.74;
    const dist = Math.max(f.width / 2 / hHalf, f.height / 2 / (vHalf * usable));
    const yaw = f.yaw || 0;
    return {
      x: f.center[0] + Math.sin(yaw) * dist,
      y: f.center[1] + (f.lift || 0),
      z: f.center[2] + Math.cos(yaw) * dist,
      yaw,
      pitch: f.pitch || 0,
      fov,
    };
  }

  function apply() {
    let sx = 0;
    let sy = 0;
    if (shake.left > 0) {
      const k = (shake.left / shake.total) * shake.amp;
      sx = (Math.random() - 0.5) * k;
      sy = (Math.random() - 0.5) * k;
    }
    camera.position.set(cur.x + sx, cur.y + sy + bob, cur.z);
    camera.rotation.set(cur.pitch + look.pitch, cur.yaw + look.yaw, 0);
    if (camera.fov !== cur.fov) {
      camera.fov = cur.fov;
      camera.updateProjectionMatrix();
    }
  }

  return {
    get station() {
      return station;
    },
    get moving() {
      return !!tween;
    },

    /** 자리로 부드럽게 옮긴다. 끝나면 풀리는 Promise 를 돌려준다. */
    goTo(st, ms = 600) {
      station = st;
      const to = poseOf(st);
      to.yaw = shortAngle(cur.yaw, to.yaw);
      const from = { ...cur };
      if (tween) tween.resolve();
      return new Promise((resolve) => {
        tween = { from, to, t: 0, ms: Math.max(1, ms), resolve };
      });
    },

    /** 자리로 즉시 옮긴다. */
    snapTo(st) {
      station = st;
      if (tween) tween.resolve();
      tween = null;
      Object.assign(cur, poseOf(st));
      look = { yaw: 0, pitch: 0 };
      apply();
    },

    /** 화면 크기가 바뀌면 현재 자리를 다시 계산한다. */
    refresh() {
      if (station && !tween) Object.assign(cur, poseOf(station));
    },

    /** 손가락으로 끌어서 둘러본다 (자리가 허용하는 범위 안에서). */
    lookBy(dxPx, dyPx) {
      if (!station || !station.look) return;
      dragging = true;
      const k = 0.0045;
      look.yaw = T.MathUtils.clamp(look.yaw + dxPx * k, -station.look.yaw, station.look.yaw);
      look.pitch = T.MathUtils.clamp(look.pitch + dyPx * k, -station.look.pitch, station.look.pitch);
    },
    lookEnd() {
      dragging = false;
    },
    resetLook() {
      look = { yaw: 0, pitch: 0 };
    },

    shake(amp = 0.08, ms = 400) {
      shake = { amp, left: ms, total: ms };
    },

    /** 걸음 흔들림 (덕트를 기어갈 때) */
    setBob(v) {
      bob = v;
    },

    update(dtMs) {
      if (tween) {
        tween.t += dtMs / tween.ms;
        const k = ease(Math.min(1, tween.t));
        for (const key of ['x', 'y', 'z', 'yaw', 'pitch', 'fov']) cur[key] = lerp(tween.from[key], tween.to[key], k);
        if (tween.t >= 1) {
          const done = tween;
          tween = null;
          cur.yaw = ((cur.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
          done.resolve();
        }
      }
      // 손을 떼면 시선이 정면으로 돌아온다
      if (!dragging && station && station.spring) {
        const back = Math.min(1, dtMs / 180);
        look.yaw = lerp(look.yaw, 0, back);
        look.pitch = lerp(look.pitch, 0, back);
      }
      if (shake.left > 0) shake.left -= dtMs;
      apply();
    },

    pose: () => ({ ...cur }),
  };
}
