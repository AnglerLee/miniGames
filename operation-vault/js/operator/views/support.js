// 지원 탭: 막힌 단계를 건너뛰는 우회 코드를 발급한다.

import { h, showModal } from '../../shared/dom.js';
import { STAGES } from '../../shared/stages.js';
import { supportCode } from '../../shared/synccode.js';
import { currentTuning } from './console.js';

export function renderSupport(view, app) {
  const tuning = currentTuning(app.mission);
  const box = h('div', {});

  view.append(
    h(
      'div',
      { class: 'card' },
      h('div', { class: 'section-title', text: '본부 지원: 우회 코드' }),
      h('p', {
        class: 'dim',
        text: '아이가 한 단계에서 너무 오래 막히면 그 단계를 건너뛰게 해 줄 수 있습니다. 대신 등급이 내려가고 보너스 보상은 사라집니다.',
      })
    ),
    box
  );

  if (!tuning || tuning.stage === 0) {
    box.append(h('p', { class: 'center dim', text: '먼저 매뉴얼 탭에서 지금 단계의 주파수를 맞추세요.' }));
    return;
  }

  box.append(
    h(
      'div',
      { class: 'card center' },
      h('p', {}, '지금 단계: ', h('b', { text: STAGES[tuning.stage].name })),
      h('button', {
        type: 'button',
        class: 'btn danger block',
        id: 'issue',
        style: { marginTop: '12px' },
        text: '우회 코드 발급',
        onClick: async () => {
          const ok = await showModal({
            title: '이 단계를 건너뛸까요?',
            text: '보너스 보상을 받을 수 없게 됩니다.',
            actions: [
              { label: '취소', value: false },
              { label: '발급', value: true, kind: 'danger' },
            ],
          });
          if (!ok) return;
          box.replaceChildren(
            h(
              'div',
              { class: 'card center' },
              h('div', { class: 'section-title', text: '우회 코드' }),
              h('div', { class: 'big-number', id: 'support-code', text: supportCode(app.mission, 'skip', tuning.stage, tuning.channel) }),
              h('p', { class: 'dim small', style: { marginTop: '8px' }, text: '아이 화면의 ☰ 메뉴에서 "본부 지원 코드"를 누르고 이 숫자를 입력하게 하세요.' })
            )
          );
        },
      })
    )
  );
}
