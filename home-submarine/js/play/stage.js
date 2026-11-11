// 단계 사이 화면: 첫 브리핑(표지 → 이야기 → 잠수함 지도 → 하는 법), 단계 안내, 단계 완료, 실패, 준비 안 됨.
// 걷기 전에 서서 읽는 화면이다. 한 장에 한 가지만 말하고, 그 단계에서 처음 나오는 것은 그림 한 컷으로 보여 준다.

import { h } from '../shared/dom.js';
import { STAGES, PARTS, RELAY_SYMBOLS } from '../shared/content.js';
import { depth } from '../shared/engine.js';
import { briefing, howTo, stageTitle } from '../shared/text.js';
import { G } from './game.js';
import { dot, subIcon, hullCells } from './art.js';
import { mapList, openMenu } from './menu.js';
import { audio } from './audio.js';

function screen(cls, ...children) {
  return h(
    'div',
    { class: 'screen ' + cls },
    h('button', { class: 'hud-btn screen-menu', type: 'button', 'aria-label': '메뉴', 'data-act': 'menu', onClick: openMenu }, h('b', { text: '☰' })),
    h('div', { class: 'screen-body' }, ...children)
  );
}

const bubbles = () => [1, 2, 3, 4].map((i) => h('i', { class: 'bubble b' + i }));

function hullLine(s) {
  return h('div', { class: 'hull-line' }, h('span', { text: '선체' }), hullCells(s.hull, s.hullMax), h('b', { text: s.hull + ' / ' + s.hullMax }));
}

export function notReadyScreen() {
  return h(
    'div',
    { class: 'screen notready' },
    h(
      'div',
      { class: 'screen-body' },
      h('div', { class: 'art-box' }, subIcon('art-sub'), bubbles()),
      h('h1', { text: '아직 잠수함이 준비되지 않았어' }),
      h('p', { class: 'lead', text: '부모님께 준비를 부탁해.' }),
      h('a', { class: 'btn primary block big', href: 'setup.html', text: '준비 화면으로 (부모)' }),
      h('a', { class: 'btn ghost block', href: 'index.html', text: '처음으로' })
    )
  );
}

// ---------- 첫 브리핑 ----------

export function briefScreen(onBoard) {
  const setup = G.setup;
  const body = h('div', { class: 'brief-page' });
  const dots = [0, 1, 2, 3].map(() => h('i'));
  let page = 0;
  const next = (label) =>
    h('button', {
      class: 'btn primary block big',
      type: 'button',
      'data-act': 'next',
      text: label,
      onClick: () => {
        audio.unlock();
        audio.sfx('page');
        show(page + 1);
      },
    });

  const pages = [
    () => [
      h('div', { class: 'art-box cover-art' }, subIcon('art-sub'), bubbles()),
      h('p', { class: 'kicker', text: '임무 No.' + (setup.missionNo || 1) }),
      h('h1', { class: 'cover-title', text: '잠수함 간식호' }),
      h('p', { class: 'cover-captain', text: (setup.captain ? setup.captain + ' 함장' : '함장') + ', 출동 준비!' }),
      next('브리핑 듣기'),
    ],
    () => [h('p', { class: 'kicker', text: '브리핑' }), h('div', { class: 'story' }, briefing(setup.captain).map((t, i) => h('p', { style: { '--i': i }, text: t }))), next('다음')],
    () => [
      h('p', { class: 'kicker', text: '잠수함 지도' }),
      h('h2', { class: 'page-title', text: '방마다 구역이 됐어' }),
      mapList(),
      h('p', { class: 'soft hint', text: '경보의 색과 그림을 보고 그 방으로 가.' }),
      next('다음'),
    ],
    () => [
      h('p', { class: 'kicker', text: '하는 법' }),
      h('ol', { class: 'how' }, howTo().map((t) => h('li', { text: t }))),
      h('div', { class: 'safety' }, h('b', { text: '⚠️ 안전' }), h('span', { text: '뛰지 말고 빠르게 걷기. 폰을 보며 걷다 부딪히지 않게 조심' })),
      h('button', { class: 'btn primary block big', type: 'button', 'data-act': 'board', text: '출항 준비', onClick: onBoard }),
    ],
  ];

  function show(n) {
    page = Math.min(n, pages.length - 1);
    body.replaceChildren(...pages[page]());
    body.dataset.page = page;
    dots.forEach((d, i) => d.classList.toggle('on', i === page));
    body.classList.remove('turn');
    void body.offsetWidth;
    body.classList.add('turn');
  }

  const el = screen('brief', body, h('div', { class: 'page-dots' }, dots));
  show(0);
  return el;
}

// ---------- 단계 안내 ----------

function miniCard(st, sec, level = 'ok') {
  return h(
    'div',
    { class: 'mini-card', 'data-level': level, style: { '--c': st.role.color } },
    h('span', { class: 'mc-icon', text: st.role.icon }),
    h('span', { class: 'mc-where', text: st.role.name + ' · ' + st.room.name }),
    h('b', { class: 'mc-sec', text: sec + '초' })
  );
}

const arrow = () => h('span', { class: 'flow-arrow', text: '→' });

