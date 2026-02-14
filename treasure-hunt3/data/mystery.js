PRESET_DATA.mystery = {
    "scenarios": [
        {
            "id": "mystery-01",
            "name": "비밀 금고를 찾아라",
            "description": "탐정단원이 되어 단서를 모아 금고의 암호를 풀어보자.",
            "introText": "탐정단 본부에서 긴급 연락이 왔다.\n\n마을 어딘가에 숨겨진 비밀 금고에 중요한 보물이 들어있다고 한다.\n\n금고의 암호를 알아내기 위해서는 곳곳에 흩어진 단서를 모아야 한다.\n\n탐정단원이여, 지금 바로 수사를 시작하라!",
            "treasurePassword": "범인은탐정",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game22",
                    "clue": { "type": "text", "content": "범인은" },
                    "storyText": "용의자의 폰에서 수상한 와이파이 신호가 잡힌다. 해킹해서 증거를 확보하라!",
                    "hintMessage": "",
                    "secretCode": "🔍",
                    "successMessage": "해킹 성공! 용의자의 통신 기록에서 첫 번째 단서를 찾았다!"
                },
                {
                    "type": "findObject",
                    "hints": ["거실 어딘가에 증거물이 숨겨져 있다", "쿠션 아래를 확인해볼까?", "소파 근처를 잘 살펴봐"],
                    "answers": ["메모", "쪽지", "메모지"],
                    "clue": { "type": "text", "content": "탐정" },
                    "storyText": "제보자가 거실에 중요한 메모를 남겼다고 한다. 찾아내라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game03",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "암호화된 카드 메시지를 해독해야 한다. 짝을 맞춰 메시지를 복원하라!",
                    "hintMessage": "",
                    "secretCode": "🕵️",
                    "successMessage": "카드 해독 완료! 범인의 행적이 드러나고 있다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game23",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "드디어 범인의 금고를 발견했다! 다이얼을 돌려 열어라!",
                    "hintMessage": "",
                    "secretCode": "🔐",
                    "successMessage": "금고 해제 성공! 사건의 전모가 밝혀졌다!"
                }
            ],
            "finalReward": {
                "message": "축하한다, 명탐정! 사건을 완벽하게 해결했다! 비밀 금고의 보물을 확인하라!",
                "secretCode": "724"
            }
        },
        {
            "id": "mystery-02",
            "name": "사라진 다이아몬드",
            "description": "보석 전시회에서 다이아몬드가 사라졌다! 범인을 추적하라!",
            "introText": "긴급 속보!\n\n시립 박물관 보석 전시회에서 세계 최대 다이아몬드 '별의 눈물'이 사라졌다!\n\n범인은 전시장 곳곳에 교묘한 흔적을 남겼다.\n\n보석감정사의 도움을 받아 단서를 추적하고 다이아몬드를 되찾아라!",
            "treasurePassword": "보석감정사",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game08",
                    "clue": { "type": "text", "content": "보석" },
                    "storyText": "범인이 남긴 암호 편지가 발견되었다! 숨겨진 단어를 찾아내라!",
                    "hintMessage": "",
                    "secretCode": "💎",
                    "successMessage": "암호 편지 해독! 범인의 첫 번째 흔적을 발견했다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game17",
                    "clue": { "type": "text", "content": "감정" },
                    "storyText": "현장에 남은 바코드가 수상하다! 스캔해서 증거를 확보하라!",
                    "hintMessage": "",
                    "secretCode": "📱",
                    "successMessage": "바코드 분석 완료! 범인의 동선이 드러나고 있다!"
                },
                {
                    "type": "findObject",
                    "hints": ["서재나 방 어딘가에 감정 도구가 숨겨져 있다", "서랍장 위를 살펴봐", "안경이나 돋보기 근처를 확인해봐"],
                    "answers": ["돋보기", "안경", "루페"],
                    "clue": { "type": "text", "content": "사" },
                    "storyText": "보석 감정에 사용된 돋보기에 범인의 지문이 남아있다! 찾아라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game12",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "다이아몬드의 진위를 판별해야 한다! 빛의 색깔 패턴을 분석하라!",
                    "hintMessage": "",
                    "secretCode": "🌈",
                    "successMessage": "진품 감별 완료! 가짜 다이아몬드 사이에서 단서를 발견!"
                },
                {
                    "type": "minigame",
                    "gameId": "game23",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "범인의 비밀 금고를 찾았다! 안에 '별의 눈물'이 있을 것이다!",
                    "hintMessage": "",
                    "secretCode": "🔓",
                    "successMessage": "금고 오픈! 사라진 다이아몬드를 되찾았다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 전설의 다이아몬드 '별의 눈물'을 되찾았다! 최고의 보석 탐정이다!",
                "secretCode": "291"
            }
        },
        {
            "id": "mystery-03",
            "name": "이중 스파이의 정체",
            "description": "조직 내 이중 스파이를 색출하라! 아무도 믿지 마라!",
            "introText": "극비 보고!\n\n우리 탐정단 안에 이중 스파이가 숨어있다는 첩보가 입수되었다.\n\n스파이는 중요한 기밀 문서를 빼돌리고 있으며,\n증거를 모아 정체를 밝혀야 한다.\n\n코드네임 '제로' — 그가 누구인지 밝혀내라!",
            "treasurePassword": "코드네임제로",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game20",
                    "clue": { "type": "text", "content": "코드" },
                    "storyText": "스파이가 이모지 암호로 통신하고 있다! 메시지를 해독하라!",
                    "hintMessage": "",
                    "secretCode": "🕶️",
                    "successMessage": "이모지 암호 해독 성공! 스파이의 통신망 일부를 파악했다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game19",
                    "clue": { "type": "text", "content": "네임" },
                    "storyText": "도청된 음성 파일이 거꾸로 녹음되어 있다! 원래 메시지를 복원하라!",
                    "hintMessage": "",
                    "secretCode": "🎧",
                    "successMessage": "음성 복원 완료! 스파이의 코드네임이 언급되어 있다!"
                },
                {
                    "type": "findObject",
                    "hints": ["주방 어딘가에 비밀 문서가 숨겨져 있다", "냉장고 근처를 확인해봐", "서랍 안을 뒤져봐"],
                    "answers": ["봉투", "편지", "서류"],
                    "clue": { "type": "text", "content": "제로" },
                    "storyText": "스파이가 주방에 기밀 문서를 봉투에 넣어 숨겨뒀다! 찾아내라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game07",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "스파이의 암호 장부를 해독해야 한다! 빠르게 계산해서 암호를 풀어라!",
                    "hintMessage": "",
                    "secretCode": "📊",
                    "successMessage": "암호 장부 해독! 스파이의 행적이 명확해지고 있다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game25",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "마지막 증거! 스파이가 남긴 복권 형태의 비밀 메시지를 긁어내라!",
                    "hintMessage": "",
                    "secretCode": "🎭",
                    "successMessage": "스파이의 정체가 밝혀졌다! 코드네임 제로를 체포하라!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 이중 스파이 코드네임 제로를 색출했다! 조직의 안전을 지켜낸 영웅이다!",
                "secretCode": "007"
            }
        }
    ]
};
