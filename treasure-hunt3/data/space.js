PRESET_DATA.space = {
    "scenarios": [
        {
            "id": "space-01",
            "name": "외계 SOS 신호 해독",
            "description": "외계인이 보낸 SOS 신호를 해독해 지구를 구하라!",
            "introText": "긴급 통신이 도착했다!\n\n미지의 외계 문명이 보낸 SOS 메시지가 여러 조각으로 나뉘어 흩어졌다.\n\n이 메시지를 해독하지 못하면 지구에 큰 위기가 닥칠 수 있다!\n\n우주 탐험대원이여, 신호를 모아 메시지를 완성하라!",
            "treasurePassword": "별빛신호탑",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game16",
                    "clue": { "type": "text", "content": "별빛" },
                    "storyText": "외계 신호의 방향을 추적해야 한다! 컴퍼스로 신호 발원지를 찾아라!",
                    "hintMessage": "",
                    "secretCode": "🛸",
                    "successMessage": "신호 추적 성공! 첫 번째 메시지 조각 확보!"
                },
                {
                    "type": "minigame",
                    "gameId": "game07",
                    "clue": { "type": "text", "content": "신호" },
                    "storyText": "우주선 항법 컴퓨터가 고장났다! 계산 문제를 풀어 수리하라!",
                    "hintMessage": "",
                    "secretCode": "🌟",
                    "successMessage": "항법 컴퓨터 수리 완료! 두 번째 메시지 조각 발견!"
                },
                {
                    "type": "findObject",
                    "hints": ["책상 위에 뭔가 특별한 게 있다", "노트나 공책을 살펴봐", "펜 옆에 있을 수도 있어"],
                    "answers": ["별", "스티커", "별 스티커"],
                    "clue": { "type": "text", "content": "탑" },
                    "storyText": "우주 기지에 숨겨진 별 모양 좌표 칩을 찾아라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game05",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "외계 퍼즐 암호를 풀어야 통신 주파수가 맞춰진다!",
                    "hintMessage": "",
                    "secretCode": "📡",
                    "successMessage": "퍼즐 해독 완료! 통신 주파수 확보!"
                },
                {
                    "type": "minigame",
                    "gameId": "game24",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "소행성 벨트를 지나야 한다! 우주선의 균형을 유지하라!",
                    "hintMessage": "",
                    "secretCode": "☄️",
                    "successMessage": "소행성 벨트 통과! 최종 메시지 조각 수신!"
                }
            ],
            "finalReward": {
                "message": "축하한다, 우주 영웅! 외계 SOS 메시지 해독에 성공했다! 지구가 안전해졌다!",
                "secretCode": "492"
            }
        },
        {
            "id": "space-02",
            "name": "화성 기지 탈출",
            "description": "화성 기지에 고립되었다! 시스템을 복구하고 탈출하라!",
            "introText": "긴급 상황 발생!\n\n화성 기지에 운석이 충돌해 시스템이 마비되었다.\n\n산소 공급 장치가 멈추기 전에 기지를 복구하고 탈출해야 한다.\n\n시간이 없다! 우주 엔지니어여, 지금 바로 수리를 시작하라!",
            "treasurePassword": "화성탈출코드",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game22",
                    "clue": { "type": "text", "content": "화성" },
                    "storyText": "기지의 메인 컴퓨터가 잠겼다! 보안 시스템을 해킹해 접근 권한을 확보하라!",
                    "hintMessage": "",
                    "secretCode": "🖥️",
                    "successMessage": "해킹 성공! 메인 컴퓨터 접근 권한 확보!"
                },
                {
                    "type": "minigame",
                    "gameId": "game27",
                    "clue": { "type": "text", "content": "탈출" },
                    "storyText": "에어록 타이머가 오작동 중이다! 정확한 타이밍에 멈춰 에어록을 열어라!",
                    "hintMessage": "",
                    "secretCode": "⏱️",
                    "successMessage": "에어록 작동 성공! 두 번째 구역으로 이동!"
                },
                {
                    "type": "findObject",
                    "hints": ["거실 어딘가에 비상 장비가 있다", "TV 리모컨 근처를 살펴봐", "테이블 위를 확인해봐"],
                    "answers": ["리모컨", "리모콘", "건전지"],
                    "clue": { "type": "text", "content": "코드" },
                    "storyText": "비상 통신 장치의 전원이 꺼졌다! 배터리를 찾아 장착하라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game05",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "환기 시스템의 회로판이 망가졌다! 퍼즐을 풀어 회로를 복구하라!",
                    "hintMessage": "",
                    "secretCode": "🔧",
                    "successMessage": "회로 복구 완료! 산소 공급 재개!"
                },
                {
                    "type": "minigame",
                    "gameId": "game21",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "탈출 포드의 문이 걸렸다! 동시에 양쪽 잠금을 해제하라!",
                    "hintMessage": "",
                    "secretCode": "🚀",
                    "successMessage": "탈출 포드 가동! 화성 기지에서 무사히 탈출했다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 화성 기지에서 극적으로 탈출했다! 우주 최고의 엔지니어다!",
                "secretCode": "301"
            }
        },
        {
            "id": "space-03",
            "name": "은하수 특급 열차",
            "description": "은하수를 달리는 우주 열차에서 벌어지는 미스터리를 풀어라!",
            "introText": "은하수 특급 열차에 오신 것을 환영합니다!\n\n그런데 이상한 일이 벌어지고 있다.\n열차의 승차권이 여러 조각으로 찢겨져 객차 곳곳에 흩어져 있다.\n\n승차권을 완성하지 못하면 종착역에서 내릴 수 없다!\n\n서둘러 승차권 조각을 모아라!",
            "treasurePassword": "은하수승차권",
            "missions": [
                {
                    "type": "minigame",
                    "gameId": "game03",
                    "clue": { "type": "text", "content": "은하수" },
                    "storyText": "1호 객차에 카드가 뒤집혀 있다! 짝을 맞춰 승차권 조각을 찾아라!",
                    "hintMessage": "",
                    "secretCode": "🌌",
                    "successMessage": "카드 매칭 성공! 첫 번째 승차권 조각 획득!"
                },
                {
                    "type": "minigame",
                    "gameId": "game08",
                    "clue": { "type": "text", "content": "승차" },
                    "storyText": "식당칸 메뉴판에 숨겨진 단어를 찾아라! 그 안에 승차권 조각이 있다!",
                    "hintMessage": "",
                    "secretCode": "🍽️",
                    "successMessage": "숨겨진 단어 발견! 두 번째 승차권 조각!"
                },
                {
                    "type": "findObject",
                    "hints": ["책상 위에 특별한 카드가 있다", "교통카드나 명함을 살펴봐", "카드 지갑 근처를 확인해봐"],
                    "answers": ["카드", "교통카드", "명함"],
                    "clue": { "type": "text", "content": "권" },
                    "storyText": "차장이 특별한 카드를 책상 위에 놓고 갔다! 찾아서 확인하라!"
                },
                {
                    "type": "minigame",
                    "gameId": "game12",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "열차 신호등의 색깔 패턴을 읽어야 다음 객차로 이동할 수 있다!",
                    "hintMessage": "",
                    "secretCode": "🚂",
                    "successMessage": "신호 해독 완료! 다음 객차로 이동 성공!"
                },
                {
                    "type": "minigame",
                    "gameId": "game17",
                    "clue": { "type": "text", "content": "" },
                    "storyText": "종착역 게이트의 바코드를 스캔해 최종 승차권을 발급받아라!",
                    "hintMessage": "",
                    "secretCode": "🎫",
                    "successMessage": "승차권 완성! 은하수 여행을 무사히 마쳤다!"
                }
            ],
            "finalReward": {
                "message": "축하한다! 은하수 특급 열차의 미스터리를 풀고 종착역에 도착했다! 멋진 우주 여행이었다!",
                "secretCode": "777"
            }
        }
    ]
};
