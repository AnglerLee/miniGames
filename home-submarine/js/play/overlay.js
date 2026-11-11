// 판 쌓기.
// 무대 판(도착 확인, 수리, 암호)은 HUD 아래 무대에 떠서 위의 수심·선체가 계속 보인다.
// 멈춤과 메뉴는 화면 전체(top) 위에 뜬다. 멈춤 판은 경보가 보이지 않게 모두 가린다.

import { h } from '../shared/dom.js';

const stack = [];
const hosts = { stage: null, top: null };

export function setHost(kind, el) {
  hosts[kind] = el;
}

function topHost() {
  if (!hosts.top || !hosts.top.isConnected) {
    hosts.top = h('div', { class: 'top-layer' });
    document.body.append(hosts.top);
  }
  return hosts.top;
}

/**
 * 판을 연다.
 *   host     'stage' | 'top'
 *   backdrop 바깥을 누르면 닫히는 어두운 바탕을 깐다
 *   onClose(how)  how: 'x'(닫기) 'back'(바깥) 'done'(끝냄) 'late'(시간 초과) 'all'(화면이 바뀜)
 * 돌려주는 api: { name, el, host, closed, update(state)?, close(how) }
 */
export function openOverlay(name, { host = 'stage', cls = '', backdrop = false, onClose = null } = {}) {
  const el = h('div', { class: ('ov ov-' + name + ' ' + cls).trim() });
  const api = {
    name,
    el,
    host,
    closed: false,
    onClose,
    update: null,
    close(how = 'x') {
      closeOverlay(api, how);
    },
  };
  if (backdrop) el.append(h('div', { class: 'ov-back', onClick: () => api.close('back') }));
  const parent = host === 'top' ? topHost() : hosts.stage || topHost();
  parent.append(el);
  stack.push(api);
  return api;
}

export function closeOverlay(api, how = 'x') {
  if (!api || api.closed) return;
  api.closed = true;
  const i = stack.indexOf(api);
  if (i >= 0) stack.splice(i, 1);
  try {
    if (api.onClose) api.onClose(how);
  } finally {
    api.el.remove();
  }
}

/** host 를 주면 그 자리의 판만 닫는다 */
export function closeAll(host = null, how = 'all') {
  for (const api of stack.slice().reverse()) if (!host || api.host === host) closeOverlay(api, how);
}

/** 조건에 맞는 판을 닫는다. 닫은 것이 있으면 true */
export function closeWhere(test, how) {
  let closed = false;
  for (const api of stack.slice().reverse()) {
    if (test(api)) {
      closeOverlay(api, how);
      closed = true;
    }
  }
  return closed;
}

export const topOverlay = () => (stack.length ? stack[stack.length - 1] : null);
export const findOverlay = (name) => stack.find((o) => o.name === name) || null;

/** 숫자와 막대만 바꾸는 갱신 (매 tick) */
export function updateOverlays(s) {
  for (const api of stack.slice()) if (!api.closed && api.update) api.update(s);
}
