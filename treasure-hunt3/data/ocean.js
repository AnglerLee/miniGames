PRESET_DATA.ocean = {
    "scenarios": [
        {
            "id": "ocean-01",
            "name": "아틀란티스의 비밀",
            "description": "전설의 해저 도시 아틀란티스를 찾아 심해 탐험을 떠나자!",
            "introText": "해양 연구소에서 긴급 발표!\n\n심해 탐사 중 고대 도시 아틀란티스의 흔적이 발견되었다.\n\n도시의 비밀을 풀기 위해서는 해저 곳곳에 흩어진 크리스탈 조각을 모아야 한다.\n\n심해 탐험대원이여, 잠수정에 탑승하라!",
            "treasurePassword": "심해크리스탈",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game16",
                    "clue": { "type": "text", "content": "심해" },
                    "storyText": "해류가 복잡한 심해에서 방향을 잡아야 한다! 컴퍼스로 아틀란티스를 찾아라!",
                    "hintMessage": "",
                    "secretCode": "🧭",
                    "successMessage": "방향 확인! 아틀란티스로 향하는 해류를 발견했다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game05",
                    "clue": { "type": "text", "content": "크리" },
                    "storyText": "해저 유적의 타일 퍼즐이 잠금장치를 막고 있다! 퍼즐을 맞춰라!",
                    "hintMessage": "",
                    "secretCode": "🐠",
                    "successMessage": "퍼즐 해독 성공! 두 번째 크리스탈 조각 획득!"
                },
                {
                    "type": "findObject",
                    "hints": ["화장실 어딘가에 크리스탈이 숨겨져 있다", "비누 근처를 살펴봐", "거울 뒤를 확인해봐"],
                    "answers": ["조개", "조개껍데기", "조가비"],
                    "clue": { "type": "text", "content": "스탈" },
                    "storyText": "아틀란티스 주민이 남긴 조개 속에 크리스탈이 있다고 한다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game12",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "심해 생물이 빛을 내며 신호를 보내고 있다! 색깔 패턴을 읽어내라!",
                    "hintMessage": "",
                    "secretCode": "🪼",
                    "successMessage": "신호 해독 성공! 네 번째 크리스탈 조각!"
                },
                {
                    "type": "minigame",
                    "gameId": "game24",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "수압이 위험하다! 잠수정의 균형을 유지하며 최종 유적에 도달하라!",
                    "hintMessage": "",
                    "secretCode": "🌊",
                    "successMessage": "최종 유적 도달! 아틀란티스의 비밀이 밝혀진다!"
                }
            ],
            "finalReward": {
                "message": "축하한다, 심해 탐험가! 아틀란티스의 크리스탈을 모두 모았다! 고대 도시의 비밀을 확인하라!",
                "secretCode": "847"
            }
        },
        {
            "id": "ocean-02",
            "name": "인어공주의 목걸이",
            "description": "인어 왕국의 분실된 마법 목걸이를 찾아 해저 탐험!",
            "introText": "인어 왕국에서 긴급 요청이 왔다!\n\n인어공주의 마법 목걸이가 해류에 휩쓸려 사라졌다.\n\n목걸이 없이는 인어들이 노래를 부를 수 없어 바다가 어둠에 잠긴다.\n\n심해 탐험대원이여, 목걸이의 진주를 찾아 바다를 밝혀라!",
            "treasurePassword": "인어의진주",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game03",
                    "clue": { "type": "text", "content": "인어" },
                    "storyText": "해저 동굴에 뒤집힌 조개 카드가 있다! 짝을 맞춰 진주의 단서를 찾아라!",
                    "hintMessage": "",
                    "secretCode": "🧜‍♀️",
                    "successMessage": "조개 매칭 성공! 첫 번째 진주 조각의 위치를 알아냈다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game08",
                    "clue": { "type": "text", "content": "의" },
                    "storyText": "산호초에 고대 인어 문자가 새겨져 있다! 숨겨진 단어를 찾아라!",
                    "hintMessage": "",
                    "secretCode": "🐚",
                    "successMessage": "인어 문자 해독! 두 번째 진주 조각 발견!"
                },
                {
                    "type": "findObject",
                    "hints": ["방 어딘가에 진주가 숨겨져 있다", "장식품 근처를 살펴봐", "서랍장 위를 확인해봐"],
                    "answers": ["구슬", "비즈", "목걸이"],
                    "clue": { "type": "text", "content": "진주" },
                    "storyText": "인어공주가 육지에 진주를 숨겨뒀다고 한다! 구슬 모양의 진주를 찾아라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game13",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "거대한 조개가 입을 닫으려 한다! 힘을 모아 조개를 열어 진주를 꺼내라!",
                    "hintMessage": "",
                    "secretCode": "💪",
                    "successMessage": "조개 열기 성공! 네 번째 진주 조각!"
                },
                {
                    "type": "minigame",
                    "gameId": "game25",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "마지막 진주가 오래된 보물 상자 안에 있다! 이끼를 긁어 상자를 열어라!",
                    "hintMessage": "",
                    "secretCode": "📿",
                    "successMessage": "목걸이 완성! 인어공주의 노래가 바다를 밝힌다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 인어공주의 마법 목걸이를 되찾았다! 바다의 은인으로 칭송받게 되었다!",
                "secretCode": "615"
            }
        },
        {
            "id": "ocean-03",
            "name": "심해 화산 폭발",
            "description": "심해 화산이 폭발 직전! 해저 마을 주민들을 대피시켜라!",
            "introText": "긴급 경보 발령!\n\n심해 화산이 폭발 직전이다! 해저 마을 주민들이 위험에 처해있다.\n\n대피 경로를 확보하고 주민들을 안전한 곳으로 이동시켜야 한다.\n\n시간이 촉박하다! 구조대원이여, 지금 바로 출동하라!",
            "treasurePassword": "긴급대피신호",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game24",
                    "clue": { "type": "text", "content": "긴급" },
                    "storyText": "해저 지진으로 흔들리는 잠수정! 균형을 잡으며 마을에 도착하라!",
                    "hintMessage": "",
                    "secretCode": "🌋",
                    "successMessage": "잠수정 조종 성공! 해저 마을에 도착했다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game07",
                    "clue": { "type": "text", "content": "대피" },
                    "storyText": "대피 인원을 계산해 구명정을 배치해야 한다! 빠르게 계산하라!",
                    "hintMessage": "",
                    "secretCode": "🚨",
                    "successMessage": "계산 완료! 구명정 배치 성공!"
                },
                {
                    "type": "findObject",
                    "hints": ["거실 어딘가에 신호 장치가 있다", "소파 옆을 살펴봐", "전화기 근처를 확인해봐"],
                    "answers": ["호루라기", "호각", "피리"],
                    "clue": { "type": "text", "content": "신호" },
                    "storyText": "대피 신호를 울릴 장치가 필요하다! 호루라기를 찾아라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game21",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "해저 터널 문이 잠겼다! 동시에 양쪽 잠금을 해제해 대피로를 열어라!",
                    "hintMessage": "",
                    "secretCode": "🚪",
                    "successMessage": "터널 오픈! 대피로 확보 완료!"
                },
                {
                    "type": "minigame",
                    "gameId": "game02",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "용암이 밀려온다! 복잡한 해저 미로를 빠져나가 안전 지대로 이동하라!",
                    "hintMessage": "",
                    "secretCode": "🏊",
                    "successMessage": "전원 대피 완료! 모두가 안전하다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 해저 마을 주민 전원을 구출했다! 바다의 영웅이다!",
                "secretCode": "119"
            }
        }
    ]
};
