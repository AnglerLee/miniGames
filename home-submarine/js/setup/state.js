// 준비 마법사의 상태: 설정(setup)과 마법사 위치(wiz).
// 설정은 바뀔 때마다 바로 저장한다. 부모가 중간에 창을 닫아도 이어서 할 수 있게.

import { loadSetup, saveSetup, defaultSetup, loadHistory, loadRun, missionKey } from '../shared/store.js';
import { makeStations } from '../shared/tags.js';
import { ROOMS_MIN, ROOMS_MAX } from '../shared/content.js';
import { showModal } from '../shared/dom.js';

// 마법사 위치와 고르다 만 예측은 설정과 따로 둔다 (play 화면은 몰라도 되는 값)
const WIZ_KEY = 'minigames:homeSubmarine_setupWizard';

export const NAME_MAX = 8;
export const ROOM_NAME_MAX = 6;
export const TEXT_MAX = 40;

export const STEPS = ['시작하기 전에', '함장과 난이도', '방과 구역', '보물과 보상', '쪽지 붙이기', '관찰 준비'];
export const LAST_STEP = STEPS.length - 1;
export const NOTES_STEP = 4;

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
    // 설정이 지워져도 기록이 남아 있으면 임무 번호는 이어 간다
    const maxNo = Math.max(0, ...loadHistory().map((x) => x.missionNo | 0));
    if (maxNo) setup.missionNo = maxNo + 1;
    saveSetup(setup);
  }
  if (!setup.placed || typeof setup.placed !== 'object') setup.placed = {};
  if (!setup.roleOf || typeof setup.roleOf !== 'object') setup.roleOf = {};
  state.setup = setup;
  const w = readWiz();
  state.wiz = {
    step: Math.max(0, Math.min(LAST_STEP, w.step | 0)),
    predict: w.predict && typeof w.predict === 'object' ? w.predict : {},
    seq: w.seq | 0,
  };
  // 지금 있는 방 번호를 기억해 둔다. 뺀 방의 번호를 새 방에 다시 주지 않게.
  for (const r of setup.rooms) {
    const m = /^r(\d+)$/.exec(r.id || '');
    if (m) state.wiz.seq = Math.max(state.wiz.seq, +m[1]);
  }
}

export function save() {
  const s = state.setup;
  // 준비가 덜 된 상태(쪽지를 덜 붙였거나 방이 모자람)로 바뀌면 아이 화면을 열지 못하게 한다
  if (s.ready && firstProblem()) s.ready = false;
  saveSetup(s);
  try {
    localStorage.setItem(WIZ_KEY, JSON.stringify(state.wiz));
  } catch (e) {
    /* 저장소를 쓸 수 없는 환경 */
  }
}

/** 새 방 id. 뺀 방의 번호도 다시 쓰지 않는다 (같은 번호면 쪽지 숫자도 같아져 헷갈린다) */
export function nextRoomId() {
  let max = state.wiz.seq | 0;
  for (const r of state.setup.rooms) {
    const m = /^r(\d+)$/.exec(r.id || '');
    if (m) max = Math.max(max, +m[1]);
  }
  state.wiz.seq = max + 1;
  return 'r' + (max + 1);
}

export function stations() {
  return makeStations(state.setup);
}

/** 지금 배정을 모든 방에 대해 적어 둔다 (방을 넣고 뺀 뒤 남은 배정이 엉키지 않게) */
export function normalizeRoles() {
  const s = state.setup;
  // 지금 배정(roleOf)을 읽어 구역을 정한 다음에 새로 적는다
  const list = makeStations(s);
  s.roleOf = {};
  for (const st of list) s.roleOf[st.room.id] = st.role.id;
}

export function placedRooms() {
  const p = state.setup.placed || {};
  return state.setup.rooms.filter((r) => p[r.id] === true).length;
}

/**
 * 쪽지가 달라지는 변경(방 넣고 빼기, 구역 바꾸기) 전에 부른다.
 * 이미 붙였다고 표시한 쪽지가 있으면 한 번 확인한다. 바꿔도 되면 true.
 */
export async function confirmNotesReset() {
  if (!placedRooms()) return true;
  const ok = await showModal({
    title: '쪽지를 다시 붙여야 해요',
    text: '이미 붙였다고 표시한 쪽지가 있어요.\n방이나 구역을 바꾸면 쪽지 안내가 달라져서 4단계를 처음부터 다시 확인해야 해요.',
    actions: [
      { label: '그대로 두기', value: false, kind: 'ghost' },
      { label: '바꾸기', value: true, kind: 'primary' },
    ],
  });
  return !!ok;
}

/** 쪽지가 달라졌을 때: 붙임 표시를 모두 비운다 */
export function notesChanged() {
  state.setup.placed = {};
}

/** 지금 설정의 임무를 아이가 하던 중이면 그 저장 */
export function activeRun() {
  const run = loadRun();
  if (!run || run.key !== missionKey(state.setup)) return null;
  if (run.state.phase === 'done' && run.state.recorded) return null;
  return run;
}

// ---------- 단계별 확인 ----------

function nameProblem(list) {
  const names = list.map((x) => String(x.name || '').trim());
  const emptyAt = names.findIndex((n) => !n);
  if (emptyAt >= 0) return { text: '이름이 비어 있는 방이 있어요.', focus: '[data-name-of="' + list[emptyAt].id + '"]' };
  const dupAt = names.findIndex((n, i) => names.indexOf(n) !== i);
  if (dupAt >= 0) return { text: '"' + names[dupAt] + '" 방이 두 번 있어요. 이름을 다르게 해 주세요.', focus: '[data-name-of="' + list[dupAt].id + '"]' };
  return null;
}

/**
 * 이 단계를 넘어가지 못하는 이유. 문제가 없으면 null.
 * 돌려주는 값: { text, focus } (focus: 흔들어 보여 줄 요소의 선택자)
 */
export function stepProblem(step) {
  const s = state.setup;
  if (step === 2) {
    const n = s.rooms.length;
    if (n < ROOMS_MIN) return { text: '방을 ' + ROOMS_MIN + '곳 이상 골라 주세요. (지금 ' + n + '곳)', focus: '#room-presets' };
    if (n > ROOMS_MAX) return { text: '방은 ' + ROOMS_MAX + '곳까지예요. (지금 ' + n + '곳)', focus: '#room-list' };
    return nameProblem(s.rooms);
  }
  if (step === 3) {
    if (!String(s.treasure.text || '').trim()) return { text: '보물 내용을 적어 주세요. 물 위로 올라왔을 때 아이에게 보여 줄 내용이에요.', focus: '#treasure-text' };
    if (!/^\d{4}$/.test(String(s.pin || ''))) return { text: '확인 번호는 숫자 4자리로 적어 주세요.', focus: '#pin' };
  }
  if (step === NOTES_STEP) {
    const left = s.rooms.length - placedRooms();
    if (left > 0) return { text: '아직 붙이지 않은 쪽지가 ' + left + '장 있어요.', focus: '.note-card:not(.done)' };
    if (!s.placed.treasure) return { text: '보물상자를 숨긴 뒤 체크해 주세요.', focus: '#check-treasure' };
    if (!s.placed.safety) return { text: '아이가 다닐 바닥을 치운 뒤 체크해 주세요.', focus: '#check-safety' };
  }
  return null;
}

/** 1~4단계 중 처음 막히는 곳 */
export function firstProblem() {
  for (let i = 1; i < LAST_STEP; i++) {
    const p = stepProblem(i);
    if (p) return Object.assign({ step: i }, p);
  }
  return null;
}
