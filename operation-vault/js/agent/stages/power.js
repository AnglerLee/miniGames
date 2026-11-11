// 3단계 전력실의 3D 장면.
// 벽의 배전반에 레버 스위치 6개, 장치 상태등 3개, 부하 계기가 있다.
// 아이는 무엇이 켜져 있는지 본부에 알리고, 본부가 정한 순서대로 레버를 올리고 내린다.

import * as T from '../lib/three.js';
import { SWITCHES } from '../../shared/puzzles/powergrid.js';
import { drawTag } from '../../shared/draw2d/tags.js';
import { room, box, plane, lit, glow, label, lamp, liveTexture, canvasTexture, hitPlate, ceilingLight } from '../engine/kit.js';
import { vibrate } from '../platform.js';

const LAMPS = [
  { key: 'lock', name: '잠금장치', color: 0x4da3ff },
  { key: 'cam', name: '카메라', color: 0xffb547 },
  { key: 'alarm', name: '경보 회로', color: 0xff4d5e },
];

export function createPowerStage(env) {
  const root = new T.Group();
  root.add(room({ w: 6, h: 3.8, d: 8, wall: '#3f4a45' }));
  ceilingLight(root, 0, 3.8, 0.5, { intensity: 16 });
  root.add(new T.AmbientLight(0x93a8c8, 0.95));

  const wallZ = -3.95;
  const board = new T.Group();
  board.position.set(0, 0, wallZ);
  root.add(board);

  const back = box(1.9, 2.5, 0.12, lit(0x232a38));
  back.position.set(0, 1.65, 0.06);
  const title = label('배 전 반', { w: 0.9, h: 0.16, color: '#ffd76a', px: 72 });
  title.position.set(0, 2.78, 0.125);
  board.add(back, title);

  // 장치 상태등: 켜져 있으면 그 장치에 전기가 들어오고 있다는 뜻
  const lamps = {};
  LAMPS.forEach((info, i) => {
    const x = (i - 1) * 0.58;
    const bulb = lamp(0.075, info.color);
    bulb.position.set(x, 2.52, 0.17);
    const text = label(info.name, { w: 0.5, h: 0.13, px: 64 });
    text.position.set(x, 2.36, 0.125);
    board.add(bulb, text);
    lamps[info.key] = bulb;
  });

  // 부하 계기
  const gauge = liveTexture(512, 96);
  const gaugeMesh = plane(1.5, 0.28, glow(0xffffff, { map: gauge.texture }));
  gaugeMesh.position.set(0, 2.08, 0.125);
  board.add(gaugeMesh);

  // 레버 스위치 6개 (3개씩 두 줄)
  const levers = [];
  for (let i = 0; i < SWITCHES; i++) {
    const x = ((i % 3) - 1) * 0.58;
    const y = i < 3 ? 1.42 : 0.7;
    const unit = new T.Group();
    unit.position.set(x, y, 0.12);
    const housing = box(0.24, 0.36, 0.05, lit(0x3a4458));
    const slot = box(0.06, 0.26, 0.052, lit(0x0c0f16));
    const pivot = new T.Group();
    pivot.position.z = 0.03;
    const handle = box(0.075, 0.2, 0.075, lit(0xd7dbe4));
    handle.position.set(0, 0.07, 0.05);
    const knob = box(0.11, 0.07, 0.09, lit(0xe04b4b));
    knob.position.set(0, 0.17, 0.05);
    pivot.add(handle, knob);
    const led = lamp(0.03, 0x3ddc84);
    led.position.set(0.085, -0.14, 0.04);
    const tagPlate = plane(0.24, 0.24, glow(0xffffff));
    tagPlate.position.set(0, 0.34, 0.01);
    const plate = hitPlate(0.5, 0.66, 0.1);
    plate.position.set(0, 0.1, 0.06);
    unit.add(housing, slot, pivot, led, tagPlate, plate);
    board.add(unit);
    const lever = { index: i, pivot, led, tagPlate, plate, angle: 0.6, target: 0.6 };
    levers.push(lever);
    env.interact.add({
      mesh: plate,
      onTap() {
        if (busy) return;
        vibrate(15);
        act({ type: 'flip', index: i });
      },
    });
  }

  const stations = {
    far: { pos: [0, 1.7, 3.2], yaw: 0, pitch: -0.02, fov: 68, look: { yaw: 0.5, pitch: 0.25 } },
    focus: { frame: { center: [0, 1.66, wallZ + 0.12], yaw: 0, width: 1.9, height: 2.5, usable: 0.8 }, fov: 62 },
  };

  let sim = null;
  let busy = false;
  let taggedFor = '';

  function refresh() {
    const view = sim.view();
    view.switches.forEach((sw, i) => {
      levers[i].target = sw.on ? -0.6 : 0.6; // 위로 올라가 있으면 켜짐
      levers[i].led.userData.set(sw.on);
    });
    lamps.lock.userData.set(view.lamps.lock);
    lamps.cam.userData.set(view.lamps.cam);
    lamps.alarm.userData.set(view.lamps.alarm);
    gauge.redraw((g, w, hgt) => {
      g.fillStyle = '#04101c';
      g.fillRect(0, 0, w, hgt);
      g.strokeStyle = '#2a3760';
      g.lineWidth = 4;
      g.strokeRect(2, 2, w - 4, hgt - 4);
      g.fillStyle = '#e9eefb';
      g.font = '800 40px sans-serif';
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      g.fillText('부하', 20, hgt / 2 + 2);
      const limited = view.maxOn < SWITCHES;
      // 켜진 스위치 수만큼 칸이 찬다. 제한을 넘는 칸은 붉게 표시된다.
      for (let i = 0; i < SWITCHES; i++) {
        const x = 118 + i * 38;
        const over = limited && i >= view.maxOn;
        g.fillStyle = i < view.load ? (over ? '#ff4d5e' : '#3ddc84') : over ? '#3a1820' : '#1a2a44';
        g.fillRect(x, 24, 30, hgt - 48);
      }
      g.fillStyle = limited ? '#ffb547' : '#93a0c4';
      g.textAlign = 'right';
      g.font = '800 34px sans-serif';
      g.fillText(limited ? `${view.load} / 최대 ${view.maxOn}` : `${view.load}개`, w - 16, hgt / 2 + 2);
    });
  }

  /** 스위치 위의 표식 그림을 붙인다. */
  function paintTags(tags) {
    const key = JSON.stringify(tags);
    if (key === taggedFor) return;
    taggedFor = key;
    tags.forEach((tag, i) => {
      const mat = levers[i].tagPlate.material;
      if (mat.map) mat.map.dispose();
      mat.map = canvasTexture(128, 128, (g, w, hgt) => {
        g.fillStyle = '#0c1220';
        g.fillRect(0, 0, w, hgt);
        g.strokeStyle = '#c9d6f2';
        g.lineWidth = 5;
        g.strokeRect(3, 3, w - 6, hgt - 6);
        drawTag(g, tag, w / 2, hgt / 2, w * 0.68);
      });
      mat.needsUpdate = true;
    });
  }

  function act(action) {
    if (!sim || busy) return { status: 'open', events: [] };
    const result = sim.act(action);
    for (const event of result.events) {
      if (event.type === 'flipped') env.audio.sfx('switch');
      if (event.type === 'alarm-cut') {
        busy = true;
        env.audio.sfx('alarm');
        vibrate([150, 80, 150]);
        env.hud.caption('경보 회로의 전원이 끊겼다! 비상 경보 발령!', { ms: 4000, kind: 'bad' });
        env.report.mistake('alarm-cut');
      }
      if (event.type === 'overload') {
        busy = true;
        env.audio.sfx('spark');
        vibrate([150, 80, 150]);
        env.hud.flash('#ffffff', 0.7);
        env.hud.caption('과부하! 스위치를 너무 많이 켰다.', { ms: 4000, kind: 'bad' });
        env.report.mistake('overload');
      }
      if (event.type === 'unlocked') {
        busy = true;
        env.audio.sfx('granted');
        env.hud.caption('잠금장치와 카메라가 꺼졌다. 금고실로 가는 길이 열린다!', { kind: 'good' });
        env.rig.goTo(stations.far, 1300);
        env.report.solved(1500);
      }
    }
    refresh();
    return result;
  }

  return {
    id: 'power',
    root,
    intro: '지금 켜져 있는 스위치를 본부에 알려라. 경보 회로는 한순간도 꺼지면 안 된다.',

    load(dev, nextSim, reason) {
      sim = nextSim;
      busy = false;
      paintTags(dev.tags);
      refresh();
      // 레버를 새 상태로 바로 맞춘다
      for (const lever of levers) lever.angle = lever.target;
      if (reason === 'mistake') {
        env.hud.caption('스위치 상태가 바뀌었다. 무엇이 켜져 있는지 다시 알려라.', { ms: 5000, kind: 'bad' });
      }
    },

    async enter() {
      env.rig.snapTo(stations.far);
      await env.rig.goTo(stations.focus, 1700);
      env.hud.setBack(null);
    },

    exit() {},

    update(dt) {
      for (const lever of levers) {
        lever.angle += (lever.target - lever.angle) * Math.min(1, dt * 14);
        lever.pivot.rotation.x = lever.angle;
      }
    },

    act,
    get sim() {
      return sim;
    },
    /** 검증용: 레버의 화면 좌표 */
    touchPoints: () => Object.fromEntries(levers.map((l) => [String(l.index), env.interact.screenPointOf(l.plate)])),
  };
}
