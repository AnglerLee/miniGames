// 증거 조사: 소개 → 손으로 조사하는 장면 → "새로운 사실" 카드.
// 장면은 scenes/index.js 규격대로 띄우고, 판을 닫을 때는 반드시 destroy() 한다.

import { h, buzz, toast } from '../shared/dom.js';
import { saveRun } from '../shared/store.js';
import { stream } from '../shared/prng.js';
import { evidenceTitle, evidenceIcon, evidenceIntro, factText } from '../shared/text.js';
import { mountScene } from './scenes/index.js';
import { G, commit, log, markUnseen, evidenceTag, tagDone } from './game.js';
import { openOverlay, findOverlay } from './overlay.js';
import { celebrate } from './fx.js';
import { audio } from './audio.js';

/** 장면을 몇 번 띄우고 몇 번 치웠는지 (타이머가 쌓이지 않는지 검증할 때 본다) */
export const sceneStats = { mounted: 0, destroyed: 0 };

const TIPS = {
  time: '정리표에 사건 시각이 표시됐어.',
  cfoot: '수첩에서 용의자들의 발자국 무늬와 맞춰 봐.',
  cprint: '수첩에서 용의자들의 지문 모양과 맞춰 봐.',
};

export function openEvidence(i, isNew) {
  const cs = G.cs;
  const ev = cs.evidence[i];
  const tag = evidenceTag(i);
  const room = cs.rooms[ev.room];
  const ov = openOverlay('evidence', { title: evidenceTitle(cs, ev), cls: 'ev' });
  ov.index = i;
  ov.view = 'intro';

  let scene = null;
  let alive = true;
  let finished = false;
  let waiters = [];

  function destroyScene() {
    if (!scene) return;
    const sc = scene;
    scene = null;
    try {
      sc.destroy();
    } finally {
      sceneStats.destroyed++;
    }
  }

  function setView(view, ...children) {
    ov.view = view;
    ov.sheet.dataset.view = view;
    ov.body.replaceChildren(...children);
    ov.body.scrollTop = 0;
  }

  function showIntro() {
    setView(
      'intro',
      h(
        'div',
        { class: 'ev-intro' },
        h('div', { class: 'ev-icon', 'aria-hidden': 'true', text: evidenceIcon(ev) }),
        h('h3', { text: evidenceTitle(cs, ev) }),
        h('span', { class: 'chip', text: room.icon + ' ' + room.name }),
        h('p', { class: 'ev-intro-text', text: evidenceIntro(cs, ev) }),
        h('button', { class: 'btn primary block ev-start', type: 'button', text: '🔎 조사 시작', onClick: startScene })
      )
    );
  }

  function startScene() {
    destroyScene();
    finished = false;
    const root = h('div', { class: 'scene-root' });
    setView('scene', h('div', { class: 'card scene-box' }, root));
    audio.sfx('open');
    const found = G.run.found[tag.id];
    scene = mountScene(root, {
      data: ev.scene,
      rng: stream(cs.seed, 'scene', ev.id),
      done() {
        if (!alive || finished) return;
        finished = true;
        // 장면이 done 을 부른 그 자리에서 자기 자신을 치우지 않게 한 박자 미룬다
        queueMicrotask(complete);
      },
      miss() {
        if (!alive || finished) return;
        found.misses = (found.misses || 0) + 1;
        saveRun(G.run);
      },
      sfx: (name) => audio.sfx(name),
      buzz,
    });
    sceneStats.mounted++;
  }

  function complete() {
    if (!alive) return;
    destroyScene();
    const found = G.run.found[tag.id];
    if (!found.done) {
      found.done = true;
      log('scene', { tag: tag.id, misses: found.misses || 0 });
      markUnseen();
      commit('scene');
    }
    audio.sfx('fact');
    buzz([30, 40, 80]);
    showFact(true);
  }

  function showFact(fresh) {
    const tip = TIPS[ev.fact.kind];
    setView(
      'fact',
      h(
        'div',
        { class: 'ev-fact' + (fresh ? ' fresh' : '') },
        h('div', { class: 'card fact-card' },
          h('span', { class: 'stamp fact-stamp', text: '새로운 사실' }),
          h('div', { class: 'fact-head' }, h('span', { class: 'fact-icon', text: evidenceIcon(ev) }), h('b', { text: evidenceTitle(cs, ev) })),
          h('p', { class: 'fact-text', text: factText(cs, ev) }),
          h('p', { class: 'fact-room soft', text: '📍 ' + room.name + '에서 찾은 증거' })
        ),
        tip ? h('p', { class: 'fact-tip', text: '💡 ' + tip }) : null,
        h('button', {
          class: 'btn gold block fact-ok',
          type: 'button',
          text: fresh ? '✎ 수첩에 적기' : '닫기',
          onClick: () => {
            ov.close();
            if (fresh) toast('수첩에 적었어', 'good');
          },
        })
      )
    );
    if (fresh) setTimeout(() => alive && audio.sfx('stamp'), 260);
    waiters.splice(0).forEach((fn) => fn(true));
  }

  ov.onClose = () => {
    alive = false;
    destroyScene();
    waiters.splice(0).forEach((fn) => fn(false));
  };

  /** 검증용: 장면을 풀고 사실 카드까지 */
  ov.solve = () => {
    if (ov.view === 'fact') return Promise.resolve(true);
    if (ov.view === 'intro') startScene();
    const p = new Promise((resolve) => {
      waiters.push(resolve);
      setTimeout(() => resolve(ov.view === 'fact'), 5000);
    });
    if (scene) scene.solve();
    return p;
  };

  if (tagDone(tag)) showFact(false);
  else showIntro();
  if (isNew) celebrate(ov.sheet, { title: '증거 쪽지 발견!', tag });
  return ov;
}

/** 열려 있는 증거 장면을 풀고 사실 카드까지 넘긴다 (검증 손잡이) */
export function solveOpenScene() {
  const ov = findOverlay('evidence');
  return ov ? ov.solve() : Promise.resolve(false);
}
