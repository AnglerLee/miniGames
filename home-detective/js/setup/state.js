// 준비 마법사의 상태: 설정(setup), 마법사 위치(wiz), 지금 설정으로 만든 사건.
// 설정은 바뀔 때마다 바로 저장한다. 부모가 중간에 창을 닫아도 이어서 할 수 있게.

import { loadSetup, saveSetup, defaultSetup, loadHistory, loadRun, caseKey, photos } from '../shared/store.js';
import { buildCase } from '../shared/case.js';
import { hash32 } from '../shared/prng.js';
import { DIFFICULTY, ROOMS_MIN, ROOMS_MAX } from '../shared/content.js';
import { showModal } from '../shared/dom.js';

// 마법사 위치와 화면용 기록은 이 기기에만 둔다 (설정과 달리 다른 폰으로 보낼 필요가 없다)
const WIZ_KEY = 'minigames:homeDetective_setupWizard';

export const SUSPECTS_MAX = 8;
export const NAME_MAX = 8;
export const HINT_MAX = 40;
export const MIN_MINUTES = 10;
export const MAX_MINUTES = 60;

export const STEPS = ['시작하기 전에', '기본 설정', '방 고르기', '용의자 인형', '보물과 보상', '쪽지 붙이기', '관찰 준비'];
export const LAST_STEP = STEPS.length - 1;

export const state = { setup: null, wiz: null };

function readWiz() {
  try {
    return JSON.parse(localStorage.getItem(WIZ_KEY)) || {};
  } catch (e) {
    return {};
  }
}

export function initState() {
  let setup = loadSetup();
  if (!setup) {
    setup = defaultSetup();
    // 기록만 남고 설정이 지워진 경우에도 사건 번호는 이어 간다
    const maxNo = Math.max(0, ...loadHistory().map((x) => x.caseNo | 0));
    if (maxNo) setup.caseNo = maxNo + 1;
    saveSetup(setup);
  }
  if (!setup.placed) setup.placed = {};
  state.setup = setup;
  const w = readWiz();
  state.wiz = {
    step: Math.max(0, Math.min(LAST_STEP, w.step | 0)),
    minutesTouched: !!w.minutesTouched,
    predict: w.predict || {},
    prevTreasure: w.prevTreasure || '',
    seq: w.seq || {},
  };
  // 지금 있는 번호를 기억해 둔다. 기본으로 들어 있던 방(r1~r5)을 빼고 새로 넣을 때도 같은 번호를 다시 쓰지 않게.
  for (const [list, prefix] of [[setup.rooms, 'r'], [setup.suspects, 's']]) {
    for (const x of list) {
      const m = /^[a-z]+(\d+)$/.exec(x.id || '');
      if (m) state.wiz.seq[prefix] = Math.max(state.wiz.seq[prefix] | 0, +m[1]);
    }
  }
}

export function save() {
  saveSetup(state.setup);
  try {
    localStorage.setItem(WIZ_KEY, JSON.stringify(state.wiz));
  } catch (e) {
    /* 저장소를 쓸 수 없는 환경 */
  }
}

/**
 * 새 방/용의자 id. 지운 번호도 다시 쓰지 않는다.
 * (같은 번호를 다시 쓰면 다른 방인데도 붙여 둔 쪽지가 맞는 것처럼 보일 수 있다)
 */
export function nextId(list, prefix) {
  let max = state.wiz.seq[prefix] | 0;
  for (const x of list) {
    const m = /^[a-z]+(\d+)$/.exec(x.id || '');
    if (m) max = Math.max(max, +m[1]);
  }
  state.wiz.seq[prefix] = max + 1;
  return prefix + (max + 1);
}

// ---------- 사건 ----------

let cache = { key: null, cs: null, error: null };

/** 지금 설정으로 만든 사건. 같은 설정이면 다시 만들지 않는다. */
export function currentCase() {
  const s = state.setup;
  const key = JSON.stringify([s.seed, s.difficulty, s.rooms, s.suspects, s.crimeRoom]);
  if (cache.key !== key) {
    try {
      cache = { key, cs: buildCase(s), error: null };
    } catch (e) {
      cache = { key, cs: null, error: e.message };
    }
  }
  return cache;
}

/**
 * 쪽지 배치의 지문. 기호, 쪽지 id, 방 id 가 모두 같아야 같은 배치다.
 * 이름만 고친 경우(곰돌이 → 뽀미)는 붙여 둔 쪽지를 그대로 쓸 수 있으므로 이름은 넣지 않는다.
 */
export function caseSig(cs) {
  return hash32(
    cs.tags
      .map((t) => t.id + '@' + cs.rooms[t.room].id + '#' + t.code.shape + '.' + t.code.digit)
      .sort()
      .join('|')
  );
}

function tagKeys() {
  return Object.keys(state.setup.placed || {}).filter((k) => k !== 'treasure');
}

/** 5단계에서 쪽지를 하나라도 붙였거나 힌트를 적었는가 */
export function placingStarted() {
  const p = state.setup.placed || {};
  return tagKeys().some((k) => p[k] && (p[k].done || p[k].hint || p[k].photo));
}

/** 쪽지 배치를 비운다. 보물상자는 사건과 상관없이 같은 곳에 있으므로 남긴다. */
export function resetPlaced({ keepTreasure = true } = {}) {
  const s = state.setup;
  const t = s.placed && s.placed.treasure;
  s.placed = keepTreasure && t ? { treasure: t } : {};
  return photos.clearPrefix('tag:');
}

/**
 * 5단계에 들어올 때: 저장된 배치가 지금 사건과 맞지 않으면 버린다.
 * 돌려주는 값: 버렸으면 true
 */
