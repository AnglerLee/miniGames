// 2단계 환기 덕트: 길 찾기.
// 아이는 1인칭으로 덕트 미로 안에 있다. 부모에게는 설계도가 있지만 아이가 어디서
// 어느 쪽을 보고 있는지 모른다. 아이가 눈앞의 표식을 말해 주면 부모가 위치와 방향을
// 알아내고, 감지선을 피해 출구까지 가는 길을 불러 준다. 감지선은 설계도에만 보인다.
//
// 좌표: x 는 오른쪽으로, y 는 아래로 커진다. 방향 번호는 0 북, 1 동, 2 남, 3 서.

import { stream } from '../prng.js';
import { allTags } from '../tags.js';

export const id = 'duct';
export const kind = 'guide';

export const DIRS = [
  { dx: 0, dy: -1, bit: 1 },
  { dx: 1, dy: 0, bit: 2 },
  { dx: 0, dy: 1, bit: 4 },
  { dx: -1, dy: 0, bit: 8 },
];

/** 표식이 보이는 최대 거리 (칸). 덕트 안은 어두워서 멀리는 보이지 않는다. */
export const SIGHT = 4;

// 난이도별: 크기, 추가로 뚫는 통로 수, 감지선 수, 표식 수, 스프레이 횟수
const CONFIG = [
  { w: 4, h: 4, loops: 3, wires: 2, tags: 6, sprays: 3 },
  { w: 5, h: 5, loops: 4, wires: 3, tags: 8, sprays: 3 },
  { w: 6, h: 6, loops: 6, wires: 5, tags: 10, sprays: 2 },
];

const idx = (m, x, y) => y * m.w + x;
const inside = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;

/** (x, y) 칸에서 dir 방향으로 통로가 뚫려 있는가. */
export function isOpen(m, x, y, dir) {
  return (m.open[idx(m, x, y)] & DIRS[dir].bit) !== 0;
}

/** 통로를 한쪽 표기로 통일한다: 항상 동쪽(1) 또는 남쪽(2) 방향으로 적는다. */
function edgeOf(x, y, dir) {
  if (dir === 0) return { x, y: y - 1, dir: 2 };
  if (dir === 3) return { x: x - 1, y, dir: 1 };
  return { x, y, dir };
}
const edgeKey = (e) => e.x * 1000 + e.y * 10 + e.dir;

/** (x, y) 에서 dir 방향 통로에 감지선이 있는가. */
export function hasWire(m, x, y, dir) {
  const k = edgeKey(edgeOf(x, y, dir));
  return m.wires.some((w) => edgeKey(w) === k);
}

/**
 * 감지선을 지나지 않고 갈 수 있는 거리를 구한다 (너비 우선 탐색).
 * blocked 는 추가로 막을 통로의 키 집합.
 */
function distances(m, fromX, fromY, blocked) {
  const dist = new Array(m.w * m.h).fill(-1);
  const prev = new Array(m.w * m.h).fill(-1);
  const queue = [idx(m, fromX, fromY)];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const x = cur % m.w;
    const y = Math.floor(cur / m.w);
    for (let d = 0; d < 4; d++) {
      if (!isOpen(m, x, y, d)) continue;
      if (blocked.has(edgeKey(edgeOf(x, y, d)))) continue;
      const n = idx(m, x + DIRS[d].dx, y + DIRS[d].dy);
      if (dist[n] >= 0) continue;
      dist[n] = dist[cur] + 1;
      prev[n] = cur;
      queue.push(n);
    }
  }
  return { dist, prev };
}

const wireSet = (m) => new Set(m.wires.map(edgeKey));

