// 작은 연출들: 쪽지 발견 축하, 타자 치듯 나오는 말, 반짝이.

import { h } from '../shared/dom.js';
import { codeText } from '../shared/case.js';
import { audio } from './audio.js';

/**
 * 판 위에 "쪽지 발견!" 을 잠깐 띄운다. 누르는 데 방해되지 않게 pointer-events 는 끈다.
 * 돌려주는 함수를 부르면 바로 치운다.
 */
export function celebrate(host, { title, tag }) {
  const sparks = Array.from({ length: 14 }, (_, i) =>
    h('i', { class: 'spark', style: { '--a': i * (360 / 14) + 'deg', '--d': 70 + (i % 3) * 26 + 'px', '--c': ['#ffd95a', '#e3b341', '#fff3c4', '#d9412f'][i % 4] } })
  );
  const box = h(
    'div',
    { class: 'celebrate', 'aria-live': 'polite' },
    h('div', { class: 'celebrate-burst' }, sparks, h('span', { class: 'note-code', text: codeText(tag.code) })),
    h('strong', { text: title })
  );
  host.append(box);
  const timer = setTimeout(() => box.remove(), 1900);
  return () => {
    clearTimeout(timer);
    box.remove();
  };
}

/**
 * 글자를 한 자씩 찍는다. 'type' 소리는 3~4글자에 한 번.
 * play(text, onDone) 으로 시작하고, finish() 로 한 번에 다 보여 준다.
 */
export function typer(el, speed = 42) {
  let timer = null;
  let full = '';
  let i = 0;
  let sinceSound = 0;
  let onDone = null;

  function step() {
    i++;
    el.textContent = full.slice(0, i);
    sinceSound++;
    if (sinceSound >= (i % 2 ? 3 : 4) && full[i - 1] !== ' ') {
      sinceSound = 0;
      audio.sfx('type');
    }
    if (i >= full.length) finish();
  }

  function finish() {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
    el.textContent = full;
    const done = onDone;
    onDone = null;
    if (done) done();
  }

  return {
    play(text, done) {
      clearInterval(timer);
      full = text;
      i = 0;
      sinceSound = 0;
      onDone = done || null;
      el.textContent = '';
      timer = setInterval(step, speed);
    },
    finish,
    stop() {
      clearInterval(timer);
      timer = null;
      onDone = null;
    },
    get busy() {
      return timer !== null;
    },
  };
}

/** 애니메이션 클래스를 다시 건다 (같은 요소에서 여러 번 보여 줄 때) */
export function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
