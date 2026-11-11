// 4단계 보안 토큰의 3D 장면 (현실 미션).
// 아이는 집 안에 숨겨진 쪽지를 실제로 찾아와, 적힌 번호를 이 단말기에 입력한다.

import { createTerminalRoom, drawScreenFrame, drawEntryBoxes } from './terminal.js';
import { vibrate } from '../platform.js';

export function createTokenStage(env) {
  const term = createTerminalRoom(env, { sector: 'SECTOR D · 금고 통로', wall: '#4a3f5f' });
  let sim = null;
  let busy = false;
  let tint = '#ffb547';

  function redraw() {
    const view = sim.view();
    term.screen.redraw((g, w, h) => {
      drawScreenFrame(g, w, h, '보안 토큰 번호 입력', tint);
      g.fillStyle = '#e9eefb';
      g.font = '700 26px sans-serif';
      g.textAlign = 'center';
      g.fillText('본부가 현장에 숨겨 둔', w / 2, 92);
      g.fillText('쪽지를 찾아 번호를 입력하라', w / 2, 128);
      drawEntryBoxes(g, w, 170, view.entered, view.length, tint);
      g.fillStyle = '#93a0c4';
      g.font = '600 20px sans-serif';
      g.fillText('힌트는 본부가 무전으로 알려 준다', w / 2, 276);
    });
  }

  function act(action) {
    if (!sim) return { status: 'open', events: [] };
    const result = sim.act(action);
    for (const event of result.events) {
      if (event.type === 'key') env.audio.sfx('key');
      if (event.type === 'cleared') env.audio.sfx('click');
      if (event.type === 'granted') {
        tint = '#3ddc84';
        busy = true;
        env.audio.sfx('granted');
        env.audio.sfx('door');
        term.openDoor();
        env.hud.caption('토큰 인증 완료! 금고실로 가는 문이 열린다.', { kind: 'good' });
        env.rig.goTo(term.stations.far, 1400);
        env.report.solved(1500);
      }
      if (event.type === 'denied') {
        tint = '#ff4d5e';
        env.audio.sfx('denied');
        vibrate([80, 60, 80]);
        env.report.mistake('wrong-token');
      }
    }
    redraw();
    return result;
  }

  for (const key of term.keys) {
    env.interact.add({
      mesh: key.plate,
      onTap() {
        if (busy) return;
        term.pressKey(key.name);
        vibrate(10);
        act(key.name === 'C' ? { type: 'clear' } : { type: 'digit', d: Number(key.name) });
      },
    });
  }

  return {
    id: 'token',
    root: term.root,
    intro: '본부가 숨겨 둔 쪽지를 찾아 번호를 입력하라. 시계는 멈추지 않는다!',

    load(nextDev, nextSim, reason) {
      sim = nextSim;
      busy = false;
      tint = '#ffb547';
      redraw();
      if (reason === 'mistake') env.hud.caption('번호가 틀렸다! 쪽지를 다시 확인하라.', { ms: 4000, kind: 'bad' });
    },

    async enter() {
      env.rig.snapTo(term.stations.far);
      await env.rig.goTo(term.stations.focus, 1800);
      env.hud.setBack(null);
    },

    exit() {},
    update(dt) {
      term.update(dt);
    },
    act,
    get sim() {
      return sim;
    },
    /** 검증용: 키의 화면 좌표 */
    touchPoints: () => Object.fromEntries(term.keys.map((k) => [k.name, env.interact.screenPointOf(k.plate)])),
  };
}
