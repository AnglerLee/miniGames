// 두 폰이 말로 주고받는 숫자 코드.
//  - 주파수 (4자리): 아이 화면에 뜨고 부모가 입력한다. 단계, 채널, 매뉴얼 지문이 들어 있다.
//  - 개봉 코드 (4자리): 금고를 열면 아이 화면에 뜬다. 등급이 들어 있다.
//  - 우회 코드 (3자리): 부모 화면에 뜨고 아이가 입력한다. 막힌 단계를 건너뛴다.
//  - 토큰 번호 (4자리): 부모가 쪽지에 적어 집 안에 숨긴다.

import { hash32 } from './prng.js';

export const STAGE_COUNT = 6; // 0 교신 점검, 1 게이트, 2 덕트, 3 전력실, 4 토큰, 5 금고
export const CHANNEL_COUNT = 16;
const CHECK_COUNT = 100;
const STATES = STAGE_COUNT * CHANNEL_COUNT * CHECK_COUNT; // 9600
const MOD = 10000;

export const RANKS = ['S', 'A', 'B', 'C'];

/** 씨앗마다 다른 일대일 섞기 규칙 (n -> a*n + b mod 10000). */
function affine(seed) {
  let a = 1 + 2 * (hash32(seed, 'sync-a') % 5000);
  while (a % 5 === 0) a = (a + 2) % MOD; // 10000 과 서로소여야 되돌릴 수 있다
  const b = hash32(seed, 'sync-b') % MOD;
  return { a, b };
}

/** a * x ≡ 1 (mod m) 인 x 를 구한다. */
function modInverse(a, m) {
  let [oldR, r] = [a, m];
  let [oldS, s] = [1, 0];
  while (r !== 0) {
    const q = Math.floor(oldR / r);
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  return ((oldS % m) + m) % m;
}

const pad = (n, len) => String(n).padStart(len, '0');

export function encodeSync(mission, stage, channel, check) {
  const n = stage * (CHANNEL_COUNT * CHECK_COUNT) + channel * CHECK_COUNT + check;
  const { a, b } = affine(mission.seed);
  return pad((a * n + b) % MOD, 4);
}

/** 주파수를 해석한다. 있을 수 없는 값이면 null. */
export function decodeSync(mission, code) {
  if (!/^\d{4}$/.test(String(code))) return null;
  const { a, b } = affine(mission.seed);
  const n = (modInverse(a, MOD) * ((Number(code) - b + MOD) % MOD)) % MOD;
  if (n >= STATES) return null;
  return {
    stage: Math.floor(n / (CHANNEL_COUNT * CHECK_COUNT)),
    channel: Math.floor(n / CHECK_COUNT) % CHANNEL_COUNT,
    check: n % CHECK_COUNT,
  };
}

/** 등급별 개봉 코드 네 개. 서로 겹치지 않는다. */
function openCodes(mission) {
  const used = new Set();
  return RANKS.map((rank) => {
    let n = hash32(mission.seed, 'open', rank) % MOD;
    while (used.has(n)) n = (n + 1) % MOD;
    used.add(n);
    return pad(n, 4);
  });
}

export function encodeOpen(mission, rank) {
  return openCodes(mission)[RANKS.indexOf(rank)];
}

/** 개봉 코드를 확인하고 등급을 돌려준다. 틀리면 null. */
export function decodeOpen(mission, code) {
  const i = openCodes(mission).indexOf(String(code));
  return i < 0 ? null : RANKS[i];
}

/** 해당 단계의 우회 코드. 채널이 바뀌면 코드도 바뀐다. */
export function supportCode(mission, kind, stage, channel) {
  return pad(hash32(mission.seed, 'support', kind, stage, channel) % 1000, 3);
}

/** 쪽지에 적을 토큰 번호 (1000~9999). */
export function tokenNumber(mission) {
  return String(1000 + (hash32(mission.seed, 'token') % 9000));
}