export function manual(ctx) {
  const cfg = CONFIG[ctx.difficulty];
  const rng = stream(ctx.seed, id, 'manual', ctx.channel);
  const m = { w: cfg.w, h: cfg.h, open: new Array(cfg.w * cfg.h).fill(0), wires: [] };

  const carve = (x, y, d) => {
    m.open[idx(m, x, y)] |= DIRS[d].bit;
    m.open[idx(m, x + DIRS[d].dx, y + DIRS[d].dy)] |= DIRS[(d + 2) % 4].bit;
  };

  // 1) 깊이 우선 탐색으로 길이 하나뿐인 미로를 만든다
  const visited = new Array(cfg.w * cfg.h).fill(false);
  const stack = [{ x: rng.int(cfg.w), y: rng.int(cfg.h) }];
  visited[idx(m, stack[0].x, stack[0].y)] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = rng
      .shuffle([0, 1, 2, 3])
      .filter((d) => {
        const nx = cur.x + DIRS[d].dx;
        const ny = cur.y + DIRS[d].dy;
        return inside(m, nx, ny) && !visited[idx(m, nx, ny)];
      });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const d = options[0];
    carve(cur.x, cur.y, d);
    const next = { x: cur.x + DIRS[d].dx, y: cur.y + DIRS[d].dy };
    visited[idx(m, next.x, next.y)] = true;
    stack.push(next);
  }

  // 2) 벽을 몇 군데 더 뚫어 돌아가는 길을 만든다 (감지선을 피할 다른 길이 필요하다)
  const closedWalls = [];
  for (let y = 0; y < cfg.h; y++) {
    for (let x = 0; x < cfg.w; x++) {
      for (const d of [1, 2]) {
        if (inside(m, x + DIRS[d].dx, y + DIRS[d].dy) && !isOpen(m, x, y, d)) {
          closedWalls.push({ x, y, d });
        }
      }
    }
  }
  for (const wall of rng.sample(closedWalls, cfg.loops)) carve(wall.x, wall.y, wall.d);

  // 3) 출구
  m.exit = { x: rng.int(cfg.w), y: rng.int(cfg.h) };

  // 4) 표식: 막힌 벽면에 붙인다. 한 칸에 하나, 출구 칸은 제외
  const faces = [];
  for (let y = 0; y < cfg.h; y++) {
    for (let x = 0; x < cfg.w; x++) {
      if (x === m.exit.x && y === m.exit.y) continue;
      const walls = [0, 1, 2, 3].filter((d) => !isOpen(m, x, y, d));
      if (walls.length) faces.push({ x, y, dir: rng.pick(walls) });
    }
  }
  const names = rng.shuffle(allTags());
  m.tags = rng.sample(faces, cfg.tags).map((f, i) => ({ ...f, c: names[i].c, s: names[i].s }));
  m.tags.sort((a, b) => idx(m, a.x, a.y) - idx(m, b.x, b.y));

  // 5) 감지선: 출구로 가는 가장 짧은 길 위에 놓아 돌아가게 만든다.
  //    단, 감지선을 모두 피해도 모든 칸이 이어져 있어야 한다.
  const start0 = farthestTag(m);
  for (let n = 0; n < cfg.wires; n++) {
    const blocked = wireSet(m);
    const { prev } = distances(m, start0.x, start0.y, blocked);
    const onPath = [];
    for (let cur = idx(m, m.exit.x, m.exit.y); prev[cur] >= 0; cur = prev[cur]) {
      const p = prev[cur];
      const px = p % m.w;
      const py = Math.floor(p / m.w);
      const d = [0, 1, 2, 3].find(
        (k) => idx(m, px + DIRS[k].dx, py + DIRS[k].dy) === cur && isOpen(m, px, py, k)
      );
      onPath.push(edgeOf(px, py, d));
    }
    const everyEdge = [];
    for (let y = 0; y < cfg.h; y++) {
      for (let x = 0; x < cfg.w; x++) {
        for (const d of [1, 2]) if (isOpen(m, x, y, d)) everyEdge.push({ x, y, dir: d });
      }
    }
    const candidates = [...rng.shuffle(onPath), ...rng.shuffle(everyEdge)];
    const chosen = candidates.find((e) => {
      if (blocked.has(edgeKey(e))) return false;
      const trial = new Set(blocked);
      trial.add(edgeKey(e));
      return distances(m, 0, 0, trial).dist.every((v) => v >= 0);
    });
    if (!chosen) break;
    m.wires.push(chosen);
  }
  m.wires.sort((a, b) => edgeKey(a) - edgeKey(b));

  // 6) 출발 후보: 출구에서 충분히 먼 표식들. 실수하면 다른 후보로 옮겨진다.
  const { dist } = distances(m, m.exit.x, m.exit.y, wireSet(m));
  const ranked = m.tags
    .map((t, i) => ({ i, d: dist[idx(m, t.x, t.y)] }))
    .sort((a, b) => b.d - a.d || a.i - b.i);
  const minDist = Math.floor((cfg.w + cfg.h) / 2);
  let starts = ranked.filter((r) => r.d >= minDist);
  if (starts.length < 3) starts = ranked.slice(0, 3);
  m.starts = starts.map((r) => r.i);
  m.sprays = cfg.sprays;
  return m;
}

/** 출구에서 가장 먼 표식 (감지선 배치의 기준 출발점). */
function farthestTag(m) {
  const { dist } = distances(m, m.exit.x, m.exit.y, new Set());
  let best = m.tags[0];
  for (const t of m.tags) {
    if (dist[idx(m, t.x, t.y)] > dist[idx(m, best.x, best.y)]) best = t;
  }
  return best;
}

export function device(ctx, attempt) {
  const m = manual(ctx);
  const rng = stream(ctx.seed, id, 'device', ctx.channel);
  const order = rng.shuffle(m.starts);
  const tag = m.tags[order[attempt % order.length]];
  // 표식이 붙은 벽을 정면으로 보고 시작한다
  return { maze: m, start: { x: tag.x, y: tag.y, heading: tag.dir } };
}

/** 정면으로 곧게 봤을 때 보이는 표식과 거리. 없으면 null. */
export function tagAhead(m, x, y, heading) {
  let cx = x;
  let cy = y;
  for (let dist = 0; dist <= SIGHT; dist++) {
    if (!isOpen(m, cx, cy, heading)) {
      const t = m.tags.find((k) => k.x === cx && k.y === cy && k.dir === heading);
      return t ? { tag: { c: t.c, s: t.s }, dist } : null;
    }
    cx += DIRS[heading].dx;
    cy += DIRS[heading].dy;
  }
  return null;
}

