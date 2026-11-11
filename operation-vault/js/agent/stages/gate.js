// 1단계 정문 게이트의 3D 장면.
// 단말기 화면에 문양 네 개가 뜨고, 아이는 본부가 불러 주는 숫자를 키패드에 입력한다.

import { createTerminalRoom, drawScreenFrame, drawEntryBoxes } from './terminal.js';
import { drawGlyph } from '../../shared/draw2d/glyph.js';
import { vibrate } from '../platform.js';

export function createGateStage(env) {
  const term = createTerminalRoom(env, { sector: 'SECTOR A · 정문', wall: '#3a465f' });
  let sim = null;
  let dev = null;
  let sessionLeft = 0;
  let lastBar = -1;
  let busy = false;
  let flashColor = null;

  function redraw() {
    const view = sim.view();
    term.screen.redraw((g, w, h) => {
      drawScreenFrame(g, w, h, '보안 문양 인증', flashColor || '#36e0ff');
      // 문양 네 개
      const size = 104;
      const gap = 14;
      const x0 = w / 2 - (4 * size + 3 * gap) / 2;
      view.glyphs.forEach((glyph, i) => {
        const x = x0 + i * (size + gap);
        g.fillStyle = '#0a1c2e';
        g.fillRect(x, 62, size, size + 10);
        drawGlyph(g, glyph, x + size / 2, 62 + size / 2 + 6, size * 0.94);
      });
      drawEntryBoxes(g, w, 190, view.entered, view.length, flashColor || '#36e0ff');
      // 세션 시간 막대: 다 줄면 문양이 바뀐다
      const ratio = Math.max(0, sessionLeft / dev.sessionSec);
      g.fillStyle = '#12233a';
      g.fillRect(24, 272, w - 48, 16);
      g.fillStyle = ratio < 0.25 ? '#ff4d5e' : '#ffb547';
      g.fillRect(24, 272, (w - 48) * ratio, 16);
      g.fillStyle = '#93a0c4';
      g.font = '600 18px sans-serif';
      g.textAlign = 'center';
      g.fillText('문양 유효 시간', w / 2, 304);
    });
  }

  function act(action) {
    if (!sim) return { status: 'open', events: [] };
    const result = sim.act(action);
    for (const event of result.events) {
      if (event.type === 'key') env.audio.sfx('key');
      if (event.type === 'cleared') env.audio.sfx('click');
      if (event.type === 'granted') {
        flashColor = '#3ddc84';
        env.audio.sfx('granted');
        env.audio.sfx('door');
        term.openDoor();
        busy = true;
        env.hud.caption('인증 성공! 게이트가 열린다.', { kind: 'good' });
        env.rig.goTo(term.stations.far, 1400);
        env.report.solved(1500);
      }
      if (event.type === 'denied') {
        flashColor = '#ff4d5e';
        env.audio.sfx('denied');
        vibrate([80, 60, 80]);
        env.report.mistake('wrong-code');
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
    id: 'gate',
    root: term.root,
    intro: '단말기의 문양을 본부에 설명하고, 불러 주는 숫자를 입력하라.',

    load(nextDev, nextSim, reason) {
      dev = nextDev;
      sim = nextSim;
      sessionLeft = dev.sessionSec;
      flashColor = null;
      busy = false;
      redraw();
      if (reason === 'soft') env.hud.caption('시간이 지나 문양이 바뀌었다. 다시 설명하라.', { ms: 4000, kind: 'bad' });
      if (reason === 'mistake') env.hud.caption('틀렸다! 문양이 바뀌었다. 다시 설명하라.', { ms: 4000, kind: 'bad' });
    },

    async enter() {
      env.rig.snapTo(term.stations.far);
      await env.rig.goTo(term.stations.focus, 1800);
      env.hud.setBack(null);
    },

    exit() {},

    update(dt, active) {
      term.update(dt);
      if (!active || busy || !sim) return;
      sessionLeft -= dt;
      const bar = Math.ceil(sessionLeft * 2);
      if (bar !== lastBar) {
        lastBar = bar;
        redraw();
      }
      if (sessionLeft <= 0) {
        busy = true;
        env.audio.sfx('reroll');
        env.report.soft();
      }
    },

    act,
    get sim() {
      return sim;
    },
    /** 검증용: 키의 화면 좌표 */
    touchPoints: () => Object.fromEntries(term.keys.map((k) => [k.name, env.interact.screenPointOf(k.plate)])),
  };
}
