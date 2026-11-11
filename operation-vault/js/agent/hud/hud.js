// 아이 화면의 HUD: 시계, 경보 단계, 주파수, 안내 문구, 화면 효과, 전체 화면 패널.
// 3D 캔버스 위에 얹는 일반 HTML 요소다.

import { h } from '../../shared/dom.js';

export function createHud(rules) {
  const root = document.getElementById('hud');
  const screenEl = document.getElementById('screen');

  const pips = Array.from({ length: rules.alarmMax }, () => h('i'));
  const alarm = h('div', { class: 'hud-alarm' }, h('span', { class: 'label', text: '경보' }), pips);
  const clock = h('div', { class: 'hud-clock stopped', id: 'clock', text: '--:--' });
  const freqCode = h('b', { id: 'frequency', text: '----' });
  const freq = h('div', { class: 'hud-freq' }, h('span', { class: 'label', text: '주파수' }), freqCode);
  const caption = h('div', { class: 'hud-caption', id: 'caption' });
  const controls = h('div', { class: 'hud-controls', id: 'controls' });
  const backBtn = h('button', { type: 'button', class: 'hud-btn', id: 'back', text: '◀ 물러서기' });
  const menuBtn = h('button', { type: 'button', class: 'hud-btn', id: 'menu', text: '☰' });
  const vignette = h('div', { class: 'fx-vignette' });
  const flashEl = h('div', { class: 'fx-flash' });
  const fadeEl = h('div', { class: 'fx-fade' });

  root.replaceChildren(
    vignette,
    flashEl,
    fadeEl,
    h('div', { class: 'hud-top' }, alarm, clock, freq),
    caption,
    h('div', { class: 'hud-spacer' }),
    controls,
    h('div', { class: 'hud-bottom' }, backBtn, menuBtn)
  );
  backBtn.style.visibility = 'hidden';

  let backHandler = null;
  let menuHandler = null;
  let captionTimer = 0;
  let lastClock = '';
  backBtn.addEventListener('click', () => backHandler && backHandler());
  menuBtn.addEventListener('click', () => menuHandler && menuHandler());

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  return {
    controls,

    /** HUD 전체를 보이거나 숨긴다 (전체 화면 패널이 떠 있을 때는 숨긴다). */
    show(on) {
      root.classList.toggle('off', !on);
    },

    setClock(ms, running) {
      const total = Math.max(0, Math.ceil(ms / 1000));
      const text = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      if (text !== lastClock) {
        clock.textContent = text;
        lastClock = text;
      }
      clock.classList.toggle('low', running && total <= 60);
      clock.classList.toggle('stopped', !running);
    },

    setAlarm(level) {
      pips.forEach((p, i) => p.classList.toggle('on', i < level));
      alarm.classList.toggle('hot', level >= rules.alarmMax - 1);
      vignette.style.opacity = String(Math.min(1, level / rules.alarmMax) * 0.9);
      vignette.classList.toggle('pulse', level >= 3);
    },

    /** 새 주파수를 띄우고 잠깐 깜빡여 눈에 띄게 한다. */
    setFrequency(code, highlight = true) {
      freqCode.textContent = code;
      freq.classList.remove('new');
      if (highlight) {
        void freq.offsetWidth;
        freq.classList.add('new');
      }
    },

    /** 화면 위쪽 안내 문구. ms 가 0 이면 다음 문구가 올 때까지 남는다. */
    caption(text, { ms = 0, kind = '' } = {}) {
      clearTimeout(captionTimer);
      caption.className = 'hud-caption ' + kind;
      caption.textContent = text;
      if (ms > 0) captionTimer = setTimeout(() => (caption.textContent = ''), ms);
    },

    /** 단계 시작 알림: 새 주파수를 화면 가운데에 크게 잠깐 띄운다. */
    announce(title, big, sub, ms = 3200) {
      const el = h(
        'div',
        { class: 'hud-announce' },
        h('div', { class: 'title', text: title }),
        h('div', { class: 'big', text: big }),
        h('div', { class: 'sub', text: sub })
      );
      root.append(el);
      setTimeout(() => el.classList.add('out'), ms - 400);
      setTimeout(() => el.remove(), ms);
    },

    /** 깎인 시간을 화면 가운데에 크게 띄운다. */
    timeHit(ms) {
      const el = h('div', { class: 'hud-hit', text: `-${Math.round(ms / 1000)}초` });
      root.append(el);
      setTimeout(() => el.remove(), 1500);
    },

    flash(color = '#ff2a3c', strength = 0.55) {
      flashEl.style.transition = 'none';
      flashEl.style.background = color;
      flashEl.style.opacity = String(strength);
      void flashEl.offsetWidth;
      flashEl.style.transition = 'opacity 0.5s ease-out';
      flashEl.style.opacity = '0';
    },

    shake() {
      document.body.classList.remove('shake');
      void document.body.offsetWidth;
      document.body.classList.add('shake');
    },

    /** 화면을 검게 덮거나 걷는다. */
    async fade(on, ms = 400) {
      fadeEl.style.transitionDuration = ms + 'ms';
      fadeEl.style.opacity = on ? '1' : '0';
      await wait(ms);
    },

    /** 물러서기 버튼. handler 가 없으면 숨긴다. */
    setBack(handler, label = '◀ 물러서기') {
      backHandler = handler;
      backBtn.textContent = label;
      backBtn.style.visibility = handler ? 'visible' : 'hidden';
    },

    onMenu(handler) {
      menuHandler = handler;
    },

    /**
     * 전체 화면 패널을 띄운다. node 가 null 이면 닫는다.
     * kind: '' 기본, 'glass' 반투명, 'alert' 붉은 경고, 'gold' 금고 개방
     */
    screen(node, kind = '') {
      screenEl.className = node ? 'on ' + kind : '';
      screenEl.replaceChildren(...(node ? [node] : []));
      screenEl.scrollTop = 0;
    },

    screenOpen: () => screenEl.classList.contains('on'),
  };
}
