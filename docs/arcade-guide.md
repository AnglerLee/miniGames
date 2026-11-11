# 미니게임 공통 엔진 안내서

미니게임 20개가 함께 쓰는 화면 틀과 진행 관리 도구입니다. 게임마다 따로 만들던 타이머, 모달, 효과음, 성공 처리를 한곳에 모았고, 게임은 "무엇이 재미있는가"에만 집중하도록 했습니다.

- 엔진: `assets/js/arcade.js` (전역 `Arcade`)
- 스타일: `assets/css/arcade.css` (`ar-` 로 시작하는 클래스)
- 관리자 도구: `assets/js/admin-kit.js` (전역 `AdminKit`)
- 본보기 게임: `games/12-color-rush/`

## 1. 기획 기준

한 번 풀고 끝나는 과제가 아니라, 한 판 안에 흐름이 있는 게임이어야 합니다.

| 항목 | 기준 |
|---|---|
| 한 판 길이 | 1분 30초 ~ 3분 |
| 스테이지 | 3개 안팎. 스테이지마다 숫자만 키우지 말고 **새 규칙이나 장애물**을 하나씩 더한다 |
| 긴장 장치 | 줄어드는 시간, 하트, 쫓아오는 것 가운데 하나 이상이 화면에 항상 보인다 |
| 잘할수록 보상 | 콤보, 속도 보너스, 피버처럼 잘하는 순간이 눈과 귀로 드러난다 |
| 실수의 대가 | 실수하면 하트나 시간을 잃는다. 무제한 재도전으로 뚫리는 구조를 만들지 않는다 |
| 선택 | 가능하면 "안전하게 갈까, 욕심낼까"를 고르는 지점을 하나 둔다 |
| 실패와 재도전 | 실패하면 그 스테이지부터 다시 한다(`checkpoint`). 재도전할수록 조금 쉬워진다(`game.retry`) |
| 별 등급 | 클리어하면 별 1~3개. 별 3개는 실수 없이 잘해야 받는다. 재도전으로 깬 판은 최대 2개 |
| 대상 | 초등 고학년(10~12세)과 부모. 글은 짧게, 규칙은 한 줄로 |

운에만 맡기는 판정은 피합니다. 아이가 "내가 잘해서 깼다"고 느낄 수 있어야 합니다.

## 2. 파일 구성

```
games/NN-이름/
  index.html      아래 틀 그대로. 내용은 game.js 가 만든다
  game.js         게임 로직 (즉시 실행 함수로 감싼다)
  style.css       이 게임만의 스타일
  admin.html      관리자 설정 화면
  admin.js        AdminKit.page({...}) 선언
  docs/design.md  기획 문서 (핵심 재미, 스테이지, 점수와 별 기준, 설정값)
```

`index.html` 틀:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">
    <title>게임 이름</title>
    <link rel="icon" href="data:,">
    <link rel="stylesheet" href="../../assets/css/arcade.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <script src="../../assets/js/arcade.js"></script>
    <script src="game.js"></script>
