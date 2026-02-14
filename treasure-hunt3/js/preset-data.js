/* ===== preset-data.js - 5 Preset Scenario Data ===== */

const GAME_INFO = {
    'game02': { name: '미로 탈출', icon: '🌀', path: '02-maze', category: 'puzzle' },
    'game03': { name: '짝 맞추기', icon: '🃏', path: '03-card-match', category: 'puzzle' },
    'game05': { name: '숫자 퍼즐', icon: '🔢', path: '05-sliding-puzzle', category: 'puzzle' },
    'game07': { name: '빠른 계산', icon: '➕', path: '07-math-race', category: 'puzzle' },
    'game08': { name: '단어 찾기', icon: '🔤', path: '08-word-search', category: 'puzzle' },
    'game11': { name: '순서대로 터치', icon: '🔢', path: '11-sequence-tap', category: 'action' },
    'game12': { name: '색깔 스피드', icon: '🌈', path: '12-color-rush', category: 'action' },
    'game13': { name: '에너지 충전', icon: '⚡', path: '13-energy-charge', category: 'sensor', badge: '📱' },
    'game15': { name: '데시벨 측정기', icon: '🔊', path: '15-decibel-meter', category: 'audio', badge: '🎤' },
    'game16': { name: '매직 컴퍼스', icon: '🧭', path: '16-magic-compass', category: 'sensor', badge: '📱' },
    'game17': { name: '바코드 스캐너', icon: '📱', path: '17-barcode-scanner', category: 'camera', badge: '📷' },
    'game18': { name: '컬러 헌터', icon: '🎨', path: '18-color-hunter', category: 'camera', badge: '📷' },
    'game19': { name: '리버스 오디오', icon: '🔄', path: '19-reverse-audio', category: 'audio', badge: '🎤' },
    'game20': { name: '이모지 넌센스', icon: '🤔', path: '20-emoji-quiz', category: 'puzzle' },
    'game21': { name: '동시 터치 협동', icon: '🤝', path: '21-dual-touch', category: 'action' },
    'game22': { name: '와이파이 해커', icon: '📡', path: '22-wifi-hacker', category: 'puzzle' },
    'game23': { name: '디지털 금고 털이', icon: '🔓', path: '23-safe-cracker', category: 'special' },
    'game24': { name: '폭탄 해체', icon: '💣', path: '24-bomb-balance', category: 'sensor', badge: '📱' },
    'game25': { name: '복권 긁기', icon: '🎫', path: '25-scratch-card', category: 'special' },
    'game27': { name: '절대음감 스톱워치', icon: '⏱️', path: '27-stopwatch', category: 'action' }
};

