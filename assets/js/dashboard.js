// 부모 대시보드(admin.html)의 보물찾기 칸.
// 보물찾기마다 이 기기에 저장된 준비 상태를 보여 주고, 아이 기기에서 열 링크(QR)를 만든다.
// 서버가 없으므로 링크에 준비 내용을 통째로 담는다. 링크를 연 기기에 진행과 기록이 남는다.

import { shareBox } from './share-box.js';
import * as det from '../../home-detective/js/shared/store.js';
import * as sub from '../../home-submarine/js/shared/store.js';

// 저장 키 접두사 (assets/js/arcade.js 의 Arcade.ns 와 같다)
const NS = 'minigames:';

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(NS + key));
  } catch (e) {
    return null;
  }
}

/** 대시보드(사이트 맨 위 폴더) 기준 주소 */
const at = (path) => new URL(path, location.href).href;

const day = (t) => {
  try {
    return new Date(t).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  } catch (e) {
    return '';
  }
};

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (v == null || v === false) return;
    if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') Object.entries(v).forEach(([prop, val]) => el.style.setProperty(prop.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), val));
    else el.setAttribute(k, v === true ? '' : v);
  });
  kids.flat().forEach((c) => c != null && c !== false && el.append(c));
  return el;
}

// ---------------------------------------------------------------- 보물찾기 목록
// state() → { ready, kind: 'none'|'draft'|'ready'|'playing', text, last }
// link()  → 아이 기기에서 열 주소 (ready 일 때만 부른다)

