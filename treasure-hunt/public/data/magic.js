PRESET_DATA.magic = {
    "scenarios": [
        {
            "id": "magic-01",
            "name": "봉인된 마법서",
            "description": "마법학교의 7가지 시험을 통과해 봉인된 마법서를 열어라!",
            "introText": "마법학교에서 전설의 시험이 시작되었다!\n\n봉인된 마법서를 열기 위해서는 7가지 시험을 통과하며\n마법의 룬 조각을 모아야 한다.\n\n모든 룬을 모아 주문을 완성하라, 마법사 견습생이여!",
            "treasurePassword": "루모스마법주문",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game08",
                    "clue": { "type": "text", "content": "루모스" },
                    "storyText": "첫 번째 시험: 마법의 단어 속에 숨겨진 고대 주문을 찾아내라!",
                    "hintMessage": "",
                    "secretCode": "✨",
                    "successMessage": "주문 발견! 첫 번째 룬 획득!"
                },
                {
                    "type": "findObject",
                    "hints": ["현관 근처에 마법 물건이 숨겨져 있다", "신발장을 확인해봐", "열쇠고리를 살펴봐"],
                    "answers": ["열쇠고리", "키링", "열쇠"],
                    "clue": { "type": "text", "content": "마법" },
                    "storyText": "두 번째 시험: 마법의 열쇠가 현관 어딘가에 봉인되어 있다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game12",
                    "clue": { "type": "text", "content": "주문" },
                    "storyText": "세 번째 시험: 마법의 색을 정확히 구별해내라! 틀리면 마법이 폭주한다!",
                    "hintMessage": "",
                    "secretCode": "🪄",
                    "successMessage": "색깔 시험 통과! 세 번째 룬 획득!"
                },
                {
                    "type": "minigame",
                    "gameId": "game15",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "네 번째 시험: 소리의 마법! 주문을 외쳐 봉인의 균열을 만들어라!",
                    "hintMessage": "",
                    "secretCode": "📣",
                    "successMessage": "소리 마법 성공! 네 번째 룬!"
                },
                {
                    "type": "minigame",
                    "gameId": "game11",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "다섯 번째 시험: 마법진의 문양을 순서대로 터치하라!",
                    "hintMessage": "",
                    "secretCode": "⭐",
                    "successMessage": "마법진 완성! 다섯 번째 룬!"
                },
                {
                    "type": "findObject",
                    "hints": ["방 안 어딘가에 마지막 룬이 있다", "책장이나 서랍을 확인해봐", "책 사이를 살펴봐"],
                    "answers": ["카드", "마법카드", "타로"],
                    "clue": { "type": "text", "content": "" },
                    "storyText": "여섯 번째 시험: 마법의 카드가 방 어딘가에 숨겨져 있다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game27",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "최종 시험: 마법의 시간을 정확히 멈춰라! 0.1초의 오차도 허용되지 않는다!",
                    "hintMessage": "",
                    "secretCode": "🔮",
                    "successMessage": "시간 마법 성공! 모든 룬을 모았다! 봉인을 풀어라!"
                }
            ],
            "finalReward": {
                "message": "축하한다, 위대한 마법사! 봉인된 마법서가 열렸다! 전설의 마법을 손에 넣었다!",
                "secretCode": "637"
            }
        },
        {
            "id": "magic-02",
            "name": "드래곤 알의 비밀",
            "description": "마법학교 지하실에서 발견된 드래곤 알을 부화시켜라!",
            "introText": "놀라운 발견!\n\n마법학교 지하 금고에서 전설의 드래곤 알이 발견되었다.\n\n알을 부화시키려면 4가지 원소의 마법 에너지를 모아야 한다.\n\n불꽃의 마법을 완성해 드래곤을 깨워라, 마법사여!",
            "treasurePassword": "드래곤의불꽃",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game13",
                    "clue": { "type": "text", "content": "드래곤" },
                    "storyText": "불의 원소를 모으려면 강한 에너지가 필요하다! 온 힘을 다해 마력을 충전하라!",
                    "hintMessage": "",
                    "secretCode": "🔥",
                    "successMessage": "불의 원소 획득! 드래곤 알이 미약하게 빛나기 시작한다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game18",
                    "clue": { "type": "text", "content": "의" },
                    "storyText": "물의 원소! 마법의 색을 가진 보석을 찾아 에너지를 추출하라!",
                    "hintMessage": "",
                    "secretCode": "💧",
                    "successMessage": "물의 원소 획득! 드래곤 알에 균열이 생기고 있다!"
                },
                {
                    "type": "findObject",
                    "hints": ["거실 어딘가에 마법의 불꽃이 숨겨져 있다", "촛대나 장식품 근처를 살펴봐", "선반 위를 확인해봐"],
                    "answers": ["양초", "캔들", "초"],
                    "clue": { "type": "text", "content": "불꽃" },
                    "storyText": "드래곤 알을 데울 마법의 불꽃이 필요하다! 마법 양초를 찾아라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game07",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "바람의 원소! 마법 방정식을 풀어 바람의 에너지를 계산하라!",
                    "hintMessage": "",
                    "secretCode": "🌬️",
                    "successMessage": "바람의 원소 획득! 드래곤 알이 더욱 밝게 빛난다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game24",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "땅의 원소! 드래곤 알을 안정적으로 지탱해야 한다! 균형을 유지하라!",
                    "hintMessage": "",
                    "secretCode": "🌍",
                    "successMessage": "땅의 원소 완성! 드래곤 알이 부화하기 시작한다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 드래곤이 부화했다! 전설의 드래곤 라이더가 될 자격을 얻었다!",
                "secretCode": "248"
            }
        },
        {
            "id": "magic-03",
            "name": "거울 나라의 미궁",
            "description": "마법 거울 속 거꾸로 된 세계에서 탈출하라!",
            "introText": "이런! 금지된 마법 거울을 만져버렸다!\n\n거울 속으로 빨려 들어가 모든 것이 거꾸로인 세계에 갇혔다.\n\n원래 세계로 돌아가려면 미궁 속 탈출 열쇠 조각을 모아야 한다.\n\n거꾸로 된 세상에서 살아남아라!",
            "treasurePassword": "거울속세상",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game19",
                    "clue": { "type": "text", "content": "거울" },
                    "storyText": "거울 나라에서는 소리도 거꾸로다! 뒤집힌 음성을 해독하라!",
                    "hintMessage": "",
                    "secretCode": "🪞",
                    "successMessage": "음성 해독 성공! 미궁의 첫 번째 열쇠 조각 획득!"
                },
                {
                    "type": "minigame",
                    "gameId": "game03",
                    "clue": { "type": "text", "content": "속" },
                    "storyText": "거울 미궁의 벽에 뒤집힌 그림이 붙어있다! 짝을 맞춰 길을 찾아라!",
                    "hintMessage": "",
                    "secretCode": "🃏",
                    "successMessage": "그림 매칭 성공! 두 번째 열쇠 조각 발견!"
                },
                {
                    "type": "findObject",
                    "hints": ["화장실에 마법 거울이 숨겨져 있다", "세면대 근처를 살펴봐", "거울 앞을 확인해봐"],
                    "answers": ["거울", "손거울", "콤팩트"],
                    "clue": { "type": "text", "content": "세상" },
                    "storyText": "탈출의 열쇠가 현실 세계의 거울에 반사되어 있다! 거울을 찾아라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game11",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "미궁의 함정! 바닥 타일을 거꾸로 된 순서로 밟아야 한다!",
                    "hintMessage": "",
                    "secretCode": "🔄",
                    "successMessage": "함정 통과! 출구가 보이기 시작한다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game25",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "마지막 관문! 거울 봉인을 긁어 탈출 주문을 완성하라!",
                    "hintMessage": "",
                    "secretCode": "✨",
                    "successMessage": "탈출 주문 완성! 거울 나라에서 빠져나왔다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 거울 나라의 미궁에서 탈출했다! 가장 용감한 마법사로 인정받았다!",
                "secretCode": "369"
            }
        }
    ]
};
