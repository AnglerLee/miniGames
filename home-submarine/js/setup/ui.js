// 준비 마법사 화면 조각들. 단계 파일마다 같은 모양을 쓰려고 모아 둔다.

import { h } from '../shared/dom.js';

/** 문제가 있는 곳을 보여 주고 흔든다 */
export function shake(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove('shake');
  void el.offsetWidth; // 같은 요소를 연달아 흔들 때 애니메이션을 다시 시작하게
  el.classList.add('shake');
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
  if (el.matches('input, textarea')) el.focus({ preventScroll: true });
}

/** 켜고 끄는 버튼 (aria-pressed 로 상태를 보인다) */
export function choice(label, on, onClick, props = {}) {
  return h('button', Object.assign({ class: 'choice', type: 'button', 'aria-pressed': String(!!on), onClick }, props), label);
}

/** 여러 개 중 하나를 고르는 버튼 묶음. 고르면 눌린 표시만 바꾸고 onPick(value) */
export function choiceGroup(options, current, onPick, cls = 'choices') {
  const box = h('div', { class: cls });
  const paint = (v) => box.querySelectorAll('.choice').forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === v)));
  options.forEach((o) =>
    box.append(
      choice(o.label, o.value === current, () => {
        paint(o.value);
        onPick(o.value);
      }, o.props || {})
    )
  );
  box.paint = paint;
  return box;
}

/** 이름표가 붙은 입력 칸 묶음 */
export function field(label, control, { optional = false, help = null, id = null } = {}) {
  return h(
    'div',
    { class: 'field', id },
    h('label', { class: 'label', for: control && control.id ? control.id : null }, label, optional ? h('span', { class: 'opt', text: '(선택)' }) : null),
    control,
    help ? (typeof help === 'string' ? h('p', { class: 'small muted', text: help }) : help) : null
  );
}

/**
 * 그림 문자 고르기. 버튼을 누르면 아래에 판이 열린다. 한 번에 하나만 열어 둔다.
 * 돌려주는 값: { button, grid }
 */
export function iconPicker(icons, current, onPick, label = '그림 바꾸기') {
  const button = h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, 'aria-expanded': 'false' }, current);
  const grid = h('div', { class: 'icon-grid', hidden: true });
  const paint = (v) => {
    button.textContent = v;
    grid.querySelectorAll('.icon-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.textContent === v)));
  };
  icons.forEach((ic) =>
    grid.append(
      h('button', {
        class: 'icon-btn',
        type: 'button',
        'aria-pressed': String(ic === current),
        onClick: () => {
          grid.hidden = true;
          button.setAttribute('aria-expanded', 'false');
          paint(ic);
          onPick(ic);
        },
      }, ic)
    )
  );
  button.addEventListener('click', () => {
    document.querySelectorAll('.icon-grid').forEach((g) => {
      if (g !== grid) g.hidden = true;
    });
    grid.hidden = !grid.hidden;
    button.setAttribute('aria-expanded', String(!grid.hidden));
  });
  return { button, grid };
}

/** 체크 상자 버튼. 누를 때마다 켜고 끈다. */
export function checkButton({ id, label, on, onToggle }) {
  const btn = h('button', {
    class: 'check',
    type: 'button',
    id: id || null,
    'aria-pressed': String(!!on),
    onClick: () => {
      const v = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(v));
      onToggle(v);
    },
  }, h('span', { class: 'box', 'aria-hidden': 'true' }), h('span', { text: label }));
  return btn;
}

/** 글자 수를 잘라 넣는다 (maxlength 가 안 먹는 입력기 대비, 이모지도 한 글자로) */
export function clip(text, max) {
  return Array.from(String(text || '')).slice(0, max).join('');
}
