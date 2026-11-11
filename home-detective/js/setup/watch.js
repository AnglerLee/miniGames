// 6단계: 관찰 준비. 부모의 예측, 지켜보는 법, 다른 폰으로 보내는 주소.
// "아이에게 폰 건네기"는 아래 고정 버튼이 맡는다 (main.js 의 handOff).

import { h } from '../shared/dom.js';
import { encodeSetup } from '../shared/store.js';
import { DIFFICULTY } from '../shared/content.js';
import { state, stepProblem, STEPS, LAST_STEP } from './state.js';
import { choiceGroup } from './ui.js';
import { shareBox } from '../../../assets/js/share-box.js';

const QUESTIONS = [
  { k: 'time', q: '수사가 얼마나 걸릴까요?', opts: [[0, '여유 있게'], [1, '아슬아슬하게'], [2, '시간 초과']] },
  { k: 'hints', q: '무전 힌트를 몇 번 쓸까요?', opts: [[0, '안 쓴다'], [1, '한두 번'], [2, '세 번 이상']] },
  { k: 'first', q: '무엇을 먼저 찾을까요?', opts: [['suspect', '용의자'], ['evidence', '증거']] },
];

/** 다른 폰에서 열 주소. 받는 쪽은 설정을 저장하고 바로 수사를 시작한다. */
export function shareUrl(setup) {
  return new URL('play.html', location.href).href + '#c=' + encodeSetup(Object.assign({}, setup, { ready: true }));
}

export function renderWatch(ctx) {
  const s = state.setup;
  const wiz = state.wiz;
  const D = DIFFICULTY[s.difficulty] || DIFFICULTY[1];
  // 세 문항을 다 고르기 전에는 setup.predict 를 비워 둔다 (결과 화면은 세 값이 다 있어야 비교한다)
  const current = () => s.predict || wiz.predict || {};
  const doneLine = h('p', { class: 'small', id: 'predict-done', style: { marginTop: '12px', fontWeight: '800' } });
  const paintDone = () => {
    const n = QUESTIONS.filter((q) => current()[q.k] != null).length;
    doneLine.textContent = n === QUESTIONS.length ? '✓ 예측을 적어 두었어요.' : n + ' / ' + QUESTIONS.length + ' 골랐어요';
    doneLine.style.color = n === QUESTIONS.length ? 'var(--green)' : 'var(--ink-soft)';
  };
  const pick = (k, v) => {
    const p = Object.assign({}, current(), { [k]: v });
    if (QUESTIONS.every((q) => p[q.k] != null)) {
      s.predict = { time: p.time, hints: p.hints, first: p.first };
      wiz.predict = {};
    } else {
      s.predict = null;
      wiz.predict = p;
    }
    paintDone();
    ctx.changed();
  };
  paintDone();

  // 링크는 펼칠 때 만든다. 그래야 방금 고른 예측까지 담긴다.
  const shareSlot = h('div', { id: 'share-slot', style: { marginTop: '10px' } });
  const openShare = (e) => {
    if (!e.currentTarget.open) return;
    // 덜 끝난 단계가 있으면 링크를 만들지 않는다 ("아이에게 폰 건네기"와 같은 검사)
    for (let i = 1; i < LAST_STEP; i++) {
      const p = stepProblem(i);
      if (!p) continue;
      shareSlot.replaceChildren(
        h('p', { class: 'why', id: 'share-problem', text: (i + 1) + '단계 "' + STEPS[i] + '"를 먼저 끝내 주세요. ' + p.text }),
        h('button', { class: 'btn small', type: 'button', onClick: () => ctx.go(i) }, '그 단계로 가기')
      );
      return;
    }
    // 링크를 만든 사건은 준비가 끝난 것으로 본다 (부모 대시보드에서 다시 보낼 수 있게)
    state.setup.ready = true;
    ctx.changed();
    shareSlot.replaceChildren(shareBox({ url: shareUrl(state.setup), title: '우리 집 탐정', text: '사건 No.' + state.setup.caseNo + ' 링크야. 눌러서 수사를 시작해!' }));
  };

  const tip = (ico, title, text) => h('li', {}, h('span', { class: 'ico', text: ico }), h('div', {}, h('b', { text: title }), h('span', { class: 'small muted', text })));

  return [
    h(
      'section',
      { class: 'card', id: 'predict' },
      h('h2', {}, '관찰자 예측 ', h('span', { class: 'small muted', text: '(선택)' })),
      h('p', { class: 'soft small', style: { marginBottom: '12px' }, text: '아이가 어떻게 할지 하나씩 눌러 두세요. 끝나고 실제와 비교해 드려요.' }),
      QUESTIONS.map((q) =>
        h(
          'div',
          { class: 'predict-q', 'data-q': q.k },
          h('span', { class: 'label', text: q.q }),
          choiceGroup(
            q.opts.map(([value, label]) => ({ value, label, props: { 'data-v': String(value) } })),
            current()[q.k],
            (v) => pick(q.k, v),
            // 세 개짜리는 좁은 폭(320)에서 두 칸으로 접힌다 ("아슬아슬하게"가 쪼개지지 않게)
            'choices ' + (q.opts.length === 3 ? 'auto' : 'grid2')
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
        { class: 'watch-list', style: { marginTop: '8px' } },
        tip('🤐', '끼어들지 않기', '막히면 게임 안의 무전이 힌트를 줍니다.'),
        tip('👀', '아이가 직접 풀게 지켜봐 주세요', '혼자 버티며 푼 경험이 남습니다.'),
        tip('🚨', '비상시 (쪽지가 떨어졌을 때)', '게임 메뉴 > 부모 메뉴 > 확인 번호 ' + s.pin)
      )
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', { text: '준비 끝' }),
      h('p', {
        class: 'soft',
        text: '사건 No.' + s.caseNo + ' · ' + D.name + ' · 제한 ' + s.minutes + '분' + (String(s.detective || '').trim() ? ' · ' + s.detective.trim() + ' 탐정' : ''),
      }),
      h('p', { class: 'small muted', style: { marginTop: '6px' }, text: '아래 "아이에게 폰 건네기"를 누르면 아이 화면으로 바뀌어요. 이 폰을 아이에게 건네 주세요.' })
    ),
    h(
      'details',
      { class: 'card share', id: 'share', onToggle: openShare },
      h('summary', {}, '📨 다른 기기로 보내기'),
      h('p', { class: 'soft small', style: { margin: '6px 0 0' }, text: '아이가 태블릿이나 자기 폰으로 할 때 이 링크를 보내 주세요. 링크를 연 기기에서 같은 사건이 바로 시작되고, 기록과 관찰 리포트도 그 기기에 남아요.' }),
      shareSlot,
      h('p', { class: 'small muted', style: { marginTop: '8px' }, text: '사진은 이 폰에만 남고, 힌트 글은 함께 갑니다.' })
    ),
  ];
}
