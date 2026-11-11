// 메뉴(규칙, 소리, 잠깐 멈춤)와 부모 메뉴(확인 번호 → 쪽지 목록, 도와주기, 수사 끝내기).
// 부모 메뉴 글은 존댓말이다.

import { h, showModal, toast } from '../shared/dom.js';
import { clock } from '../shared/score.js';
import { codeText } from '../shared/case.js';
import { rules, evidenceTitle } from '../shared/text.js';
import { G, at, log, commit, left, foundOf, markUnseen, emit } from './game.js';
import { openOverlay, closeAll, toggleOff, findOverlay } from './overlay.js';
import { refreshInterrogate } from './interrogate.js';
import { audio } from './audio.js';

// ---------- 메뉴 ----------

export function openMenu() {
  if (toggleOff('menu')) return;
  const ov = openOverlay('menu', { variant: 'bottom', title: '메뉴' });
  audio.sfx('open');
  const soundBtn = h('button', { class: 'menu-item', type: 'button', 'data-act': 'sound', onClick: toggleSound });
  const paintSound = () => (soundBtn.textContent = audio.muted() ? '🔇 소리 켜기' : '🔊 소리 끄기');
  paintSound();
  function toggleSound() {
    audio.setMuted(!audio.muted());
    paintSound();
    if (!audio.muted()) audio.sfx('tap');
  }
  ov.body.append(
    h('div', { class: 'menu-list' },
      h('button', { class: 'menu-item', type: 'button', 'data-act': 'rules', text: '📜 수사 규칙 다시 보기', onClick: () => { ov.close(); showRules(); } }),
      soundBtn,
      h('button', { class: 'menu-item', type: 'button', 'data-act': 'pause', text: '⏸ 잠깐 멈춤', onClick: () => { ov.close(); pause(); } }),
      h('button', { class: 'menu-item parent', type: 'button', 'data-act': 'parent', text: '🔒 부모 메뉴', onClick: () => { ov.close(); openParent(); } })
    )
  );
  return ov;
}

export function showRules() {
  const cs = G.cs;
  return showModal({
    title: '📜 수사 규칙',
    body: h('ol', { class: 'rules-list' }, rules(cs).map((r) => h('li', { text: r }))),
    actions: [{ label: '알겠어', value: true, kind: 'primary' }],
  });
}

// ---------- 잠깐 멈춤 ----------

let cover = null;

/** 멈춘다. restoring 이면 이미 멈춘 상태로 새로고침한 것 (기록은 다시 하지 않는다). */
export function pause(restoring = false) {
  const run = G.run;
  if (!restoring) {
    if (run.pauseAt !== null) return;
    run.pauseAt = Date.now();
    commit('pause');
  }
  audio.music.stop();
  document.querySelector('.app')?.setAttribute('inert', '');
  document.body.classList.add('is-paused');
  cover?.remove();
  cover = h(
    'div',
    { class: 'pause-cover', role: 'dialog', 'aria-label': '잠깐 멈춤' },
    h('div', { class: 'pause-box' },
      h('div', { class: 'pause-icon', text: '⏸' }),
      h('h2', { text: '잠깐 멈춤' }),
      h('p', { text: '시계가 멈췄어. 돌아오면 이어서 하자.' }),
      h('p', { class: 'pause-left' }, '남은 시간 ', h('b', { text: clock(left()) })),
      h('button', { class: 'btn gold block pause-go', type: 'button', text: '▶ 다시 시작', onClick: resume })
    )
  );
  document.body.append(cover);
}

export function resume() {
  const run = G.run;
  if (run.pauseAt === null) return;
  const now = Date.now();
  const ms = now - run.pauseAt;
  // 멈춘 동안 기호 잠김과 고발 정지도 같이 멈춘 것으로 친다
  if (run.lockUntil > run.pauseAt) run.lockUntil += ms;
  if (run.suspendUntil > run.pauseAt) run.suspendUntil += ms;
  run.pausedMs += ms;
  run.pauseAt = null;
  run.pauses++;
  log('pause', { ms });
  commit('resume');
  cover?.remove();
  cover = null;
  document.querySelector('.app')?.removeAttribute('inert');
  document.body.classList.remove('is-paused');
  audio.unlock();
  audio.music.start();
  audio.sfx('tap');
}

// ---------- 부모 메뉴 ----------

export function openParent() {
  if (findOverlay('parent')) return;
  const ov = openOverlay('parent', { title: '🔒 부모 메뉴', cls: 'parent' });
  audio.sfx('open');
  pinView(ov);
  return ov;
}

