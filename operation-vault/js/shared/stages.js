// 단계 목록과, 주파수로 매뉴얼을 찾는 연결 고리.
// 두 페이지가 모두 이 파일을 통해 퍼즐 내용을 만들어 낸다.

import { digest } from './canon.js';
import { encodeSync, decodeSync } from './synccode.js';
import * as commscheck from './puzzles/commscheck.js';
import * as glyphgate from './puzzles/glyphgate.js';
import * as ductmaze from './puzzles/ductmaze.js';
import * as powergrid from './puzzles/powergrid.js';
import * as tokengate from './puzzles/tokengate.js';
import * as vaultdial from './puzzles/vaultdial.js';

/** 번호가 곧 주파수에 들어가는 단계 번호다. 순서를 바꾸면 안 된다. */
export const STAGES = [
  { id: 'comms', name: '교신 점검', puzzle: commscheck },
  { id: 'gate', name: '정문 게이트', puzzle: glyphgate },
  { id: 'duct', name: '환기 덕트', puzzle: ductmaze },
  { id: 'power', name: '전력실', puzzle: powergrid },
  { id: 'token', name: '보안 토큰', puzzle: tokengate },
  { id: 'vault', name: '금고실', puzzle: vaultdial },
];

export function ctxFor(mission, stage, channel) {
  return { seed: mission.seed, stage, channel, difficulty: mission.difficulty };
}

export function manualFor(mission, stage, channel) {
  return STAGES[stage].puzzle.manual(ctxFor(mission, stage, channel));
}

export function deviceFor(mission, stage, channel, attempt) {
  return STAGES[stage].puzzle.device(ctxFor(mission, stage, channel), attempt);
}

/** 아이 화면에 띄울 주파수. 매뉴얼 지문이 들어 있다. */
export function frequencyFor(mission, stage, channel) {
  const check = digest(manualFor(mission, stage, channel)) % 100;
  return encodeSync(mission, stage, channel, check);
}

/**
 * 부모가 입력한 주파수로 매뉴얼을 찾는다.
 * 숫자를 잘못 들었거나 두 폰의 내용이 어긋나 있으면 ok 가 false.
 */
export function tune(mission, code) {
  const decoded = decodeSync(mission, code);
  if (!decoded || decoded.stage >= STAGES.length) return { ok: false };
  if (decoded.stage === 4 && !mission.token) return { ok: false };
  const manual = manualFor(mission, decoded.stage, decoded.channel);
  if (digest(manual) % 100 !== decoded.check) return { ok: false };
  return { ok: true, stage: decoded.stage, channel: decoded.channel, manual };
}
