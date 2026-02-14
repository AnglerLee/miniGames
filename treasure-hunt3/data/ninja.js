PRESET_DATA.ninja = {
    "scenarios": [
        {
            "id": "ninja-01",
            "name": "비밀 두루마리를 찾아라",
            "description": "닌자 수련관의 시험을 통과하고 비밀 두루마리를 손에 넣어라!",
            "introText": "닌자 수련관에서 긴급 소집!\n\n전설의 비밀 두루마리가 도난당할 위기에 처했다.\n\n두루마리를 지키기 위해 수련관 곳곳에 숨겨진 봉인 조각을 모아야 한다.\n\n닌자 수련생이여, 은밀하게 임무를 수행하라!",
            "treasurePassword": "그림자인술",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game11",
                    "clue": { "type": "text", "content": "그림자" },
                    "storyText": "첫 번째 시련: 수련관의 함정을 순서대로 정확히 밟아야 한다!",
                    "hintMessage": "",
                    "secretCode": "🌙",
                    "successMessage": "함정 통과! 첫 번째 봉인 조각을 획득했다!"
                },
                {
                    "type": "findObject",
                    "hints": ["침실 어딘가에 봉인 부적이 숨겨져 있다", "옷장 안을 뒤져봐", "서랍 속을 확인해봐"],
                    "answers": ["부적", "종이", "부적종이"],
                    "clue": { "type": "text", "content": "인술" },
                    "storyText": "선배 닌자가 침실 어딘가에 봉인 부적을 숨겨두었다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game07",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "암호 해독 시험! 닌자 암호를 빠르게 풀어야 한다!",
                    "hintMessage": "",
                    "secretCode": "⚔️",
                    "successMessage": "암호 해독 완료! 세 번째 봉인 조각!"
                },
                {
                    "type": "minigame",
                    "gameId": "game27",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "정확한 타이밍에 표적을 맞춰야 한다! 닌자의 집중력을 보여줘라!",
                    "hintMessage": "",
                    "secretCode": "🎯",
                    "successMessage": "표적 명중! 네 번째 봉인 조각!"
                },
                {
                    "type": "minigame",
                    "gameId": "game22",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "적의 통신망에 잠입해야 한다! 해킹으로 최종 정보를 탈취하라!",
                    "hintMessage": "",
                    "secretCode": "🥷",
                    "successMessage": "잠입 성공! 모든 봉인 조각을 모았다!"
                }
            ],
            "finalReward": {
                "message": "축하한다, 그림자의 닌자! 비밀 두루마리를 지켜냈다! 최고의 닌자로 인정받았다!",
                "secretCode": "903"
            }
        },
        {
            "id": "ninja-02",
            "name": "그림자 대전",
            "description": "라이벌 닌자 문파의 도전을 받아 무술 대회에서 우승하라!",
            "introText": "라이벌 닌자 문파 '흑룡회'에서 도전장을 보내왔다!\n\n그림자 무술 대회에서 승리하지 못하면 수련관을 빼앗기게 된다.\n\n대회의 다섯 가지 시련을 통과해야만 최고의 닌자가 될 수 있다.\n\n수련생이여, 수련관의 명예를 지켜라!",
            "treasurePassword": "무림의고수",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game12",
                    "clue": { "type": "text", "content": "무림" },
                    "storyText": "첫 번째 시련: 상대의 공격 색깔을 보고 빠르게 반격하라!",
                    "hintMessage": "",
                    "secretCode": "🥋",
                    "successMessage": "첫 번째 시련 통과! 빠른 반사신경을 인정받았다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game13",
                    "clue": { "type": "text", "content": "의" },
                    "storyText": "두 번째 시련: 내공 충전! 차크라를 모아 필살기를 완성하라!",
                    "hintMessage": "",
                    "secretCode": "💥",
                    "successMessage": "내공 충전 완료! 강력한 힘이 느껴진다!"
                },
                {
                    "type": "findObject",
                    "hints": ["거실 어딘가에 수련 도구가 숨겨져 있다", "쿠션 뒤를 살펴봐", "카펫 아래를 확인해봐"],
                    "answers": ["수건", "타올", "타월"],
                    "clue": { "type": "text", "content": "고수" },
                    "storyText": "닌자의 수련에 필수인 수련 수건이 숨겨져 있다! 찾아서 힘을 모아라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game05",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "네 번째 시련: 적의 방어 진형을 퍼즐처럼 분석해 약점을 찾아라!",
                    "hintMessage": "",
                    "secretCode": "🧩",
                    "successMessage": "약점 발견! 상대의 방어가 무너지고 있다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game23",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "최종 결전! 상대 닌자의 비밀 금고를 열어 승리의 증표를 획득하라!",
                    "hintMessage": "",
                    "secretCode": "🏆",
                    "successMessage": "대회 우승! 수련관의 명예를 지켜냈다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 그림자 대전에서 우승했다! 무림 최고의 닌자로 인정받았다!",
                "secretCode": "808"
            }
        },
        {
            "id": "ninja-03",
            "name": "쿠노이치의 비밀 임무",
            "description": "적진에 잠입하여 포로로 잡힌 동료를 구출하라!",
            "introText": "긴급 임무 하달!\n\n동료 닌자가 적의 성에 포로로 잡혀있다.\n\n쿠노이치(여닌자)의 잠입술을 배워 적진 깊숙이 침투해야 한다.\n\n은밀하게, 신속하게, 동료를 구출하라!",
            "treasurePassword": "동료구출작전",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game02",
                    "clue": { "type": "text", "content": "동료" },
                    "storyText": "적의 성 안은 미로처럼 복잡하다! 들키지 않게 미로를 통과하라!",
                    "hintMessage": "",
                    "secretCode": "🏯",
                    "successMessage": "미로 통과! 적의 시선을 피해 성 안으로 잠입했다!"
                },
                {
                    "type": "minigame",
                    "gameId": "game19",
                    "clue": { "type": "text", "content": "구출" },
                    "storyText": "적의 통신을 도청했다! 거꾸로 된 음성에서 동료의 위치를 알아내라!",
                    "hintMessage": "",
                    "secretCode": "📻",
                    "successMessage": "통신 해독! 동료가 지하 감옥에 있다는 정보를 얻었다!"
                },
                {
                    "type": "findObject",
                    "hints": ["침실 어딘가에 구출 대상이 있다", "인형 근처를 살펴봐", "이불 속을 확인해봐"],
                    "answers": ["인형", "곰인형", "봉제인형"],
                    "clue": { "type": "text", "content": "작전" },
                    "storyText": "동료의 분신술 인형이 숨겨져 있다! 찾아서 작전에 활용하라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game17",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "감옥 문에 특수 바코드 잠금이 걸려있다! 스캔해서 문을 열어라!",
                    "hintMessage": "",
                    "secretCode": "🔓",
                    "successMessage": "감옥 문 해제! 동료를 구출했다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 동료를 무사히 구출했다! 최고의 닌자 팀워크를 보여줬다!",
                "secretCode": "747"
            }
        }
    ]
};
