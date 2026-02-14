PRESET_DATA.pirate = {
    "scenarios": [
        {
            "id": "pirate-01",
            "name": "블랙비어드의 보물 지도",
            "description": "전설의 해적 블랙비어드의 보물 지도를 따라 최종 보물 상자를 열자!",
            "introText": "어느 날, 낡은 다락방에서 해적 선장 블랙비어드의 보물 지도를 발견했다!\n\n하지만 지도는 여러 조각으로 찢겨져 집 곳곳에 숨겨져 있었다.\n\n모든 지도 조각을 모아 보물 상자의 암호를 알아내야 한다.\n\n용감한 해적이여, 보물을 찾아 모험을 떠나자!",
            "treasurePassword": "해적왕의검",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game02",
                    "clue": { "type": "text", "content": "해적" },
                    "storyText": "난파선 내부 미로를 통과해야 첫 번째 지도 조각을 얻을 수 있다!",
                    "hintMessage": "",
                    "secretCode": "🏴‍☠️",
                    "successMessage": "미로를 탈출했다! 난파선에서 첫 번째 지도 조각 획득!"
                },
                {
                    "type": "findObject",
                    "hints": ["침실 어딘가에 금화가 숨겨져 있다", "베개 아래를 뒤져봐", "이불 속에 있을지도?"],
                    "answers": ["동전", "금화", "코인"],
                    "clue": { "type": "text", "content": "왕의" },
                    "storyText": "블랙비어드가 침실에 금화와 함께 지도 조각을 숨겨뒀다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game20",
                    "clue": { "type": "text", "content": "검" },
                    "storyText": "해적들의 비밀 이모지 암호문을 해독해야 한다!",
                    "hintMessage": "",
                    "secretCode": "⚓",
                    "successMessage": "해적 암호 해독 성공! 새로운 지도 조각 발견!"
                },
                {
                    "type": "minigame",
                    "gameId": "game13",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "폭풍이 몰아친다! 온 힘을 다해 돛을 올려라!",
                    "hintMessage": "",
                    "secretCode": "⛵",
                    "successMessage": "폭풍을 뚫고 나아갔다! 지도 조각이 돛에 붙어있었다!"
                },
                {
                    "type": "findObject",
                    "hints": ["화장실 어딘가에 해적의 보물이 있다", "수건 사이를 뒤져봐", "세면대 아래를 확인해봐"],
                    "answers": ["반지", "링"],
                    "clue": { "type": "text", "content": "" },
                    "storyText": "전설에 의하면 해적 선장의 반지가 숨겨져 있다고 한다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game25",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "마지막 관문! 낡은 보물 지도를 긁어 최종 위치를 확인하라!",
                    "hintMessage": "",
                    "secretCode": "🗺️",
                    "successMessage": "모든 지도 조각을 모았다! 보물 상자로 향하라!"
                }
            ],
            "finalReward": {
                "message": "축하한다, 용감한 해적이여! 전설의 블랙비어드 보물을 찾았다!",
                "secretCode": "358"
            }
        },
        {
            "id": "pirate-02",
            "name": "유령선의 저주",
            "description": "바다 위 유령선에 올라 저주를 풀고 보물을 탈취하라!",
            "introText": "안개 낀 바다 한가운데, 전설의 유령선이 나타났다!\n\n이 배에는 저주에 걸린 해적들의 보물이 가득하다고 한다.\n\n저주를 풀기 위해서는 배 곳곳에 숨겨진 봉인 조각을 모아야 한다.\n\n두려움을 떨쳐내고, 유령선에 올라타라!",
            "treasurePassword": "선장의나침반",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game03",
                    "clue": { "type": "text", "content": "선장" },
                    "storyText": "유령선 갑판에 뒤집힌 카드들이 흩어져 있다! 짝을 맞춰 선장의 메시지를 복원하라!",
                    "hintMessage": "",
                    "secretCode": "👻",
                    "successMessage": "카드 해독! 유령 선장이 남긴 첫 번째 봉인 조각 발견!"
                },
                {
                    "type": "minigame",
                    "gameId": "game24",
                    "clue": { "type": "text", "content": "의" },
                    "storyText": "배가 심하게 흔들린다! 폭탄이 터지기 전에 균형을 잡아라!",
                    "hintMessage": "",
                    "secretCode": "💣",
                    "successMessage": "위기 탈출! 폭발 직전 두 번째 봉인 조각을 손에 넣었다!"
                },
                {
                    "type": "findObject",
                    "hints": ["침실 어딘가에 선장의 항해 도구가 있다", "탁자 위를 살펴봐", "서랍 속을 확인해봐"],
                    "answers": ["시계", "손목시계", "탁상시계"],
                    "clue": { "type": "text", "content": "나침반" },
                    "storyText": "선장실에서 항해 시계를 찾아야 한다! 시계 안에 봉인 조각이 숨겨져 있다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game15",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "유령들이 소리로 봉인을 지키고 있다! 함성으로 유령들을 물리쳐라!",
                    "hintMessage": "",
                    "secretCode": "📢",
                    "successMessage": "유령 퇴치 성공! 네 번째 봉인 조각!"
                },
                {
                    "type": "minigame",
                    "gameId": "game22",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "유령선의 통신 장비를 해킹해 탈출 경로를 확보하라!",
                    "hintMessage": "",
                    "secretCode": "🚢",
                    "successMessage": "해킹 완료! 저주가 풀리기 시작한다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 유령선의 저주를 풀고 보물을 손에 넣었다! 전설의 해적이 되었다!",
                "secretCode": "413"
            }
        },
        {
            "id": "pirate-03",
            "name": "크라켄의 심장",
            "description": "전설의 해양 괴물 크라켄을 물리치고 심해 보물을 획득하라!",
            "introText": "대양의 깊은 곳에서 크라켄이 눈을 떴다!\n\n크라켄의 심장에는 엄청난 보물이 숨겨져 있다고 한다.\n\n괴물을 물리치려면 전설의 무기 조각을 모아야 한다.\n\n바다의 용사여, 크라켄에 맞서라!",
            "treasurePassword": "크라켄보물",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game13",
                    "clue": { "type": "text", "content": "크라켄" },
                    "storyText": "크라켄의 촉수가 배를 붙잡았다! 온 힘을 다해 촉수를 떼어내라!",
                    "hintMessage": "",
                    "secretCode": "🐙",
                    "successMessage": "촉수 격퇴! 크라켄이 잠시 물러났다! 무기 조각 하나를 건졌다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game11",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "크라켄의 약점을 공격하려면 정확한 순서로 타격해야 한다!",
                    "hintMessage": "",
                    "secretCode": "⚔️",
                    "successMessage": "정확한 타격! 크라켄이 비명을 지른다!"
                },
                {
                    "type": "findObject",
                    "hints": ["화장실 어딘가에 바다의 보물이 있다", "선반 위를 살펴봐", "비누 근처를 확인해봐"],
                    "answers": ["비누", "비누곽", "고체비누"],
                    "clue": { "type": "text", "content": "보물" },
                    "storyText": "심해에서 떠올라온 신비한 보석이 화장실에 숨겨져 있다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game05",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "크라켄의 심장으로 가는 퍼즐 통로! 타일을 맞춰 길을 열어라!",
                    "hintMessage": "",
                    "secretCode": "💰",
                    "successMessage": "통로 오픈! 크라켄의 심장에 도달했다! 보물을 획득하라!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 크라켄을 물리치고 심해의 보물을 차지했다! 전설의 바다 영웅이다!",
                "secretCode": "582"
            }
        }
    ]
};
