// 공용 기본 로직 테스트: 난수, 작전 코드, 주파수, 개봉 코드.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hash32, makeRng, stream } from '../js/shared/prng.js';
import { encodeBase32, decodeBase32, crc8 } from '../js/shared/codec.js';
import { encodeMission, decodeMission } from '../js/shared/mission.js';
import {
  encodeSync,
  decodeSync,
  encodeOpen,
  decodeOpen,
  supportCode,
  tokenNumber,
  RANKS,
  STAGE_COUNT,
  CHANNEL_COUNT,
} from '../js/shared/synccode.js';
import { canon, digest } from '../js/shared/canon.js';
import { STAGES, frequencyFor, tune } from '../js/shared/stages.js';

test('난수는 같은 씨앗이면 항상 같은 값을 낸다 (고정 벡터)', () => {
  // 이 값이 바뀌면 이미 만들어 둔 작전 코드의 내용이 전부 달라진다
  assert.equal(hash32('a'), hash32('a'));
  assert.notEqual(hash32('ab', 'c'), hash32('a', 'bc'));
  const rng = makeRng(12345);
  const first = [rng.next(), rng.next(), rng.next()];
  const again = makeRng(12345);
  assert.deepEqual([again.next(), again.next(), again.next()], first);
  assert.deepEqual(first, [4207900869, 1317490944, 2079646450]);
  assert.equal(hash32(1, 'gate', 'manual', 0), 3055455912);
});

test('용도별 난수 흐름은 서로 독립이다', () => {
  const a = stream(7, 'x').next();
  const b = stream(7, 'y').next();
  assert.notEqual(a, b);
  assert.equal(stream(7, 'x').next(), a);
});

test('섞기와 뽑기는 원본을 건드리지 않는다', () => {
  const rng = makeRng(1);
  const src = [1, 2, 3, 4, 5];
  const out = rng.shuffle(src);
  assert.deepEqual(src, [1, 2, 3, 4, 5]);
  assert.deepEqual(out.slice().sort(), src);
  assert.equal(rng.sample(src, 3).length, 3);
});

test('Base32 왕복', () => {
  const rng = makeRng(99);
  for (let i = 0; i < 2000; i++) {
    const bytes = Array.from({ length: 7 }, () => rng.int(256));
    const text = encodeBase32(bytes);
    assert.equal(text.length, 12);
    assert.deepEqual(decodeBase32(text, 7), bytes);
  }
  assert.equal(decodeBase32('!!!!', 2), null);
  assert.equal(crc8([1, 2, 3]), crc8([1, 2, 3]));
});