/** 그 단계에서 처음 나오는 것을 그림 한 컷으로 */
function teach(id) {
  const S = G.stations;
  const storage = S.find((st) => st.role.id === 'storage') || S[0];
  const other = S.find((st) => st !== storage) || S[0];
  const third = S.find((st) => st !== storage && st !== other) || other;
  if (id === 'dive') {
    return h('div', { class: 'teach' }, h('div', { class: 'teach-row' }, miniCard(other, 42), h('p', { text: '경보가 뜨면 그 방으로 가서 버튼을 눌러' })));
  }
  if (id === 'deep') {
    const part = Object.values(PARTS)[0];
    return h(
      'div',
      { class: 'teach' },
      h('div', { class: 'teach-row' }, h('div', { class: 'mini-stack' }, miniCard(other, 58), miniCard(third, 12, 'red')), h('p', {}, h('b', { text: '두 곳이 한꺼번에.' }), ' 급한 것부터')),
      h(
        'div',
        { class: 'teach-row' },
        h('div', { class: 'flow' }, dot(storage), arrow(), h('span', { class: 'flow-chip', text: part.icon }), arrow(), dot(other)),
        h('p', { text: '📦 ' + storage.room.name + '(부품 창고)에서 부품을 챙겨서 가야 해' })
      )
    );
  }
  if (id === 'salvage') {
    return h(
      'div',
      { class: 'teach' },
      h(
        'div',
        { class: 'teach-row' },
        h('div', { class: 'flow' }, dot(other), h('span', { class: 'flow-chip syms', text: RELAY_SYMBOLS.slice(0, 3).join('') }), arrow(), dot(third)),
        h('p', { text: '한 방에서 기호를 보고 외워서 다른 방에 입력' })
      ),
      h(
        'div',
        { class: 'teach-row' },
        h('div', { class: 'flow' }, h('span', { class: 'flow-chip', text: '🏗️' }), [other, storage, third].map((st, i) => h('span', { class: 'flow-num' }, dot(st), h('em', { text: String(i + 1) })))),
        h('p', { text: '마지막엔 크레인 순서대로 구역을 돌아' })
      )
    );
  }
  return h(
    'div',
    { class: 'teach' },
    h('div', { class: 'teach-row' }, h('div', { class: 'flow' }, ['🔧', '📦', '👀'].map((t) => h('span', { class: 'flow-chip', text: t }))), h('p', {}, h('b', { text: '마지막 고비.' }), ' 전부 섞여 나와'))
  );
}

export function stageIntroScreen(s, onStart) {
  const st = STAGES[s.stage];
  return screen(
    'stage-intro',
    h('p', { class: 'kicker', text: '지금 수심 ' + depth(s) + 'm' }),
    h('h1', { class: 'stage-title', text: stageTitle(s.stage) }),
    h('p', { class: 'lead', text: st.lead }),
    teach(st.id),
    s.ease > 0 ? h('p', { class: 'ease', text: '다시 도전. 이번엔 시간이 더 넉넉해' }) : null,
    hullLine(s),
    h('button', { class: 'btn primary block big', type: 'button', 'data-act': 'start', text: '시작', onClick: onStart })
  );
}

// ---------- 단계 완료, 실패 ----------

export function clearScreen(s, onNext) {
  const st = STAGES[s.stage];
  const last = s.stage >= STAGES.length - 1;
  // 이번 도전에서 생긴 일만 센다 (가라앉고 다시 한 경우 앞의 기록은 빼고)
  const mine = s.log.filter((e) => e.stage === st.id && e.at >= s.stageStartedAt);
  const fixed = mine.filter((e) => e.type === 'resolve').length;
  const missed = mine.filter((e) => e.type === 'miss').length;
  const rescued = mine.some((e) => e.type === 'rescue');
  const hop = Math.round(s.hopMs / 1000);
  return screen(
    'clear',
    h('div', { class: 'stamp' }, h('span', { class: 'stamp-ring' }), h('b', { text: depth(s) + 'm' }), h('span', { text: '완료' })),
    h('h1', { class: 'clear-title' }, h('span', { text: st.name + ' 완료' }), h('span', { class: 'sep', text: ' · ' }), h('span', { text: '수심 ' + depth(s) + 'm' })),
    st.id === 'dock'
      ? h('p', { class: 'lead hop', text: '네 걸음: 구역 사이 약 ' + hop + '초. 이 걸음에 맞춰 시간을 줄게' })
      : h(
          'div',
          { class: 'tally' },
          h('div', { class: 'tally-box good' }, h('b', { text: String(fixed) }), h('span', { text: '고친 고장' })),
          h('div', { class: 'tally-box' + (missed ? ' bad' : '') }, h('b', { text: String(missed) }), h('span', { text: '놓친 고장' }))
        ),
    hullLine(s),
    rescued ? h('p', { class: 'soft', text: '부모님이 이 단계를 넘겨 줬어' }) : null,
    last ? null : h('p', { class: 'soft next-up', text: '다음: ' + stageTitle(s.stage + 1) }),
    h('button', { class: 'btn primary block big', type: 'button', 'data-act': 'next', text: last ? '물 위로!' : '다음', onClick: onNext })
  );
}

export function failedScreen(s, onRetry) {
  return screen(
    'failed',
    h('div', { class: 'art-box sink-art' }, subIcon('art-sub'), bubbles()),
    h('p', { class: 'kicker', text: stageTitle(s.stage) }),
    h('h1', { text: '선체가 버티지 못했어' }),
    h('p', { class: 'lead', text: '긴급 수리를 하고 이 단계를 다시 하자' }),
    h('p', { class: 'soft', text: '선체를 가득 채우고, 시간도 더 넉넉하게 줄게.' }),
    h('button', { class: 'btn warn block big', type: 'button', 'data-act': 'retry', text: '다시 도전', onClick: onRetry })
  );
}
