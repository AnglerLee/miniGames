// 아래 탭 줄과 가운데 탭 내용. 가운데에 솟은 둥근 "쪽지 발견" 버튼이 있다.

import { h } from '../shared/dom.js';
import { G, on, commit } from './game.js';
import { renderSite } from './site.js';
import { renderNotebook } from './notebook.js';
import { renderBoard } from './board.js';
import { renderAccuse, tickAccuse } from './accuse.js';
import { openPad } from './pad.js';
import { audio } from './audio.js';

const TABS = [
  { id: 'site', label: '현장', icon: '🏠' },
  { id: 'notebook', label: '수첩', icon: '📒' },
  { id: 'board', label: '정리표', icon: '📋' },
  { id: 'accuse', label: '고발', icon: '🚨' },
];

let main = null;
let buttons = {};

export function currentTab() {
  const t = G.run && G.run.tab;
  return TABS.some((x) => x.id === t) ? t : 'site';
}

export function mountTabs() {
  main = h('main', { class: 'tabview', id: 'tabview' });
  buttons = {};
  const btn = (t) =>
    (buttons[t.id] = h(
      'button',
      { class: 'tab', type: 'button', 'data-tab': t.id, onClick: () => switchTab(t.id) },
      h('span', { class: 'tab-icon', text: t.icon }),
      h('span', { class: 'tab-label', text: t.label }),
      h('i', { class: 'tab-dot', 'aria-hidden': 'true' })
    ));
  const pad = h('button', { class: 'pad-btn', type: 'button', 'aria-label': '쪽지 발견', onClick: openPad }, h('span', { class: 'pad-btn-icon', text: '📝' }), h('span', { class: 'pad-btn-label', text: '쪽지 발견' }));
  const bar = h('nav', { class: 'tabbar' }, btn(TABS[0]), btn(TABS[1]), h('div', { class: 'pad-slot' }, pad), btn(TABS[2]), btn(TABS[3]));
  on('change', () => render(true));
  on('tick', (now) => {
    if (currentTab() === 'accuse') tickAccuse(now);
  });
  render(false);
  return { main, bar };
}

export function switchTab(id) {
  if (!G.run || id === currentTab()) return;
  G.run.tab = id;
  audio.sfx('page');
  commit('tab');
  main.scrollTop = 0;
}

function render(keepScroll) {
  if (!main || !G.run || G.run.phase !== 'play') return;
  const tab = currentTab();
  if (tab === 'notebook' || tab === 'board') G.unseen[tab] = false;
  for (const t of TABS) {
    buttons[t.id].classList.toggle('on', t.id === tab);
    buttons[t.id].setAttribute('aria-current', t.id === tab ? 'page' : 'false');
    buttons[t.id].classList.toggle('new', !!G.unseen[t.id]);
  }
  const top = main.scrollTop;
  main.dataset.tab = tab;
  main.replaceChildren();
  const page = h('div', { class: 'page page-' + tab });
  main.append(page);
  if (tab === 'site') renderSite(page);
  else if (tab === 'notebook') renderNotebook(page);
  else if (tab === 'board') renderBoard(page);
  else renderAccuse(page, () => render(true));
  if (keepScroll) main.scrollTop = top;
}
