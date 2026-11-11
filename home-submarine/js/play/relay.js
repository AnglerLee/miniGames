// 좌표 전달: 출발 구역에서 기호를 잠깐 보여 주고(showCode), 도착 구역에서 외운 기호를 입력받는다(enterCode).
// 보여 주는 시간은 게임 시계로 잰다. 멈춰 있는 동안에는 줄지 않는다.

import { h, buzz } from '../shared/dom.js';
import { DIFFICULTY, RELAY_SYMBOLS } from '../shared/content.js';
import { remaining } from '../shared/engine.js';
import { josa } from '../shared/text.js';
import { G, send, alertById, secs, ratioOf, levelOf } from './game.js';
import { openOverlay } from './overlay.js';
import { urgentStrip } from './strip.js';
import { shake } from './fx.js';
import { audio } from './audio.js';

/** 다 가린 뒤 판이 저절로 닫힐 때까지 (게임 시간) */
const HIDE_LINGER_MS = 2500;

/** 열린 입력 판 { id, press(i) } */
let entry = null;

function head(st, title, ov) {
  return h(
    'div',
    { class: 'panel-head' },
    h('span', { class: 'station-dot', text: st.role.icon }),
    h('div', { class: 'panel-what' }, h('span', { class: 'panel-where', text: st.role.name + ' · ' + st.room.name }), h('strong', { class: 'panel-title', text: title })),
    h('button', { class: 'xbtn', type: 'button', 'aria-label': '닫기', 'data-act': 'close', text: '✕', onClick: () => ov.close('x') })
  );
}

export function openShowCode(alert, { onEnd }) {
  const from = G.stations[alert.source];
  const to = G.stations[alert.station];
  const showMs = DIFFICULTY[G.state.difficulty].showMs;
  const tiles = alert.code.map((c, i) => h('span', { class: 'sym', style: { '--i': i }, text: RELAY_SYMBOLS[c] }));
  const fill = h('i');
  const msg = h('p', { class: 'code-msg', text: '잘 외워. 곧 가려져' });
  const closeBtn = h('button', { class: 'btn primary block code-go', type: 'button', text: '외웠어', onClick: () => ov.close('done') });
  const strip = urgentStrip({ exceptId: alert.id });
  const ov = openOverlay('show', { cls: 'panel code-panel', onClose: (how) => onEnd && onEnd(how) });
  ov.alertId = alert.id;
  ov.el.style.setProperty('--c', from.role.color);
  ov.el.append(
    strip.el,
    head(from, '좌표를 외워!', ov),
    h('div', { class: 'code-body' }, h('p', { class: 'kicker', text: '전달할 좌표 · ' + alert.code.length + '개' }), h('div', { class: 'sym-row n' + alert.code.length }, tiles), h('div', { class: 'meter' }, fill), msg, closeBtn)
  );
  audio.sfx('code');
  let hiddenAt = null;
  ov.update = (s) => {
    strip.update(s);
    const a = alertById(alert.id, s);
    if (!a) return;
    const start = a.seenAt === null ? s.clock : a.seenAt;
    const left = start + showMs - s.clock;
    if (left > 0) {
      fill.style.transform = 'scaleX(' + (left / showMs).toFixed(4) + ')';
      return;
    }
    if (hiddenAt === null) {
      hiddenAt = s.clock;
      ov.el.classList.add('hidden-code');
      fill.style.transform = 'scaleX(0)';
      tiles.forEach((t) => (t.textContent = '?'));
      msg.textContent = '외웠으면 ' + josa(to.room.name, '으로/로') + ' 가서 입력해';
      closeBtn.textContent = '닫기';
      audio.sfx('lock');
    } else if (s.clock - hiddenAt >= HIDE_LINGER_MS) ov.close('done');
  };
  ov.update(G.state);
  return ov;
}

