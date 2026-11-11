// 수사 화면의 모든 모듈이 함께 보는 상태와 작은 도우미.
// 상태(run)를 바꾼 모듈은 commit() 으로 저장하고, 다른 화면은 'change' 를 듣고 다시 그린다.

import { saveRun } from '../shared/store.js';
import { elapsedMs, remainingMs } from '../shared/score.js';

export const G = {
  setup: null,
  cs: null,
  run: null,
  /** 쪽지 id → 힌트 사진이 이 기기에 실제로 있는가 (다른 폰에서 받은 설정은 사진이 빠져 있다) */
  photoOk: {},
  /** 새 단서가 생겼는데 아직 안 본 탭 */
  unseen: { notebook: false, board: false },
};

// ---------- 작은 알림판 ----------

const subs = new Map();

export function on(type, fn) {
  if (!subs.has(type)) subs.set(type, new Set());
  subs.get(type).add(fn);
  return () => subs.get(type).delete(fn);
}

export function emit(type, data) {
  const set = subs.get(type);
  if (!set) return;
  for (const fn of [...set]) fn(data);
}

/** 저장하고 화면들에 알린다 */
export function commit(what = '') {
  if (G.run) saveRun(G.run);
  emit('change', what);
}

// ---------- 시간 ----------

/** 시작 뒤 흐른 수사 시간 (이벤트의 at) */
export const at = (now = Date.now()) => elapsedMs(G.run, now);
export const left = (now = Date.now()) => remainingMs(G.run, now);
export const ratioLeft = (now = Date.now()) => Math.max(0, Math.min(1, left(now) / G.run.limitMs));

/** 관찰 리포트가 읽는 기록 */
export function log(type, extra) {
  G.run.events.push(Object.assign({ at: at(), type }, extra || {}));
}

/** 벌로 시간을 깎는다. HUD 가 "-2:00" 을 날린다. */
export function penalize(ms) {
  G.run.penaltyMs += ms;
  emit('penalty', ms);
}

/** 0:20, 2:00 처럼 (분은 0 을 채우지 않는다) */
export function mmss(ms) {
  const sec = Math.round(Math.abs(ms) / 1000);
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

// ---------- 사건 진행 ----------

export const suspectTag = (s) => G.cs.tags.find((t) => t.kind === 'suspect' && t.ref === s);
export const evidenceTag = (i) => G.cs.tags.find((t) => t.kind === 'evidence' && t.ref === i);
export const foundOf = (tag) => (tag && G.run.found[tag.id]) || null;
export const tagDone = (tag) => !!(foundOf(tag) && foundOf(tag).done);

export const met = (s) => !!foundOf(suspectTag(s));
export const heard = (s, t) => (G.run.asked[s] || []).includes(t);
export const heardAny = (s) => (G.run.asked[s] || []).length > 0;
export const heardAll = (s) => G.cs.slots.every((_, t) => heard(s, t));
export const evDone = (i) => tagDone(evidenceTag(i));

/** 아이가 이미 가진 단서인가 (들은 진술, 조사를 마친 증거) */
export function owned(item) {
  if (!item) return false;
  if (item.type === 'statement') return heard(item.who, item.slot);
  return evDone(item.index);
}

/** HUD 의 "탐문 2/5 · 증거 1/4" */
export function progress() {
  const cs = G.cs;
  return {
    asked: cs.suspects.filter((_, s) => heardAll(s)).length,
    suspects: cs.suspects.length,
    evidence: cs.evidence.filter((_, i) => evDone(i)).length,
    evidenceTotal: cs.evidence.length,
    found: Object.keys(G.run.found).length,
    tags: cs.tags.length,
  };
}

/** 마지막으로 수사가 앞으로 나아간 수사 시각 (무전 권하기에 쓴다) */
const PROGRESS_EVENTS = new Set(['start', 'find', 'asked', 'scene', 'accuse', 'rescue']);
export function lastProgressAt() {
  const ev = G.run.events;
  for (let i = ev.length - 1; i >= 0; i--) if (PROGRESS_EVENTS.has(ev[i].type)) return ev[i].at;
  return 0;
}

/** 쪽지를 처음 찾은 것으로 적는다 (저장은 부른 쪽이 한다). 처음이면 true. */
export function discover(tag) {
  const run = G.run;
  if (run.found[tag.id]) return false;
  run.found[tag.id] = { at: at(), done: false, misses: 0 };
  run.codeStreak = 0;
  log('find', { tag: tag.id });
  markUnseen();
  return true;
}

/** 새 단서가 수첩과 정리표에 들어갔다 */
export function markUnseen() {
  G.unseen.notebook = true;
  G.unseen.board = true;
}

/** 좁은 칸에 쓰는 짧은 이름 (공백을 빼고 n 자) */
export function short(name, n = 3) {
  const s = String(name || '').replace(/\s+/g, '');
  return s.length <= n ? s : s.slice(0, n) + '…';
}

/** 방 이름은 줄임표 없이 앞 글자만 (아이콘을 앞세우므로 충분하다) */
export function shortRoom(name, n = 3) {
  return String(name || '').replace(/\s+/g, '').slice(0, n);
}
