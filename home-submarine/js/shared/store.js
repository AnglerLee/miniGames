// 저장: 설정과 진행 상태를 localStorage 에 둔다. 서버로 보내는 것은 없다.

import { hash32 } from './prng.js';
import { ROOM_PRESETS } from './content.js';

export const KEYS = {
  setup: 'minigames:homeSubmarine_setup',
  run: 'minigames:homeSubmarine_run',
  history: 'minigames:homeSubmarine_history',
};

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export function newSeed() {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}

/**
 * 기본 설정.
 *   tagSeed  구역 쪽지(모양과 숫자)를 정한다. 쪽지를 붙여 둔 동안에는 바꾸지 않는다.
 *   seed     임무(어느 구역이 언제 고장 나는지)를 정한다. 할 때마다 새로 뽑는다.
 *   roleOf   { 방 id: 구역 id }  부모가 직접 배정한 것만 (없으면 차례대로)
 *   placed   { 방 id: true }  쪽지를 붙였는지
 *   predict  부모의 예측 { damage:0|1|2, retry:0|1, hardest:단계 id } 또는 null
 */
export function defaultSetup() {
  return {
    v: 1,
    captain: '',
    difficulty: 1,
    rooms: ROOM_PRESETS.slice(0, 5).map((r, i) => ({ id: 'r' + (i + 1), name: r.name, icon: r.icon })),
    roleOf: {},
    treasure: { kind: 'place', text: '' },
    bonus: { text: '', rule: 'A' },
    pin: '0000',
    tagSeed: newSeed(),
    seed: newSeed(),
    placed: {},
    predict: null,
    ready: false,
    missionNo: 1,
  };
}

export function loadSetup() {
  const s = read(KEYS.setup);
  if (!s || s.v !== 1 || !Array.isArray(s.rooms)) return null;
  return Object.assign(defaultSetup(), s);
}
export function saveSetup(setup) {
  return write(KEYS.setup, setup);
}

/** 저장된 진행: { key, state, savedAt }  (state 는 engine.js 의 상태) */
export function loadRun() {
  const r = read(KEYS.run);
  return r && r.state && r.state.v === 1 ? r : null;
}
export function saveRun(key, state) {
  return write(KEYS.run, { key, state, savedAt: Date.now() });
}
export function clearRun() {
  try {
    localStorage.removeItem(KEYS.run);
  } catch (e) {
    /* 저장소를 쓸 수 없는 환경 */
  }
}

export function loadHistory() {
  const hst = read(KEYS.history);
  return Array.isArray(hst) ? hst : [];
}
export function addHistory(entry) {
  const list = loadHistory();
  list.unshift(entry);
  write(KEYS.history, list.slice(0, 30));
}

/** 저장된 진행이 지금 설정의 임무인지 확인하는 열쇠 */
export function missionKey(setup) {
  return hash32(setup.seed, setup.tagSeed, setup.difficulty, setup.rooms.map((r) => r.id).join('|'), JSON.stringify(setup.roleOf || {}));
}

// ---------- 다른 기기로 설정 보내기 (#c=…) ----------
// 서버가 없으므로 설정을 통째로 주소에 담는다. 받는 기기는 저장하고 바로 임무를 연다.
// 암호가 아니다. 아이가 주소만 보고 보물 위치를 읽지 못하게 가볍게 가리는 정도다.

const MASK = [0x3c, 0x71, 0x0e, 0x5b, 0x22, 0x47, 0x69, 0x14];

function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 설정을 주소에 붙일 글자로 바꾼다. 받는 쪽에서 바로 시작하도록 ready 를 켠다. */
export function encodeSetup(setup) {
  const slim = Object.assign({}, setup, { ready: true });
  const bytes = new TextEncoder().encode(JSON.stringify(slim));
  return toBase64Url(bytes.map((b, i) => b ^ MASK[i % MASK.length]));
}

/** encodeSetup 의 반대. 읽을 수 없으면 null. */
export function decodeSetup(text) {
  try {
    const bytes = fromBase64Url(text).map((b, i) => b ^ MASK[i % MASK.length]);
    const s = JSON.parse(new TextDecoder().decode(bytes));
    if (!s || s.v !== 1 || !Array.isArray(s.rooms) || !s.rooms.length) return null;
    return Object.assign(defaultSetup(), s);
  } catch (e) {
    return null;
  }
}

/**
 * 링크로 보내기 전에 임무를 정한다. 이 기기에서 이미 끝낸 임무 번호면 새 임무(새 씨앗, 다음 번호)로 바꾼다.
 * "아이에게 폰 건네기"(setup/main.js 의 handOff)와 같은 규칙이다. 바뀌었으면 true.
 */
export function freshMission(setup) {
  if (!loadHistory().some((x) => x.missionNo === setup.missionNo)) return false;
  setup.missionNo = (setup.missionNo | 0) + 1;
  setup.seed = newSeed();
  return true;
}
