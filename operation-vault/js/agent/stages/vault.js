// 5단계 금고실의 3D 장면.
// 커다란 금고 문 한가운데에 다이얼이 있다. 손가락으로 원을 그리듯 끌어서 돌린다.
//   탐지: 천천히 돌리면 숨은 번호에서 묵직하게 걸린다. 손가락을 떼지 않고 멈춰 있으면 표시된다.
//   입력: 본부가 계산한 번호에 맞추고, 손가락을 떼지 않고 멈춰서 확정한다.

import * as T from '../lib/three.js';
import { h } from '../../shared/dom.js';
import { DIAL, TURNS } from '../../shared/puzzles/vaultdial.js';
import { drawTag } from '../../shared/draw2d/tags.js';
import { room, box, plane, lit, glow, label, lamp, canvasTexture, hitPlate, ceilingLight } from '../engine/kit.js';
import { vibrate } from '../platform.js';

const STEP = (Math.PI * 2) / DIAL; // 눈금 하나의 각도
const SLOW_MS = 130; // 눈금 사이 간격이 이보다 길면 "천천히"로 본다
const HOLD_WAIT_MS = 320; // 멈춘 뒤 고리가 차기 시작하기까지
const HOLD_FILL_MS = 900; // 고리가 다 차는 시간
const NTH = ['첫째', '둘째', '셋째'];

