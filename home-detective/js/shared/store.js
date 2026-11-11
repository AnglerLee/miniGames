// 저장: 설정과 진행 상태는 localStorage, 사진은 IndexedDB 에 둔다.
// 사진은 이 기기 밖으로 나가지 않는다.

import { hash32 } from './prng.js';
import { DIFFICULTY, ROOM_PRESETS, SUSPECT_PRESETS } from './content.js';

export const KEYS = {
  setup: 'minigames:homeDetective_setup',
  run: 'minigames:homeDetective_run',
  history: 'minigames:homeDetective_history',
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

function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    /* 저장소를 쓸 수 없는 환경 */
  }
}

/** 새 사건 씨앗 */
export function newSeed() {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}

/**
 * 처음 여는 부모에게 보여 줄 기본 설정.
 * placed: 쪽지 id → { done, hint, photo }   (배치를 마쳤는지, 숨긴 곳 힌트 글, 힌트 사진 열쇠)
 * predict: 부모의 예측 { time, hints, first } 또는 null
 */
export function defaultSetup() {
  return {
    v: 1,
    detective: '',
    difficulty: 1,
    minutes: DIFFICULTY[1].minutes,
    rooms: ROOM_PRESETS.slice(0, 5).map((r, i) => ({ id: 'r' + (i + 1), name: r.name, icon: r.icon })),
    suspects: SUSPECT_PRESETS.slice(0, 6).map((s, i) => ({ id: 's' + (i + 1), name: s.name, icon: s.icon, photo: null })),
    crimeRoom: null,
    treasure: { kind: 'place', text: '' },
    bonus: { text: '', rule: 'A' },
    pin: '0000',
    seed: newSeed(),
    placed: {},
    predict: null,
    ready: false,
    caseNo: 1,
  };
}

export function loadSetup() {
  const s = read(KEYS.setup);
  if (!s || s.v !== 1 || !Array.isArray(s.rooms) || !Array.isArray(s.suspects)) return null;
  return Object.assign(defaultSetup(), s);
}
export function saveSetup(setup) {
  return write(KEYS.setup, setup);
}

export function loadRun() {
  const r = read(KEYS.run);
  return r && r.v === 1 ? r : null;
}
export function saveRun(run) {
  return write(KEYS.run, run);
}
export function clearRun() {
  remove(KEYS.run);
}

/** 지난 사건 기록 (최근 것이 앞) */
export function loadHistory() {
  const hst = read(KEYS.history);
  return Array.isArray(hst) ? hst : [];
}
export function addHistory(entry) {
  const list = loadHistory();
  list.unshift(entry);
  write(KEYS.history, list.slice(0, 30));
}

/** 저장된 진행 상태가 지금 설정의 사건인지 확인하는 열쇠 */
export function caseKey(setup) {
  return hash32(
    setup.seed,
    setup.difficulty,
    setup.rooms.map((r) => r.id + r.name).join('|'),
    setup.suspects.map((s) => s.id + s.name).join('|'),
    setup.crimeRoom || ''
  );
}

// ---------- 사진 (IndexedDB) ----------

const DB_NAME = 'minigames:homeDetective';
const STORE = 'photos';
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('이 브라우저는 사진을 저장할 수 없어요.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(req ? req.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

const urlCache = new Map();

export const photos = {
  /** 사진을 저장한다. key 예: 'suspect:s1', 'tag:e:e2' */
  put(key, blob) {
    if (urlCache.has(key)) {
      URL.revokeObjectURL(urlCache.get(key));
      urlCache.delete(key);
    }
    return tx('readwrite', (store) => store.put(blob, key));
  },
  /** 없으면 null */
  get(key) {
    return tx('readonly', (store) => store.get(key)).then((v) => v || null, () => null);
  },
  /** <img src> 에 쓸 주소. 없으면 null. 같은 열쇠는 같은 주소를 돌려준다. */
  async url(key) {
    if (!key) return null;
    if (urlCache.has(key)) return urlCache.get(key);
    const blob = await photos.get(key);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(key, url);
    return url;
  },
  del(key) {
    if (urlCache.has(key)) {
      URL.revokeObjectURL(urlCache.get(key));
      urlCache.delete(key);
    }
    return tx('readwrite', (store) => store.delete(key)).catch(() => {});
  },
  /** 열쇠가 prefix 로 시작하는 사진을 모두 지운다 (새 사건을 만들 때 지난 힌트 사진 정리) */
  async clearPrefix(prefix) {
    try {
      const keys = await tx('readonly', (store) => store.getAllKeys());
      await Promise.all(keys.filter((k) => String(k).startsWith(prefix)).map((k) => photos.del(k)));
    } catch (e) {
      /* 사진 저장소가 없는 환경 */
    }
  },
};

/**
 * 고른 사진 파일을 줄여서 Blob 으로 만든다 (긴 변 maxSide px, JPEG).
 * 폰 카메라 원본은 수 MB 라서 그대로 두면 저장 공간이 금방 찬다.
 */
export function shrinkImage(file, maxSide = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('사진을 바꾸지 못했어요.'))), 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('사진을 읽지 못했어요.'));
    };
    img.src = url;
  });
}

// ---------- 다른 폰으로 설정 보내기 (사진 제외) ----------

const MASK = [0x5a, 0x21, 0x7c, 0x13, 0x48, 0x66, 0x09, 0x3d];

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

/**
 * 설정을 주소에 붙일 글자로 바꾼다. 사진은 빠지고, 눈으로 읽히지 않게 가볍게 가린다.
 * (암호가 아니다. 아이가 주소만 보고 보물 위치를 읽지 못하게 하는 정도다.)
 */
export function encodeSetup(setup) {
  const slim = JSON.parse(JSON.stringify(setup));
  slim.suspects.forEach((s) => {
    s.photo = null;
  });
  Object.values(slim.placed || {}).forEach((p) => {
    p.photo = null;
  });
  const bytes = new TextEncoder().encode(JSON.stringify(slim));
  return toBase64Url(bytes.map((b, i) => b ^ MASK[i % MASK.length]));
}

/** encodeSetup 의 반대. 읽을 수 없으면 null. */
export function decodeSetup(text) {
  try {
    const bytes = fromBase64Url(text).map((b, i) => b ^ MASK[i % MASK.length]);
    const s = JSON.parse(new TextDecoder().decode(bytes));
    if (!s || s.v !== 1 || !Array.isArray(s.rooms) || !Array.isArray(s.suspects)) return null;
    return Object.assign(defaultSetup(), s);
  } catch (e) {
    return null;
  }
}
