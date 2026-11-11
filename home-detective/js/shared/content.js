// 게임에 쓰는 고정 내용: 시간대, 방과 인형 예시, 말투, 무늬 이름, 난이도 값.

/** 진술에 나오는 세 시각. 사건은 이 중 한 시각에 일어난다. */
export const SLOT_LABELS = ['오후 2시', '오후 3시', '오후 4시'];
/** 시계 장면이 그릴 시각 (24시간제 시) */
export const SLOT_HOURS = [14, 15, 16];

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

/** 방 아이콘으로 고를 수 있는 그림 */
export const ROOM_ICONS = ['🛋️', '🍳', '🛏️', '🧸', '🛁', '🚪', '🪴', '📚', '🧺', '👕', '🎹', '🖥️', '🪜', '🧹'];

/** 용의자 예시 (부모가 이름을 집에 있는 인형 이름으로 바꾼다) */
export const SUSPECT_PRESETS = [
  { name: '곰돌이', icon: '🧸' },
  { name: '토끼', icon: '🐰' },
  { name: '로봇', icon: '🤖' },
  { name: '공룡', icon: '🦖' },
  { name: '펭귄', icon: '🐧' },
  { name: '고양이', icon: '🐱' },
];

/** 용의자 얼굴로 고를 수 있는 그림 */
export const SUSPECT_ICONS = [
  '🧸', '🐰', '🤖', '🦖', '🐧', '🐱', '🐶', '🦄', '🐼', '🦊', '🐸', '🐵',
  '🦁', '🐯', '🐷', '🐥', '🐙', '🦈', '👾', '🚗', '🪆', '⚽',
];

/** 발자국 무늬 (draw.js 의 drawFootprint 와 번호가 같다) */
export const FOOT_PATTERNS = ['줄무늬', '물방울무늬', '별무늬', '지그재그'];

/** 지문 모양 (draw.js 의 drawFingerprint 와 번호가 같다) */
export const PRINT_TYPES = ['소용돌이형', '고리형', '활형'];

/** 쪽지 기호. 부모가 손으로 그리기 쉬운 모양만 쓴다. */
export const CODE_SHAPES = ['●', '▲', '■', '★', '♥', '◆'];
export const CODE_SHAPE_NAMES = ['동그라미', '세모', '네모', '별', '하트', '마름모'];

/**
 * 말투. 진술의 뜻은 같고 앞뒤 말만 다르다.
 * hello: 처음 만났을 때, pre: 진술 앞, post: 진술 뒤, bye: 탐문이 끝났을 때
 */
export const PERSONAS = [
  {
    id: 'grumpy',
    name: '투덜이',
    hello: ['또 뭘 물어보려고? 바쁘단 말이야.', '흥, 탐정 놀이야? 빨리 물어봐.'],
    pre: ['몇 번을 말해.', '잘 들어.', '하아…'],
    post: ['됐지?', '이제 그만 물어봐.', '진짜라니까.'],
    bye: '다 말했으니까 이제 가 봐.',
  },
  {
    id: 'timid',
    name: '겁쟁이',
    hello: ['히익! 저, 저는 아무것도 몰라…', '타, 탐정님…? 나 잡으러 온 거 아니지?'],
    pre: ['그, 그게…', '음… 그러니까…', '화내지 마…'],
    post: ['정말이야…', '믿어 줘…', '틀림없어… 아마도…'],
    bye: '이, 이제 가도 되지…?',
  },
  {
    id: 'boaster',
    name: '허풍쟁이',
    hello: ['오! 명탐정이 나를 찾아왔군. 영광인 줄 알라고!', '에헴, 이 몸의 증언이 필요하다고?'],
    pre: ['이 몸으로 말할 것 같으면,', '똑똑히 기억하지!', '에헴.'],
    post: ['내 기억력은 세계 최고야!', '어때, 대단하지?', '틀릴 리가 없지.'],
    bye: '도움이 필요하면 언제든 이 몸을 찾으라고!',
  },
  {
    id: 'sleepy',
    name: '잠꾸러기',
    hello: ['으음… 누구야… 아직 졸린데…', '하아암… 탐정…? 무슨 일이야…'],
    pre: ['으음…', '하아암…', '잠깐만… 아, 맞다.'],
    post: ['…졸려.', '그랬던 것 같아… 쿨…', '이제 자도 돼…?'],
    bye: '그럼 난 다시 잘게… 쿨쿨…',
  },
  {
    id: 'polite',
    name: '모범생',
    hello: ['안녕, 탐정님. 수사에 협조할게.', '물어보고 싶은 게 있으면 차례대로 물어봐.'],
    pre: ['정확히 말할게.', '기록해 둬.', '분명히 기억해.'],
    post: ['이상이야.', '틀림없어.', '확실해.'],
    bye: '수사 잘 되길 바랄게.',
  },
  {
    id: 'chatty',
    name: '수다쟁이',
    hello: ['어머 어머, 탐정이야? 나 할 말 진짜 많아!', '드디어 왔구나! 소문 들었어? 간식이 없어졌대!'],
    pre: ['있잖아 있잖아,', '그게 말이야,', '내가 봤는데 말이지,'],
    post: ['진짜 신기하지 않아?', '아 맞다, 이건 비밀이야!', '근데 범인은 누굴까?'],
    bye: '또 물어볼 거 생기면 꼭 다시 와!',
  },
];

/**
 * 난이도별 값. 모두 시작값이며 실제로 해 본 뒤 고친다.
 * suspects: 용의자 수, evidence: 증거 수(시계 포함), minutes: 기본 제한 시간
 * detail: 진술에 같이 있던 사람을 말해 줄 확률 (높을수록 쉽다)
 * herring: 사건과 무관한 증거 수
 */
export const DIFFICULTY = [
  { name: '쉬움', suspects: 4, evidence: 3, minutes: 30, detail: 0.9, herring: 0, hintGapSec: 180 },
  { name: '보통', suspects: 5, evidence: 4, minutes: 28, detail: 0.7, herring: 0, hintGapSec: 240 },
  { name: '어려움', suspects: 6, evidence: 5, minutes: 25, detail: 0.5, herring: 1, hintGapSec: 300 },
];

/** 방 수 범위 */
export const ROOMS_MIN = 4;
export const ROOMS_MAX = 6;

/** 보물 공개 방식 */
export const TREASURE_KINDS = [
  { id: 'lock', label: '숫자 자물쇠 번호', lead: '자물쇠 번호', placeholder: '예: 3 - 1 - 7' },
  { id: 'place', label: '보물을 숨긴 곳', lead: '보물이 있는 곳', placeholder: '예: 세탁기 안' },
  { id: 'key', label: '열쇠를 둔 곳', lead: '열쇠가 있는 곳', placeholder: '예: 신발장 둘째 칸' },
  { id: 'text', label: '직접 쓰는 문구', lead: '범인의 자백', placeholder: '예: 엄마에게 "수사 끝"이라고 말하기' },
];

/** 보너스 보상을 주는 기준 */
export const BONUS_RULES = [
  { id: 'A', label: 'A 등급 이상' },
  { id: 'S', label: 'S 등급만' },
  { id: 'always', label: '등급과 상관없이' },
];
