// 진행 상태 리듀서 테스트: 시간, 경보, 발각, 등급.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reduce, initialRun, rulesFor, rankOf, bonusUnlocked } from '../js/shared/run.js';

const mission = { seed: 1, difficulty: 1, token: true, timePreset: 3, code: 'TEST-TEST-TEST' };
const rules = rulesFor(mission);

/** 이벤트를 차례로 적용하고 마지막 상태와 모든 효과를 돌려준다. */
function play(state, events, r = rules) {
  const effects = [];
  for (const e of events) {
    const out = reduce(state, typeof e === 'string' ? { type: e } : e, r);
    state = out.state;
    effects.push(...out.effects);
  }
  return { state, effects };
}

const types = (effects) => effects.map((e) => e.type);
const begin = () => play(initialRun(mission, rules), ['START', 'COMMS_OK', 'INTRO_DONE']).state;

test('시작: 교신 점검을 거쳐 첫 단계가 시작된다', () => {
  let s = initialRun(mission, rules);
  assert.equal(s.phase, 'BRIEFING');
  assert.equal(s.remainingMs, 15 * 60000);
  s = play(s, ['START']).state;
  assert.equal(s.phase, 'COMMS');
  // 교신 점검 중에는 시계가 가지 않는다
  assert.equal(play(s, [{ type: 'TICK', dt: 5000 }]).state.remainingMs, s.remainingMs);
  s = play(s, ['COMMS_OK']).state;
  assert.equal(s.phase, 'INTRO');
  assert.equal(s.stage, 1);
  s = play(s, ['INTRO_DONE']).state;
  assert.equal(s.phase, 'ACTIVE');
});

test('시계는 진행 중에만 줄어든다', () => {
  let s = begin();
  s = play(s, [{ type: 'TICK', dt: 1000 }]).state;
  assert.equal(s.remainingMs, rules.totalMs - 1000);
});

test('실수: 경보가 오르고 시간이 깎이고 장치가 다시 섞인다', () => {
  const out = play(begin(), [{ type: 'MISTAKE', reason: 'wrong-code' }]);
  assert.equal(out.state.alarm, 1);
  assert.equal(out.state.mistakes, 1);
  assert.equal(out.state.attempt, 1);
  assert.equal(out.state.remainingMs, rules.totalMs - rules.mistakeMs);
  assert.deepEqual(types(out.effects), ['ALARM', 'TIME_HIT', 'REROLL', 'PERSIST']);
  // 채널은 그대로다: 부모는 아무것도 하지 않아도 된다
  assert.equal(out.state.channel, 0);
});

test('세션 만료 같은 가벼운 재배치는 경보를 올리지 않는다', () => {
  const out = play(begin(), ['SOFT_REROLL']);
  assert.equal(out.state.alarm, 0);
  assert.equal(out.state.attempt, 1);
  assert.deepEqual(types(out.effects), ['REROLL']);
});

test('단계를 통과하면 경보가 한 단계 내려가고 다음 단계로 간다', () => {
  let s = play(begin(), ['MISTAKE', 'MISTAKE']).state;
  assert.equal(s.alarm, 2);
  const out = play(s, ['STAGE_SOLVED']);
  assert.equal(out.state.phase, 'CLEAR');
  assert.equal(out.state.alarm, 1);
  assert.ok(types(out.effects).includes('STAGE_CLEAR'));
  s = play(out.state, ['NEXT']).state;
  assert.equal(s.stage, 2);
  assert.equal(s.phase, 'INTRO');
  assert.equal(s.attempt, 0);
});

test('경보가 최대에 닿으면 발각된다', () => {
  const out = play(begin(), ['MISTAKE', 'MISTAKE', 'MISTAKE', 'MISTAKE', 'MISTAKE']);
  assert.equal(out.state.phase, 'CAUGHT');
  assert.equal(out.effects.filter((e) => e.type === 'CAUGHT')[0].reason, 'alarm');
  // 발각 중에는 더 이상 실수가 쌓이지 않는다
  assert.equal(play(out.state, ['MISTAKE']).state.alarm, 5);
});

test('시간이 0 이 되면 발각된다', () => {
  const out = play(begin(), [{ type: 'TICK', dt: rules.totalMs + 5 }]);
  assert.equal(out.state.phase, 'CAUGHT');
  assert.equal(out.state.remainingMs, 0);
  assert.equal(out.effects[0].reason, 'time');
});

test('실수의 시간 벌점으로 시간이 바닥나도 발각된다', () => {
  let s = play(begin(), [{ type: 'TICK', dt: rules.totalMs - 10000 }]).state;
  const out = play(s, ['MISTAKE']);
  assert.equal(out.state.phase, 'CAUGHT');
  assert.equal(out.state.remainingMs, 0);
});

