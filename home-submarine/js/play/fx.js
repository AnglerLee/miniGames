// 화면 연출: 번쩍임, 가운데 큰 알림, 수리 완료 불꽃, 흔들림.
// 알림은 누르는 데 방해되지 않게 pointer-events 를 끈 층에 뜬다 (멈춤 판보다는 아래).

import { h } from '../shared/dom.js';

let layer = null;

function fxLayer() {
  if (!layer || !layer.isConnected) {
    layer = h('div', { class: 'fx-layer', 'aria-hidden': 'true' });
    document.body.append(layer);
  }
  return layer;
}

/** 화면 전체가 한 번 번쩍인다. kind: 'alarm' | 'damage' | 'good' | 'arrive'(color 와 함께) */
export function flash(kind, color) {
  const el = h('div', { class: 'flash flash-' + kind, style: color ? { '--c': color } : null });
  fxLayer().append(el);
  setTimeout(() => el.remove(), 900);
}

/** 애니메이션 클래스를 다시 건다 */
export function replay(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export const shake = (el) => replay(el, 'shake');

let noteBox = null;
let noteTimer = null;
let noteDone = null;

/**
 * 가운데에 크게 뜨는 알림. 다음 알림이 뜨면 그 자리를 넘겨 준다(이때 done 은 바로 불린다).
 *   kind: 'good' | 'bad' | 'pick' | 'power' | ''   sparks: 수리 완료 불꽃
 */
export function note({ icon = '', text, sub = '', color = '', kind = '', ms = 1600, sparks = false }, done = null) {
  const prevDone = noteDone;
  clearNote();
  if (prevDone) prevDone();
  noteBox = h(
    'div',
    { class: ('note ' + kind).trim(), style: color ? { '--c': color } : null },
    h(
      'div',
      { class: 'note-burst' },
      sparks ? Array.from({ length: 16 }, (_, i) => h('i', { class: 'spark', style: { '--a': i * 22.5 + 'deg', '--d': 84 + (i % 3) * 30 + 'px' } })) : null,
      icon ? h('div', { class: 'note-icon', text: icon }) : null
    ),
    h('strong', { class: 'note-text', text }),
    sub ? h('span', { class: 'note-sub', text: sub }) : null
  );
  fxLayer().append(noteBox);
  noteDone = done;
  noteTimer = setTimeout(() => {
    const d = noteDone;
    clearNote();
    if (d) d();
  }, ms);
}

/** 알림을 치운다. 기다리던 done 은 부르지 않는다 (도착 순서를 취소할 때) */
export function clearNote() {
  clearTimeout(noteTimer);
  noteTimer = null;
  noteDone = null;
  if (noteBox) noteBox.remove();
  noteBox = null;
}

export const noteText = () => (noteBox ? noteBox.querySelector('.note-text').textContent : null);
