// 화면 요소를 만드는 작은 도우미들. 모든 화면이 함께 쓴다.

/**
 * 요소를 만든다. props 의 on* 은 이벤트, class/text/html 은 각각 클래스, 글자, HTML,
 * style 은 객체(--로 시작하면 CSS 변수), 나머지는 속성으로 들어간다. children 은 요소나 문자열.
 */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'style' && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        if (k.startsWith('--')) node.style.setProperty(k, v);
        else node.style[k] = v;
      }
    } else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** 요소의 내용을 비우고 새 내용으로 바꾼다 */
export function fill(node, ...children) {
  node.replaceChildren(...children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/**
 * 자체 모달을 띄운다 (브라우저 기본 alert/confirm 대신 쓴다).
 * actions: [{ label, value, kind }]. 누른 버튼의 value 로 끝나는 Promise 를 돌려준다.
 */
export function showModal({ title, text, body, actions }) {
  return new Promise((resolve) => {
    const close = (value) => {
      backdrop.remove();
      resolve(value);
    };
    const backdrop = h(
      'div',
      { class: 'modal-backdrop' },
      h(
        'div',
        { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        title ? h('h2', { text: title }) : null,
        text ? h('p', { text }) : null,
        body || null,
        h(
          'div',
          { class: 'actions' },
          (actions || [{ label: '확인', value: true, kind: 'primary' }]).map((a) =>
            h('button', { class: 'btn ' + (a.kind || ''), type: 'button', text: a.label, onClick: () => close(a.value) })
          )
        )
      )
    );
    document.body.append(backdrop);
  });
}

/** 잠깐 뜨는 알림. kind: '' | 'good' | 'bad' */
export function toast(text, kind = '', ms = 2200) {
  let box = document.querySelector('.toast-box');
  if (!box) {
    box = h('div', { class: 'toast-box', 'aria-live': 'polite' });
    document.body.append(box);
  }
  const node = h('div', { class: 'toast ' + kind, text });
  box.append(node);
  setTimeout(() => node.remove(), ms);
  return node;
}

/** 모듈이 자기 CSS 를 한 번만 넣는다 (장면 모듈처럼 CSS 파일을 따로 두지 않을 때) */
export function ensureStyle(id, cssText) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = cssText;
  document.head.append(style);
}

/** 진동 (되는 기기에서만) */
export function buzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {
    /* 진동을 쓸 수 없는 기기 */
  }
}

/** 주소의 ?debug=1 */
export const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1';
