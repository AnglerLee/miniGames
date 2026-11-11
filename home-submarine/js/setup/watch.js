// 5단계: 관찰 준비. 부모의 예측과 지켜보는 법, 다른 기기로 보내는 링크.
// "아이에게 폰 건네기"는 아래 고정 버튼이 맡는다 (main.js 의 handOff).

import { h } from '../shared/dom.js';
import { DIFFICULTY } from '../shared/content.js';
import { encodeSetup, freshMission } from '../shared/store.js';
import { shareBox } from '../../../assets/js/share-box.js';
import { state, firstProblem, STEPS } from './state.js';
import { choiceGroup } from './ui.js';

export const QUESTIONS = [
  { k: 'damage', q: '선체가 얼마나 깎일까요?', opts: [[0, '한 칸도 안 깎인다'], [1, '한두 칸'], [2, '세 칸 이상']] },
  { k: 'retry', q: '가라앉아서 다시 도전할까요?', opts: [[0, '없이 끝낸다'], [1, '한 번은 가라앉는다']] },
  { k: 'hardest', q: '가장 힘들어할 단계는?', opts: [['dive', '잠항'], ['deep', '심해'], ['salvage', '보물 인양'], ['rise', '긴급 부상']] },
];

/** 다른 기기에서 열 주소. 받는 쪽은 설정을 저장하고 바로 임무를 연다. */
export function shareUrl(setup) {
  return new URL('play.html', location.href).href + '#c=' + encodeSetup(setup);
}

export function renderWatch(ctx) {
  const s = state.setup;
  const wiz = state.wiz;
  const D = DIFFICULTY[s.difficulty] || DIFFICULTY[1];
  // 세 문항을 다 고르기 전에는 setup.predict 를 비워 둔다 (리포트는 세 값이 다 있어야 비교한다)
  const current = () => s.predict || wiz.predict || {};
  const doneLine = h('p', { class: 'small predict-done', id: 'predict-done' });
  const paintDone = () => {
    const n = QUESTIONS.filter((q) => current()[q.k] != null).length;
    doneLine.textContent = n === QUESTIONS.length ? '✓ 예측을 적어 두었어요. 끝나고 실제와 비교해 드려요.' : n + ' / ' + QUESTIONS.length + ' 골랐어요';
    doneLine.classList.toggle('ok', n === QUESTIONS.length);
  };
  const pick = (k, v) => {
    const p = Object.assign({}, current(), { [k]: v });
    if (QUESTIONS.every((q) => p[q.k] != null)) {
      s.predict = { damage: p.damage, retry: p.retry, hardest: p.hardest };
      wiz.predict = {};
    } else {
      s.predict = null;
      wiz.predict = p;
    }
    paintDone();
    ctx.changed();
  };
  paintDone();

  const tip = (ico, title, text) => h('li', {}, h('span', { class: 'ico', 'aria-hidden': 'true', text: ico }), h('div', {}, h('b', { text: title }), text ? h('span', { class: 'small muted', text }) : null));
  const who = String(s.captain || '').trim();

  return [
    h(
      'section',
      { class: 'card', id: 'predict' },
      h('h2', {}, '관찰자 예측 ', h('span', { class: 'small muted', text: '(선택)' })),
      h('p', { class: 'soft small', style: { marginBottom: '12px' }, text: '아이가 어떻게 할지 골라 두세요. 끝나고 관찰 리포트에서 실제와 비교해 드려요.' }),
      QUESTIONS.map((q) =>
        h(
          'div',
          { class: 'predict-q', 'data-q': q.k },
          h('span', { class: 'label', text: q.q }),
          choiceGroup(
            q.opts.map(([value, label]) => ({ value, label, props: { 'data-v': String(value) } })),
            current()[q.k],
            (v) => pick(q.k, v),
            'choices ' + (q.opts.length === 2 ? 'grid2' : q.opts.length === 4 ? 'grid2' : 'auto')
          )
        )
      ),
      doneLine
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', { text: '지켜보는 법' }),
      h(
        'ul',
        { class: 'watch-list' },
        tip('🤐', '끼어들지 않기', '놓쳐도 게임이 다시 기회를 줍니다. 가라앉으면 더 넉넉한 시간으로 다시 해요.'),
        tip('👀', '무엇부터 고치는지, 외울 때 어떻게 하는지 지켜봐 주세요', '두 곳이 함께 고장 날 때와 기호를 외워 옮길 때 아이만의 방법이 보여요.'),
        tip('🚨', '비상시: 게임 메뉴 > 부모 메뉴 > 확인 번호 ' + s.pin, '단계를 넘기거나 임무를 끝내고 보물을 공개할 수 있어요.')
      )
    ),
    h(
      'section',
      { class: 'card ready-card' },
      h('h2', { text: '준비 끝' }),
      h('p', { class: 'soft', id: 'ready-line', text: '임무 No.' + s.missionNo + ' · ' + D.name + ' · 방 ' + s.rooms.length + '곳' + (who ? ' · ' + who + ' 함장' : '') }),
      h('p', { class: 'small muted', style: { marginTop: '6px' }, text: '아래 "아이에게 폰 건네기"를 누르면 아이 화면으로 바뀌어요. 이 폰을 아이에게 건네 주세요.' })
    ),
    shareCard(ctx),
  ];
}

/** 아이가 다른 기기(태블릿, 아이 폰)로 할 때. 펼칠 때 링크를 만들어서 방금 고른 예측까지 담는다. */
function shareCard(ctx) {
  const slot = h('div', { id: 'share-slot', style: { marginTop: '10px' } });
  return h(
    'details',
    {
      class: 'card share',
      id: 'share',
      onToggle: (e) => {
        if (!e.currentTarget.open) return;
        const s = state.setup;
        // 덜 끝난 단계가 있으면 링크를 만들지 않는다 (쪽지를 덜 붙인 채 아이가 시작하지 않게)
        const p = firstProblem();
        if (p) {
          slot.replaceChildren(
            h('p', { class: 'why', id: 'share-problem', text: (p.step + 1) + '단계 "' + STEPS[p.step] + '"를 먼저 끝내 주세요. ' + p.text }),
            h('button', { class: 'btn small', type: 'button', onClick: () => ctx.go(p.step) }, '그 단계로 가기')
          );
          return;
        }
        // 이 기기에서 이미 끝낸 임무면 새 임무로 바꿔서 보낸다 (아이 폰에 건넬 때와 같은 규칙)
        if (freshMission(s)) {
          const line = document.getElementById('ready-line');
          if (line) line.textContent = line.textContent.replace(/No\.\d+/, 'No.' + s.missionNo);
        }
        // 링크를 만든 임무는 준비가 끝난 것으로 본다 (부모 대시보드에서 다시 보낼 수 있게)
        s.ready = true;
        ctx.changed();
        slot.replaceChildren(shareBox({ url: shareUrl(s), title: '잠수함 간식호', text: '임무 No.' + s.missionNo + ' 링크야. 눌러서 출항해!' }));
      },
    },
    h('summary', {}, '📨 다른 기기로 보내기'),
    h('p', { class: 'soft small', style: { margin: '6px 0 0' }, text: '아이가 태블릿이나 자기 폰으로 할 때 이 링크를 보내 주세요. 링크를 연 기기에서 임무가 바로 시작되고, 기록과 관찰 리포트도 그 기기에 남아요.' }),
    slot
  );
}
