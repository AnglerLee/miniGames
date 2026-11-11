// 멈춤 판, 메뉴(소리, 잠깐 멈춤, 구역 지도), 부모 메뉴(확인 번호 → 단계 넘기기, 임무 끝내기, 준비 화면).
// 아이에게는 반말, 부모 메뉴는 존댓말이다.

import { h, showModal } from '../shared/dom.js';
import { CODE_SHAPES } from '../shared/content.js';
import { stageTitle } from '../shared/text.js';
import { clock } from '../shared/score.js';
import { G, send, timed } from './game.js';
import { openOverlay, findOverlay } from './overlay.js';
import { dot, subIcon } from './art.js';
import { shake } from './fx.js';
import { requestWake } from './device.js';
import { audio } from './audio.js';

// ---------- 멈춤 ----------

export function pauseGame(byParent = false) {
  if (timed() && !G.state.paused) send({ type: 'pause', byParent });
}

export function resumeGame() {
  audio.unlock();
  if (!G.state.paused) return;
  send({ type: 'resume' });
  audio.music.start();
  requestWake();
}

/** 멈춤 판은 엔진 상태(paused)를 따라 열고 닫는다. 새로고침해서 멈춘 채 돌아와도 그대로 뜬다. */
export function syncPause() {
  const want = timed() && G.state.paused;
  const ov = findOverlay('pause');
  if (want && !ov) openPauseCover();
  else if (!want && ov) ov.close('all');
  document.body.classList.toggle('is-paused', want);
  const mission = document.querySelector('.mission');
  if (mission) mission.toggleAttribute('inert', want);
}

function openPauseCover() {
  const ov = openOverlay('pause', { host: 'top', cls: 'pause-cover' });
  ov.el.append(
    h(
      'div',
      { class: 'pause-box', role: 'dialog', 'aria-label': '잠깐 멈춤' },
      subIcon('pause-sub'),
      h('h2', { text: '잠깐 멈춤' }),
      h('p', { text: '시간이 멈췄어. 경보도 기다려 줄게.' }),
      h('button', { class: 'btn primary block pause-go', type: 'button', 'data-act': 'resume', text: '▶ 이어 하기', onClick: resumeGame }),
      h('button', { class: 'btn ghost block', type: 'button', 'data-act': 'menu', text: '☰ 메뉴', onClick: openMenu })
    )
  );
}

// ---------- 메뉴 ----------

function head(title, ov) {
  return h('div', { class: 'mhead' }, h('h2', { text: title }), h('button', { class: 'xbtn', type: 'button', 'aria-label': '닫기', text: '✕', onClick: () => ov.close() }));
}

/** 구역 지도. 쪽지 모양은 보여 주지만 숫자는 보여 주지 않는다 */
export function mapList() {
  return h(
    'ul',
    { class: 'map-list n' + G.stations.length },
    G.stations.map((st) =>
      h(
        'li',
        { style: { '--c': st.role.color } },
        dot(st),
        h('span', { class: 'map-role', text: st.role.name }),
        h('span', { class: 'map-eq', text: '=' }),
        h('span', { class: 'map-room' }, h('i', { text: st.room.icon }), h('span', { text: st.room.name })),
        h('span', { class: 'map-shape', title: '쪽지 모양', text: CODE_SHAPES[st.shape] })
      )
    )
  );
}

export function openMenu() {
  if (findOverlay('menu')) return;
  audio.sfx('tap');
  const ov = openOverlay('menu', { host: 'top', cls: 'modal-ov', backdrop: true });
  const box = h('div', { class: 'mbox', role: 'dialog', 'aria-label': '메뉴' });
  ov.el.append(box);

  function showMain() {
    const soundBtn = h('button', { class: 'mitem', type: 'button', 'data-act': 'sound' });
    const paint = () => (soundBtn.textContent = audio.muted() ? '🔇 소리 꺼짐 · 눌러서 켜기' : '🔊 소리 켜짐 · 눌러서 끄기');
    soundBtn.addEventListener('click', () => {
      audio.setMuted(!audio.muted());
      paint();
      if (!audio.muted()) audio.sfx('tap');
    });
    paint();
    const canPause = timed() && !G.state.paused;
    box.replaceChildren(
      head('메뉴', ov),
      h(
        'div',
        { class: 'mlist' },
        soundBtn,
        canPause ? h('button', { class: 'mitem', type: 'button', 'data-act': 'pause', text: '⏸ 잠깐 멈춤', onClick: () => (ov.close(), pauseGame()) }) : null,
        h('button', { class: 'mitem', type: 'button', 'data-act': 'map', text: '🗺️ 구역 지도 다시 보기', onClick: showMap }),
        h('button', { class: 'mitem parent', type: 'button', 'data-act': 'parent', text: '🔒 부모 메뉴', onClick: () => (ov.close(), openParent()) })
      )
    );
  }

  function showMap() {
    box.replaceChildren(head('🗺️ 구역 지도', ov), h('p', { class: 'msub', text: '방마다 구역이 정해져 있어. 색과 그림으로 찾아.' }), mapList(), h('button', { class: 'btn primary block', type: 'button', text: '돌아가기', onClick: showMain }));
  }

  showMain();
  return ov;
}

