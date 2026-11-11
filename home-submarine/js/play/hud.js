// 위 계기판: 단계 이름과 수심(잠수함이 막대 위를 오르내린다), 선체 칸, 든 부품, 메뉴와 멈춤 버튼.
// 매 tick 불리므로 바뀐 것만 고친다.

import { h } from '../shared/dom.js';
import { STAGES, PARTS, CARRY_MAX } from '../shared/content.js';
import { depth } from '../shared/engine.js';
import { stageTitle } from '../shared/text.js';
import { subIcon } from './art.js';
import { replay } from './fx.js';

const MAX_DEPTH = 1000;

export function mountHud({ onMenu, onPause }) {
  const stageEl = h('span', { class: 'hud-stage' });
  const meters = h('b', { class: 'hud-m' });
  const sub = subIcon('hud-sub');
  // 단계가 끝날 때의 수심에 눈금을 둔다 (300, 800, 1000)
  const marks = [...new Set(STAGES.map((s) => s.depth).filter((d) => d > 0 && d < MAX_DEPTH))].map((d) => h('i', { class: 'hud-mark', style: { left: 4 + (d / MAX_DEPTH) * 92 + '%' } }));
  const track = h('div', { class: 'hud-track' }, h('span', { class: 'hud-water' }), marks, sub);
  const cells = h('span', { class: 'cells' });
  const hullBox = h('div', { class: 'hud-hull' }, h('span', { class: 'hud-lbl', text: '선체' }), cells);
  const slots = Array.from({ length: CARRY_MAX }, () => h('span', { class: 'slot' }));
  const carryBox = h('div', { class: 'hud-carry' }, h('span', { class: 'hud-lbl', text: '부품' }), slots);

  const el = h(
    'header',
    { class: 'hud' },
    h(
      'div',
      { class: 'hud-row' },
      h('button', { class: 'hud-btn', type: 'button', 'aria-label': '메뉴', 'data-act': 'menu', onClick: onMenu }, h('b', { text: '☰' })),
      h('div', { class: 'hud-depth' }, h('div', { class: 'hud-depth-top' }, stageEl, meters), track),
      h('button', { class: 'hud-btn', type: 'button', 'aria-label': '잠깐 멈춤', 'data-act': 'pause', onClick: onPause }, h('b', { text: '⏸' }))
    ),
    h('div', { class: 'hud-row2' }, hullBox, carryBox)
  );

  const last = { d: null, stage: null, hull: null, hullMax: null, carry: '' };

  function update(s) {
    const d = depth(s);
    if (d !== last.d) {
      meters.replaceChildren(String(d), h('small', { text: 'm' }));
      // 막대 양 끝에서 잠수함이 반쯤 잘리지 않게 안쪽으로 조금 당긴다
      sub.style.left = 4 + (d / MAX_DEPTH) * 92 + '%';
      last.d = d;
    }
    if (s.stage !== last.stage) {
      stageEl.textContent = stageTitle(s.stage);
      // 물 위로 올라가는 단계에서는 잠수함이 왼쪽(수면)을 본다
      sub.classList.toggle('up', STAGES[s.stage].id === 'rise');
      last.stage = s.stage;
    }
    if (s.hullMax !== last.hullMax) {
      cells.replaceChildren(...Array.from({ length: s.hullMax }, () => h('i')));
      last.hullMax = s.hullMax;
      last.hull = null;
    }
    if (s.hull !== last.hull) {
      const kids = cells.children;
      for (let i = 0; i < kids.length; i++) {
        const on = i < s.hull;
        kids[i].classList.toggle('on', on);
        // 방금 깨진 칸만 깨지는 연출
        if (!on && last.hull !== null && i < last.hull) replay(kids[i], 'break');
      }
      if (last.hull !== null && s.hull < last.hull) replay(el, 'hit');
      el.classList.toggle('low', s.hull <= Math.max(1, Math.floor(s.hullMax / 3)));
      last.hull = s.hull;
    }
    const carry = s.carrying.join(',');
    if (carry !== last.carry) {
      const before = last.carry ? last.carry.split(',') : [];
      slots.forEach((slot, i) => {
        const id = s.carrying[i];
        slot.textContent = id ? PARTS[id].icon : '';
        slot.classList.toggle('full', !!id);
        slot.setAttribute('aria-label', id ? PARTS[id].name : '빈 칸');
        if (id && before[i] !== id) replay(slot, 'pop');
      });
      last.carry = carry;
    }
  }

  return { el, update };
}