export function createVaultStage(env) {
  const root = new T.Group();
  root.add(room({ w: 7, h: 4.2, d: 9, wall: '#4a4238' }));
  ceilingLight(root, 0, 4.2, 0, { intensity: 18, color: 0xffe9c4 });
  root.add(new T.AmbientLight(0xa89c8a, 0.9));

  const wallZ = -4.45;
  const cy = 1.9; // 금고 문 중심 높이

  // ---- 금고 문 ----
  const hinge = new T.Group(); // 왼쪽 경첩을 축으로 열린다
  hinge.position.set(-1.45, cy, wallZ + 0.05);
  root.add(hinge);
  const door = new T.Group();
  door.position.set(1.45, 0, 0);
  hinge.add(door);

  const disc = new T.Mesh(new T.CylinderGeometry(1.45, 1.45, 0.3, 48), lit(0x8c8f96));
  disc.rotation.x = Math.PI / 2;
  disc.position.z = 0.15;
  const rim = new T.Mesh(new T.TorusGeometry(1.36, 0.07, 10, 48), lit(0x5d6068));
  rim.position.z = 0.31;
  door.add(disc, rim);
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2; // 명판과 표시등 자리를 비켜 간다
    const bolt = new T.Mesh(new T.CylinderGeometry(0.075, 0.075, 0.1, 12), lit(0x4a4d55));
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0.33);
    door.add(bolt);
  }

  // 벽의 구멍과 금고 안 (문이 열리면 보인다)
  const inside = new T.Mesh(new T.CircleGeometry(1.4, 48), glow(0xffe08a));
  inside.position.set(0, cy, wallZ + 0.02);
  const insideLight = new T.PointLight(0xffd76a, 0, 12, 1.4);
  insideLight.position.set(0, cy, wallZ + 1.2);
  root.add(inside, insideLight);

  // 눈금판: 고정된 고리. 숫자는 시계 방향으로 커진다.
  const ringTex = canvasTexture(1024, 1024, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#16181d';
    g.beginPath();
    g.arc(c, c, c, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#d8dbe2';
    g.fillStyle = '#f2f2f2';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '800 62px ui-monospace, Menlo, Consolas, monospace';
    for (let i = 0; i < DIAL; i++) {
      const a = i * STEP - Math.PI / 2;
      const major = i % 5 === 0;
      g.lineWidth = major ? 9 : 4;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * (c - 8), c + Math.sin(a) * (c - 8));
      g.lineTo(c + Math.cos(a) * (c - (major ? 62 : 40)), c + Math.sin(a) * (c - (major ? 62 : 40)));
      g.stroke();
      if (major) g.fillText(String(i), c + Math.cos(a) * (c - 108), c + Math.sin(a) * (c - 108));
    }
  });
  const ring = new T.Mesh(new T.CircleGeometry(0.78, 64), glow(0xffffff, { map: ringTex }));
  ring.position.z = 0.32;
  door.add(ring);

  // 손잡이: 돌아가는 부분. 붉은 바늘이 현재 눈금을 가리킨다.
  const knob = new T.Group();
  knob.position.z = 0.33;
  const knobBody = new T.Mesh(new T.CylinderGeometry(0.42, 0.46, 0.14, 40), lit(0xc9ccd4));
  knobBody.rotation.x = Math.PI / 2;
  knobBody.position.z = 0.07;
  const grip = box(0.12, 0.62, 0.1, lit(0x8d9098));
  grip.position.z = 0.17;
  const needle = new T.Mesh(new T.ConeGeometry(0.06, 0.2, 3), glow(0xff3344));
  needle.position.set(0, 0.5, 0.06);
  knob.add(knobBody, grip, needle);
  door.add(knob);

  // 명판: 금고마다 다른 표식. 본부가 이 표식으로 변환표를 고른다.
  const plateMesh = plane(0.34, 0.34, glow(0xffffff));
  plateMesh.position.set(0, 1.03, 0.32);
  const plateLabel = label('명판', { w: 0.3, h: 0.1, color: '#ffd76a', px: 64 });
  plateLabel.position.set(0, 1.27, 0.32);
  door.add(plateMesh, plateLabel);

  // 진행 표시등 세 개
  const steps = [0, 1, 2].map((i) => {
    const bulb = lamp(0.06, 0x3ddc84);
    bulb.position.set((i - 1) * 0.22, -0.98, 0.34);
    door.add(bulb);
    return bulb;
  });

  const dialPlate = hitPlate(1.9, 1.9, 0.1);
  dialPlate.position.set(0, cy, wallZ + 0.5);
  root.add(dialPlate);

  const stations = {
    far: { pos: [0, 1.8, 3.6], yaw: 0, pitch: 0, fov: 68, look: { yaw: 0.5, pitch: 0.25 } },
    focus: { frame: { center: [0, cy - 0.12, wallZ + 0.4], yaw: 0, width: 2.5, height: 2.7, usable: 0.7 }, fov: 62 },
  };

  // ---- 조작 패널 ----
  const readout = h('b', { id: 'dial-value', text: '0' });
  const fill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  for (const c of [track, fill]) {
    c.setAttribute('cx', '42');
    c.setAttribute('cy', '42');
    c.setAttribute('r', '38');
  }
  track.setAttribute('class', 'track');
  fill.setAttribute('class', 'fill');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 84 84');
  svg.append(track, fill);
  const info = h('div', { class: 'dial-info', id: 'dial-info' });
  const meter = h('i');
  const panel = h(
    'div',
    { class: 'dial-panel', id: 'dial-panel' },
    h('div', { class: 'dial-readout' }, svg, readout),
    info,
    h('div', { class: 'meter' }, meter)
  );

  let sim = null;
  let busy = false;
  let knobAngle = 0; // 화면에 보이는 손잡이 각도 (부드럽게 따라간다)
  let dragAngle = null; // 끌기 중: 손가락의 마지막 각도
  let carry = 0; // 아직 눈금 하나가 못 된 회전량
  let lastStepAt = 0;
  let stillMs = 0; // 손가락을 댄 채 멈춰 있던 시간
  let armed = false; // 한 번 확정한 뒤에는 다시 움직여야 또 확정된다
  let meterLevel = 0;
  let onGate = false; // 숨은 번호 위에 천천히 올라와 있는 동안: 감지기 바늘이 계속 떨린다
  let fastSteps = 0; // 탐지 단계에서 연달아 빨리 넘긴 눈금 수
  let fastWarnedAt = 0;
  let opening = 0;
  let platedFor = '';

  function setRing(ratio) {
    fill.style.strokeDashoffset = String(239 * (1 - Math.max(0, Math.min(1, ratio))));
  }

  function refreshInfo() {
    const v = sim.view();
    readout.textContent = String(v.value);
    steps.forEach((bulb, i) => bulb.userData.set(v.phase === 'detect' ? i < v.marked.length : i < v.step));
    const found = v.marked.length ? v.marked.slice().sort((a, b) => a - b).join(' · ') : '아직 없음';
    if (v.phase === 'detect') {
      info.replaceChildren(
        h('div', { text: `탐지: 숨은 번호 ${v.marked.length} / 3` }),
        h('div', { class: 'found', text: found }),
        h('div', { class: 'small dim', text: '천천히 돌리다 걸리면 손을 떼지 말고 멈춰라' })
      );
    } else {
      const dir = TURNS[v.step] === 'right' ? '오른쪽으로 ↻' : '왼쪽으로 ↺';
      info.replaceChildren(
        h('div', { text: `입력: ${NTH[v.step]} 번호 · ${dir}` }),
        h('div', { class: 'found', text: `찾은 번호 ${found}` }),
        h('div', { class: 'small dim', text: '본부가 알려 준 번호에 맞추고 멈춰서 확정' })
      );
    }
  }

  function paintPlate(tag) {
    const key = JSON.stringify(tag);
    if (key === platedFor) return;
    platedFor = key;
    if (plateMesh.material.map) plateMesh.material.map.dispose();
    plateMesh.material.map = canvasTexture(128, 128, (g, w, hgt) => {
      g.fillStyle = '#0c1220';
      g.fillRect(0, 0, w, hgt);
      g.strokeStyle = '#ffd76a';
      g.lineWidth = 6;
      g.strokeRect(3, 3, w - 6, hgt - 6);
      drawTag(g, tag, w / 2, hgt / 2, w * 0.66);
    });
    plateMesh.material.needsUpdate = true;
  }

  function act(action) {
    if (!sim || busy) return { status: 'open', events: [] };
    const result = sim.act(action);
    for (const event of result.events) {
      switch (event.type) {
        case 'tick':
          env.audio.sfx('tick');
          onGate = false;
          break;
        case 'gate':
          env.audio.sfx('gate');
          vibrate(45);
          meterLevel = 1;
          onGate = true;
          break;
        case 'marked':
          onGate = false;
          env.audio.sfx('mark');
          vibrate([30, 40, 30]);
          env.hud.caption(`숨은 번호 발견: ${event.value}`, { ms: 2200, kind: 'good' });
          break;
        case 'phase':
          env.hud.caption('세 개를 모두 찾았다! 본부에 번호와 명판 표식을 알려라.', { ms: 6000, kind: 'good' });
          break;
        case 'nothing':
          env.audio.sfx('click');
          break;
        case 'commit':
          env.audio.sfx('commit');
          vibrate(60);
          if (event.step < 3) env.hud.caption(`${NTH[event.step - 1]} 번호 확정! 이제 반대 방향으로.`, { ms: 3000, kind: 'good' });
          break;
        case 'wrong-number':
        case 'wrong-direction':
          busy = true;
          env.audio.sfx('denied');
          vibrate([150, 80, 150]);
          env.hud.caption(
            event.type === 'wrong-number' ? '번호가 틀렸다! 잠금 장치가 재설정된다.' : '도는 방향이 틀렸다! 잠금 장치가 재설정된다.',
            { ms: 4000, kind: 'bad' }
          );
          env.report.mistake(event.type);
          break;
        case 'open':
          busy = true;
          opening = 0.0001;
          env.audio.setMode('off');
          env.audio.sfx('vault');
          vibrate([80, 60, 80, 60, 300]);
          env.hud.caption('금고가 열린다!', { kind: 'good' });
          env.hud.controls.replaceChildren();
          env.rig.goTo(stations.far, 2400);
          env.report.solved(3200);
          break;
      }
    }
    refreshInfo();
    return result;
  }

  /** 손가락 위치의 각도 (다이얼 중심 기준, 시계 방향으로 커진다). */
  function angleAt(x, y) {
    const c = env.interact.screenPointOf(ring);
    return Math.atan2(y - c.y, x - c.x);
  }

  env.interact.add({
    mesh: dialPlate,
    onDrag(phase, p) {
      if (busy || !sim) return;
      if (phase === 'start') {
        dragAngle = angleAt(p.x, p.y);
        carry = 0;
        stillMs = 0;
        armed = true;
        return;
      }
      if (phase === 'end') {
        dragAngle = null;
        stillMs = 0;
        setRing(0);
        return;
      }
      const a = angleAt(p.x, p.y);
      let delta = a - dragAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      dragAngle = a;
      carry += delta;
      while (Math.abs(carry) >= STEP) {
        const dir = carry > 0 ? 1 : -1;
        carry -= dir * STEP;
        const now = performance.now();
        const slow = now - lastStepAt > SLOW_MS;
        lastStepAt = now;
        stillMs = 0;
        armed = true;
        setRing(0);
        act({ type: 'rotate', delta: dir, slow });
        if (busy) break;
        // 탐지 단계에서 계속 빨리 돌리면 걸림을 느낄 수 없다는 것을 알려 준다
        fastSteps = slow ? 0 : fastSteps + 1;
        if (fastSteps >= 8 && sim.view().phase === 'detect' && now - fastWarnedAt > 5000) {
          fastWarnedAt = now;
          fastSteps = 0;
          env.hud.caption('너무 빠르다! 아주 천천히 돌려야 걸림이 느껴진다.', { ms: 3000, kind: 'bad' });
        }
      }
    },
  });

  return {
    id: 'vault',
    root,
    intro: '다이얼을 아주 천천히 돌려 걸리는 번호 세 개를 찾아라.',

    load(dev, nextSim, reason) {
      sim = nextSim;
      busy = false;
      onGate = false;
      dragAngle = null;
      stillMs = 0;
      setRing(0);
      paintPlate(dev.plate);
      knobAngle = -sim.view().value * STEP;
      refreshInfo();
      if (reason === 'mistake') {
        env.hud.caption('숨은 번호가 바뀌었다. 처음부터 다시 찾아라.', { ms: 5000, kind: 'bad' });
      }
    },

    async enter() {
      env.audio.setMode('breath'); // 음악이 사라지고 심장 박동만 남는다
      env.rig.snapTo(stations.far);
      await env.rig.goTo(stations.focus, 2000);
      env.hud.controls.replaceChildren(panel);
      env.hud.setBack(null);
    },

    exit() {
      env.audio.setMode('normal');
      env.hud.controls.replaceChildren();
    },

    update(dt, active) {
      if (sim) {
        // 손잡이가 눈금을 부드럽게 따라간다 (시계 방향 = z 축 음의 회전)
        const target = -sim.view().value * STEP;
        let diff = target - knobAngle;
        diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        knobAngle += diff * Math.min(1, dt * 22);
        knob.rotation.z = knobAngle;
      }
      // 감지기: 걸린 번호 위에 머무는 동안은 높은 값에서 떨리고, 벗어나면 가라앉는다
      if (onGate) meterLevel = 0.82 + Math.random() * 0.18;
      else meterLevel = Math.max(0.04, meterLevel - dt * 2.2);
      meter.style.width = Math.round(meterLevel * 100) + '%';

      // 손가락을 댄 채 멈춰 있으면 고리가 차고, 다 차면 확정
      if (active && !busy && dragAngle !== null && armed) {
        stillMs += dt * 1000;
        setRing((stillMs - HOLD_WAIT_MS) / HOLD_FILL_MS);
        if (stillMs >= HOLD_WAIT_MS + HOLD_FILL_MS) {
          armed = false;
          stillMs = 0;
          setRing(0);
          act({ type: 'hold' });
        }
      }

      if (opening > 0) {
        opening = Math.min(1, opening + dt * 0.4);
        const k = opening * opening * (3 - 2 * opening);
        hinge.rotation.y = -k * 1.75;
        knob.rotation.z = knobAngle + opening * 9;
        insideLight.intensity = k * 40;
      }
    },

    act,
    get sim() {
      return sim;
    },
    /** 검증용: 다이얼 중심의 화면 좌표와 반지름(px) */
    dialScreen() {
      const c = env.interact.screenPointOf(ring);
      const edge = new T.Object3D();
      ring.add(edge);
      edge.position.set(0.55, 0, 0);
      const e = env.interact.screenPointOf(edge);
      ring.remove(edge);
      return { x: c.x, y: c.y, r: Math.abs(e.x - c.x) };
    },
  };
}
