// 4단계 보안 토큰 매뉴얼: 부모가 미리 적어 둔 힌트를 읽어 준다.

import { h } from '../../shared/dom.js';
import { tokenNumber } from '../../shared/synccode.js';
import { manualHeader } from './common.js';

export function renderToken(view, manual, app) {
  const hint = app.secret.tokenHint || '(힌트를 적어 두지 않았습니다)';
  manualHeader(view, {
    script: `마지막 문이 보안 토큰을 요구한다. 본부가 현장에 숨겨 둔 쪽지를 찾아와라. 힌트를 전한다. "${hint}"`,
    steps: [
      '아이가 <b>실제로 쪽지를 찾아와서</b> 적힌 번호를 입력해야 합니다. 번호는 알려 주지 마세요.',
      '찾는 동안에도 <b>시계는 계속 갑니다</b>.',
      '틀린 번호를 입력하면 경보가 오릅니다.',
    ],
  });

  const number = h('b', { class: 'mono', text: '●●●●' });
  view.append(
    h(
      'div',
      { class: 'card center' },
      h('div', { class: 'section-title', text: '힌트' }),
      h('div', { id: 'token-hint', style: { fontSize: '22px', fontWeight: '800' }, text: hint })
    ),
    h(
      'p',
      { class: 'center dim small' },
      '쪽지에 적은 번호 (확인용): ',
      number,
      ' ',
      h('button', {
        type: 'button',
        style: { color: 'var(--accent)', fontWeight: '700' },
        text: '보기',
        onClick: () => (number.textContent = tokenNumber(app.mission)),
      })
    )
  );
}
