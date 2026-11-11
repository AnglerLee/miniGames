// 게임 목록: 게임 목록 화면(hub.js)과 전체 관리자 화면(admin.html)이 함께 쓴다.
// 게임을 더하거나 이름을 바꿀 때는 여기만 고친다.
(function () {
  'use strict';
  // 분류: brain 두뇌, speed 순발력, body 몸으로, sense 카메라·소리
  window.ARCADE_GAMES = [
    { id: 'game02', path: '02-maze', icon: '🔑', name: '미로 탈출', tag: '열쇠를 모으고 유령을 피해 탈출', cat: 'brain', c: ['#3ddc97', '#36d6ff'] },
    { id: 'game03', path: '03-card-match', icon: '🃏', name: '짝 맞추기', tag: '외웠더니 카드가 자리를 바꾼다', cat: 'brain', c: ['#ff7ab6', '#b388ff'] },
    { id: 'game05', path: '05-sliding-puzzle', icon: '🧩', name: '숫자 퍼즐', tag: '가장 적은 이동으로 맞춰라', cat: 'brain', c: ['#4d8dff', '#36d6ff'] },
    { id: 'game07', path: '07-math-race', icon: '🏎️', name: '계산 레이스', tag: '문제를 풀어 라이벌보다 먼저 결승선으로', cat: 'speed', c: ['#ff9330', '#ffd43b'] },
    { id: 'game08', path: '08-word-search', icon: '🕵️', name: '단어 탐정', tag: '단어를 다 찾으면 남은 글자가 암호가 된다', cat: 'brain', c: ['#2fd17a', '#b6f36a'] },
    { id: 'game11', path: '11-sequence-tap', icon: '🔢', name: '넘버 러시', tag: '숫자를 순서대로! 그런데 규칙이 자꾸 바뀐다', cat: 'speed', c: ['#36d6ff', '#7c5cff'] },
    { id: 'game12', path: '12-color-rush', icon: '🌈', name: '색깔 스피드', tag: '뜻일까 색일까, 헷갈리는 규칙', cat: 'speed', c: ['#ff5d9e', '#ffb347'] },
    { id: 'game13', path: '13-energy-charge', icon: '⚡', name: '에너지 충전', tag: '흔들어 충전! 로봇이 돌아보면 멈춰!', cat: 'body', need: '흔들기', c: ['#ffd43b', '#ff9330'] },
    { id: 'game15', path: '15-decibel-meter', icon: '🎈', name: '목소리 비행선', tag: '크게 외치면 오르고 조용하면 내려가요', cat: 'sense', need: '마이크', c: ['#ff5d73', '#ffb347'] },
    { id: 'game16', path: '16-magic-compass', icon: '🧭', name: '매직 컴퍼스', tag: '보물 레이더! 삐삐 소리를 쫓아 몸을 빙글', cat: 'body', need: '방향', c: ['#4dd8ff', '#2fd17a'] },
    { id: 'game17', path: '17-barcode-scanner', icon: '👾', name: '바코드 몬스터', tag: '집 안 바코드를 찍으면 몬스터가 태어난다', cat: 'sense', need: '카메라', c: ['#b388ff', '#36d6ff'] },
    { id: 'game18', path: '18-color-hunter', icon: '🎨', name: '컬러 헌터', tag: '집 안에서 색을 찾아 팔레트 완성', cat: 'sense', need: '카메라', c: ['#ff7ab6', '#ffd43b'] },
    { id: 'game19', path: '19-reverse-audio', icon: '🔄', name: '리버스 오디오', tag: '거꾸로 들리는 동요와 목소리를 해독', cat: 'sense', c: ['#7c5cff', '#ff7ab6'] },
    { id: 'game20', path: '20-emoji-quiz', icon: '🤔', name: '이모지 퀴즈쇼', tag: '이모지를 보고 글자 타일로 답을 조립', cat: 'brain', c: ['#ffd43b', '#ff7ab6'] },
    { id: 'game21', path: '21-dual-touch', icon: '🤝', name: '둘이서 한 호흡', tag: '한 폰을 둘이 잡고 손가락 호흡 맞추기', cat: 'speed', c: ['#ff5d9e', '#4d8dff'] },
    { id: 'game22', path: '22-wifi-hacker', icon: '📡', name: '와이파이 해커', tag: '신호를 잡고 방화벽을 뚫고 암호를 추리', cat: 'brain', c: ['#2fd17a', '#36d6ff'] },
    { id: 'game23', path: '23-safe-cracker', icon: '🔓', name: '금고 털이', tag: '딸깍 소리로 찾는 세 개의 잠금', cat: 'speed', c: ['#ffd166', '#ff9330'] },
    { id: 'game24', path: '24-bomb-balance', icon: '💣', name: '폭탄 해체반', tag: '수평을 지키며 지시대로 해체하라', cat: 'body', need: '기울기', c: ['#ff5d73', '#ffd43b'] },
    { id: 'game25', path: '25-scratch-card', icon: '🎫', name: '복권 긁기', tag: '살짝 엿보고 어디를 끝까지 긁을지 정해라', cat: 'brain', c: ['#ffd166', '#ff7ab6'] },
    { id: 'game27', path: '27-stopwatch', icon: '⏱️', name: '타임 스나이퍼', tag: '시계가 사라져도 정확히 멈출 수 있을까', cat: 'speed', c: ['#36d6ff', '#b388ff'] },
  ];
})();
