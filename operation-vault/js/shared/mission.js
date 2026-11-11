// 작전 코드: 부모 폰에서 만들어 아이 폰으로 넘기는 12자리 코드.
// 난수 씨앗과 난이도만 담는다. 보물 정보는 부모 폰에만 남는다.
//
// 구성 (7바이트): 버전 1 + 씨앗 4 + 옵션 1 + CRC 1
// 옵션 비트: 난이도(2) | 보안 토큰 사용(1) | 제한 시간 프리셋(3) | 예약(2)

import { encodeBase32, decodeBase32, cleanBase32, crc8 } from './codec.js';

export const MISSION_VERSION = 1;

/** 제한 시간 프리셋 (분). 옵션의 3비트로 고른다. */
export const TIME_PRESETS_MIN = [8, 10, 12, 15, 18, 20, 25, 30];

/** 난이도 프리셋. 설정 화면의 슬라이더 0~2 에 대응한다. */
export const DIFFICULTIES = [
  { name: '쉬움', icon: '🟢', timePreset: 5 },
  { name: '보통', icon: '🟡', timePreset: 3 },
  { name: '어려움', icon: '🔴', timePreset: 2 },
];

export function encodeMission({ seed, difficulty, token, timePreset }) {
  const options =
    ((difficulty & 3) << 6) | ((token ? 1 : 0) << 5) | ((timePreset & 7) << 2);
  const body = [
    MISSION_VERSION,
    (seed >>> 24) & 255,
    (seed >>> 16) & 255,
    (seed >>> 8) & 255,
    seed & 255,
    options,
  ];
  return formatCode(encodeBase32([...body, crc8(body)]));
}

/** 코드를 해석한다. 형식이 틀리거나 오타가 있으면 null. */
export function decodeMission(text) {
  const clean = cleanBase32(text);
  if (clean.length !== 12) return null;
  const bytes = decodeBase32(clean, 7);
  if (!bytes) return null;
  // 마지막 글자의 남는 비트까지 정확해야 한다 (그 자리의 오타도 걸러 낸다)
  if (encodeBase32(bytes) !== clean) return null;
  const body = bytes.slice(0, 6);
  if (crc8(body) !== bytes[6]) return null;
  if (body[0] !== MISSION_VERSION) return null;
  const seed = ((body[1] << 24) | (body[2] << 16) | (body[3] << 8) | body[4]) >>> 0;
  const options = body[5];
  const difficulty = (options >>> 6) & 3;
  if (difficulty > 2) return null;
  return {
    v: body[0],
    seed,
    difficulty,
    token: ((options >>> 5) & 1) === 1,
    timePreset: (options >>> 2) & 7,
    code: formatCode(clean),
  };
}

/** 12자리를 4자리씩 끊어 보여 준다: K7QF-2M9X-D4TP */
export function formatCode(text) {
  const clean = cleanBase32(text);
  return clean.replace(/(.{4})(?=.)/g, '$1-');
}

/** 새 작전의 씨앗. 부모 폰에서만 호출한다. */
export function randomSeed() {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) {
    return c.getRandomValues(new Uint32Array(1))[0] >>> 0;
  }
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