/** 검증용: 그 경보의 암호를 맞게 입력한다. 입력 판이 열려 있으면 기호를 눌러서, 아니면 바로 보낸다 */
export function enterCorrect(id) {
  const a = alertById(id);
  if (!a || a.kind !== 'relay') return false;
  if (entry && entry.id === id) {
    entry.clear();
    const e = entry;
    for (const c of a.code) if (entry === e) e.press(c);
    return true;
  }
  send({ type: 'code', id, input: a.code.slice() });
  return true;
}

export function openEnterCode(alert, { onEnd }) {
  const to = G.stations[alert.station];
  const from = G.stations[alert.source];
  const n = alert.code.length;
  const slots = Array.from({ length: n }, () => h('span', { class: 'cslot' }));
  const num = h('b');
  const fill = h('i');
  const msg = h('p', { class: 'code-msg', text: '외운 순서대로 눌러' });
  const keys = RELAY_SYMBOLS.map((sym, i) => h('button', { class: 'symkey', type: 'button', 'data-sym': i, text: sym, onClick: () => press(i) }));
  const strip = urgentStrip({ exceptId: alert.id });
  let input = [];
  let busy = false;
  let wrongTimer = null;

  const ov = openOverlay('code', {
    cls: 'panel code-panel',
    onClose(how) {
      clearTimeout(wrongTimer);
      if (entry && entry.ov === ov) entry = null;
      if (onEnd) onEnd(how);
    },
  });
  ov.alertId = alert.id;
  ov.el.style.setProperty('--c', to.role.color);
  const body = h(
    'div',
    { class: 'code-body' },
    h('div', { class: 'enter-top' }, h('p', { class: 'kicker', text: from.role.name + '에서 본 좌표' }), h('span', { class: 'panel-sec' }, num, h('small', { text: '초' }))),
    h('div', { class: 'meter' }, fill),
    h('div', { class: 'cslots n' + n }, slots),
    msg,
    h('div', { class: 'symkeys' }, keys),
    h('button', { class: 'btn ghost block', type: 'button', 'data-act': 'erase', text: '⌫ 지우기', onClick: erase })
  );
  ov.el.append(strip.el, head(to, '좌표를 입력해', ov), body);

  function paint(state = '') {
    slots.forEach((s, i) => {
      s.textContent = input[i] !== undefined ? RELAY_SYMBOLS[input[i]] : '';
      s.className = 'cslot' + (i === input.length ? ' next' : '') + (state ? ' ' + state : '');
    });
  }

  function press(i) {
    if (busy || ov.closed) return;
    audio.sfx('tap');
    input.push(i);
    paint();
    if (input.length < n) return;
    const fresh = send({ type: 'code', id: alert.id, input: input.slice() });
    if (fresh.some((e) => e.type === 'resolve' && e.id === alert.id)) {
      paint('good');
      ov.close('done');
      return;
    }
    // 틀리면 잠깐 빨갛게 보여 주고 비운다
    busy = true;
    paint('bad');
    audio.sfx('wrong');
    buzz([90, 60, 90]);
    shake(body);
    msg.textContent = '틀렸어. 시간 -5초. 기억이 안 나면 ' + from.room.name + '에서 다시 봐';
    msg.classList.add('bad');
    wrongTimer = setTimeout(() => {
      busy = false;
      input = [];
      paint();
    }, 650);
  }

  function erase() {
    if (busy || !input.length) return;
    input.pop();
    paint();
  }

  ov.update = (s) => {
    strip.update(s);
    const a = alertById(alert.id, s);
    if (!a) return;
    const r = ratioOf(s, a);
    num.textContent = secs(remaining(s, a));
    fill.style.transform = 'scaleX(' + r.toFixed(4) + ')';
    ov.el.dataset.level = levelOf(r);
  };

  entry = {
    ov,
    id: alert.id,
    press,
    clear() {
      clearTimeout(wrongTimer);
      busy = false;
      input = [];
      paint();
    },
  };
  paint();
  ov.update(G.state);
  return ov;
}
