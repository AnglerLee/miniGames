// 시간, 벌점, 등급, 설정 주고받기 검증
import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, newRun, elapsedMs, remainingMs, computeScore, bonusUnlocked, clock, summarize } from '../js/shared/score.js';
import { encodeSetup, decodeSetup, defaultSetup, caseKey } from '../js/shared/store.js';

const MIN = 60000;

test('시간: 멈춘 동안은 흐르지 않고, 벌은 남은 시간에서 깎인다', () => {
  const run = newRun(1, 30 * MIN, 1000);
  assert.equal(elapsedMs(run, 1000 + 5 * MIN), 5 * MIN);
  assert.equal(remainingMs(run, 1000 + 5 * MIN), 25 * MIN);
  run.pauseAt = 1000 + 5 * MIN;
  assert.equal(elapsedMs(run, 1000 + 9 * MIN), 5 * MIN);
  run.pausedMs += 4 * MIN;
  run.pauseAt = null;
  assert.equal(elapsedMs(run, 1000 + 10 * MIN), 6 * MIN);
  run.penaltyMs += RULES.wrongMs;
  assert.equal(remainingMs(run, 1000 + 10 * MIN), 30 * MIN - 6 * MIN - RULES.wrongMs);
  run.solvedAt = 1000 + 12 * MIN;
  assert.equal(elapsedMs(run, 1000 + 50 * MIN), 8 * MIN);
});

test('등급: 빨리 깔끔하게 풀면 S, 힌트와 오답이 쌓이면 내려간다', () => {
  const run = newRun(1, 30 * MIN, 0);
  run.solvedAt = 12 * MIN;
  assert.equal(computeScore(run, 0).grade, 'S');
  assert.equal(computeScore(run, 0).score, 100);

  run.hints.push({ level: 1 }, { level: 2 });
  assert.equal(computeScore(run, 0).score, 100 - RULES.hintScore[0] - RULES.hintScore[1]);
  assert.equal(computeScore(run, 0).grade, 'A');

  run.accusations.push({ result: 'wrong' }, { result: 'deny' });
  const s = computeScore(run, 0);
  assert.equal(s.parts.wrong, RULES.wrongScore);
  assert.equal(s.parts.deny, RULES.denyScore);
  assert.equal(s.grade, 'B');
});

test('등급: 시간을 넘기면 B 가 최고다', () => {
  const run = newRun(1, 20 * MIN, 0);
  run.solvedAt = 21 * MIN;
  const s = computeScore(run, 0);
  assert.ok(s.late);
  assert.equal(s.grade, 'B');
  assert.equal(s.parts.slow, RULES.slowScore);
  assert.equal(s.parts.late, RULES.lateScore);
});

test('등급: 느리게 풀수록 조금씩 깎인다', () => {
  const at = (min) => {
    const run = newRun(1, 20 * MIN, 0);
    run.solvedAt = min * MIN;
    return computeScore(run, 0).score;
  };
  assert.equal(at(10), 100);
  assert.equal(at(14), 100);
  assert.ok(at(17) < at(14));
  assert.ok(at(19.9) < at(17));
});

test('보너스 기준', () => {
  assert.ok(bonusUnlocked('S', 'A'));
  assert.ok(bonusUnlocked('A', 'A'));
  assert.ok(!bonusUnlocked('B', 'A'));
  assert.ok(!bonusUnlocked('A', 'S'));
  assert.ok(bonusUnlocked('C', 'always'));
});

test('시계 표시', () => {
  assert.equal(clock(0), '00:00');
  assert.equal(clock(65000), '01:05');
  assert.equal(clock(-61000), '+01:01');
});

test('요약: 찾은 순서와 가장 오래 막힌 구간', () => {
  const run = newRun(1, 30 * MIN, 0);
  run.found['s:s1'] = { at: 1 * MIN };
  run.found['e:e1'] = { at: 2 * MIN };
  run.found['e:e2'] = { at: 9 * MIN };
  run.solvedAt = 12 * MIN;
  const sum = summarize(run, 0);
  assert.deepEqual(sum.finds.map((f) => f.id), ['s:s1', 'e:e1', 'e:e2']);
  assert.equal(sum.longestGapMs, 7 * MIN);
  assert.equal(sum.longestGapAfter, 'e:e1');
  assert.equal(sum.firstKind, 'suspect');
});

test('설정을 글자로 바꿨다가 되돌리면 같다 (사진은 빠진다)', () => {
  const setup = defaultSetup();
  setup.detective = '지우';
  setup.treasure = { kind: 'place', text: '세탁기 안 🧺' };
  setup.suspects[0].photo = 'suspect:s1';
  setup.placed['e:e1'] = { done: true, hint: '소파 쿠션 밑', photo: 'tag:e:e1' };
  const text = encodeSetup(setup);
  assert.match(text, /^[A-Za-z0-9_-]+$/);
  assert.ok(!text.includes('세탁기'));
  const back = decodeSetup(text);
  assert.equal(back.detective, '지우');
  assert.equal(back.treasure.text, '세탁기 안 🧺');
  assert.equal(back.suspects[0].photo, null);
  assert.equal(back.placed['e:e1'].photo, null);
  assert.equal(back.placed['e:e1'].hint, '소파 쿠션 밑');
  assert.equal(back.seed, setup.seed);
  assert.equal(caseKey(back), caseKey(setup));
  assert.equal(decodeSetup('엉터리'), null);
  assert.equal(decodeSetup(''), null);
});