export function createSim(dev) {
  const m = dev.maze;
  let { x, y, heading } = dev.start;
  let sprays = m.sprays;
  let status = 'open';

  const view = () => ({
    // 몸 기준 방향: 왼쪽, 앞, 오른쪽, 뒤
    open: {
      left: isOpen(m, x, y, (heading + 3) % 4),
      front: isOpen(m, x, y, heading),
      right: isOpen(m, x, y, (heading + 1) % 4),
      back: isOpen(m, x, y, (heading + 2) % 4),
    },
    ahead: tagAhead(m, x, y, heading),
    sprays,
  });

  return {
    view,
    /** 화면 표시용: 현재 위치. 풀이기는 쓰지 않는다. */
    pose: () => ({ x, y, heading }),
    act(action) {
      if (status !== 'open') return { status, events: [] };
      switch (action.type) {
        case 'turn': {
          const delta = action.dir === 'left' ? 3 : action.dir === 'right' ? 1 : 2;
          heading = (heading + delta) % 4;
          return { status, events: [{ type: 'turned', heading }] };
        }
        case 'forward': {
          if (!isOpen(m, x, y, heading)) return { status, events: [{ type: 'bump' }] };
          if (hasWire(m, x, y, heading)) {
            status = 'fault';
            return { status, events: [{ type: 'trip', x, y, dir: heading }] };
          }
          x += DIRS[heading].dx;
          y += DIRS[heading].dy;
          if (x === m.exit.x && y === m.exit.y) {
            status = 'solved';
            return { status, events: [{ type: 'moved', x, y }, { type: 'exit' }] };
          }
          return { status, events: [{ type: 'moved', x, y }] };
        }
        case 'spray': {
          if (sprays <= 0) return { status, events: [{ type: 'empty' }] };
          sprays--;
          const found = [0, 1, 2, 3].filter((d) => isOpen(m, x, y, d) && hasWire(m, x, y, d));
          return { status, events: [{ type: 'sprayed', x, y, dirs: found }] };
        }
        default:
          return { status, events: [] };
      }
    },
  };
}

/** 매뉴얼(설계도)과 아이가 볼 수 있는 것만으로 푼다. */
export function solve(m, sim) {
  // 출발할 때는 표식이 붙은 벽을 정면으로 보고 있다: 표식으로 위치와 방향을 알아낸다
  const seen = sim.view().ahead;
  if (!seen || seen.dist !== 0) return 'lost';
  const tag = m.tags.find((t) => t.c === seen.tag.c && t.s === seen.tag.s);
  if (!tag) return 'lost';
  let heading = tag.dir;

  const { dist, prev } = distances(m, m.exit.x, m.exit.y, wireSet(m));
  let cur = idx(m, tag.x, tag.y);
  if (dist[cur] < 0) return 'unreachable';
  let result = { status: 'open' };
  while (prev[cur] >= 0) {
    const next = prev[cur]; // 출구에서부터 탐색했으므로 prev 가 출구 쪽이다
    const x = cur % m.w;
    const y = Math.floor(cur / m.w);
    const want = [0, 1, 2, 3].find((d) => idx(m, x + DIRS[d].dx, y + DIRS[d].dy) === next);
    const turn = (want - heading + 4) % 4;
    if (turn === 1) sim.act({ type: 'turn', dir: 'right' });
    else if (turn === 3) sim.act({ type: 'turn', dir: 'left' });
    else if (turn === 2) sim.act({ type: 'turn', dir: 'back' });
    heading = want;
    result = sim.act({ type: 'forward' });
    if (result.status === 'fault') return 'fault';
    cur = next;
  }
  return result.status;
}

export function audit(m, dev) {
  const problems = [];
  const names = m.tags.map((t) => t.c * 10 + t.s);
  if (new Set(names).size !== names.length) problems.push('같은 표식이 두 번 나옴');
  for (const t of m.tags) {
    if (isOpen(m, t.x, t.y, t.dir)) problems.push('표식이 뚫린 통로 쪽에 붙어 있음');
  }
  if (m.wires.length === 0) problems.push('감지선이 하나도 없음');
  const { dist } = distances(m, m.exit.x, m.exit.y, wireSet(m));
  if (dist.some((v) => v < 0)) problems.push('감지선을 피하면 갈 수 없는 칸이 있음');
  if (m.starts.length < 2) problems.push('출발 후보가 2개 미만');
  const s = dev.start;
  const ahead = tagAhead(m, s.x, s.y, s.heading);
  if (!ahead || ahead.dist !== 0) problems.push('출발 위치에서 표식이 정면에 보이지 않음');
  if (s.x === m.exit.x && s.y === m.exit.y) problems.push('출발 위치가 출구임');
  return problems;
}
