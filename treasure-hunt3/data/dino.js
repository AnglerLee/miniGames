PRESET_DATA.dino = {
    "scenarios": [
        {
            "id": "dino-01",
            "name": "공룡 타임캡슐",
            "description": "3개의 핵심 화석을 발굴해 타임캡슐의 암호를 해독하라!",
            "introText": "고고학 연구소에서 놀라운 발견!\n\n수천만 년 전 공룡시대의 타임캡슐이 발견되었다.\n\n캡슐을 열기 위해서는 3개의 핵심 화석 단서를 발굴해야 한다.\n\n발굴단원이여, 빠르게 탐사를 시작하라!",
            "treasurePassword": "티라노",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game05",
                    "clue": { "type": "text", "content": "티라노" },
                    "storyText": "발굴된 화석 조각들이 뒤섞여 있다! 퍼즐을 맞춰 화석을 복원하라!",
                    "hintMessage": "",
                    "secretCode": "🦴",
                    "successMessage": "화석 복원 성공! 티라노사우루스의 이빨 화석이다!"
                },
                {
                    "type": "findObject",
                    "hints": ["주방 어딘가에 화석 표본이 숨겨져 있다", "서랍 안을 확인해봐", "수저통 근처를 살펴봐"],
                    "answers": ["돌", "돌멩이", "조약돌"],
                    "clue": { "type": "text", "content": "" },
                    "storyText": "주방에서 특별한 공룡 발자국 화석을 찾아라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game21",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "거대한 화석을 들어올리려면 둘이 힘을 합쳐야 한다! 동시에 터치하라!",
                    "hintMessage": "",
                    "secretCode": "🤲",
                    "successMessage": "협동 발굴 성공! 완전한 공룡 화석을 발견했다!"
                }
            ],
            "finalReward": {
                "message": "축하한다, 위대한 발굴단원! 타임캡슐이 열렸다! 공룡시대의 비밀이 밝혀졌다!",
                "secretCode": "165"
            }
        },
        {
            "id": "dino-02",
            "name": "공룡 알 수송 작전",
            "description": "화산 폭발 전에 공룡 알을 안전한 곳으로 수송하라!",
            "introText": "비상! 비상! 화산이 곧 폭발한다!\n\n발굴 현장에서 살아있는 공룡 알 3개가 발견되었다.\n\n용암이 흘러내리기 전에 알을 안전한 보호소로 수송해야 한다.\n\n시간이 없다, 발굴단원! 공룡 알을 지켜라!",
            "treasurePassword": "공룡알보호",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game24",
                    "clue": { "type": "text", "content": "공룡" },
                    "storyText": "공룡 알은 매우 약하다! 흔들리지 않게 균형을 잡으며 운반하라!",
                    "hintMessage": "",
                    "secretCode": "🥚",
                    "successMessage": "첫 번째 공룡 알 수송 성공! 알이 안전하다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game12",
                    "clue": { "type": "text", "content": "알" },
                    "storyText": "화산재로 앞이 안 보인다! 색깔 신호등을 따라 안전한 경로를 찾아라!",
                    "hintMessage": "",
                    "secretCode": "🌋",
                    "successMessage": "경로 확보! 두 번째 공룡 알도 안전하게 이동!"
                },
                {
                    "type": "findObject",
                    "hints": ["거실 어딘가에 공룡 알이 숨겨져 있다", "쿠션 사이를 뒤져봐", "담요 아래를 확인해봐"],
                    "answers": ["공", "탱탱볼", "야구공"],
                    "clue": { "type": "text", "content": "보호" },
                    "storyText": "마지막 공룡 알이 거실 어딘가에 보호되어 있다! 서둘러 찾아라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game02",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "용암이 흘러내린다! 미로처럼 얽힌 동굴을 빠져나가라!",
                    "hintMessage": "",
                    "secretCode": "🏃",
                    "successMessage": "동굴 탈출 성공! 용암에서 벗어났다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game27",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "보호소 문이 타이머로 잠겨있다! 정확한 시간에 문을 열어라!",
                    "hintMessage": "",
                    "secretCode": "🏠",
                    "successMessage": "보호소 도착! 모든 공룡 알이 안전하다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 세 개의 공룡 알을 모두 보호했다! 위대한 공룡 수호자다!",
                "secretCode": "456"
            }
        },
        {
            "id": "dino-03",
            "name": "얼음 속 비밀",
            "description": "빙하에서 발견된 냉동 공룡의 DNA를 복원하라!",
            "introText": "북극 탐사대에서 놀라운 소식!\n\n수만 년 전 빙하에 갇힌 완벽한 공룡 표본이 발견되었다.\n\nDNA를 복원하면 공룡을 되살릴 수 있다!\n\n빙하 발굴단원이여, 조심스럽게 DNA 조각을 수집하라!",
            "treasurePassword": "빙하공룡",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game08",
                    "clue": { "type": "text", "content": "빙하" },
                    "storyText": "빙하 속에 새겨진 고대 문자를 해독해야 한다! 숨겨진 단어를 찾아라!",
                    "hintMessage": "",
                    "secretCode": "🧊",
                    "successMessage": "문자 해독! 빙하 속 첫 번째 DNA 조각의 위치를 알아냈다!"
                },
                {
                    "type": "findObject",
                    "hints": ["냉장고 근처에 냉동 표본이 있다", "냉동실을 확인해봐", "아이스크림 근처를 살펴봐"],
                    "answers": ["숟가락", "스푼", "수저"],
                    "clue": { "type": "text", "content": "공룡" },
                    "storyText": "빙하 표본을 채취할 발굴 도구가 필요하다! 주방에서 찾아라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game07",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "DNA 서열을 분석하려면 복잡한 계산이 필요하다! 빠르게 풀어라!",
                    "hintMessage": "",
                    "secretCode": "🧬",
                    "successMessage": "DNA 분석 완료! 서열 복원에 성공하고 있다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game23",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "최종 DNA 보관함의 잠금을 풀어라! 정밀한 다이얼 조작이 필요하다!",
                    "hintMessage": "",
                    "secretCode": "🔬",
                    "successMessage": "보관함 오픈! 완벽한 공룡 DNA가 복원되었다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 빙하 속 공룡의 DNA를 완벽하게 복원했다! 세기의 발견이다!",
                "secretCode": "953"
            }
        }
    ]
};
