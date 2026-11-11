// 장면 시험대: 장면 하나를 사건 없이 띄운다. 검증 스크립트는 window.__lab 을 쓴다.
import { h } from '../shared/dom.js';
import { makeRng } from '../shared/prng.js';
import { SLOT_LABELS } from '../shared/content.js';
import { SCENES, mountScene } from './scenes/index.js';
import { audio } from './audio.js';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') || 1);
const d = Number(q.get('d') || 1);

/** 장면마다 시험용 값. 씨앗에 따라 정답이 달라진다. */
function sample(type) {
  const rng = makeRng(seed * 977 + type.length);
  switch (type) {
    case 'clock': {
      const answer = rng.int(3);
      return { type, hour: 14 + answer, options: SLOT_LABELS.slice(), answer, mirrored: d >= 1 };
    }
    case 'dust': {
      const options = rng.shuffle([0, 1, 2, 3]);
      const pattern = rng.int(4);
      return { type, pattern, options, answer: options.indexOf(pattern) };
    }
    case 'fingerprint': {
      const options = rng.shuffle([0, 1, 2]);
      const printType = rng.int(3);
      return { type, printType, options, answer: options.indexOf(printType), rotate: rng.range(-40, 40) };
    }
    case 'uv':
      return { type, marks: 3 + d };
    case 'cctv':
      return { type, count: q.has('count') ? Number(q.get('count')) : rng.int(5), max: 4 };
    case 'shred':
      return { type, lines: ['출입 기록', '오후 3시', '거실', '곰돌이'], pieces: d >= 2 ? 9 : 6 };
    default:
      return { type };
  }
}

const stage = document.getElementById('stage');
const log = document.getElementById('log');
const state = { type: null, done: 0, misses: 0, sfx: [], data: null };
let scene = null;

function open(type) {
  if (scene) scene.destroy();
  stage.replaceChildren();
  Object.assign(state, { type, done: 0, misses: 0, sfx: [], data: sample(type) });
  scene = mountScene(stage, {
    data: state.data,
    rng: makeRng(seed),
    done() {
      state.done++;
      show();
    },
    miss() {
      state.misses++;
      show();
    },
    sfx(name) {
      state.sfx.push(name);
      audio.sfx(name);
    },
    buzz() {},
  });
  show();
}

function show() {
  log.textContent = `${state.type} · 완료 ${state.done} · 실수 ${state.misses} · ${JSON.stringify(state.data)}`;
}

const bar = document.getElementById('bar');
for (const type of Object.keys(SCENES)) {
  bar.append(h('button', { class: 'btn', type: 'button', text: type, onClick: () => open(type) }));
}
bar.append(h('button', { class: 'btn gold', type: 'button', text: '자동 풀이', onClick: () => scene && scene.solve() }));
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });

window.__lab = { state, open, solve: () => scene && scene.solve(), destroy: () => scene && (scene.destroy(), (scene = null)) };
open(q.get('scene') || 'clock');
