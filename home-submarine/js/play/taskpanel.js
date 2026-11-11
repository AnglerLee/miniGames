// 수리 판: 위에 고장 제목과 그 경보의 남은 시간, 아래 상자에 수리 놀이(tasks/*)를 띄운다.
// 판을 닫을 때는 어떤 길로 닫히든 반드시 놀이의 destroy() 를 부른다.

import { h, buzz } from '../shared/dom.js';
import { DIFFICULTY } from '../shared/content.js';
import { stream } from '../shared/prng.js';
import { remaining } from '../shared/engine.js';
import { mountTask } from './tasks/index.js';
import { G, send, alertById, secs, ratioOf, levelOf } from './game.js';
import { openOverlay } from './overlay.js';
import { urgentStrip } from './strip.js';
import { audio } from './audio.js';

export const taskStats = { mounted: 0, destroyed: 0 };

/** 열린 수리 판 { ov, alertId, solve() } */
let cur = null;

export const openTaskInfo = () => (cur ? { id: cur.alertId } : null);

/** 검증용: 열린 수리 놀이를 푼다. 판이 닫히면(또는 2초 뒤) 끝나는 Promise */
export function solveOpen() {
  if (!cur) return Promise.resolve(false);
  const c = cur;
  c.solve();
  return new Promise((resolve) => {
    const t0 = performance.now();
    const wait = () => {
      if (c.ov.closed) resolve(true);
      else if (performance.now() - t0 > 2000) resolve(false);
      else setTimeout(wait, 20);
    };
    wait();
  });
}

/**
 * onEnd(how)  how: 'done'(고침) 'x'(닫고 나감) 'late'(시간 초과) 'all'(화면이 바뀜)
 */
export function openTask(alert, { onEnd }) {
  const st = G.stations[alert.station];
  const num = h('b');
  const fill = h('i');
  const box = h('div', { class: 'task-box' });
  const head = h(
    'div',
    { class: 'panel-head' },
    h('span', { class: 'station-dot', text: st.role.icon }),
    h('div', { class: 'panel-what' }, h('span', { class: 'panel-where', text: st.role.name + ' · ' + st.room.name }), h('strong', { class: 'panel-title', text: alert.title })),
    h('span', { class: 'panel-sec' }, num, h('small', { text: '초' })),
    h('button', { class: 'xbtn', type: 'button', 'aria-label': '닫기', 'data-act': 'close', text: '✕', onClick: () => ov.close('x') })
  );
  const strip = urgentStrip({ exceptId: alert.id });
  let task = null;
  let finished = false;

  const ov = openOverlay('task', {
    cls: 'panel',
    onClose(how) {
      if (task) {
        const t = task;
        task = null;
        try {
          t.destroy();
        } finally {
          taskStats.destroyed++;
        }
      }
      if (cur && cur.ov === ov) cur = null;
      if (onEnd) onEnd(how);
    },
  });
  ov.alertId = alert.id;
  ov.el.style.setProperty('--c', st.role.color);
  ov.el.append(strip.el, head, h('div', { class: 'panel-bar' }, fill), box);

  ov.update = (s) => {
    strip.update(s);
    const a = alertById(alert.id, s);
    if (!a) return;
    const r = ratioOf(s, a);
    num.textContent = secs(remaining(s, a));
    fill.style.transform = 'scaleX(' + r.toFixed(4) + ')';
    ov.el.dataset.level = levelOf(r);
  };

  const done = () => {
    if (finished || ov.closed) return;
    finished = true;
    const fresh = send({ type: 'taskDone', id: alert.id });
    ov.close(fresh.some((e) => e.type === 'resolve' && e.id === alert.id) ? 'done' : 'x');
  };
  const ctx = {
    data: { type: alert.task, level: DIFFICULTY[G.state.difficulty].level },
    rng: stream(G.setup.seed, 'task', alert.id),
    color: st.role.color,
    done,
    miss() {
      if (!finished && !ov.closed) send({ type: 'taskMiss' });
    },
    // 둘째 인자: 재시동 버튼마다 늘 같은 음이 나게 하는 번호
    sfx: (name, variant) => audio.sfx(name, variant),
    buzz,
  };
  try {
    task = mountTask(box, ctx);
    taskStats.mounted++;
  } catch (e) {
    // 놀이가 고장 나도 임무는 계속할 수 있게 큰 버튼으로 대신한다
    console.error('수리 놀이를 띄우지 못했다', e);
    task = null;
    box.append(h('button', { class: 'btn primary block task-fallback', type: 'button', text: '고쳤어', onClick: done }));
  }
  cur = { ov, alertId: alert.id, solve: () => (task ? task.solve() : done()) };
  ov.update(G.state);
  return ov;
}
