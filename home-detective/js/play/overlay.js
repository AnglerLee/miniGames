// 수사 화면 위에 올라오는 판(쪽지 입력, 탐문, 증거 조사, 무전, 메뉴, 부모 메뉴).
// HUD 아래 무대 안에 쌓이므로 판이 열려 있어도 시계와 간식 게이지는 계속 보인다.

import { h } from '../shared/dom.js';
import { emit } from './game.js';

let layer = null;
const stack = [];

export function setLayer(el) {
  layer = el;
}

/**
 * 판을 연다. variant: 'full'(무대 전체) | 'bottom'(아래에서 올라옴)
 * 돌려주는 api: { name, el, sheet, body, head, setTitle(text), close(), onClose }
 */
export function openOverlay(name, { variant = 'full', title = '', onClose = null, cls = '' } = {}) {
  const titleEl = h('h2', { class: 'sheet-title', text: title });
  const x = h('button', { class: 'sheet-x', type: 'button', 'aria-label': '닫기', text: '✕', onClick: () => api.close() });
  const head = h('div', { class: 'sheet-head' }, titleEl, x);
  const body = h('div', { class: 'sheet-body' });
  const sheet = h('div', { class: 'sheet ' + variant + ' ' + cls, role: 'dialog', 'aria-label': title || name }, head, body);
  const el = h(
    'div',
    { class: 'ov ov-' + name + ' ' + variant },
    variant === 'bottom' ? h('div', { class: 'ov-back', onClick: () => api.close() }) : null,
    sheet
  );
  const api = {
    name,
    el,
    sheet,
    head,
    body,
    onClose,
    closed: false,
    setTitle(text) {
      titleEl.textContent = text;
    },
    close() {
      closeOverlay(api);
    },
  };
  layer.append(el);
  stack.push(api);
  emit('overlay');
  return api;
}

export function closeOverlay(api) {
  if (!api || api.closed) return;
  api.closed = true;
  const i = stack.indexOf(api);
  if (i >= 0) stack.splice(i, 1);
  try {
    if (api.onClose) api.onClose();
  } finally {
    api.el.remove();
    emit('overlay');
  }
}

export function closeAll() {
  while (stack.length) closeOverlay(stack[stack.length - 1]);
}

export function topOverlay() {
  return stack.length ? stack[stack.length - 1] : null;
}

export function findOverlay(name) {
  return stack.find((o) => o.name === name) || null;
}

/** 같은 판이 맨 위에 있으면 닫고 true (버튼을 두 번 누르면 닫히게) */
export function toggleOff(name) {
  const top = topOverlay();
  if (top && top.name === name) {
    top.close();
    return true;
  }
  const below = findOverlay(name);
  if (below) below.close();
  return false;
}
