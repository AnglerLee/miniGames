// 잠수함 간식호의 고정 내용: 구역, 고장, 부품, 단계, 난이도 값.

/** 부모가 고를 수 있는 방 예시 */
export const ROOM_PRESETS = [
  { name: '거실', icon: '🛋️' },
  { name: '부엌', icon: '🍳' },
  { name: '안방', icon: '🛏️' },
  { name: '아이 방', icon: '🧸' },
  { name: '화장실', icon: '🛁' },
  { name: '현관', icon: '🚪' },
  { name: '베란다', icon: '🪴' },
  { name: '서재', icon: '📚' },
  { name: '작은방', icon: '🧺' },
  { name: '옷방', icon: '👕' },
];

export const ROOM_ICONS = ['🛋️', '🍳', '🛏️', '🧸', '🛁', '🚪', '🪴', '📚', '🧺', '👕', '🎹', '🖥️', '🪜', '🧹'];

export const ROOMS_MIN = 4;
export const ROOMS_MAX = 6;

/**
 * 잠수함 구역. 방 수만큼 앞에서부터 쓴다 (4곳이면 조종실, 기관실, 산소실, 부품 창고).
 * 부품 창고는 "부품 가져오기" 고장에 꼭 필요해서 네 번째 안에 둔다.
 */
export const ROLES = [
  { id: 'helm', name: '조종실', icon: '🧭', color: '#4cc9f0' },
  { id: 'engine', name: '기관실', icon: '⚙️', color: '#ff9f43' },
  { id: 'oxygen', name: '산소실', icon: '🫧', color: '#7bed9f' },
  { id: 'storage', name: '부품 창고', icon: '📦', color: '#f6d365' },
  { id: 'radio', name: '통신실', icon: '📡', color: '#c79bff' },
  { id: 'hatch', name: '수문', icon: '🚪', color: '#ff6b81' },
];

/** 구역 쪽지 모양. 부모가 손으로 그리기 쉬운 것만 쓴다. */
export const CODE_SHAPES = ['●', '▲', '■', '★', '♥', '◆'];
export const CODE_SHAPE_NAMES = ['동그라미', '세모', '네모', '별', '하트', '마름모'];

/** 수리 종류 (js/play/tasks/ 의 모듈 이름과 같다) */
export const TASKS = {
  valve: { name: '밸브 돌리기' },
  pipes: { name: '배관 잇기' },
  gauge: { name: '압력 맞추기' },
  leak: { name: '물 새는 곳 막기' },
  pump: { name: '펌프질' },
  reboot: { name: '재시동 암호' },
};

/**
 * 구역마다 날 수 있는 고장. title 은 경보에 그대로 뜬다.
 * part 가 있으면 부품 창고에서 그 부품을 가져와야 고칠 수 있다.
 */
export const PROBLEMS = {
  helm: [
    { task: 'reboot', title: '조종 컴퓨터가 멈췄다' },
    { task: 'gauge', title: '수평 장치가 흔들린다' },
    { task: 'pipes', title: '조종 배선이 끊어졌다', part: 'fuse' },
  ],
  engine: [
    { task: 'valve', title: '냉각 밸브가 잠겼다' },
    { task: 'gauge', title: '엔진 압력이 치솟는다' },
    { task: 'pump', title: '연료가 돌지 않는다', part: 'battery' },
  ],
  oxygen: [
    { task: 'leak', title: '산소관에서 물이 샌다' },
    { task: 'pump', title: '산소가 모자란다' },
    { task: 'valve', title: '공기 정화기가 막혔다', part: 'filter' },
  ],
  storage: [
    { task: 'pipes', title: '창고 배관이 터졌다' },
    { task: 'leak', title: '창고 벽에 금이 갔다' },
  ],
  radio: [
    { task: 'reboot', title: '통신기가 먹통이다' },
    { task: 'pipes', title: '안테나 선이 풀렸다' },
    { task: 'gauge', title: '주파수가 흔들린다', part: 'fuse' },
  ],
  hatch: [
    { task: 'leak', title: '수문 틈으로 물이 들어온다' },
    { task: 'valve', title: '수문 잠금이 풀리고 있다' },
    { task: 'pump', title: '배수 펌프가 멈췄다', part: 'gasket' },
  ],
};

export const PARTS = {
  fuse: { name: '퓨즈', icon: '🔌' },
  battery: { name: '배터리', icon: '🔋' },
  filter: { name: '필터', icon: '🧽' },
  gasket: { name: '고무 패킹', icon: '⭕' },
};

