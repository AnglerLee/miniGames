// 2단계 환기 덕트의 3D 장면.
// 아이는 1인칭으로 좁은 덕트 미로 안에 있다. 정면 벽의 표식을 본부에 알리고,
// 본부가 설계도를 보고 불러 주는 대로 돌고 나아간다. 감지선은 스프레이를 뿌릴 때만 보인다.

import * as T from '../lib/three.js';
import { h } from '../../shared/dom.js';
import { DIRS, isOpen } from '../../shared/puzzles/ductmaze.js';
import { drawTag } from '../../shared/draw2d/tags.js';
import { canvasTexture, ductTexture, plane, box, lit, glow } from '../engine/kit.js';
import { vibrate } from '../platform.js';

const CELL = 2; // 한 칸의 길이 (m)
const HEIGHT = 1.5; // 덕트 높이
const EYE = 0.78; // 눈높이 (기어가는 자세)

export function createDuctStage(env) {
  const root = new T.Group();
  let mazeGroup = null;
  let builtFor = null;
  let wires = []; // { key, mesh, left } 감지선 광선
  let sim = null;
  let dev = null;
  let busy = false;
  let bobTime = 0;
  let moving = 0;

  // 머리등: 카메라를 따라다닌다
  const headlamp = new T.PointLight(0xfff1dc, 11, 15, 1.25);
  const ambient = new T.AmbientLight(0x9aa3b5, 0.55);
  root.add(ambient);

  // ---- 조작 패널 ----
  const btn = (id, glyph, text, onClick) =>
    h('button', { type: 'button', id, onClick }, h('span', { class: 'glyph', text: glyph }), text);
  const leftBtn = btn('duct-left', '↶', '왼쪽으로 돌기', () => act({ type: 'turn', dir: 'left' }));
  const fwdBtn = btn('duct-forward', '▲', '앞으로', () => act({ type: 'forward' }));
  const rightBtn = btn('duct-right', '↷', '오른쪽으로 돌기', () => act({ type: 'turn', dir: 'right' }));
  const sprayBtn = btn('duct-spray', '💨', '스프레이', () => act({ type: 'spray' }));
  const backBtn = btn('duct-back', '⟲', '뒤로 돌기', () => act({ type: 'turn', dir: 'back' }));
  const pad = h('div', { class: 'pad', id: 'duct-pad' }, leftBtn, fwdBtn, rightBtn, sprayBtn, backBtn, h('div'));

  const yawOf = (heading) => (-heading * Math.PI) / 2;
  // 칸의 뒤쪽에 눈을 둔다: 정면 벽과 거리가 생겨 표식과 통로가 한눈에 들어온다
  const BACK = 0.55;
  const eyePos = (pose) => [
    pose.x * CELL - DIRS[pose.heading].dx * BACK,
    EYE,
    pose.y * CELL - DIRS[pose.heading].dy * BACK,
  ];

  function stationOf(pose) {
    return {
      pos: eyePos(pose),
      yaw: yawOf(pose.heading),
      pitch: -0.04,
      fov: 80,
      look: { yaw: 0.85, pitch: 0.4 },
      spring: true,
    };
  }

  /** 미로 한 채를 짓는다. 채널이 같으면 다시 짓지 않는다. */
  function build(m) {
    if (mazeGroup) {
      mazeGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (o.material.map) o.material.map.dispose();
          o.material.dispose();
        }
      });
      root.remove(mazeGroup);
    }
    mazeGroup = new T.Group();
    root.add(mazeGroup);
    wires = [];

    // 바닥과 천장: 전체를 덮는 판 한 장씩
    const spanX = m.w * CELL;
    const spanZ = m.h * CELL;
    const floorTex = ductTexture();
    floorTex.repeat.set(m.w, m.h);
    const floor = plane(spanX, spanZ, lit(0x9ba5b8, { map: floorTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(spanX / 2 - CELL / 2, 0, spanZ / 2 - CELL / 2);
    const ceilTex = ductTexture();
    ceilTex.repeat.set(m.w, m.h);
    const ceiling = plane(spanX, spanZ, lit(0x7e889c, { map: ceilTex }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(spanX / 2 - CELL / 2, HEIGHT, spanZ / 2 - CELL / 2);
    mazeGroup.add(floor, ceiling);

    // 벽: 같은 벽을 두 번 만들지 않도록 칸마다 북쪽과 서쪽만, 끝 줄에서는 남쪽과 동쪽도 만든다
    const slots = [];
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        if (!isOpen(m, x, y, 0)) slots.push({ x, y, d: 0 });
        if (!isOpen(m, x, y, 3)) slots.push({ x, y, d: 3 });
        if (y === m.h - 1) slots.push({ x, y, d: 2 });
        if (x === m.w - 1) slots.push({ x, y, d: 1 });
      }
    }
    const wallTex = ductTexture();
    wallTex.repeat.set(1, 1);
    const wallMesh = new T.InstancedMesh(
      new T.BoxGeometry(CELL + 0.1, HEIGHT, 0.1),
      lit(0xaab3c4, { map: wallTex }),
      slots.length
    );
    const dummy = new T.Object3D();
    slots.forEach((s, i) => {
      dummy.position.set(s.x * CELL + DIRS[s.d].dx * (CELL / 2), HEIGHT / 2, s.y * CELL + DIRS[s.d].dy * (CELL / 2));
      dummy.rotation.set(0, s.d % 2 === 0 ? 0 : Math.PI / 2, 0);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(i, dummy.matrix);
    });
    mazeGroup.add(wallMesh);

    // 통로마다 테두리 틀과 천장 작업등을 달아 깊이가 느껴지게 한다
    const ribs = [];
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        for (const d of [1, 2]) if (isOpen(m, x, y, d)) ribs.push({ x, y, d });
      }
    }
    const ribMesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), lit(0x39414f), ribs.length * 4);
    ribs.forEach((r, i) => {
      const cx = r.x * CELL + DIRS[r.d].dx * (CELL / 2);
      const cz = r.y * CELL + DIRS[r.d].dy * (CELL / 2);
      const along = r.d === 2; // 남쪽 통로면 틀이 X 방향으로 놓인다
      const parts = [
        { px: 0, py: HEIGHT - 0.04, sx: CELL, sy: 0.08 }, // 위
        { px: 0, py: 0.03, sx: CELL, sy: 0.06 }, // 아래
        { px: -CELL / 2 + 0.05, py: HEIGHT / 2, sx: 0.1, sy: HEIGHT }, // 왼쪽
        { px: CELL / 2 - 0.05, py: HEIGHT / 2, sx: 0.1, sy: HEIGHT }, // 오른쪽
      ];
      parts.forEach((part, k) => {
        dummy.position.set(cx + (along ? part.px : 0), part.py, cz + (along ? 0 : part.px));
        dummy.rotation.set(0, along ? 0 : Math.PI / 2, 0);
        dummy.scale.set(part.sx, part.sy, 0.12);
        dummy.updateMatrix();
        ribMesh.setMatrixAt(i * 4 + k, dummy.matrix);
      });
    });
    dummy.scale.set(1, 1, 1);
    mazeGroup.add(ribMesh);

    const lights = new T.InstancedMesh(new T.BoxGeometry(0.5, 0.03, 0.12), glow(0x9fdcff), m.w * m.h);
    for (let i = 0; i < m.w * m.h; i++) {
      dummy.position.set((i % m.w) * CELL, HEIGHT - 0.02, Math.floor(i / m.w) * CELL);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      lights.setMatrixAt(i, dummy.matrix);
    }
    mazeGroup.add(lights);

    // 표식: 벽에 붙은 빛나는 판. 조명과 상관없이 제 색으로 보인다.
    for (const t of m.tags) {
      const tex = canvasTexture(128, 128, (g, w, hgt) => {
        g.fillStyle = '#0c1220';
        g.fillRect(0, 0, w, hgt);
        g.strokeStyle = '#c9d6f2';
        g.lineWidth = 6;
        g.strokeRect(3, 3, w - 6, hgt - 6);
        drawTag(g, t, w / 2, hgt / 2, w * 0.66);
      });
      const sign = plane(0.6, 0.6, glow(0xffffff, { map: tex, fog: false }));
      const inset = CELL / 2 - 0.07;
      sign.position.set(t.x * CELL + DIRS[t.dir].dx * inset, 0.8, t.y * CELL + DIRS[t.dir].dy * inset);
      // 판의 앞면이 칸 안쪽을 보도록 돌린다
      sign.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][t.dir];
      mazeGroup.add(sign);
    }

    // 출구: 바닥의 초록 쇠창살
    const hatchTex = canvasTexture(128, 128, (g, w, hgt) => {
      g.fillStyle = '#062414';
      g.fillRect(0, 0, w, hgt);
      g.strokeStyle = '#3ddc84';
      g.lineWidth = 8;
      g.strokeRect(6, 6, w - 12, hgt - 12);
      for (let i = 24; i < w; i += 20) {
        g.beginPath();
        g.moveTo(i, 12);
        g.lineTo(i, hgt - 12);
        g.stroke();
      }
    });
    const hatch = plane(CELL * 0.8, CELL * 0.8, glow(0xffffff, { map: hatchTex, fog: false }));
    hatch.rotation.x = -Math.PI / 2;
    hatch.position.set(m.exit.x * CELL, 0.02, m.exit.y * CELL);
    const exitLight = new T.PointLight(0x3ddc84, 8, 7, 1.6);
    exitLight.position.set(m.exit.x * CELL, 0.9, m.exit.y * CELL);
    mazeGroup.add(hatch, exitLight);

    // 감지선: 통로를 가로지르는 붉은 광선 세 줄. 평소에는 보이지 않는다.
    for (const w of m.wires) {
      const group = new T.Group();
      for (const y of [0.3, 0.75, 1.2]) {
        const beam = box(CELL - 0.15, 0.025, 0.025, glow(0xff2a3c));
        beam.position.y = y;
        group.add(beam);
      }
      group.position.set(w.x * CELL + DIRS[w.dir].dx * (CELL / 2), 0, w.y * CELL + DIRS[w.dir].dy * (CELL / 2));
      group.rotation.y = w.dir === 1 ? Math.PI / 2 : 0;
      group.visible = false;
      mazeGroup.add(group);
      wires.push({ key: w.x * 1000 + w.y * 10 + w.dir, mesh: group, left: 0 });
    }
  }

  /** (x, y) 에서 dir 방향 통로의 감지선을 잠깐 드러낸다. */
  function revealWire(x, y, dir, seconds) {
    const e = dir === 0 ? { x, y: y - 1, dir: 2 } : dir === 3 ? { x: x - 1, y, dir: 1 } : { x, y, dir };
    const wire = wires.find((w) => w.key === e.x * 1000 + e.y * 10 + e.dir);
    if (wire) {
      wire.mesh.visible = true;
      wire.left = seconds;
    }
  }

  function refreshPad() {
    const v = sim.view();
    const mark = (el, open) => {
      el.classList.toggle('open', open);
      el.classList.toggle('shut', !open);
    };
    mark(leftBtn, v.open.left);
    mark(fwdBtn, v.open.front);
    mark(rightBtn, v.open.right);
    mark(backBtn, v.open.back);
    sprayBtn.lastChild.textContent = `스프레이 ×${v.sprays}`;
    sprayBtn.disabled = v.sprays <= 0;
  }

  function act(action) {
    if (!sim || busy) return { status: 'open', events: [] };
    const result = sim.act(action);
    const pose = sim.pose();
    for (const event of result.events) {
      switch (event.type) {
        case 'turned':
          env.audio.sfx('turn');
          env.rig.resetLook();
          env.rig.goTo(stationOf(pose), 260);
          break;
        case 'moved':
          env.audio.sfx('step');
          vibrate(12);
          moving = 0.38;
          env.rig.resetLook();
          env.rig.goTo(stationOf(pose), 380);
          break;
        case 'bump':
          env.audio.sfx('bump');
          vibrate(30);
          env.rig.shake(0.05, 200);
          env.hud.caption('막혀 있다.', { ms: 1200 });
          break;
        case 'sprayed':
          env.audio.sfx('spray');
          for (const d of event.dirs) revealWire(event.x, event.y, d, 3.5);
          env.hud.caption(
            event.dirs.length ? '감지선이 보인다! 그쪽으로는 가면 안 된다.' : '근처에 감지선이 없다.',
            { ms: 2800, kind: event.dirs.length ? 'bad' : 'good' }
          );
          break;
        case 'empty':
          env.hud.caption('스프레이를 다 썼다.', { ms: 1500 });
          break;
        case 'trip':
          busy = true;
          revealWire(event.x, event.y, event.dir, 2);
          env.audio.sfx('trip');
          vibrate([120, 60, 120]);
          env.report.mistake('tripwire');
          break;
        case 'exit':
          busy = true;
          env.audio.sfx('granted');
          env.hud.caption('출구를 찾았다! 덕트를 빠져나간다.', { kind: 'good' });
          env.report.solved(1300);
          break;
      }
    }
    refreshPad();
    return result;
  }

  return {
    id: 'duct',
    root,
    intro: '정면 벽의 표식을 본부에 알리고, 지시에 따라 출구를 찾아라. 감지선 주의!',

    load(nextDev, nextSim, reason) {
      dev = nextDev;
      sim = nextSim;
      busy = false;
      // 실수로 다시 섞일 때는 미로는 그대로고 출발 위치만 바뀐다
      const key = JSON.stringify(dev.maze.open) + JSON.stringify(dev.maze.wires);
      if (key !== builtFor) {
        build(dev.maze);
        builtFor = key;
      }
      env.rig.snapTo(stationOf(dev.start));
      refreshPad();
      if (reason === 'mistake') {
        env.hud.caption('감지선에 걸렸다! 다른 곳으로 끌려왔다. 정면의 표식을 다시 알려라.', { ms: 5000, kind: 'bad' });
      }
    },

    async enter() {
      env.scene.fog = new T.Fog(0x05070d, 3, 14);
      env.camera.add(headlamp);
      env.hud.controls.replaceChildren(pad);
      env.hud.setBack(null);
      env.rig.snapTo(stationOf(dev.start));
      await new Promise((r) => setTimeout(r, 900));
    },

    exit() {
      env.scene.fog = null;
      env.camera.remove(headlamp);
      env.rig.setBob(0);
      env.hud.controls.replaceChildren();
    },

    update(dt) {
      for (const wire of wires) {
        if (wire.left > 0) {
          wire.left -= dt;
          wire.mesh.visible = wire.left > 0 && Math.floor(wire.left * 12) % 2 === 0 ? true : wire.left > 0.6;
          if (wire.left <= 0) wire.mesh.visible = false;
        }
      }
      // 기어갈 때 화면이 살짝 출렁인다
      if (moving > 0) {
        moving -= dt;
        bobTime += dt * 16;
        env.rig.setBob(Math.sin(bobTime) * 0.035);
      } else {
        env.rig.setBob(0);
      }
    },

    act,
    get sim() {
      return sim;
    },
  };
}
