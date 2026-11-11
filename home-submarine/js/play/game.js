// 아이 화면이 함께 쓰는 진행 상태와 작은 도우미들.
// 규칙은 엔진(reduce)에만 있다. 화면은 이벤트를 보내고, 엔진 기록(log)에 새로 생긴 일을 보고 연출을 고른다.

import { reduce, remaining } from '../shared/engine.js';
import { saveRun } from '../shared/store.js';

/** setup: 부모 설정, stations: 구역 목록, state: 엔진 상태, key: 저장 열쇠, manual: 검증용으로 실제 시계를 멈췄는가 */
export const G = { setup: null, stations: null, state: null, key: null, manual: false };

/** 시간이 흐르는 단계 */
export const TIMED = ['dock', 'run', 'route'];

const subs = new Map();

export function on(name, fn) {
  if (!subs.has(name)) subs.set(name, []);
  subs.get(name).push(fn);
}

export function emit(name, payload) {
  for (const fn of subs.get(name) || []) fn(payload);
}

/**
 * 엔진에 이벤트를 보낸다. 돌려주는 값은 이번에 새로 생긴 기록들이다.
 * 기록이 생겼다는 것은 해결·놓침·도착·단계 전환 같은 "일"이 있었다는 뜻이라 그때마다 저장한다.
 */
export function send(event) {
  const prev = G.state;
  if (!prev) return [];
  const next = reduce(prev, event, { stations: G.stations });
  G.state = next;
  const fresh = next.log.slice(prev.log.length);
  if (fresh.length) save();
  emit('change', { prev, next, fresh, event });
  return fresh;
}

export function save() {
  if (G.state && G.key !== null) saveRun(G.key, G.state);
}

export const timed = (s = G.state) => !!s && TIMED.includes(s.phase);

/** 급한 순서 (마감이 가까운 것부터) */
export const urgentFirst = (s = G.state) => s.active.slice().sort((a, b) => a.deadline - b.deadline);

export const alertById = (id, s = G.state) => (s ? s.active.find((a) => a.id === id) || null : null);

export const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));

/** 남은 시간 비율 0~1 */
export const ratioOf = (s, a) => (a.limitMs ? Math.max(0, Math.min(1, remaining(s, a) / a.limitMs)) : 0);

/** 0.5 아래면 주황, 0.25 아래면 빨강 */
export const levelOf = (ratio) => (ratio < 0.25 ? 'red' : ratio < 0.5 ? 'amber' : 'ok');

/** 크레인 순서의 남은 시간 */
export const routeLeft = (s) => (s.route ? Math.max(0, s.route.deadline - s.clock) : 0);

/** "기관실 · 부엌" */
export const placeName = (st) => st.role.name + ' · ' + st.room.name;
