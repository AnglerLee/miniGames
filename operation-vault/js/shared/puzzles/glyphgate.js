// 1단계 정문 게이트: 문양 해독.
// 아이 화면의 단말기에 이름 없는 문양 4개가 뜬다. 부모의 문양 사전에는 문양마다 숫자가 있다.
// 아이가 생김새를 말로 설명하면 부모가 찾아서 숫자를 불러 주고, 아이가 키패드에 입력한다.
//
// 문양 = 테두리 + 안쪽 무늬 + 아래 점 개수. 사전의 절반은 다른 문양과 한 군데만 달라서
// 대충 설명하면 틀린다. 보통 이상 난이도에서는 문양 색에 따라 숫자를 더한다.

import { stream } from '../prng.js';

export const id = 'gate';
export const kind = 'lookup';

export const FRAMES = [
  { id: 'circle', name: '원' },
  { id: 'square', name: '네모' },
  { id: 'triangle', name: '세모' },
  { id: 'diamond', name: '마름모' },
  { id: 'hexagon', name: '육각형' },
];

export const MARKS = [
  { id: 'plus', name: '십자' },
  { id: 'x', name: '엑스' },
  { id: 'hbar', name: '가로줄 하나' },
  { id: 'hbar2', name: '가로줄 둘' },
  { id: 'vbar', name: '세로줄 하나' },
  { id: 'vbar2', name: '세로줄 둘' },
  { id: 'zig', name: '번개' },
  { id: 'chevron', name: '꺾쇠' },
];

export const MAX_PIPS = 3;
const CODE_LENGTH = 4;

// 난이도별: 사전 항목 수, 쓰는 색 수(0 이면 색 규칙 없음), 문양이 바뀌기까지의 시간(초)
const CONFIG = [
  { entries: 12, colors: 0, sessionSec: 120 },
  { entries: 16, colors: 3, sessionSec: 90 },
  { entries: 20, colors: 5, sessionSec: 75 },
];

const glyphKey = (g) => g.frame * 100 + g.mark * 10 + g.pips;

export function manual(ctx) {
  const cfg = CONFIG[ctx.difficulty];
  const rng = stream(ctx.seed, id, 'manual', ctx.channel);
  const seen = new Set();
  const glyphs = [];
  const add = (g) => {
    const k = glyphKey(g);
    if (seen.has(k)) return;
    seen.add(k);
    glyphs.push(g);
  };

  const half = cfg.entries / 2;
  while (glyphs.length < half) {
    add({ frame: rng.int(FRAMES.length), mark: rng.int(MARKS.length), pips: rng.int(MAX_PIPS + 1) });
  }
  // 나머지 절반: 앞의 문양에서 한 군데만 바꾼 헷갈리는 문양
  for (let i = 0; glyphs.length < cfg.entries; i++) {
    const g = { ...glyphs[i % half] };
    const feature = rng.int(3);
    if (feature === 0) g.frame = (g.frame + 1 + rng.int(FRAMES.length - 1)) % FRAMES.length;
    else if (feature === 1) g.mark = (g.mark + 1 + rng.int(MARKS.length - 1)) % MARKS.length;
    else g.pips = (g.pips + 1 + rng.int(MAX_PIPS)) % (MAX_PIPS + 1);
    add(g);
  }

  const entries = glyphs.map((g) => ({ ...g, digit: rng.int(10) }));
  entries.sort((a, b) => glyphKey(a) - glyphKey(b)); // 테두리별로 모아서 보여 준다

  // 색 보정: 문양이 이 색이면 숫자에 add 를 더한다 (10 이상이면 일의 자리만)
  let colors = [];
  if (cfg.colors > 0) {
    const picked = rng.sample([0, 1, 2, 3, 4], cfg.colors);
    const adds = rng.sample([0, 1, 2, 3, 4, 5], cfg.colors);
    colors = picked.map((c, i) => ({ c, add: adds[i] }));
    colors.sort((a, b) => a.c - b.c);
  }
  return { entries, colors, sessionSec: cfg.sessionSec };
}

export function device(ctx, attempt) {
  const m = manual(ctx);
  const rng = stream(ctx.seed, id, 'device', ctx.channel, attempt);
  const picked = rng.sample(m.entries, CODE_LENGTH);
  const glyphs = [];
  const code = [];
  for (const e of picked) {
    const color = m.colors.length ? rng.pick(m.colors) : null;
    glyphs.push({ frame: e.frame, mark: e.mark, pips: e.pips, color: color ? color.c : -1 });
    code.push((e.digit + (color ? color.add : 0)) % 10);
  }
  return { glyphs, code, sessionSec: m.sessionSec };
}

export function createSim(dev) {
  let status = 'open';
  let entered = [];
  return {
    view: () => ({ glyphs: dev.glyphs, entered: entered.slice(), length: CODE_LENGTH }),
    act(action) {
      if (status !== 'open') return { status, events: [] };
      if (action.type === 'clear') {
        entered = [];
        return { status, events: [{ type: 'cleared' }] };
      }
      if (action.type !== 'digit') return { status, events: [] };
      entered.push(action.d);
      if (entered.length < CODE_LENGTH) return { status, events: [{ type: 'key', d: action.d }] };
      const ok = entered.every((d, i) => d === dev.code[i]);
      status = ok ? 'solved' : 'fault';
      return { status, events: [{ type: ok ? 'granted' : 'denied' }] };
    },
  };
}

/** 매뉴얼로 문양 하나의 숫자를 구한다. 사전에 없으면 -1. */
export function lookup(m, glyph) {
  const e = m.entries.find((x) => glyphKey(x) === glyphKey(glyph));
  if (!e) return -1;
  const color = m.colors.find((x) => x.c === glyph.color);
  return (e.digit + (color ? color.add : 0)) % 10;
}

export function solve(m, sim) {
  let result = { status: 'open' };
  for (const g of sim.view().glyphs) result = sim.act({ type: 'digit', d: lookup(m, g) });
  return result.status;
}

export function audit(m, dev) {
  const problems = [];
  const keys = m.entries.map(glyphKey);
  if (new Set(keys).size !== keys.length) problems.push('사전에 같은 문양이 두 번 나옴');
  if (dev.glyphs.length !== CODE_LENGTH) problems.push('문양이 4개가 아님');
  for (const g of dev.glyphs) {
    if (!keys.includes(glyphKey(g))) problems.push('사전에 없는 문양이 나옴');
    if (m.colors.length === 0 && g.color !== -1) problems.push('색 규칙이 없는데 색이 있음');
    if (m.colors.length > 0 && !m.colors.some((x) => x.c === g.color)) {
      problems.push('보정표에 없는 색이 나옴');
    }
  }
  return problems;
}
