// 매뉴얼 탭: 아이가 불러 준 주파수를 입력하면 그 단계의 매뉴얼이 열린다.

import { h, createDigitEntry } from '../../shared/dom.js';
import { load, save } from '../../shared/store.js';
import { STAGES, tune } from '../../shared/stages.js';
import { renderComms } from '../manuals/comms.js';
import { renderGate } from '../manuals/gate.js';
import { renderDuct } from '../manuals/duct.js';
import { renderPower } from '../manuals/power.js';
import { renderToken } from '../manuals/token.js';
import { renderVault } from '../manuals/vault.js';

const MANUALS = [renderComms, renderGate, renderDuct, renderPower, renderToken, renderVault];

/** 지금 맞춰 둔 주파수. 새로고침해도 유지된다. 맞지 않으면 null. */
export function currentTuning(mission) {
  const saved = load('console');
  if (!saved || saved.mission !== mission.code) return null;
  const result = tune(mission, saved.code);
  return result.ok ? { ...result, code: saved.code } : null;
}

export function renderConsole(view, app) {
  const tuning = currentTuning(app.mission);
  if (tuning) renderManual(view, app, tuning);
  else renderTuner(view, app);
}

function renderTuner(view, app) {
  const message = h('p', { class: 'center dim', text: '아이 화면에 나온 주파수 네 자리를 아이가 불러 주면 입력하세요.' });
  const entry = createDigitEntry({
    length: 4,
    onComplete(code) {
      const result = tune(app.mission, code);
      if (!result.ok) {
        entry.reject();
        message.className = 'center error';
        message.textContent = '주파수가 맞지 않습니다. 숫자를 다시 확인하세요. 계속 안 되면 두 폰 모두 새로고침하세요.';
        return;
      }
      save('console', { mission: app.mission.code, code });
      view.replaceChildren();
      renderManual(view, app, { ...result, code });
    },
  });
  view.append(
    h('div', { class: 'card' }, h('div', { class: 'section-title center', text: '주파수 맞추기' }), entry.el),
    message
  );
}

function renderManual(view, app, tuning) {
  view.append(
    h(
      'div',
      { class: 'tuned' },
      h('div', {}, h('b', { id: 'stage-name', text: STAGES[tuning.stage].name }), h('div', { class: 'small dim mono', text: `주파수 ${tuning.code}` })),
      h('button', {
        type: 'button',
        id: 'retune',
        text: '주파수 바꾸기',
        onClick: () => {
          save('console', null);
          view.replaceChildren();
          renderTuner(view, app);
        },
      })
    )
  );
  MANUALS[tuning.stage](view, tuning.manual, app, tuning);
}
