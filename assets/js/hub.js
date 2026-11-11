// 게임 목록 화면: 별 모으기, 오늘의 도전, 분류별 게임 카드
(function () {
  'use strict';
  const { h, records, today, sfx, fmt } = Arcade;

  const GAMES = window.ARCADE_GAMES;

  const CATS = [
    ['all', '전체'],
    ['brain', '🧠 두뇌'],
    ['speed', '⚡ 순발력'],
    ['body', '🤸 몸으로'],
    ['sense', '📷 카메라·소리'],
  ];

  const RANKS = [
    [0, '🌱 새내기 도전자'],
    [6, '🧭 꼬마 탐험가'],
    [15, '🕵️ 실력파 요원'],
    [30, '🔥 게임 고수'],
    [45, '👑 전설의 달인'],
    [60, '🏆 완벽한 마스터'],
  ];

  const MAX_STARS = GAMES.length * 3;
  const all = records.all();
  const rec = (id) => all[id] || { stars: 0, best: null, clears: 0 };
  const url = (g) => `games/${g.path}/index.html`;

  /** 날짜로 정해지는 오늘의 도전 3개. 같은 날에는 언제 열어도 같다 */
  function dailyPicks() {
    let seed = Number(today().replace(/-/g, ''));
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pool = GAMES.slice();
    const picks = [];
    // 센서·카메라가 필요한 게임은 하루에 하나까지만 넣어서 어디서든 할 수 있게 한다
    let needUsed = false;
    while (picks.length < 3 && pool.length) {
      const g = pool.splice(Math.floor(next() * pool.length), 1)[0];
      if (g.need) {
        if (needUsed) continue;
        needUsed = true;
      }
      picks.push(g);
    }
    return picks;
  }

  function starRow(n) {
    return h('div', { class: 'ar-stars sm' }, [0, 1, 2].map((i) => h('span', { class: i < n ? 'on' : '', text: '⭐' })));
  }

  function card(g) {
    const r = rec(g.id);
    return h(
      'a',
      {
        class: 'hub-card' + (r.clears ? '' : ' new'),
        href: url(g),
        style: { '--c1': g.c[0], '--c2': g.c[1] },
        dataset: { cat: g.cat },
      },
      [
        g.need ? h('div', { class: 'need', text: g.need }) : null,
        h('div', { class: 'ico', text: g.icon }),
        h('b', { text: g.name }),
        h('div', { class: 'tag', text: g.tag }),
        h('div', { class: 'foot' }, [
          starRow(r.stars || 0),
          r.clears && typeof r.best === 'number' ? h('div', { class: 'best', text: fmt(r.best) }) : null,
        ]),
      ]
    );
  }

  // ----- 별 모으기
  const total = GAMES.reduce((sum, g) => sum + (rec(g.id).stars || 0), 0);
  let rankIdx = 0;
  RANKS.forEach(([need], i) => {
    if (total >= need) rankIdx = i;
  });
  const nextRank = RANKS[rankIdx + 1];
  const starsBox = h('section', { class: 'hub-stars' }, [
    h('div', { class: 'row' }, [
      h('div', { class: 'rank', text: RANKS[rankIdx][1] }),
      h('div', { class: 'count', text: `⭐ ${total} / ${MAX_STARS}` }),
    ]),
    h('div', { class: 'bar' }, h('i', { style: { width: (total / MAX_STARS) * 100 + '%' } })),
    h('div', {
      class: 'next',
      text: nextRank ? `별 ${nextRank[0] - total}개를 더 모으면 "${nextRank[1].replace(/^\S+\s/, '')}"` : '모든 게임에서 별 3개를 모았어요!',
    }),
  ]);

  // ----- 오늘의 도전
  const picks = dailyPicks();
  const doneCount = picks.filter((g) => rec(g.id).lastClear === today()).length;
  const daily = h(
    'section',
    { class: 'hub-daily' },
    picks.map((g) =>
      h('a', { href: url(g), class: rec(g.id).lastClear === today() ? 'done' : '' }, [
        h('div', { class: 'ico', text: g.icon }),
        h('b', { text: g.name }),
      ])
    )
  );

  // ----- 분류 탭과 카드
  const grid = h('section', { class: 'hub-grid' }, GAMES.map(card));
  const tabs = h(
    'nav',
    { class: 'hub-tabs' },
    CATS.map(([key, label], i) =>
      h('button', {
        class: i === 0 ? 'on' : '',
        text: label,
        onclick: (e) => {
          sfx('tap');
          Array.from(tabs.children).forEach((b) => b.classList.toggle('on', b === e.currentTarget));
          Array.from(grid.children).forEach((c) => c.classList.toggle('ar-hidden', key !== 'all' && c.dataset.cat !== key));
        },
      })
    )
  );

  const randomBtn = h('button', {
    class: 'ar-btn gold block',
    text: '🎲 아무거나 한 판!',
    onclick: () => {
      // 아직 별 3개가 아닌 게임 가운데서 먼저 고른다
      const pool = GAMES.filter((g) => !g.need && (rec(g.id).stars || 0) < 3);
      const g = Arcade.pick(pool.length ? pool : GAMES.filter((x) => !x.need));
      location.href = url(g);
    },
  });

  document.body.appendChild(
    h('div', { class: 'hub-wrap' }, [
      h('header', { class: 'hub-head' }, [h('h1', { text: '🎮 미니게임 아케이드' }), h('p', { text: '게임을 깨고 별을 모아 보자!' })]),
      starsBox,
      h('div', { class: 'hub-section-title' }, [h('span', { text: '🗺️ 보물찾기' }), h('small', { text: '부모님이 준비해 주면 시작!' })]),
      h('section', { class: 'hub-featured' }, [
        h('a', { class: 'hub-big detective', href: 'home-detective/index.html' }, [
          h('div', { class: 'ico', text: '🕵️' }),
          h('b', { text: '우리 집 탐정' }),
          h('span', { text: '인형들이 용의자! 집을 돌아다니며 혼자 푸는 추리 게임' }),
        ]),
        h('a', { class: 'hub-big submarine', href: 'home-submarine/index.html' }, [
          h('div', { class: 'ico', text: '🚢' }),
          h('b', { text: '잠수함 간식호' }),
          h('span', { text: '집이 잠수함! 방마다 터지는 고장을 고치는 실시간 미션' }),
        ]),
        h('a', { class: 'hub-big hunt', href: 'treasure-hunt3/index.html' }, [
          h('div', { class: 'ico', text: '🗺️' }),
          h('b', { text: '홈 트레저헌트' }),
          h('span', { text: '미션을 깨고 집 안의 보물 찾기' }),
        ]),
        h('a', { class: 'hub-big vault', href: 'operation-vault/index.html' }, [
          h('div', { class: 'ico', text: '🕶️' }),
          h('b', { text: '작전명 스낵 볼트' }),
          h('span', { text: '폰 두 대로 부모와 함께하는 3D 금고 침투' }),
        ]),
      ]),
      h('div', { class: 'hub-section-title' }, [
        h('span', { text: '🎯 오늘의 도전' }),
        h('small', { text: doneCount >= picks.length ? '모두 완료! 🎉' : `${doneCount} / ${picks.length} 완료` }),
      ]),
      daily,
      randomBtn,
      tabs,
      grid,
      h('footer', { class: 'hub-foot' }, [h('a', { href: 'admin.html', text: '👪 부모 대시보드' }), ' · ', h('a', { href: 'guide/index.html', text: '📖 게임 설명서' })]),
    ])
  );
})();