const PRESET_DATA = {
    /* ===== Mystery: 4 missions ===== */
    mystery: {
        id: 'preset-mystery',
        name: '미스테리 탐정단',
        theme: 'mystery',
        description: '비밀 금고를 찾아라! 탐정단원이 되어 단서를 모아 금고의 암호를 풀어보자.',
        introText: '탐정단 본부에서 긴급 연락이 왔다.\n\n마을 어딘가에 숨겨진 비밀 금고에 중요한 보물이 들어있다고 한다.\n\n금고의 암호를 알아내기 위해서는 곳곳에 흩어진 단서를 모아야 한다.\n\n탐정단원이여, 지금 바로 수사를 시작하라!',
        treasurePassword: '범인은탐정',
        missions: [
            {
                type: 'minigame',
                gameId: 'game22',
                clue: { type: 'text', content: '범인은' },
                storyText: '용의자의 폰에서 수상한 와이파이 신호가 잡힌다. 해킹해서 증거를 확보하라!',
                hintMessage: '',
                secretCode: '🔍',
                successMessage: '해킹 성공! 용의자의 통신 기록에서 첫 번째 단서를 찾았다!'
            },
            {
                type: 'findObject',
                hints: ['거실 어딘가에 증거물이 숨겨져 있다', '쿠션 아래를 확인해볼까?', '소파 근처를 잘 살펴봐'],
                answers: ['메모', '쪽지', '메모지'],
                clue: { type: 'text', content: '탐정' },
                storyText: '제보자가 거실에 중요한 메모를 남겼다고 한다. 찾아내라!'
            },
            {
                type: 'minigame',
                gameId: 'game03',
                clue: { type: 'text', content: '' },
                storyText: '암호화된 카드 메시지를 해독해야 한다. 짝을 맞춰 메시지를 복원하라!',
                hintMessage: '',
                secretCode: '🕵️',
                successMessage: '카드 해독 완료! 범인의 행적이 드러나고 있다!'
            },
            {
                type: 'minigame',
                gameId: 'game23',
                clue: { type: 'text', content: '' },
                storyText: '드디어 범인의 금고를 발견했다! 다이얼을 돌려 열어라!',
                hintMessage: '',
                secretCode: '🔐',
                successMessage: '금고 해제 성공! 사건의 전모가 밝혀졌다!'
            }
        ],
        finalReward: {
            message: '축하한다, 명탐정! 사건을 완벽하게 해결했다! 비밀 금고의 보물을 확인하라!',
            secretCode: '724'
        }
    },

    /* ===== Pirate: 6 missions ===== */
    pirate: {
        id: 'preset-pirate',
        name: '해적 보물섬',
        theme: 'pirate',
        description: '전설의 해적 블랙비어드의 보물 지도를 따라 최종 보물 상자를 열자!',
        introText: '어느 날, 낡은 다락방에서 해적 선장 블랙비어드의 보물 지도를 발견했다!\n\n하지만 지도는 여러 조각으로 찢겨져 집 곳곳에 숨겨져 있었다.\n\n모든 지도 조각을 모아 보물 상자의 암호를 알아내야 한다.\n\n용감한 해적이여, 보물을 찾아 모험을 떠나자!',
        treasurePassword: '해적왕의검',
        missions: [
            {
                type: 'minigame',
                gameId: 'game02',
                clue: { type: 'text', content: '해적' },
                storyText: '난파선 내부 미로를 통과해야 첫 번째 지도 조각을 얻을 수 있다!',
                hintMessage: '',
                secretCode: '🏴‍☠️',
                successMessage: '미로를 탈출했다! 난파선에서 첫 번째 지도 조각 획득!'
            },
            {
                type: 'findObject',
                hints: ['침실 어딘가에 금화가 숨겨져 있다', '베개 아래를 뒤져봐', '이불 속에 있을지도?'],
                answers: ['동전', '금화', '코인'],
                clue: { type: 'text', content: '왕의' },
                storyText: '블랙비어드가 침실에 금화와 함께 지도 조각을 숨겨뒀다!'
            },
            {
                type: 'minigame',
                gameId: 'game20',
                clue: { type: 'text', content: '검' },
                storyText: '해적들의 비밀 이모지 암호문을 해독해야 한다!',
                hintMessage: '',
                secretCode: '⚓',
                successMessage: '해적 암호 해독 성공! 새로운 지도 조각 발견!'
            },
            {
                type: 'minigame',
                gameId: 'game13',
                clue: { type: 'text', content: '' },
                storyText: '폭풍이 몰아친다! 온 힘을 다해 돛을 올려라!',
                hintMessage: '',
                secretCode: '⛵',
                successMessage: '폭풍을 뚫고 나아갔다! 지도 조각이 돛에 붙어있었다!'
            },
            {
                type: 'findObject',
                hints: ['화장실 어딘가에 해적의 보물이 있다', '수건 사이를 뒤져봐', '세면대 아래를 확인해봐'],
                answers: ['반지', '링'],
                clue: { type: 'text', content: '' },
                storyText: '전설에 의하면 해적 선장의 반지가 숨겨져 있다고 한다!'
            },
            {
                type: 'minigame',
                gameId: 'game25',
                clue: { type: 'text', content: '' },
                storyText: '마지막 관문! 낡은 보물 지도를 긁어 최종 위치를 확인하라!',
                hintMessage: '',
                secretCode: '🗺️',
                successMessage: '모든 지도 조각을 모았다! 보물 상자로 향하라!'
            }
        ],
        finalReward: {
            message: '축하한다, 용감한 해적이여! 전설의 블랙비어드 보물을 찾았다!',
            secretCode: '358'
        }
    },

    /* ===== Space: 5 missions ===== */
    space: {
        id: 'preset-space',
        name: '우주 탐험대',
        theme: 'space',
        description: '외계인이 보낸 SOS 신호를 해독해 지구를 구하라!',
        introText: '긴급 통신이 도착했다!\n\n미지의 외계 문명이 보낸 SOS 메시지가 여러 조각으로 나뉘어 흩어졌다.\n\n이 메시지를 해독하지 못하면 지구에 큰 위기가 닥칠 수 있다!\n\n우주 탐험대원이여, 신호를 모아 메시지를 완성하라!',
        treasurePassword: '별빛신호탑',
        missions: [
            {
                type: 'minigame',
                gameId: 'game16',
                clue: { type: 'text', content: '별빛' },
                storyText: '외계 신호의 방향을 추적해야 한다! 컴퍼스로 신호 발원지를 찾아라!',
                hintMessage: '',
                secretCode: '🛸',
                successMessage: '신호 추적 성공! 첫 번째 메시지 조각 확보!'
            },
            {
                type: 'minigame',
                gameId: 'game07',
                clue: { type: 'text', content: '신호' },
                storyText: '우주선 항법 컴퓨터가 고장났다! 계산 문제를 풀어 수리하라!',
                hintMessage: '',
                secretCode: '🌟',
                successMessage: '항법 컴퓨터 수리 완료! 두 번째 메시지 조각 발견!'
            },
            {
                type: 'findObject',
                hints: ['책상 위에 뭔가 특별한 게 있다', '노트나 공책을 살펴봐', '펜 옆에 있을 수도 있어'],
                answers: ['별', '스티커', '별 스티커'],
                clue: { type: 'text', content: '탑' },
                storyText: '우주 기지에 숨겨진 별 모양 좌표 칩을 찾아라!'
            },
            {
                type: 'minigame',
                gameId: 'game05',
                clue: { type: 'text', content: '' },
                storyText: '외계 퍼즐 암호를 풀어야 통신 주파수가 맞춰진다!',
                hintMessage: '',
                secretCode: '📡',
                successMessage: '퍼즐 해독 완료! 통신 주파수 확보!'
            },
            {
                type: 'minigame',
                gameId: 'game24',
                clue: { type: 'text', content: '' },
                storyText: '소행성 벨트를 지나야 한다! 우주선의 균형을 유지하라!',
                hintMessage: '',
                secretCode: '☄️',
                successMessage: '소행성 벨트 통과! 최종 메시지 조각 수신!'
            }
        ],
        finalReward: {
            message: '축하한다, 우주 영웅! 외계 SOS 메시지 해독에 성공했다! 지구가 안전해졌다!',
            secretCode: '492'
        }
    },

    /* ===== Magic: 7 missions ===== */
    magic: {
        id: 'preset-magic',
        name: '마법학교 비밀',
        theme: 'magic',
        description: '마법학교의 7가지 시험을 통과해 봉인된 마법서를 열어라!',
        introText: '마법학교에서 전설의 시험이 시작되었다!\n\n봉인된 마법서를 열기 위해서는 7가지 시험을 통과하며\n마법의 룬 조각을 모아야 한다.\n\n모든 룬을 모아 주문을 완성하라, 마법사 견습생이여!',
        treasurePassword: '루모스마법주문',
        missions: [
            {
                type: 'minigame',
                gameId: 'game08',
                clue: { type: 'text', content: '루모스' },
                storyText: '첫 번째 시험: 마법의 단어 속에 숨겨진 고대 주문을 찾아내라!',
                hintMessage: '',
                secretCode: '✨',
                successMessage: '주문 발견! 첫 번째 룬 획득!'
            },
            {
                type: 'findObject',
                hints: ['현관 근처에 마법 물건이 숨겨져 있다', '신발장을 확인해봐', '열쇠고리를 살펴봐'],
                answers: ['열쇠고리', '키링', '열쇠'],
                clue: { type: 'text', content: '마법' },
                storyText: '두 번째 시험: 마법의 열쇠가 현관 어딘가에 봉인되어 있다!'
            },
            {
                type: 'minigame',
                gameId: 'game12',
                clue: { type: 'text', content: '주문' },
                storyText: '세 번째 시험: 마법의 색을 정확히 구별해내라! 틀리면 마법이 폭주한다!',
                hintMessage: '',
                secretCode: '🪄',
                successMessage: '색깔 시험 통과! 세 번째 룬 획득!'
            },
            {
                type: 'minigame',
                gameId: 'game15',
                clue: { type: 'text', content: '' },
                storyText: '네 번째 시험: 소리의 마법! 주문을 외쳐 봉인의 균열을 만들어라!',
                hintMessage: '',
                secretCode: '📣',
                successMessage: '소리 마법 성공! 네 번째 룬!'
            },
            {
                type: 'minigame',
                gameId: 'game11',
                clue: { type: 'text', content: '' },
                storyText: '다섯 번째 시험: 마법진의 문양을 순서대로 터치하라!',
                hintMessage: '',
                secretCode: '⭐',
                successMessage: '마법진 완성! 다섯 번째 룬!'
            },
            {
                type: 'findObject',
                hints: ['방 안 어딘가에 마지막 룬이 있다', '책장이나 서랍을 확인해봐', '책 사이를 살펴봐'],
                answers: ['카드', '마법카드', '타로'],
                clue: { type: 'text', content: '' },
                storyText: '여섯 번째 시험: 마법의 카드가 방 어딘가에 숨겨져 있다!'
            },
            {
                type: 'minigame',
                gameId: 'game27',
                clue: { type: 'text', content: '' },
                storyText: '최종 시험: 마법의 시간을 정확히 멈춰라! 0.1초의 오차도 허용되지 않는다!',
                hintMessage: '',
                secretCode: '🔮',
                successMessage: '시간 마법 성공! 모든 룬을 모았다! 봉인을 풀어라!'
            }
        ],
        finalReward: {
            message: '축하한다, 위대한 마법사! 봉인된 마법서가 열렸다! 전설의 마법을 손에 넣었다!',
            secretCode: '637'
        }
    },

    /* ===== Dino: 3 missions ===== */
    dino: {
        id: 'preset-dino',
        name: '공룡시대 발굴단',
        theme: 'dino',
        description: '3개의 핵심 화석을 발굴해 타임캡슐의 암호를 해독하라!',
        introText: '고고학 연구소에서 놀라운 발견!\n\n수천만 년 전 공룡시대의 타임캡슐이 발견되었다.\n\n캡슐을 열기 위해서는 3개의 핵심 화석 단서를 발굴해야 한다.\n\n발굴단원이여, 빠르게 탐사를 시작하라!',
        treasurePassword: '티라노',
        missions: [
            {
                type: 'minigame',
                gameId: 'game05',
                clue: { type: 'text', content: '티라노' },
                storyText: '발굴된 화석 조각들이 뒤섞여 있다! 퍼즐을 맞춰 화석을 복원하라!',
                hintMessage: '',
                secretCode: '🦴',
                successMessage: '화석 복원 성공! 티라노사우루스의 이빨 화석이다!'
            },
            {
                type: 'findObject',
                hints: ['주방 어딘가에 화석 표본이 숨겨져 있다', '서랍 안을 확인해봐', '수저통 근처를 살펴봐'],
                answers: ['돌', '돌멩이', '조약돌'],
                clue: { type: 'text', content: '' },
                storyText: '주방에서 특별한 공룡 발자국 화석을 찾아라!'
            },
            {
                type: 'minigame',
                gameId: 'game21',
                clue: { type: 'text', content: '' },
                storyText: '거대한 화석을 들어올리려면 둘이 힘을 합쳐야 한다! 동시에 터치하라!',
                hintMessage: '',
                secretCode: '🤲',
                successMessage: '협동 발굴 성공! 완전한 공룡 화석을 발견했다!'
            }
        ],
        finalReward: {
            message: '축하한다, 위대한 발굴단원! 타임캡슐이 열렸다! 공룡시대의 비밀이 밝혀졌다!',
            secretCode: '165'
        }
    }
};

function getPresetData(themeId) {
    return PRESET_DATA[themeId] || null;
}

function getGameInfo(gameId) {
    return GAME_INFO[gameId] || null;
}

function getAllGameIds() {
    return Object.keys(GAME_INFO);
}