// ---------- 부모 메뉴 ----------

export function openParent() {
  if (findOverlay('parent')) return;
  // 부모가 번호를 누르고 고르는 동안 아이의 시간이 가지 않게 먼저 멈춘다 (멈춤 판이 이 판 아래에 깔린다)
  pauseGame(true);
  const ov = openOverlay('parent', { host: 'top', cls: 'modal-ov', backdrop: true });
  const box = h('div', { class: 'mbox parent-box', role: 'dialog', 'aria-label': '부모 메뉴' });
  ov.el.append(box);

  function showPin() {
    const pin = String(G.setup.pin || '0000');
    let typed = '';
    const dots = Array.from({ length: pin.length }, () => h('i'));
    const msg = h('p', { class: 'pin-msg', text: '확인 번호 ' + pin.length + '자리를 눌러 주세요' });
    const press = (k) => {
      if (k === '⌫') typed = typed.slice(0, -1);
      else if (typed.length < pin.length) typed += k;
      dots.forEach((d, i) => d.classList.toggle('on', i < typed.length));
      if (typed.length < pin.length) return;
      if (typed === pin) return showOptions();
      typed = '';
      audio.sfx('wrong');
      shake(pad);
      msg.textContent = '번호가 맞지 않아요. 다시 눌러 주세요';
      msg.classList.add('bad');
      setTimeout(() => dots.forEach((d) => d.classList.remove('on')), 250);
    };
    const pad = h(
      'div',
      { class: 'pin-pad' },
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0'].map((k) => h('button', { class: 'pkey', type: 'button', 'data-key': k, text: k, onClick: () => press(k) }))
    );
    box.replaceChildren(head('🔒 부모 메뉴', ov), msg, h('div', { class: 'pin-dots' }, dots), pad);
  }

  function showOptions() {
    const s = G.state;
    const canRescue = ['dock', 'run', 'route', 'failed'].includes(s.phase);
    box.replaceChildren(
      head('🔒 부모 메뉴', ov),
      h('p', { class: 'parent-status' }, h('b', { text: stageTitle(s.stage) }), ' · 선체 ' + s.hull + '/' + s.hullMax + ' · ' + clock(s.clock)),
      h('div', { class: 'mlist' },
        h('button', { class: 'btn warn block', type: 'button', 'data-act': 'rescue', disabled: !canRescue, text: '이 단계 넘기기', onClick: rescue }),
        h('p', { class: 'parent-hint', text: canRescue ? '아이가 많이 힘들어할 때 지금 단계를 끝난 것으로 합니다.' : '단계를 하는 중에만 쓸 수 있어요.' }),
        h('button', { class: 'btn danger block', type: 'button', 'data-act': 'finish', text: '임무 끝내고 보물 공개', onClick: finish }),
        h('a', { class: 'btn ghost block', href: 'setup.html', 'data-act': 'setup', text: '준비 화면으로' }),
        h('button', { class: 'btn ghost block', type: 'button', text: '닫기', onClick: () => ov.close() })
      )
    );
  }

  function rescue() {
    ov.close();
    send({ type: 'rescue' });
  }

  async function finish() {
    const ok = await showModal({
      title: '임무를 끝낼까요?',
      text: '남은 단계를 건너뛰고 바로 보물을 공개합니다.\n부모님이 끝낸 임무로 기록됩니다.',
      actions: [
        { label: '취소', value: false, kind: 'ghost' },
        { label: '끝내고 공개', value: true, kind: 'danger' },
      ],
    });
    if (!ok || ov.closed) return;
    ov.close();
    send({ type: 'finish' });
  }

  showPin();
  return ov;
}