const HUNTS = [
  {
    id: 'detective',
    icon: '🕵️',
    name: '우리 집 탐정',
    desc: '인형이 용의자, 집이 사건 현장. 진술의 모순을 찾아 범인을 고발하는 추리 게임',
    chips: ['부모 준비 10분', '아이 혼자 20~30분', '포스트잇 7~11장'],
    c: '#1f6f6a',
    soft: '#e3f1ef',
    prep: 'home-detective/setup.html',
    guide: 'guide/detective.html',
    here: 'home-detective/index.html',
    state() {
      const s = det.loadSetup();
      const run = det.loadRun();
      const last = det.loadHistory()[0];
      const out = { last: last ? '지난 사건 No.' + last.caseNo + (last.forced ? ' · 중간에 끝냄' : ' · 등급 ' + last.grade) + ' · ' + day(last.at) : '' };
      if (!s) return Object.assign(out, { kind: 'none', text: '아직 준비 전이에요' });
      if (!s.ready) return Object.assign(out, { kind: 'draft', text: '준비하던 중이에요. 준비하기를 눌러 이어 가세요.' });
      const label = '사건 No.' + s.caseNo + ' · 방 ' + s.rooms.length + '곳';
      if (run && run.caseKey === det.caseKey(s) && run.phase === 'play') return Object.assign(out, { ready: true, kind: 'playing', text: '이 기기에서 수사 중 · ' + label });
      return Object.assign(out, { ready: true, kind: 'ready', text: '준비 끝 · ' + label });
    },
    link() {
      return at('home-detective/play.html') + '#c=' + det.encodeSetup(Object.assign({}, det.loadSetup(), { ready: true }));
    },
    shareText: () => '사건 링크야. 눌러서 수사를 시작해!',
    note: '사진은 이 기기에만 남고, 아이 기기에서는 그림으로 보여요.',
  },
  {
    id: 'submarine',
    icon: '🚢',
    name: '잠수함 간식호',
    desc: '집이 잠수함! 경보가 뜬 방으로 걸어가 고장을 고치며 보물을 건지는 실시간 미션',
    chips: ['부모 준비 5분', '아이 혼자 15분', '쪽지는 다음에도 그대로'],
    c: '#0f6e9c',
    soft: '#e1f0f8',
    prep: 'home-submarine/setup.html',
    guide: 'guide/submarine.html',
    here: 'home-submarine/index.html',
    state() {
      const s = sub.loadSetup();
      const run = sub.loadRun();
      const last = sub.loadHistory()[0];
      const out = { last: last ? '지난 임무 No.' + last.missionNo + ' · 등급 ' + last.grade + ' · ' + day(last.at) : '' };
      if (!s) return Object.assign(out, { kind: 'none', text: '아직 준비 전이에요' });
      if (!s.ready) return Object.assign(out, { kind: 'draft', text: '준비하던 중이에요. 준비하기를 눌러 이어 가세요.' });
      const label = '임무 No.' + s.missionNo + ' · 방 ' + s.rooms.length + '곳';
      const running = run && run.key === sub.missionKey(s) && run.state.phase !== 'done' && run.state.phase !== 'intro';
      if (running) return Object.assign(out, { ready: true, kind: 'playing', text: '이 기기에서 임무 중 · ' + label });
      return Object.assign(out, { ready: true, kind: 'ready', text: '준비 끝 · ' + label });
    },
    link() {
      const s = sub.loadSetup();
      // 이 기기에서 이미 끝낸 임무면 새 임무로 바꿔서 보낸다 (아이에게 폰을 건넬 때와 같은 규칙)
      if (sub.freshMission(s)) {
        s.predict = null; // 지난 임무의 예측과 비교하지 않게
        sub.saveSetup(s);
      }
      return at('home-submarine/play.html') + '#c=' + sub.encodeSetup(s);
    },
    shareText: () => '임무 No.' + sub.loadSetup().missionNo + ' 링크야. 눌러서 출항해!',
    note: '같은 링크를 다시 열면 하던 임무가 이어져요. 다음 날 새 임무를 하려면 아래 버튼으로 새 링크를 만드세요.',
    extra(refresh) {
      return h('button', {
        type: 'button',
        class: 'again',
        'data-act': 'new-mission',
        text: '🔁 같은 쪽지로 새 임무 링크 만들기',
        onclick: () => {
          const s = sub.loadSetup();
          s.seed = sub.newSeed();
          s.missionNo = (s.missionNo | 0) + 1;
          s.predict = null; // 지난 임무의 예측과 비교하지 않게
          sub.saveSetup(s);
          refresh();
        },
      });
    },
  },
  {
    id: 'hunt',
    icon: '🗺️',
    name: '홈 트레저헌트',
    desc: '미니게임 미션을 깨고 단서를 모아 집 안의 보물 상자를 여는 보물찾기',
    chips: ['테마 9가지', '미니게임 + 물건 찾기', '1~2명'],
    c: '#d97706',
    soft: '#fef3c7',
    prep: 'treasure-hunt3/admin.html',
    here: 'treasure-hunt3/index.html',
    state() {
      const cfg = readJSON('treasureHunt3_config');
      const st = readJSON('treasureHunt3_state');
      const hist = readJSON('treasureHunt3_history');
      const last = Array.isArray(hist) && hist.length ? hist[hist.length - 1] : null;
      const out = { last: last && last.completedAt ? '지난 보물찾기 · ' + day(last.completedAt) + ' 완료' : '' };
      if (!cfg || !Array.isArray(cfg.missions) || !cfg.missions.length) return Object.assign(out, { kind: 'none', text: '아직 준비 전이에요' });
      const label = '미션 ' + cfg.missions.length + '개' + (cfg.playerCount === 2 ? ' · 2명' : '');
      if (st && st.status === 'playing') return Object.assign(out, { ready: true, kind: 'playing', text: '이 기기에서 진행 중 · ' + label });
      return Object.assign(out, { ready: true, kind: 'ready', text: '준비 끝 · ' + label });
    },
    link() {
      return window.HuntShare.url(readJSON('treasureHunt3_config'), at('treasure-hunt3/'));
    },
    shareText: () => '보물찾기 링크야. 눌러서 시작해!',
    note: '미니게임의 개별 설정(사진, 녹음)은 함께 가지 않아요. 아이 기기에서는 기본 설정으로 돌아요.',
  },
  {
    id: 'vault',
    icon: '🕶️',
    name: '작전명 스낵 볼트',
    desc: '폰 두 대로 하는 3D 금고 침투. 아이 폰은 현장 요원, 부모 폰은 본부가 되어 말로 함께 풀어요',
    chips: ['폰 2대', '부모와 함께', '12~18분'],
    c: '#4338ca',
    soft: '#e0e7ff',
    prep: 'operation-vault/setup.html',
    guide: 'guide/vault.html',
    here: 'operation-vault/operator.html',
    hereLabel: '본부 열기',
    state() {
      const m = readJSON('operationVault_mission');
      if (!m || !m.code) return { kind: 'none', text: '아직 준비 전이에요', last: '' };
      return { ready: true, kind: 'ready', text: '준비 끝 · 작전 코드 ' + m.code, last: m.revealed ? '보물을 공개한 작전이에요. 새로 하려면 다시 준비하세요.' : '' };
    },
    link() {
      return at('operation-vault/agent.html') + '#m=' + readJSON('operationVault_mission').code;
    },
    shareText: () => '작전 링크야. 눌러서 현장 요원으로 들어와!',
    note: '부모 폰은 "본부 열기"로 매뉴얼을 띄워 두고 함께 해요.',
  },
];

