// 본부 콘솔 (부모용). 탭 네 개: 작전 코드, 매뉴얼, 지원, 개봉.
// 아이 폰과 통신하지 않는다. 아이가 불러 주는 숫자를 입력하면 필요한 화면이 열린다.

import { h } from '../shared/dom.js';
import { load } from '../shared/store.js';
import { decodeMission } from '../shared/mission.js';
import { renderShare } from './views/share.js';
import { renderConsole } from './views/console.js';
import { renderSupport } from './views/support.js';
import { renderReveal } from './views/reveal.js';

const TABS = [
  { id: 'share', icon: '📲', name: '작전 코드', render: renderShare },
  { id: 'manual', icon: '📖', name: '매뉴얼', render: renderConsole },
  { id: 'support', icon: '🆘', name: '지원', render: renderSupport },
  { id: 'reveal', icon: '🎁', name: '개봉', render: renderReveal },
];

const stored = load('mission');
const mission = stored ? decodeMission(stored.code) : null;

if (!mission) {
  // 만들어 둔 작전이 없으면 설정 화면으로 보낸다
  location.replace('setup.html');
} else {
  const view = document.getElementById('view');
  const tabs = document.getElementById('tabs');
  document.getElementById('mission-code').textContent = mission.code;

  const app = {
    mission,
    /** 이 폰에만 있는 정보: 보물, 보너스, 토큰 힌트 */
    secret: stored,
    go(id) {
      location.hash = id;
    },
  };

  const show = () => {
    const id = location.hash.slice(1);
    const tab = TABS.find((t) => t.id === id) || TABS[0];
    tabs.replaceChildren(
      ...TABS.map((t) =>
        h(
          'button',
          { type: 'button', class: t.id === tab.id ? 'on' : '', 'data-tab': t.id, onClick: () => app.go(t.id) },
          h('span', { class: 'icon', text: t.icon }),
          t.name
        )
      )
    );
    view.replaceChildren();
    view.scrollTop = 0;
    tab.render(view, app);
  };

  window.addEventListener('hashchange', show);
  show();
}