</body>
</html>
```

예전 `common.js`, `common.css`, `treasure-hunt/js/core.js` 는 새 게임에서 불러오지 않습니다. 쓰지 않게 된 옛 파일은 지웁니다.

## 3. 게임 만들기

```js
(function () {
  'use strict';
  const { h, sfx, fx } = Arcade;

  function start(game) {
    // 재도전할 때마다 다시 불린다. 여기서 화면을 만들고 판을 시작한다.
    const board = h('div', { class: 'my-board' });
    game.root.append(board);
    game.setStage(game.checkpoint, 3);
    game.setGoal('목표를 <b>한 줄</b>로');
    game.startTimer(60, { onEnd: () => game.lose({ message: '시간이 다 됐어요.' }) });
  }

  Arcade.createGame({
    id: 'game12',            // 보물찾기가 아는 게임 ID. 바꾸면 안 된다
    title: '색깔 스피드',
    icon: '🌈',
    accent: '#ff5d9e',       // 이 게임의 강조색 두 가지
    accent2: '#ffb347',
    tagline: '시작 화면에 나오는 한 줄 소개',
    howTo: ['규칙 1', '규칙 2', '규칙 3'],   // 3줄 이하. <b> 로 강조
    lives: 3,                // 하트를 쓰면
    stages: 3,               // 스테이지 진행 칸을 쓰면
    start,
  });
})();
```

`createGame` 이 하는 일은 다음과 같습니다.

- 시작 화면(소개, 규칙, 내 기록)과 3-2-1 카운트다운
- 위쪽 HUD: 일시 정지, 스테이지 칸, 점수, 하트, 시간 막대, 목표 한 줄
- 일시 정지 화면(계속, 소리 켜고 끄기, 처음부터), 탭을 벗어나면 자동 정지. 멈춘 동안에는 판이 완전히 가려진다
- 결과 화면: 별, 점수, 신기록, 통계, 다시 하기
- 기록 저장과 보물찾기 완료 신호

### createGame 옵션

| 옵션 | 뜻 |
|---|---|
| `id`, `title`, `icon`, `tagline`, `howTo` | 기본 정보 |
| `accent`, `accent2` | 강조색 (버튼, 시간 막대) |
| `lives` | 하트 수. 없으면 하트를 그리지 않는다 |
| `stages` | 스테이지 수. 없으면 진행 칸을 그리지 않는다 |
| `showScore` | `false` 면 점수를 숨긴다 |
| `scoreUnit` | 점수 단위. 기본 `'점'` |
| `lowerIsBetter` | 점수가 낮을수록 좋은 기록이면 `true` |
| `countdown` | `false` 면 3-2-1 없이 바로 시작 |
| `music` | `false` 면 배경 리듬을 끈다. **마이크를 쓰는 게임은 반드시 끈다** |
| `startLabel` | 시작 버튼 글자 |
| `prepare(game)` | 시작 버튼을 누른 그 순간에 불린다. 센서·카메라·마이크 권한은 여기서 요청한다. Promise 를 돌려줘도 된다(최대 10초까지 기다린다) |
| `start(game)` | 판 시작. 재도전 때마다 다시 불린다 |
| `onPause(game)`, `onResume(game)` | 일시 정지와 재개 때 |
| `onEnd(game, cleared)` | 판이 끝났을 때 |

### game 객체

화면

| 이름 | 뜻 |
|---|---|
| `game.root` | 게임 화면을 넣는 곳. 가운데 정렬된 세로 flex 상자 |
| `game.footer` | 아래쪽 버튼 줄. 비어 있으면 보이지 않는다 |
| `game.setGoal(html)` | HUD 아래 목표 한 줄 |
| `game.setStage(index, total)` | 스테이지 칸. index 는 0부터 |
| `game.banner(title, sub, { ms, kind })` | 화면 가운데 큰 안내 띠. `await` 하면 사라진 뒤 이어진다 |

점수, 콤보, 하트

| 이름 | 뜻 |
|---|---|
| `game.score`, `game.setScore(n)`, `game.addScore(n, at)` | `at` 에 엘리먼트를 주면 그 자리에 `+n` 이 떠오른다 |
| `game.addCombo()` | 콤보 +1. 음이 반음씩 올라간다. 현재 콤보를 돌려준다 |
| `game.resetCombo()`, `game.combo`, `game.maxCombo` | |
| `game.loseLife(at)` | 하트 -1, 화면이 흔들린다. 남은 수를 돌려준다. **0 이면 게임이 직접 `lose()` 를 부른다** |
| `game.gainLife()`, `game.setLives(n, max)`, `game.lives` | 하트를 중간 스테이지부터 보이려면 `lives` 옵션 없이 `game.setLives(3, 3)` |

시간과 예약. 모두 게임 시계를 따르므로 일시 정지하면 함께 멈추고, 재시작하면 지난 판의 예약은 사라집니다. **`setTimeout`, `setInterval`, `requestAnimationFrame` 을 직접 쓰지 말고 아래 것을 씁니다.**

| 이름 | 뜻 |
|---|---|
| `game.startTimer(초, { onEnd, warnAt })` | HUD 시간 막대. 돌려주는 객체로 `left()`, `ratio()`(남은 비율 0~1), `add(초, { silent })`, `pause()`, `resume()`, `stop()` |
| `game.timeLeft()`, `game.stopTimer()`, `game.hideTimer()` | |
| `game.setMusic(켜기)` | 이번 판의 배경 리듬을 끄거나 다시 켠다. 게임이 직접 박자를 내는 스테이지에서 쓴다. 일시 정지 뒤에도 그 상태가 유지된다 |
| `game.setTension(0~1)` | 배경 리듬 긴장도의 하한. 쫓아오는 적이 가까울 때처럼 시간과 무관한 긴장을 올린다 |
| `game.after(ms, fn)`, `game.every(ms, fn)` | 돌려주는 함수를 부르면 취소 |
| `game.loop(fn)` | 매 프레임 `fn(dt초, 시간초)` |
| `game.wait(ms)` | 게임 시계 기준 Promise |
| `game.tween(ms, step, ease)` | 게임 시계로 도는 움직임. `step(k)` 이 0→1 로 불린다. Promise 를 돌려준다 |
| `game.time` | 이번 판에서 플레이한 시간(초) |
| `game.on(대상, 이벤트, 함수, 옵션)` | `window`, `document` 에 거는 이벤트. 재시작 때 자동으로 풀린다 |
| `game.onPauseChange(fn)` | 이번 판에서만 쓰는 일시 정지 알림. 멈출 때 `fn(true)`, 이어 갈 때 `fn(false)`. `start()` 안에서 등록하면 그 판의 상태에 바로 닿는다 |
| `game.onCleanup(fn)` | 판이 끝나거나 재시작될 때 할 정리. 카메라, 마이크, 센서는 여기서 끈다 |

끝내기

| 이름 | 뜻 |
|---|---|
| `game.win({ stars, title, message, stats })` | 클리어. `stats` 는 `[['이름', '값'], ...]` 4줄 이하 |
| `game.lose({ title, message, icon, checkpoint })` | 실패. `checkpoint` 에 스테이지 번호를 주면 재도전이 거기서 시작한다 |
| `game.retry` | 재도전 횟수. 시간을 조금 더 주는 식으로 난이도를 풀어 준다 |
| `game.checkpoint` | 재도전이 시작할 스테이지 번호. `start()` 에서 읽는다 |
| `game.playing`, `game.phase` | 입력을 받을 때 `if (!game.playing) return;` 으로 막는다 |
| `game.config`, `game.debug`, `game.embedded` | `createGame` 에 준 옵션, `?debug=1` 여부, 보물찾기 안인지 |

### Arcade 도우미

| 이름 | 뜻 |
|---|---|
| `Arcade.h(tag, attrs, children)` | 엘리먼트 만들기. `class`, `text`, `html`, `style`, `dataset`, `on이벤트` |
| `Arcade.loadSettings(key, defaults)` | 관리자 설정 읽기 |
| `Arcade.store.get/set/remove` | localStorage (JSON) |
| `Arcade.rand`, `randInt`, `pick`, `shuffle`, `clamp`, `lerp`, `wait`, `fmt`, `formatTime` | |
| `Arcade.sfx(name, arg)` | 효과음 |
| `Arcade.vibrate(pattern)` | 진동. 아이폰은 진동이 없으므로 소리와 화면 효과를 반드시 함께 낸다 |
| `Arcade.fx.burst(대상, { count, colors, emoji, spread })` | 조각이 터진다 |
| `Arcade.fx.floatText(대상, 글, { color, size })` | 글자가 떠오른다 |
| `Arcade.fx.shake(엘리먼트, 세기)`, `flash(색)`, `confetti()`, `toast(html, { kind: 'good'|'bad'|'gold', ms })`, `pop(엘리먼트)` | |
| `Arcade.audio.music.setIntensity(0~1)` | 배경 리듬의 긴장도. 시간 막대가 있으면 남은 시간에 따라 자동으로 오른다 |
| `Arcade.audio.tone({ freq, to, type, dur, vol })`, `noise({...})` | 직접 소리 만들기 |
| `Arcade.audio.context()` | 마이크 분석에 쓸 AudioContext |
| `Arcade.sensors.requestMotion()` | 기울기·흔들기 권한. `prepare` 안에서 부른다 |
| `Arcade.embedded` | 보물찾기 안에서 열렸는가 |

효과음 이름: `tap` `pick` `flip` `pop` `good` `great` `perfect` `bad` `miss` `combo` `tick` `warn` `count` `go` `stage` `win` `lose` `star` `coin` `bonus` `whoosh` `lock` `unlock` `power` `zap` `boom` `heart`

### 스타일 부품

| 클래스 | 용도 |
|---|---|
| `ar-btn` + `lg` `sm` `block` `ghost` `good` `bad` `gold` | 버튼 |
| `ar-card` | 반투명 상자 |
| `ar-chip` | 알약 모양 작은 표시 |
| `ar-choices` | 2열 보기 버튼 묶음 |
| `ar-label`, `ar-big`, `ar-dim`, `ar-hidden` | 글자 |
| `ar-input` | 글자 입력창 |
| `ar-pop`, `ar-shake`, `ar-pulse` | 짧은 움직임 |

콤보 표시(`.ar-combo`)는 게임 화면 맨 위 가운데에 뜹니다. 그 자리를 가리면 안 되는 게임은 자기 `style.css` 에서 `.ar-combo` 의 위치를 옮깁니다. 위아래(`top`)만 옮길 때는 그것으로 충분합니다. 가운데에서 벗어나게 옮길 때는 `transform: none` 을 주고, 튀는 움직임(`.ar-combo.bump` 의 `animation`)도 가운데 정렬이 없는 자기 키프레임으로 바꿉니다(엔진의 키프레임에는 `translateX(-50%)` 가 들어 있다). 아예 숨기고 게임 화면 안에 직접 그려도 됩니다. 일시 정지 중에는 `.ar-app` 에 `ar-paused` 클래스가 붙고 CSS 움직임이 함께 멈춥니다.

색은 CSS 변수로 씁니다: `--ar-accent` `--ar-accent-2` `--ar-good` `--ar-bad` `--ar-gold` `--ar-text` `--ar-dim` `--ar-panel` `--ar-panel-2` `--ar-line`. 게임 전용 클래스는 게임마다 짧은 접두사를 붙입니다(예: `cr-`).

## 4. 화면 규칙

- 세로 화면 한 장에 모두 들어와야 합니다. 360×640 에서도 스크롤이 생기면 안 됩니다.
- 누르는 것은 48px 이상. 주로 누르는 버튼은 엄지가 닿는 아래쪽(`game.footer`)에 둡니다.
- 빠른 반응이 필요한 버튼은 `click` 대신 `pointerdown` 으로 받습니다.
- 끌거나 돌리는 영역에는 `touch-action: none` 을 줍니다.
- 정답·오답·획득은 색, 움직임, 소리가 함께 나와야 합니다.
- `alert`, `confirm`, `prompt` 는 쓰지 않습니다.
- 화면의 글, 주석, 문서는 모두 한국어로 씁니다.
- 센서·카메라·마이크가 없거나 거부된 기기에서도 끝까지 할 수 있는 대체 조작을 둡니다. PC 에서 시험할 수 있어야 합니다.

## 5. 보물찾기 연동

보물찾기(`treasure-hunt3/play.html`)는 게임을 iframe 으로 열고 `GAME_CLEAR` 메시지를 기다립니다. 엔진이 다음을 맡으므로 게임은 `game.win()` 만 부르면 됩니다.

- 클리어 결과 화면에서 "다음으로"를 누르면 `{ type: 'GAME_CLEAR', gameId }` 를 부모에게 보냅니다. 누르지 않아도 15초 뒤에 보냅니다.
- 보물찾기 안에서는 "게임 목록" 버튼이 나오지 않습니다.
- 부모가 보내는 `THEME_BG` 배경을 적용합니다.

게임 ID(`game02` ~ `game27`)와 폴더 이름은 보물찾기 설정에 저장되어 있으므로 바꾸지 않습니다.

## 6. 관리자 페이지

게임 화면과 설정 화면은 분리합니다. 설정은 기존과 같은 localStorage 키에 저장합니다.

```html
<link rel="stylesheet" href="../../assets/css/admin-theme.css">
...
<script src="../../assets/js/admin-kit.js"></script>
<script src="admin.js"></script>
```

```js
AdminKit.page({
    title: '색깔 스피드 설정',
    storageKey: 'color_rush_settings',
    recordId: 'game12',
    note: '이 게임이 어떻게 진행되는지 한두 문장',
    presets: [            // 쉬움, 보통, 어려움의 기본값
        { questionTime: 3.6, quota: 6, lives: 4 },
        { questionTime: 2.8, quota: 8, lives: 3 },
        { questionTime: 2.2, quota: 10, lives: 3 }
    ],
    fields: [             // 난이도에 따라 기본값이 바뀌는 칸
        { key: 'questionTime', label: '문제당 시간 (초)', min: 1, max: 10, step: 0.1, help: '설명' }
    ],
    extras: [             // 난이도와 무관한 칸. default 가 필요하다
        { section: '기타' },
        { key: 'password', label: '비밀번호', type: 'text', default: '1234', wide: true }
    ],
    onRender(form, api) { /* 사진 올리기처럼 직접 만든 부분을 덧붙인다 */ }
});
```

저장되는 모양은 `{ difficulty: 0|1|2, ...값, lastUpdated }` 입니다. 게임은 `difficulty` 로 기본값을 고른 뒤 저장된 값으로 덮어씁니다. 기본값 표는 `game.js` 와 `admin.js` 두 곳에 있으므로 함께 고칩니다.

칸 종류: `number`(기본), `text`, `select`(`options: [[값, 이름]]`), `checkbox`, `textarea`. `wide: true` 는 한 줄을 다 씁니다.

## 7. 검증

주소에 `?debug=1` 을 붙이면 `window.__arcade = { game, state }` 가 생깁니다. 게임은 자동 검증을 위해 `window.__game` 에 작은 조작 창구를 엽니다(본보기 게임의 `answerRight`, `answerWrong` 참고).

확인할 것

- 처음부터 끝까지 클리어가 되고, 결과 화면에 별과 점수가 나온다
- 실패하면 실패 화면이 나오고, 다시 도전하면 그 스테이지부터 이어진다
- 일시 정지하면 시간과 움직임이 멈추고, 계속하면 이어진다
- 보물찾기 안에서 클리어하면 `GAME_CLEAR` 가 한 번만 간다
- 390×844 와 360×640 에서 스크롤이 없다
- 콘솔에 오류가 없다
- 관리자 페이지에서 저장한 값이 게임에 반영된다