function huntCard(hunt) {
  const st = hunt.state();
  const slot = h('div', { class: 'send-slot', id: 'send-' + hunt.id });

  const fill = () => {
    slot.replaceChildren(
      h('p', { class: 'who', text: hunt.note }),
      shareBox({ url: hunt.link(), title: hunt.name, text: hunt.shareText() }),
      hunt.extra ? h('div', { class: 'acts', style: { marginTop: '10px' } }, hunt.extra(refresh)) : null
    );
  };
  // 새 임무를 만든 뒤: 상태 줄과 링크를 함께 새로 그린다
  const refresh = () => {
    const next = huntCard(hunt);
    card.replaceWith(next);
    next.querySelector('[data-act="send"]').click();
  };

  const sendBtn = h('button', {
    type: 'button',
    class: 'send',
    'data-act': 'send',
    disabled: !st.ready,
    title: st.ready ? null : '먼저 준비를 끝내 주세요',
    text: '📨 아이에게 보내기',
    onclick: () => {
      if (slot.childElementCount) slot.replaceChildren();
      else fill();
    },
  });

  const card = h(
    'article',
    { class: 'hunt', id: 'hunt-' + hunt.id, 'data-kind': st.kind, style: { '--c': hunt.c, '--soft': hunt.soft } },
    h('div', { class: 'hunt-head' }, h('div', { class: 'ico', 'aria-hidden': 'true', text: hunt.icon }), h('div', {}, h('h3', { text: hunt.name }), h('p', { text: hunt.desc }))),
    h('div', { class: 'chips' }, hunt.chips.map((c) => h('span', { text: c }))),
    h('div', { class: 'status ' + st.kind }, st.text, st.last ? h('span', { class: 'last', text: st.last }) : null),
    hunt.guide ? h('a', { class: 'guide-link', href: hunt.guide, 'data-act': 'guide', text: '📖 설명서 보기 (준비하는 법, 게임 진행)' }) : null,
    h(
      'div',
      { class: 'acts' },
      h('a', { href: hunt.prep, 'data-act': 'prep', text: st.kind === 'none' ? '🧰 준비하기' : '🧰 다시 준비하기' }),
      sendBtn,
      h('a', { href: hunt.here, 'data-act': 'here', text: hunt.hereLabel || '이 기기에서 시작' })
    ),
    slot
  );
  return card;
}

const box = document.getElementById('hunts');
HUNTS.forEach((hunt) => {
  try {
    box.append(huntCard(hunt));
  } catch (e) {
    // 한 보물찾기의 저장 내용이 깨져 있어도 나머지는 보이게
    console.warn('보물찾기 상태를 읽지 못했습니다:', hunt.id, e);
    box.append(h('article', { class: 'hunt', style: { '--c': hunt.c } }, h('h3', { text: hunt.icon + ' ' + hunt.name }), h('div', { class: 'acts' }, h('a', { href: hunt.prep, text: '🧰 준비하기' }))));
  }
});

// ---------------------------------------------------------------- 미니게임 목록 보내기
const arcade = document.getElementById('arcadeSend');
arcade.addEventListener('toggle', () => {
  const slot = document.getElementById('arcadeSlot');
  if (!arcade.open || slot.childElementCount) return;
  slot.append(shareBox({ url: at('./'), title: '미니게임 아케이드', text: '미니게임 링크야. 별을 모아 봐!' }));
});

// 다른 탭에서 준비를 마치고 돌아오면 상태가 맞게 바뀌도록
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload();
});
