PRESET_DATA.jungle = {
    "scenarios": [
        {
            "id": "jungle-01",
            "name": "잃어버린 황금 신전",
            "description": "전설의 황금 신전을 찾아 정글 깊숙이 탐험을 떠나자!",
            "introText": "고대 문명 연구소에서 놀라운 지도가 발견되었다!\n\n수천 년 전 사라진 황금 신전의 위치가 정글 어딘가에 숨겨져 있다.\n\n신전의 봉인을 풀기 위해서는 정글 곳곳에 흩어진 유물 조각을 모아야 한다.\n\n탐험대원이여, 정글 속으로 출발하라!",
            "treasurePassword": "황금신전열쇠",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game02",
                    "clue": { "type": "text", "content": "황금" },
                    "storyText": "울창한 정글 미로를 헤쳐나가야 한다! 길을 잃지 말고 출구를 찾아라!",
                    "hintMessage": "",
                    "secretCode": "🌿",
                    "successMessage": "정글 미로 탈출 성공! 고대 석판에서 첫 번째 유물 조각 발견!"
                },
                {
                    "type": "findObject",
                    "hints": ["거실 어딘가에 고대 유물이 숨겨져 있다", "식물 화분 근처를 살펴봐", "책장 위를 확인해봐"],
                    "answers": ["나뭇잎", "잎", "이파리"],
                    "clue": { "type": "text", "content": "신전" },
                    "storyText": "정글 캠프 주변에 고대인이 남긴 나뭇잎 표식이 있다고 한다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game18",
                    "clue": { "type": "text", "content": "열쇠" },
                    "storyText": "독이 있는 식물과 약초를 구별해야 한다! 정확한 색을 찾아내라!",
                    "hintMessage": "",
                    "secretCode": "🦜",
                    "successMessage": "식물 감별 성공! 약초에서 세 번째 유물 조각 발견!"
                },
                {
                    "type": "minigame",
                    "gameId": "game13",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "거대한 바위가 신전 입구를 막고 있다! 온 힘을 모아 밀어내라!",
                    "hintMessage": "",
                    "secretCode": "🗿",
                    "successMessage": "바위 제거 성공! 신전의 입구가 드러났다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game23",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "황금 신전의 마지막 봉인! 고대 잠금장치를 풀어라!",
                    "hintMessage": "",
                    "secretCode": "🏛️",
                    "successMessage": "봉인 해제! 전설의 황금 신전이 열렸다!"
                }
            ],
            "finalReward": {
                "message": "축하한다, 위대한 탐험가! 잃어버린 황금 신전의 보물을 찾았다!",
                "secretCode": "531"
            }
        },
        {
            "id": "jungle-02",
            "name": "원숭이 왕국의 왕관",
            "description": "원숭이 왕국의 도난당한 왕관을 되찾아주는 모험!",
            "introText": "정글 깊은 곳의 원숭이 왕국에서 도움을 요청해왔다!\n\n왕의 황금 왕관이 밤사이 사라졌다고 한다.\n\n범인은 왕관을 여러 조각으로 나눠 정글 곳곳에 숨겨버렸다.\n\n탐험대원이여, 왕관 조각을 모아 원숭이 왕국을 구하라!",
            "treasurePassword": "원숭이왕관",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game11",
                    "clue": { "type": "text", "content": "원숭이" },
                    "storyText": "원숭이들이 나뭇가지를 순서대로 흔들어 길을 알려준다! 순서를 기억하라!",
                    "hintMessage": "",
                    "secretCode": "🐒",
                    "successMessage": "순서 기억 성공! 원숭이들이 첫 번째 왕관 조각을 건네준다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game20",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "범인이 남긴 이모지 암호가 나무껍질에 새겨져 있다! 해독하라!",
                    "hintMessage": "",
                    "secretCode": "🌳",
                    "successMessage": "암호 해독! 범인의 도주 경로를 파악했다!"
                },
                {
                    "type": "findObject",
                    "hints": ["주방 어딘가에 원숭이의 먹이가 숨겨져 있다", "과일 바구니를 살펴봐", "냉장고 안을 확인해봐"],
                    "answers": ["바나나", "과일", "사과"],
                    "clue": { "type": "text", "content": "왕관" },
                    "storyText": "원숭이 정찰대가 과일에 왕관 조각 위치를 새겨놓았다! 찾아라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game15",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "정글의 맹수가 왕관 조각을 지키고 있다! 큰 소리로 겁을 줘서 쫓아내라!",
                    "hintMessage": "",
                    "secretCode": "🦁",
                    "successMessage": "맹수 퇴치! 네 번째 왕관 조각 획득!"
                },
                {
                    "type": "minigame",
                    "gameId": "game25",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "마지막 왕관 조각이 먼지 쌓인 보물함에 숨겨져 있다! 긁어서 찾아라!",
                    "hintMessage": "",
                    "secretCode": "👑",
                    "successMessage": "왕관 완성! 원숭이 왕국에 평화가 돌아왔다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 원숭이 왕국의 왕관을 되찾았다! 정글의 영웅으로 칭송받게 되었다!",
                "secretCode": "728"
            }
        },
        {
            "id": "jungle-03",
            "name": "독사의 동굴",
            "description": "맹독 뱀이 지키는 동굴 속 고대 약초를 구해오는 미션!",
            "introText": "정글 마을에 전염병이 퍼지고 있다!\n\n유일한 치료약은 독사의 동굴 깊은 곳에 자라는 전설의 약초뿐이다.\n\n동굴은 맹독 뱀들이 지키고 있어 매우 위험하다.\n\n용감한 탐험가여, 마을 사람들을 구하러 동굴로 떠나라!",
            "treasurePassword": "해독의약초",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game12",
                    "clue": { "type": "text", "content": "해독" },
                    "storyText": "독사의 독을 구별해야 한다! 독의 색깔 패턴을 분석해 해독제를 만들어라!",
                    "hintMessage": "",
                    "secretCode": "🐍",
                    "successMessage": "독 분석 완료! 해독 정보를 얻었다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game27",
                    "clue": { "type": "text", "content": "의" },
                    "storyText": "뱀이 잠든 사이에 동굴을 지나야 한다! 정확한 타이밍에 움직여라!",
                    "hintMessage": "",
                    "secretCode": "⏰",
                    "successMessage": "은밀하게 통과! 동굴 깊은 곳으로 진입 성공!"
                },
                {
                    "type": "findObject",
                    "hints": ["거실 어딘가에 약초가 숨겨져 있다", "화분이나 식물 근처를 살펴봐", "창문 근처를 확인해봐"],
                    "answers": ["풀", "잎", "나뭇잎"],
                    "clue": { "type": "text", "content": "약초" },
                    "storyText": "동굴 입구에서 약초의 향기가 난다! 단서가 되는 식물을 찾아라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game22",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "동굴의 보안 장치를 해제해야 약초 보관소에 접근할 수 있다!",
                    "hintMessage": "",
                    "secretCode": "🌿",
                    "successMessage": "보안 해제! 전설의 약초를 손에 넣었다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 전설의 약초를 구해 마을을 구했다! 정글의 구원자로 기억될 것이다!",
                "secretCode": "194"
            }
        }
    ]
};