test('작전 코드 왕복 1만 건', () => {
  const rng = makeRng(2026);
  for (let i = 0; i < 10000; i++) {
    const mission = {
      seed: rng.next(),
      difficulty: rng.int(3),
      token: rng.bool(),
      timePreset: rng.int(8),
    };
    const code = encodeMission(mission);
    assert.match(code, /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    const back = decodeMission(code);
    assert.ok(back, code);
    assert.equal(back.seed, mission.seed);
    assert.equal(back.difficulty, mission.difficulty);
    assert.equal(back.token, mission.token);
    assert.equal(back.timePreset, mission.timePreset);
    assert.equal(back.code, code);
  }
});

test('작전 코드는 소문자, 띄어쓰기, 헷갈리는 글자를 받아 준다', () => {
  const code = encodeMission({ seed: 0xdeadbeef, difficulty: 1, token: true, timePreset: 3 });
  const sloppy = code.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
  assert.equal(decodeMission(sloppy).seed, 0xdeadbeef);
});

test('작전 코드의 오타는 걸러진다', () => {
  const rng = makeRng(5);
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let accepted = 0;
  const trials = 4000;
  for (let i = 0; i < trials; i++) {
    const code = encodeMission({
      seed: rng.next(),
      difficulty: rng.int(3),
      token: rng.bool(),
      timePreset: rng.int(8),
    }).replace(/-/g, '');
    const at = rng.int(12);
    let ch = alphabet[rng.int(32)];
    while (ch === code[at]) ch = alphabet[rng.int(32)];
    const typo = code.slice(0, at) + ch + code.slice(at + 1);
    if (decodeMission(typo)) accepted++;
  }
  // 한 글자 오타는 8비트 이내의 연속 오류라서 CRC-8 이 반드시 잡는다
  assert.equal(accepted, 0);
  assert.equal(decodeMission('ABCD-EFGH'), null);
  assert.equal(decodeMission(''), null);
});

test('주파수는 단계, 채널, 지문과 일대일로 대응한다', () => {
  for (const seed of [0, 1, 0xffffffff, 123456789]) {
    const mission = { seed };
    const seen = new Set();
    for (let stage = 0; stage < STAGE_COUNT; stage++) {
      for (let channel = 0; channel < CHANNEL_COUNT; channel++) {
        for (let check = 0; check < 100; check++) {
          const code = encodeSync(mission, stage, channel, check);
          assert.match(code, /^\d{4}$/);
          assert.ok(!seen.has(code), '주파수가 겹침');
          seen.add(code);
          assert.deepEqual(decodeSync(mission, code), { stage, channel, check });
        }
      }
    }
    assert.equal(seen.size, 9600);
  }
  assert.equal(decodeSync({ seed: 1 }, '12a4'), null);
  assert.equal(decodeSync({ seed: 1 }, '123'), null);
});

test('잘못 들은 주파수는 대부분 걸러진다', () => {
  const mission = { seed: 424242, difficulty: 1, token: true, timePreset: 3 };
  const real = frequencyFor(mission, 1, 0);
  assert.equal(tune(mission, real).ok, true);
  let accepted = 0;
  for (let n = 0; n < 10000; n++) {
    const code = String(n).padStart(4, '0');
    if (code !== real && tune(mission, code).ok) accepted++;
  }
  // 9600개 상태 중 지문이 맞는 것은 단계x채널 96개뿐이다
  assert.ok(accepted <= 96, `통과 ${accepted}개`);
});

test('모든 단계와 채널의 주파수가 제 매뉴얼로 이어진다', () => {
  const mission = { seed: 777, difficulty: 2, token: true, timePreset: 2 };
  for (let stage = 0; stage < STAGES.length; stage++) {
    for (let channel = 0; channel < CHANNEL_COUNT; channel++) {
      const result = tune(mission, frequencyFor(mission, stage, channel));
      assert.equal(result.ok, true);
      assert.equal(result.stage, stage);
      assert.equal(result.channel, channel);
    }
  }
});

test('토큰을 쓰지 않는 작전에서는 토큰 단계 주파수가 통하지 않는다', () => {
  const withToken = { seed: 31337, difficulty: 0, token: true, timePreset: 5 };
  const code = frequencyFor(withToken, 4, 0);
  assert.equal(tune(withToken, code).ok, true);
  assert.equal(tune({ ...withToken, token: false }, code).ok, false);
});

test('개봉 코드는 등급을 담고 서로 겹치지 않는다', () => {
  const rng = makeRng(8);
  for (let i = 0; i < 3000; i++) {
    const mission = { seed: rng.next() };
    const codes = RANKS.map((r) => encodeOpen(mission, r));
    assert.equal(new Set(codes).size, 4);
    RANKS.forEach((r, k) => assert.equal(decodeOpen(mission, codes[k]), r));
  }
  assert.equal(decodeOpen({ seed: 1 }, 'abcd'), null);
});

test('우회 코드와 토큰 번호의 형식', () => {
  const mission = { seed: 99 };
  assert.match(supportCode(mission, 'skip', 2, 0), /^\d{3}$/);
  assert.notEqual(supportCode(mission, 'skip', 2, 0), supportCode(mission, 'skip', 3, 0));
  assert.match(tokenNumber(mission), /^[1-9]\d{3}$/);
});

test('지문은 키 순서와 무관하다', () => {
  assert.equal(canon({ b: 1, a: [2, { d: 3, c: 4 }] }), canon({ a: [2, { c: 4, d: 3 }], b: 1 }));
  assert.equal(digest({ x: 1, y: 2 }), digest({ y: 2, x: 1 }));
  assert.notEqual(digest({ x: 1 }), digest({ x: 2 }));
});