export function syncPlaced(cs) {
  const s = state.setup;
  const sig = caseSig(cs);
  if (s.placedSig === sig) return false;
  const keys = tagKeys();
  const ids = new Set(cs.tags.map((t) => t.id));
  // 지문이 없는 설정(다른 화면에서 만든 것)은 쪽지 id 만 맞으면 그대로 쓴다
  if (!keys.length || (s.placedSig == null && keys.every((k) => ids.has(k)))) {
    s.placedSig = sig;
    save();
    return false;
  }
  resetPlaced();
  s.placedSig = sig;
  s.ready = false;
  save();
  return true;
}

export function placedCount(cs) {
  const p = state.setup.placed || {};
  return cs.tags.filter((t) => p[t.id] && p[t.id].done).length;
}

let warned = false;

/**
 * 사건이 달라지는 값(난이도, 방, 용의자, 사건 방)을 바꾸기 전에 부른다.
 * 이미 쪽지를 붙이기 시작했으면 한 번만 경고한다. 바꿔도 되면 true.
 */
export async function guardChange() {
  if (warned || !placingStarted()) return true;
  const ok = await showModal({
    title: '사건이 새로 만들어져요',
    text: '이미 붙인 쪽지가 있어요.\n이 값을 바꾸면 기호가 모두 달라져서 쪽지를 처음부터 다시 붙여야 해요.',
    actions: [
      { label: '그대로 두기', value: false, kind: 'ghost' },
      { label: '바꾸기', value: true, kind: 'primary' },
    ],
  });
  if (ok) warned = true;
  return !!ok;
}

/** 사건이 달라지는 값을 바꾼 뒤: 아이에게 건넨 상태를 푼다 */
export function structureChanged() {
  state.setup.ready = false;
}

/** 지금 설정의 사건을 아이가 풀고 있는 중이면 그 진행 상태 */
export function activeRun() {
  const run = loadRun();
  if (!run || run.caseKey !== caseKey(state.setup) || run.phase === 'end') return null;
  return run;
}

/** 이 사건을 이미 아이에게 건넸거나 풀어 본 적이 있는가 (지난 설정으로 새 사건을 만들 수 있는가) */
export function usedBefore() {
  const s = state.setup;
  return !!s.ready || loadHistory().some((x) => x.caseNo === s.caseNo);
}

// ---------- 단계별 확인 ----------

function nameProblem(list, what) {
  const names = list.map((x) => String(x.name || '').trim());
  const emptyAt = names.findIndex((n) => !n);
  if (emptyAt >= 0) return { text: '이름이 비어 있는 ' + what + '이 있어요.', focus: '[data-name-of="' + list[emptyAt].id + '"]' };
  const dupAt = names.findIndex((n, i) => names.indexOf(n) !== i);
  if (dupAt >= 0) {
    return { text: '"' + names[dupAt] + '" 이름이 두 번 있어요. 이름을 다르게 해 주세요.', focus: '[data-name-of="' + list[dupAt].id + '"]' };
  }
  return null;
}

/**
 * 이 단계를 넘어가지 못하는 이유. 문제가 없으면 null.
 * 돌려주는 값: { text, focus } (focus: 흔들어 보여 줄 요소의 선택자)
 */
export function stepProblem(step) {
  const s = state.setup;
  const D = DIFFICULTY[s.difficulty] || DIFFICULTY[1];
  if (step === 1) {
    if (!(s.minutes >= MIN_MINUTES && s.minutes <= MAX_MINUTES)) {
      return { text: '제한 시간은 ' + MIN_MINUTES + '분에서 ' + MAX_MINUTES + '분 사이로 정해 주세요.', focus: '#minutes-card' };
    }
  }
  if (step === 2) {
    const n = s.rooms.length;
    if (n < ROOMS_MIN) return { text: '방을 ' + ROOMS_MIN + '곳 이상 골라 주세요. (지금 ' + n + '곳)', focus: '#room-presets' };
    if (n > ROOMS_MAX) return { text: '방은 ' + ROOMS_MAX + '곳까지예요. (지금 ' + n + '곳)', focus: '#room-list' };
    const p = nameProblem(s.rooms, '방');
    if (p) return p;
  }
  if (step === 3) {
    const n = s.suspects.length;
    if (n < D.suspects) {
      return { text: D.name + ' 난이도는 용의자가 ' + D.suspects + '명 필요해요. (지금 ' + n + '명)', focus: '#add-suspect' };
    }
    if (n > SUSPECTS_MAX) return { text: '용의자는 ' + SUSPECTS_MAX + '명까지예요.', focus: '#sus-list' };
    const p = nameProblem(s.suspects, '인형');
    if (p) return p;
  }
  if (step === 4) {
    if (!String(s.treasure.text || '').trim()) {
      return { text: '보물 내용을 적어 주세요. 범인이 자백할 때 아이에게 알려 줄 내용이에요.', focus: '#treasure-text' };
    }
    if (!/^\d{4}$/.test(String(s.pin || ''))) return { text: '확인 번호는 숫자 4자리로 적어 주세요.', focus: '#pin' };
  }
  if (step === 5) {
    const { cs, error } = currentCase();
    if (!cs) return { text: error, focus: null };
    if (s.placedSig !== caseSig(cs)) {
      return { text: placingStarted() ? '사건이 바뀌었어요. 쪽지를 새로 붙여 주세요.' : '쪽지를 붙여 주세요.', focus: null };
    }
    const left = cs.tags.length - placedCount(cs);
    if (left) return { text: '아직 붙이지 않은 쪽지가 ' + left + '장 있어요.', focus: '.tag-card:not(.done)' };
    if (!(s.placed.treasure && s.placed.treasure.done)) return { text: '보물상자를 숨긴 뒤 체크해 주세요.', focus: '#treasure-check' };
  }
  return null;
}
