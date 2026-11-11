// 단어 탐정: 낱말 자료와 격자 만들기
// 화면과 무관한 순수 함수만 둔다. 브라우저에서는 window.WordPuzzle, Node 에서는 module.exports 로 쓴다.
(function (root) {
  'use strict';

  // ----- 자료: 주제마다 찾을 단어(words)와 수수께끼(riddles). 수수께끼의 답(a)이 숨은 암호다.
  // 단어는 2~5글자, 거꾸로 읽어도 같은 말(토마토)과 서로 포함하는 말(은하/은하수)은 넣지 않는다.
  const THEMES = [
    {
      id: 'animal', name: '동물원', icon: '🐾',
      words: ['고양이', '강아지', '호랑이', '코끼리', '기린', '사자', '토끼', '다람쥐', '펭귄', '얼룩말',
        '원숭이', '돌고래', '거북이', '악어', '하마', '여우', '늑대', '독수리', '오리', '사슴'],
      riddles: [
        { q: '주머니에 아기를 넣고 뛰는 동물은?', a: '캥거루' },
        { q: '사막의 배라고 불리는 동물은?', a: '낙타' },
        { q: '대나무만 먹는 흑백 곰은?', a: '판다' },
        { q: '거꾸로 매달려 잠자는 동물은?', a: '박쥐' },
        { q: '집을 등에 지고 다니는 느림보는?', a: '달팽이' },
        { q: '날지 못해도 가장 빨리 달리는 새는?', a: '타조' },
      ],
    },
    {
      id: 'fruit', name: '과일 채소', icon: '🥕',
      words: ['사과', '포도', '참외', '복숭아', '자두', '오렌지', '망고', '키위', '레몬', '체리',
        '감자', '오이', '바나나', '멜론', '옥수수', '가지', '배추', '시금치', '파인애플', '블루베리'],
      riddles: [
        { q: '겉은 초록, 속은 빨간 여름 과일은?', a: '수박' },
        { q: '깔수록 눈물이 나는 채소는?', a: '양파' },
        { q: '토끼가 좋아하는 주황색 채소는?', a: '당근' },
        { q: '씨가 겉에 콕콕 박힌 빨간 과일은?', a: '딸기' },
        { q: '핼러윈에 얼굴을 새기는 채소는?', a: '호박' },
        { q: '땅속에서 캐는 달콤한 겨울 간식은?', a: '고구마' },
      ],
    },
    {
      id: 'school', name: '학교', icon: '🏫',
      words: ['교실', '칠판', '공책', '가방', '선생님', '운동장', '필통', '책상', '의자', '친구',
        '숙제', '체육', '음악', '미술', '수학', '과학', '국어', '시험', '반장', '실내화', '복도'],
      riddles: [
        { q: '틀린 글씨를 쓱쓱 없애 주는 것은?', a: '지우개' },
        { q: '쓸수록 키가 작아지는 것은?', a: '연필' },
        { q: '학교에서 다 같이 먹는 점심은?', a: '급식' },
        { q: '책을 빌려 볼 수 있는 곳은?', a: '도서관' },
        { q: '여름과 겨울에 학교를 쉬는 때는?', a: '방학' },
        { q: '쉬는 시간을 알려 주는 것은?', a: '종소리' },
      ],
    },
    {
      id: 'weather', name: '날씨', icon: '⛅',
      words: ['구름', '바람', '번개', '태풍', '안개', '햇빛', '장마', '우박', '이슬', '서리',
        '봄비', '얼음', '가을', '겨울', '여름', '눈보라', '우산', '장화', '날씨', '온도'],
      riddles: [
        { q: '비 온 뒤 하늘에 걸리는 일곱 색 다리는?', a: '무지개' },
        { q: '겨울에 굴려서 만드는 하얀 친구는?', a: '눈사람' },
        { q: '번쩍한 뒤에 우르릉 울리는 소리는?', a: '천둥' },
        { q: '처마 끝에 거꾸로 자라는 것은?', a: '고드름' },
        { q: '가을에 나뭇잎이 빨갛게 물드는 것은?', a: '단풍' },
        { q: '여름에 갑자기 쏟아지다 그치는 비는?', a: '소나기' },
      ],
    },
    {
      id: 'space', name: '우주', icon: '🚀',
      words: ['지구', '태양', '화성', '목성', '금성', '수성', '은하수', '별자리', '우주선', '로켓',
        '유성', '달나라', '북극성', '우주복', '무중력', '탐사선', '행성', '천문대', '정거장', '비행사', '인공위성'],
      riddles: [
        { q: '멋진 고리를 두른 행성은?', a: '토성' },
        { q: '별을 크게 보여 주는 긴 통은?', a: '망원경' },
        { q: '빛까지 빨아들이는 우주의 구멍은?', a: '블랙홀' },
        { q: '긴 꼬리를 끌며 날아오는 별은?', a: '혜성' },
        { q: '우주에 산다는 상상 속 손님은?', a: '외계인' },
        { q: '가장 둥글고 환한 밤하늘의 달은?', a: '보름달' },
      ],
    },
    {
      id: 'sea', name: '바다', icon: '🌊',
      words: ['상어', '오징어', '해파리', '조개', '갈매기', '파도', '모래', '해적', '산호', '새우',
        '거북', '미역', '소라', '돛단배', '물고기', '가오리', '바닷가', '수영', '튜브', '소금', '물개'],
      riddles: [
        { q: '다리가 여덟 개, 먹물을 쏘는 것은?', a: '문어' },
        { q: '밤바다에서 배에게 길을 알려 주는 것은?', a: '등대' },
        { q: '옆으로만 걷는 집게 달린 친구는?', a: '꽃게' },
        { q: '바닷속을 몰래 다니는 배는?', a: '잠수함' },
        { q: '바다에서 가장 큰 동물은?', a: '고래' },
        { q: '별 모양으로 생긴 바다 친구는?', a: '불가사리' },
      ],
    },
    {
      id: 'food', name: '맛집', icon: '🍜',
      words: ['떡볶이', '라면', '만두', '치킨', '피자', '햄버거', '비빔밥', '불고기', '된장', '국수',
        '튀김', '어묵', '순대', '계란', '샐러드', '초콜릿', '호떡', '돈가스', '우동', '카레', '잡채', '갈비'],
      riddles: [
        { q: '생일에 촛불을 꽂는 것은?', a: '케이크' },
        { q: '겨울 길거리의 물고기 모양 빵은?', a: '붕어빵' },
        { q: '얼음을 곱게 갈아 만든 여름 간식은?', a: '팥빙수' },
        { q: '검은 소스에 비벼 먹는 면은?', a: '짜장면' },
        { q: '밥상에 빠지지 않는 빨간 반찬은?', a: '김치' },
        { q: '돌돌 말아 썰어 먹는 소풍 도시락은?', a: '김밥' },
      ],
    },
    {
      id: 'play', name: '놀이터', icon: '⚽',
      words: ['축구', '야구', '농구', '배구', '탁구', '달리기', '줄넘기', '태권도', '씨름', '양궁',
        '스키', '썰매', '그네', '시소', '딱지', '윷놀이', '술래잡기', '공기놀이', '연날리기', '제기차기'],
      riddles: [
        { q: '꼭꼭 숨어라, 머리카락 보일라!', a: '숨바꼭질' },
        { q: '채찍으로 치면 빙글빙글 도는 것은?', a: '팽이' },
        { q: '두 바퀴로 씽씽 달리는 탈것은?', a: '자전거' },
        { q: '타고 주르륵 내려오는 놀이 기구는?', a: '미끄럼틀' },
        { q: '물에서 첨벙첨벙 헤엄치는 운동은?', a: '수영' },
        { q: '얼음 위를 달리는 칼날 신발은?', a: '스케이트' },
      ],
    },
  ];

  // 스테이지 규칙. plan 은 단어가 놓이는 방식: f 바로(→ ↓), r 거꾸로(← ↑), d 대각선(↘ ↗)
  const STAGES = [
    { size: 6, count: 4, maxLen: 4, plan: 'ffff', decoys: 0 },
    { size: 7, count: 5, maxLen: 4, plan: 'rrfff', decoys: 0 },
    { size: 8, count: 6, maxLen: 5, plan: 'ddrfff', decoys: 2 },
  ];
  const DIRS = { f: [[0, 1], [1, 0]], r: [[0, -1], [-1, 0]], d: [[1, 1], [-1, 1]] };
  const ALL_DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  const MAX_CODE = 8; // 부모가 넣는 암호의 최대 글자 수
  // 마지막 단계의 글자 타일은 닮은 글자를 섞어도 이 수를 넘기지 않는다(360 폭에서 한 칸 48px 이상).
  // 암호가 이보다 길면 닮은 글자 없이 암호 글자만 깐다
  const MAX_TILES = 6;
  const LURE = 0.3; // 빈칸에 찾을 단어의 글자를 섞어 넣는 비율(헷갈리게)
  // 채운 글자가 우연히 만들면 안 되는 말
  const BANNED = ['보지', '자지', '시발', '씨발', '병신', '새끼', '지랄', '미친', '바보', '죽어', '고자'];

  // ----- 작은 도우미
  const chars = (s) => Array.from(String(s));
  const reverse = (s) => chars(s).reverse().join('');
  const pickOne = (arr, rng) => arr[Math.floor(rng() * arr.length)];

  function shuffled(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** 두 단어가 한 격자에 함께 있으면 헷갈리는가(서로 포함하거나, 거꾸로 읽으면 포함) */
  function clash(a, b) {
    return a.includes(b) || b.includes(a) || a.includes(reverse(b)) || b.includes(reverse(a));
  }

  // 빈칸을 채울 글자: 자료에 나오는 모든 글자(단어처럼 보여야 암호가 눈에 띄지 않는다)
  const FILLER = Array.from(
    new Set(chars(THEMES.map((t) => t.words.join('') + t.riddles.map((r) => r.a).join('')).join('')))
  );

  /** 부모가 적은 암호를 격자에 넣을 글자 배열로 바꾼다. 2~8글자가 아니면 null */
  function normalizeCode(text) {
    const letters = chars(String(text === undefined || text === null ? '' : text).toUpperCase()).filter((ch) =>
      /[0-9A-Z가-힣]/.test(ch)
    );
    return letters.length >= 2 && letters.length <= MAX_CODE ? letters : null;
  }

  // ----- 가짜 단어: 한 글자를 닮은 글자로 바꾼다 (고양이 → 고앙이)
  // 한글 한 글자 = 0xAC00 + (초성 * 21 + 중성) * 28 + 종성
  const CHO_SWAP = { 0: 15, 15: 0, 3: 16, 16: 3, 7: 17, 17: 7, 12: 14, 14: 12, 2: 5, 5: 2, 6: 7, 9: 12, 11: 18, 18: 11, 1: 0, 4: 3, 8: 7, 10: 9, 13: 12 };
  const JUNG_SWAP = { 0: 2, 2: 0, 4: 6, 6: 4, 8: 12, 12: 8, 13: 17, 17: 13, 1: 5, 5: 1, 18: 13, 20: 0, 9: 0, 11: 8, 14: 4, 16: 13, 19: 18 };
  const JONG_SWAP = { 4: 21, 21: 4, 8: 4, 16: 21, 17: 16, 1: 17 };

  /** 닮은 글자들을 돌려준다. 한글이 아니면 빈 배열 */
  function similar(ch) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (ch.length !== 1 || code < 0 || code > 11171) return [];
    const cho = Math.floor(code / 588);
    const jung = Math.floor((code % 588) / 28);
    const jong = code % 28;
    const make = (a, b, c) => String.fromCharCode(0xac00 + (a * 21 + b) * 28 + c);
    const out = [];
    if (JUNG_SWAP[jung] !== undefined) out.push(make(cho, JUNG_SWAP[jung], jong));
    if (JONG_SWAP[jong] !== undefined) out.push(make(cho, jung, JONG_SWAP[jong]));
    if (CHO_SWAP[cho] !== undefined) out.push(make(CHO_SWAP[cho], jung, jong));
    return out;
  }

  /** word 와 한 글자만 다른 가짜 단어. avoid 는 쓰면 안 되는 글자(Set), taken 은 피해야 할 말들 */
  function makeDecoy(word, avoid, taken, rng) {
    const t = chars(word);
    const options = [];
    t.forEach((ch, i) => {
      similar(ch).forEach((alt) => {
        if (avoid.has(alt)) return;
        const fake = t.slice(0, i).concat(alt, t.slice(i + 1)).join('');
        if (!taken.some((w) => clash(w, fake))) options.push(fake);
      });
    });
    return options.length ? pickOne(options, rng) : null;
  }

  // ----- 격자 읽기
  /** 격자에서 글자열이 놓인 자리를 8방향으로 모두 찾는다. 자리마다 칸 번호 배열 */
  function findAll(letters, size, text) {
    const t = chars(text);
    const out = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (letters[r * size + c] !== t[0]) continue;
        for (const [dr, dc] of ALL_DIRS) {
          const er = r + dr * (t.length - 1);
          const ec = c + dc * (t.length - 1);
          if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
          const cells = [];
          for (let k = 0; k < t.length; k++) {
            const i = (r + dr * k) * size + (c + dc * k);
            if (letters[i] !== t[k]) break;
            cells.push(i);
          }
          if (cells.length === t.length) out.push(cells);
        }
      }
    }
    return out;
  }

  /** 고른 글자열이 무엇인지 판정한다. 거꾸로 끌어도 같은 단어다. { word: 번호 } | { decoy: 번호 } | {} */
  function judge(puzzle, text) {
    const back = reverse(text);
    const hit = (list) => list.findIndex((w) => w.text === text || w.text === back);
    const word = hit(puzzle.words);
    if (word >= 0) return { word };
    const decoy = hit(puzzle.decoys);
    return decoy >= 0 ? { decoy } : {};
  }

  /**
   * 끌기 보정: 시작 칸에서 손가락 쪽으로, 8방향 가운데 가장 가까운 직선을 따라간 칸 번호들.
   * 손가락 밑의 칸이 8방향 직선 위에 있으면 그 칸까지, 아니면 가장 가까운 각도의 직선으로 맞춘다.
   * dx, dy 는 시작 칸 가운데에서 손가락까지의 거리(칸 단위, 오른쪽·아래가 +)
   */
  function linePath(size, r0, c0, dx, dy) {
    const out = [r0 * size + c0];
    const rx = Math.round(dx);
    const ry = Math.round(dy);
    if (!rx && !ry) return out;
    let sc, sr, steps;
    if (!rx || !ry || Math.abs(rx) === Math.abs(ry)) {
      sc = Math.sign(rx);
      sr = Math.sign(ry);
      steps = Math.max(Math.abs(rx), Math.abs(ry));
    } else {
      const oct = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
      sc = Math.round(Math.cos((oct * Math.PI) / 4));
      sr = Math.round(Math.sin((oct * Math.PI) / 4));
      steps = Math.round((dx * sc + dy * sr) / (sc * sc + sr * sr));
    }
    for (let k = 1; k <= steps; k++) {
      const r = r0 + sr * k;
      const c = c0 + sc * k;
      if (r < 0 || r >= size || c < 0 || c >= size) break;
      out.push(r * size + c);
    }
    return out;
  }

  // ----- 격자 만들기
  const adjacent = (a, b, size) =>
    Math.abs(Math.floor(a / size) - Math.floor(b / size)) <= 1 && Math.abs((a % size) - (b % size)) <= 1;

  /** 한 번 만들어 본다. 자리가 없으면 null. easy 면 헷갈리게 하는 장치를 뺀다 */
  function build(opt, rng, easy) {
    const size = opt.size;
    const forbid = opt.forbid || [];
    const code = opt.code;
    const codeSet = new Set(code);
    const letters = new Array(size * size).fill('');

    function place(text, kind) {
      const t = chars(text);
      const spots = [];
      for (const [dr, dc] of DIRS[kind]) {
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            const er = r + dr * (t.length - 1);
            const ec = c + dc * (t.length - 1);
            if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
            let shared = 0;
            let ok = true;
            for (let k = 0; k < t.length && ok; k++) {
              const cur = letters[(r + dr * k) * size + (c + dc * k)];
              if (cur === '') continue;
              if (cur === t[k]) shared++;
              else ok = false;
            }
            // 다른 단어와는 한 칸까지만 겹친다(교차)
            if (ok && shared <= 1) spots.push([r, c, dr, dc]);
          }
        }
      }
      if (!spots.length) return null;
      const [r, c, dr, dc] = pickOne(spots, rng);
      const cells = t.map((ch, k) => {
        const i = (r + dr * k) * size + (c + dc * k);
        letters[i] = ch;
        return i;
      });
      return { text, kind, cells };
    }

    // 긴 단어일수록 거꾸로·대각선이 되고, 긴 것부터 놓는다
    const plan = chars(opt.plan);
    const kinds = shuffled(plan.filter((k) => k !== 'f'), rng).concat(plan.filter((k) => k === 'f'));
    const order = shuffled(opt.words.map((_, i) => i), rng).sort((a, b) => chars(opt.words[b]).length - chars(opt.words[a]).length);
    const words = new Array(opt.words.length);
    for (let k = 0; k < order.length; k++) {
      const put = place(opt.words[order[k]], kinds[k] || 'f');
      if (!put) return null;
      words[order[k]] = put;
    }

    // 가짜 단어
    const decoys = [];
    if (opt.decoys) {
      const sources = shuffled(opt.words.filter((w) => chars(w).length >= 3), rng).slice(0, opt.decoys);
      if (sources.length < opt.decoys) return null;
      for (const from of sources) {
        const fake = makeDecoy(from, codeSet, opt.words.concat(decoys.map((d) => d.text)), rng);
        const put = fake && place(fake, pickOne(['f', 'f', 'd'], rng));
        if (!put) return null;
        decoys.push({ text: fake, from, cells: put.cells });
      }
    }

    // 암호: 남은 칸 가운데 서로 붙지 않은 칸을 골라, 읽는 순서대로 넣는다
    const empty = shuffled(letters.map((ch, i) => (ch === '' ? i : -1)).filter((i) => i >= 0), rng);
    const codeCells = [];
    for (const i of empty) {
      if (codeCells.length === code.length) break;
      if (easy || codeCells.every((j) => !adjacent(i, j, size))) codeCells.push(i);
    }
    if (codeCells.length < code.length) return null;
    codeCells.sort((a, b) => a - b);
    codeCells.forEach((i, k) => (letters[i] = code[k]));

    // 나머지는 무관한 글자. 암호 글자는 다른 곳에 나오지 않는다
    const pool = FILLER.filter((ch) => !codeSet.has(ch));
    const lure = chars(opt.words.join(''));
    for (let i = 0; i < letters.length; i++) {
      if (letters[i] === '') letters[i] = !easy && rng() < LURE ? pickOne(lure, rng) : pickOne(pool, rng);
    }
    return { size, letters, words, decoys, code: code.slice(), codeCells, forbid };
  }

  /** 격자가 규칙을 지키는지 본다. 문제를 글로 돌려준다(없으면 빈 배열) */
  function checkPuzzle(p, strict) {
    const bad = [];
    const want = p.code.join('');
    if (p.letters.length !== p.size * p.size || p.letters.some((ch) => !ch)) bad.push('빈칸이 있다');
    // 찾을 단어는 격자 전체에서 꼭 한 번만 나온다
    p.words.forEach((w) => {
      const hits = findAll(p.letters, p.size, w.text);
      if (hits.length !== 1) bad.push(`${w.text}: ${hits.length}번 나온다`);
      else if (hits[0].join() !== w.cells.join()) bad.push(`${w.text}: 자리가 다르다`);
    });
    p.decoys.forEach((d) => {
      const diff = chars(d.text).filter((ch, i) => ch !== chars(d.from)[i]).length;
      if (diff !== 1 || chars(d.text).length !== chars(d.from).length) bad.push(`${d.text}: 한 글자만 달라야 한다`);
      if (p.words.some((w) => clash(w.text, d.text))) bad.push(`${d.text}: 진짜 단어와 겹친다`);
    });
    // 암호 글자만 읽는 순서대로 모으면 암호가 된다
    const codeSet = new Set(p.code);
    if (p.letters.filter((ch) => codeSet.has(ch)).join('') !== want) bad.push('암호 글자가 다른 칸에도 있다');
    if (p.codeCells.map((i) => p.letters[i]).join('') !== want) bad.push('암호 칸이 암호와 다르다');
    if (p.codeCells.some((i, k) => k > 0 && i <= p.codeCells[k - 1])) bad.push('암호 칸 순서가 틀렸다');
    if (strict !== false) {
      BANNED.forEach((b) => {
        if (findAll(p.letters, p.size, b).length) bad.push(`금지어: ${b}`);
      });
      // 같은 주제의 다른 단어가 우연히 생기면, 아이가 찾고도 틀렸다는 말을 듣는다
      (p.forbid || []).forEach((w) => {
        if (findAll(p.letters, p.size, w).length) bad.push(`목록 밖 단어: ${w}`);
      });
    }
    return bad;
  }

  /**
   * 격자를 만든다. 규칙을 지키는 격자가 나올 때까지 다시 만든다.
   * 오래 실패하면 덜 중요한 조건부터 하나씩 푼다(헷갈림 장치 → 금지어 검사 → 가짜 단어 → 거꾸로·대각선).
   * 마지막 단계는 가로·세로로만 놓는 판이라 언제나 만들어진다.
   * opt: { size, plan, decoys, words[], code[], forbid[], rng }
   * 돌려주는 값: { size, letters[], words[{text, kind, cells}], decoys[{text, from, cells}], code[], codeCells[], attempts }
   */
  function makePuzzle(opt) {
    const rng = opt.rng || Math.random;
    for (let attempt = 1; ; attempt++) {
      const o = Object.assign({}, opt);
      if (attempt > 600) o.decoys = 0;
      if (attempt > 1000) o.plan = chars(opt.plan).map(() => 'f').join('');
      const p = build(o, rng, attempt > 40);
      if (p && checkPuzzle(p, attempt <= 200).length === 0) {
        p.attempts = attempt;
        return p;
      }
    }
  }

  /**
   * 마지막 단계에 깔 글자 타일. 암호 글자에 닮은 글자(판 → 팬)를 extra 개까지 섞는다.
   * 돌려주는 값: [{ ch, k }] (k 는 암호에서의 자리, 섞은 글자는 -1). 암호 순서 그대로 놓이지 않게 섞는다
   */
  function makeTiles(code, extra, rng) {
    rng = rng || Math.random;
    const set = new Set(code);
    const want = Math.max(0, Math.min(extra, MAX_TILES - code.length));
    const fakes = [];
    const add = (ch) => {
      if (ch && !set.has(ch) && !fakes.includes(ch) && fakes.length < want) fakes.push(ch);
    };
    shuffled(code, rng).forEach((ch) => shuffled(similar(ch), rng).forEach(add));
    const hangul = code.every((ch) => /[가-힣]/.test(ch));
    const pool = hangul ? FILLER : chars('0123456789ABCDEFGHJKLMNPRSTUVWXYZ');
    for (let i = 0; fakes.length < want && i < 500; i++) add(pickOne(pool, rng));
    const tiles = code.map((ch, k) => ({ ch, k })).concat(fakes.map((ch) => ({ ch, k: -1 })));
    const inOrder = (list) => {
      const ks = list.filter((t) => t.k >= 0).map((t) => t.k);
      return ks.every((k, i) => i === 0 || k > ks[i - 1]);
    };
    let out = shuffled(tiles, rng);
    for (let i = 0; i < 50 && code.length > 1 && inOrder(out); i++) out = shuffled(tiles, rng);
    return out;
  }

  /** 주제에 든 단어 전부(목록 밖 단어 막기와 판정에 쓴다) */
  function themeWords(id) {
    const t = THEMES.find((x) => x.id === id);
    return t ? t.words.slice() : [];
  }

  // ----- 사건 고르기
  /** pool 에서 이번 격자에 넣을 단어를 고른다. 모자라면 null */
  function pickWords(pool, codeSet, stage, rng) {
    const ok = shuffled(
      pool.filter((w) => {
        const t = chars(w);
        return t.length >= 2 && t.length <= stage.maxLen && w !== reverse(w) && t.every((ch) => !codeSet.has(ch));
      }),
      rng
    );
    const picked = [];
    const add = (w) => {
      if (picked.length < stage.count && !picked.includes(w) && !picked.some((v) => clash(v, w))) picked.push(w);
    };
    // 3글자 이상을 먼저 챙긴다(가짜 단어의 재료, 그리고 2글자만 나오는 판을 막는다)
    const longNeed = Math.max(2, stage.decoys + 1);
    ok.filter((w) => chars(w).length >= 3).slice(0, longNeed).forEach(add);
    if (picked.length < longNeed) return null;
    ok.forEach(add);
    return picked.length === stage.count ? shuffled(picked, rng) : null;
  }

  /**
   * 사건 하나(주제, 수수께끼, 암호, 찾을 단어)를 고른다.
   * opt: { stage, avoid[주제 id], custom: { letters[], text, riddle } | null, rng }
   */
  function makeCase(opt) {
    const rng = opt.rng || Math.random;
    const avoid = opt.avoid || [];
    const fresh = shuffled(THEMES.filter((t) => !avoid.includes(t.id)), rng);
    const themes = fresh.length ? fresh : shuffled(THEMES, rng);
    const face = (t) => ({ id: t.id, name: t.name, icon: t.icon });
    // 고르지 않은 같은 주제 단어: 격자에 우연히 생기지 않게 한다
    const others = (t, words) => t.words.filter((w) => !words.includes(w) && !words.some((v) => clash(v, w)));

    if (opt.custom) {
      const codeSet = new Set(opt.custom.letters);
      const made = { riddle: opt.custom.riddle, code: opt.custom.letters.slice(), codeText: opt.custom.text, custom: true };
      for (const t of themes) {
        const words = pickWords(t.words, codeSet, opt.stage, rng);
        if (words) return Object.assign(made, { theme: face(t), words, forbid: others(t, words) });
      }
      // 암호와 글자가 겹치는 단어가 너무 많으면 모든 주제에서 고른다
      const all = THEMES.reduce((list, t) => list.concat(t.words), []);
      const words = pickWords(all, codeSet, opt.stage, rng);
      if (!words) throw new Error('암호와 겹치지 않는 단어가 모자란다');
      return Object.assign(made, { theme: { id: 'mix', name: '뒤죽박죽', icon: '🎲' }, words, forbid: [] });
    }

    for (const t of themes) {
      for (const r of shuffled(t.riddles, rng)) {
        const words = pickWords(t.words, new Set(chars(r.a)), opt.stage, rng);
        if (words) return { theme: face(t), riddle: r.q, code: chars(r.a), codeText: r.a, custom: false, words, forbid: others(t, words) };
      }
    }
    throw new Error('단어가 모자란다'); // 자료 검사(checks)가 막아 준다
  }

  const api = {
    THEMES, STAGES, MAX_CODE, MAX_TILES, FILLER, BANNED,
    chars, reverse, clash, normalizeCode, similar, makeDecoy,
    findAll, judge, linePath, checkPuzzle, makePuzzle, makeTiles, themeWords, pickWords, makeCase,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WordPuzzle = api;
})(typeof window !== 'undefined' ? window : globalThis);