test('발각 뒤: 같은 단계, 새 채널, 최소 시간 보장', () => {
  let s = play(begin(), ['STAGE_SOLVED', 'NEXT', 'INTRO_DONE']).state;
  assert.equal(s.stage, 2);
  s = play(s, [{ type: 'TICK', dt: rules.totalMs }]).state;
  assert.equal(s.phase, 'CAUGHT');
  const out = play(s, ['CAUGHT_ACK']);
  assert.equal(out.state.phase, 'INTRO');
  assert.equal(out.state.stage, 2);
  assert.equal(out.state.channel, 1);
  assert.equal(out.state.captures, 1);
  assert.equal(out.state.alarm, rules.captureAlarm);
  assert.equal(out.state.remainingMs, rules.captureMinMs);
  assert.ok(types(out.effects).includes('REKEY'));
});

test('발각 때 시간이 넉넉히 남아 있으면 그대로 둔다', () => {
  const s = play(begin(), ['MISTAKE', 'MISTAKE', 'MISTAKE', 'MISTAKE', 'MISTAKE', 'CAUGHT_ACK']).state;
  assert.equal(s.remainingMs, rules.totalMs - 5 * rules.mistakeMs);
});

test('끝까지 가면 금고가 열리고 등급이 매겨진다', () => {
  let s = begin();
  for (const stage of rules.order) {
    assert.equal(s.stage, stage);
    const out = play(s, ['STAGE_SOLVED']);
    if (stage === 5) {
      assert.equal(out.state.phase, 'OPENED');
      assert.equal(out.state.rank, 'S');
      assert.deepEqual(out.effects[0], { type: 'FINISHED', rank: 'S' });
      s = out.state;
    } else {
      s = play(out.state, ['NEXT', 'INTRO_DONE']).state;
    }
  }
  assert.equal(s.stageLog.length, rules.order.length);
});

test('토큰을 끄면 토큰 단계를 건너뛴다', () => {
  const r = rulesFor({ ...mission, token: false });
  assert.deepEqual(r.order, [1, 2, 3, 5]);
  let s = play(initialRun(mission, r), ['START', 'COMMS_OK', 'INTRO_DONE'], r).state;
  s = play(s, ['STAGE_SOLVED', 'NEXT', 'INTRO_DONE', 'STAGE_SOLVED', 'NEXT', 'INTRO_DONE'], r).state;
  assert.equal(s.stage, 3);
  s = play(s, ['STAGE_SOLVED', 'NEXT'], r).state;
  assert.equal(s.stage, 5);
});

test('우회 코드는 단계를 넘기지만 등급이 내려간다', () => {
  const out = play(begin(), ['SUPPORT']);
  assert.equal(out.state.phase, 'CLEAR');
  assert.equal(out.state.support, 1);
  assert.equal(out.state.stageLog[0].skipped, true);
  assert.equal(rankOf(out.state, rules), 'B');
});

test('등급 기준', () => {
  const base = { captures: 0, support: 0, mistakes: 0, remainingMs: rules.totalMs };
  assert.equal(rankOf(base, rules), 'S');
  assert.equal(rankOf({ ...base, mistakes: 1 }, rules), 'S');
  assert.equal(rankOf({ ...base, mistakes: 2 }, rules), 'A');
  assert.equal(rankOf({ ...base, remainingMs: rules.totalMs * 0.2 }, rules), 'A');
  assert.equal(rankOf({ ...base, captures: 1 }, rules), 'B');
  assert.equal(rankOf({ ...base, captures: 2 }, rules), 'C');
  assert.equal(bonusUnlocked('S'), true);
  assert.equal(bonusUnlocked('A'), true);
  assert.equal(bonusUnlocked('B'), false);
});

test('새로고침 뒤 복귀: 진행 중이던 단계의 처음으로, 장치는 다시 섞인다', () => {
  const s = play(begin(), [{ type: 'TICK', dt: 60000 }]).state;
  const out = play(s, ['RESUMED']);
  assert.equal(out.state.phase, 'INTRO');
  assert.equal(out.state.attempt, 1);
  assert.equal(out.state.remainingMs, s.remainingMs);
  // 발각 화면에서 새로고침하면 발각 화면 그대로다
  const caughtState = play(begin(), [{ type: 'TICK', dt: rules.totalMs }]).state;
  assert.equal(play(caughtState, ['RESUMED']).state.phase, 'CAUGHT');
});

test('엉뚱한 때의 이벤트는 무시된다', () => {
  const s = initialRun(mission, rules);
  for (const e of ['COMMS_OK', 'INTRO_DONE', 'MISTAKE', 'STAGE_SOLVED', 'NEXT', 'CAUGHT_ACK', 'SUPPORT']) {
    assert.equal(play(s, [e]).state, s, e);
  }
  assert.equal(play(s, ['모르는 이벤트']).state, s);
});
