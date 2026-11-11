// 수리 놀이 시험대: 놀이 하나를 임무 없이 띄운다. 검증 스크립트는 window.__lab 을 쓴다.
import { h } from '../shared/dom.js';
import { makeRng } from '../shared/prng.js';
import { ROLES } from '../shared/content.js';
import { TASK_MODULES, mountTask } from './tasks/index.js';
import { audio } from './audio.js';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') || 1);
const level = Number(q.get('level') || 1);

const stage = document.getElementById('stage');
const log = document.getElementById('log');
const state = { type: null, done: 0, misses: 0, sfx: [], data: null, startedAt: 0, tookMs: null };
let task = null;

function open(type) {
  if (task) task.destroy();
  stage.replaceChildren();
  Object.assign(state, { type, done: 0, misses: 0, sfx: [], data: { type, level }, startedAt: performance.now(), tookMs: null });
  task = mountTask(stage, {
    data: state.data,
    rng: makeRng(seed * 131 + type.length),
    color: ROLES[seed % ROLES.length].color,
    done() {
      state.done++;
      if (state.tookMs === null) state.tookMs = Math.round(performance.now() - state.startedAt);
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
  log.textContent = `${state.type} · 완료 ${state.done} · 실수 ${state.misses} · 난이도 ${level}` + (state.tookMs !== null ? ` · ${(state.tookMs / 1000).toFixed(1)}초` : '');
}

const bar = document.getElementById('bar');
for (const type of Object.keys(TASK_MODULES)) {
  bar.append(h('button', { class: 'btn', type: 'button', text: type, onClick: () => open(type) }));
}
bar.append(h('button', { class: 'btn warn', type: 'button', text: '자동 수리', onClick: () => task && task.solve() }));
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });

window.__lab = { state, open, solve: () => task && task.solve(), destroy: () => task && (task.destroy(), (task = null)) };
open(q.get('task') || 'valve');