function pinView(ov) {
  let typed = '';
  const dots = h('div', { class: 'pin-dots' }, [0, 1, 2, 3].map(() => h('i')));
  const msg = h('p', { class: 'pin-msg', text: '확인 번호 4자리를 넣어 주세요.' });
  const paint = () => [...dots.children].forEach((d, i) => d.classList.toggle('on', i < typed.length));
  const press = (d) => {
    if (typed.length >= 4) return;
    typed += d;
    audio.sfx('tap');
    paint();
    if (typed.length < 4) return;
    if (typed === String(G.setup.pin || '0000')) {
      listView(ov);
      return;
    }
    msg.textContent = '번호가 달라요. 다시 넣어 주세요.';
    msg.classList.add('bad');
    dots.classList.remove('shake');
    void dots.offsetWidth;
    dots.classList.add('shake');
    audio.sfx('bad');
    setTimeout(() => {
      typed = '';
      paint();
    }, 350);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) =>
    k === ''
      ? h('span')
      : h('button', {
          class: 'pin-key',
          type: 'button',
          'data-key': k,
          text: k,
          'aria-label': k === '⌫' ? '지우기' : k,
          onClick: () => {
            if (k === '⌫') {
              typed = typed.slice(0, -1);
              paint();
            } else press(k);
          },
        })
  );
  ov.body.replaceChildren(
    h('div', { class: 'pin' },
      h('p', { class: 'pin-lead', text: '아이 대신 부모님이 보는 화면이에요. 정답이 보이니 아이에게 보여 주지 마세요.' }),
      dots,
      msg,
      h('div', { class: 'pin-pad' }, keys)
    )
  );
}

function listView(ov) {
  const cs = G.cs;
  const rows = cs.tags.map((tag) => {
    const f = foundOf(tag);
    const what = tag.kind === 'suspect' ? '용의자 · ' + cs.suspects[tag.ref].name : '증거 · ' + evidenceTitle(cs, cs.evidence[tag.ref]);
    const hint = String((G.setup.placed && G.setup.placed[tag.id] && G.setup.placed[tag.id].hint) || '').trim();
    const status = !f ? '못 찾음' : f.done ? '끝남' : tag.kind === 'suspect' ? '탐문 중' : '조사 중';
    return h(
      'div',
      { class: 'card pl-row' + (f && f.done ? ' done' : ''), 'data-tag': tag.id },
      h('span', { class: 'note-code pl-code', text: codeText(tag.code) }),
      h('div', { class: 'pl-info' },
        h('b', { text: what }),
        h('small', { text: cs.rooms[tag.room].icon + ' ' + cs.rooms[tag.room].name + (hint ? ' · ' + hint : '') }),
        h('span', { class: 'pl-status', text: status })
      ),
      f && f.done ? null : h('button', { class: 'btn small pl-rescue', type: 'button', text: '찾은 것으로 처리', onClick: () => { rescue(tag); listView(ov); } })
    );
  });
  ov.body.replaceChildren(
    h('div', { class: 'pl' },
      h('p', { class: 'pl-lead', text: '아이가 도저히 못 찾는 쪽지는 "찾은 것으로 처리"를 누르세요. 용의자는 진술 3개를 모두 들은 것으로, 증거는 조사를 마친 것으로 바뀝니다.' }),
      rows,
      h('div', { class: 'pl-actions' },
        h('button', { class: 'btn primary block pl-end', type: 'button', text: '수사 끝내고 보물 공개', onClick: () => forceEnd() }),
        h('a', { class: 'btn ghost block pl-setup', href: 'setup.html', text: '준비 화면으로' })
      )
    )
  );
}

/** 부모가 대신 찾아 준다 (기록은 rescue 로 남는다) */
export function rescue(tag) {
  const run = G.run;
  const prev = foundOf(tag);
  run.found[tag.id] = Object.assign({ at: at(), misses: 0 }, prev || {}, { done: true, rescued: true });
  if (tag.kind === 'suspect') run.asked[tag.ref] = G.cs.slots.map((_, t) => t);
  log('rescue', { tag: tag.id });
  markUnseen();
  commit('rescue');
  refreshInterrogate();
  const ev = findOverlay('evidence');
  if (ev && tag.kind === 'evidence' && ev.index === tag.ref) ev.close();
  toast('찾은 것으로 처리했어요', 'good');
}

async function forceEnd() {
  const ok = await showModal({
    title: '수사를 끝낼까요?',
    text: '범인의 자백 없이 바로 보물이 공개됩니다. 되돌릴 수 없어요.',
    actions: [
      { label: '취소', value: false },
      { label: '끝내기', value: true, kind: 'primary' },
    ],
  });
  if (!ok) return;
  const run = G.run;
  run.solvedAt = Date.now();
  run.forced = true;
  run.phase = 'solved';
  audio.music.stop();
  commit('forced');
  closeAll();
  emit('solved');
}