/** 한 번에 들 수 있는 부품 수 */
export const CARRY_MAX = 2;

/** 암호 전달에 쓰는 기호 */
export const RELAY_SYMBOLS = ['🐙', '🐠', '🦀', '🐚', '⚓', '🪸'];

/**
 * 단계. dock 은 시간 제한 없이 모든 구역을 한 번씩 돌며 아이의 걸음을 잰다.
 * depth 는 그 단계가 끝났을 때의 수심(m)이다.
 */
export const STAGES = [
  { id: 'dock', name: '출항 점검', depth: 0, lead: '모든 구역을 한 번씩 돌며 전원을 켜자. 평소 걸음으로 걸어. 이 걸음이 기준이 돼.' },
  { id: 'dive', name: '잠항', depth: 300, lead: '잠수 시작. 고장 경보가 뜨면 그 구역으로 가서 고쳐.' },
  { id: 'deep', name: '심해', depth: 800, lead: '수압이 세졌어. 고장이 두 곳에서 한꺼번에 날 수 있어. 급한 것부터!' },
  { id: 'salvage', name: '보물 인양', depth: 1000, lead: '바닥에 닿았어. 좌표를 외워서 전달하고, 크레인으로 상자를 끌어올리자.' },
  { id: 'rise', name: '긴급 부상', depth: 0, lead: '상자를 실었어! 선체가 버티는 동안 물 위로 올라가자. 마지막 고비야.' },
];

/**
 * 난이도별 값. 모두 시작값이며 실제로 해 본 뒤 고친다.
 *   factor     걸음 한 번에 주는 여유 배수 (클수록 쉽다). 제한 시간 = 걸음 × 횟수 × factor + 수리 시간
 *   hull       선체 내구도 (고장을 놓치면 깎인다. 0 이면 그 단계를 다시 한다)
 *   waves      단계별 경보 묶음 수 [잠항, 심해, 인양, 부상]
 *   doubles    단계별로 두 곳이 한꺼번에 고장 나는 묶음 수
 *   queries    도착 확인 질문 종류
 *   level      수리 놀이 난이도 0~2
 *   relayLen   외워서 전달할 기호 수
 *   routeLen   크레인 순서 길이
 *   showMs     암호와 순서를 보여 주는 시간
 */
export const DIFFICULTY = [
  { name: '쉬움', factor: 2.4, hull: 6, waves: [3, 3, 2, 3], doubles: [0, 1, 0, 1], queries: ['pos'], level: 0, relayLen: 3, routeLen: 3, showMs: 7000 },
  { name: '보통', factor: 1.9, hull: 5, waves: [3, 4, 2, 4], doubles: [0, 2, 0, 2], queries: ['pos', 'max', 'min'], level: 1, relayLen: 4, routeLen: 4, showMs: 6000 },
  { name: '어려움', factor: 1.55, hull: 4, waves: [4, 5, 3, 5], doubles: [1, 3, 1, 3], queries: ['pos', 'pair', 'max', 'min'], level: 2, relayLen: 5, routeLen: 5, showMs: 5000 },
];

/** 걸음(구역 사이를 한 번 이동하는 시간) 값. dock 에서 잰 값을 이 범위로 자른다. */
export const HOP = { defaultMs: 20000, minMs: 9000, maxMs: 45000 };

/** 수리 놀이 하나에 주는 시간과 경보를 읽고 반응하는 시간 */
export const TASK_ALLOW_MS = 16000;
export const REACT_MS = 6000;
/** 도착 확인(숫자 입력)에 주는 시간 */
export const CHECKIN_MS = 4000;

/** 보물 공개 방식 */
export const TREASURE_KINDS = [
  { id: 'lock', label: '숫자 자물쇠 번호', lead: '자물쇠 번호', placeholder: '예: 3 - 1 - 7' },
  { id: 'place', label: '보물을 숨긴 곳', lead: '보물이 있는 곳', placeholder: '예: 세탁기 안' },
  { id: 'key', label: '열쇠를 둔 곳', lead: '열쇠가 있는 곳', placeholder: '예: 신발장 둘째 칸' },
  { id: 'text', label: '직접 쓰는 문구', lead: '인양한 상자 안의 쪽지', placeholder: '예: 엄마에게 "임무 완료"라고 말하기' },
];

export const BONUS_RULES = [
  { id: 'A', label: 'A 등급 이상' },
  { id: 'S', label: 'S 등급만' },
  { id: 'always', label: '등급과 상관없이' },
];
