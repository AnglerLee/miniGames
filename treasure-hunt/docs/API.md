# Treasure Hunt - REST API 명세

## Base URL
```
http://{서버IP}:3000/api
```

---

## 1. 보물찾기 설정 (Config)

### GET /api/config
현재 보물찾기 설정을 조회한다.

**Response 200:**
```json
{
  "preset": "pirate",
  "theme": "pirate",
  "scenarioId": "pirate-01",
  "totalMissions": 5,
  "globalTimeLimit": 0,
  "treasurePassword": "보물은 여기",
  "showClues": true,
  "playerCount": 2,
  "players": [
    { "name": "플레이어1" },
    { "name": "플레이어2" }
  ],
  "missions": [
    {
      "type": "minigame",
      "gameId": "game02",
      "clue": { "type": "text", "content": "첫번째 단서" },
      "storyText": "미로를 탈출하라!",
      "hintMessage": "",
      "secretCode": "🔑",
      "successMessage": "미로 탈출 성공!"
    },
    {
      "type": "findObject",
      "hints": ["거실에 있어요", "TV 근처", "빨간색이에요"],
      "answers": ["리모컨", "리모콘"],
      "clue": { "type": "text", "content": "두번째 단서" },
      "storyText": "숨겨진 물건을 찾아라!"
    }
  ],
  "introText": "해적의 보물을 찾아 모험을 떠나자!",
  "finalReward": {
    "message": "축하합니다!",
    "secretCode": "358"
  },
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

**Response 404:** 설정이 없는 경우
```json
{ "error": "Config not found", "data": null }
```

### PUT /api/config
보물찾기 설정을 저장한다. 저장 후 SSE `config_updated` 이벤트를 브로드캐스트한다.

**Request Body:** 위 GET 응답과 동일한 구조

**Response 200:**
```json
{ "success": true }
```

---

## 2. 게임 상태 (State)

### GET /api/state
현재 게임 진행 상태를 조회한다.

**Response 200:**
```json
{
  "status": "playing",
  "currentMissionIndex": 2,
  "currentPlayer": 0,
  "startedAt": "2025-01-01T10:00:00.000Z",
  "elapsedTime": 300,
  "missionResults": [
    {
      "id": "m0",
      "status": "cleared",
      "grade": "S",
      "attempts": 1,
      "time": 45,
      "player": 0
    },
    {
      "id": "m1",
      "status": "cleared",
      "grade": "A",
      "attempts": 2,
      "time": 120,
      "player": 1
    }
  ],
  "collectedClues": [
    { "type": "text", "content": "첫번째 단서" },
    { "type": "text", "content": "두번째 단서" }
  ],
  "hintsUsed": {
    "m0": 0,
    "m1": 2
  },
  "completedAt": null
}
```

**Response 404:** 진행 중인 게임이 없는 경우
```json
{ "error": "State not found", "data": null }
```

### PUT /api/state
게임 상태를 업데이트한다. 저장 후 SSE `state_updated` 이벤트를 브로드캐스트한다.

**Request Body:** 위 GET 응답과 동일한 구조

**Response 200:**
```json
{ "success": true }
```

### DELETE /api/state
게임 상태를 초기화(리셋)한다. SSE `game_reset` 이벤트를 브로드캐스트한다.

**Response 200:**
```json
{ "success": true }
```

---

## 3. 관리자 (Admin)

### GET /api/admin
관리자 정보(PIN)를 조회한다.

**Response 200:**
```json
{
  "pin": "0000"
}
```

### PUT /api/admin
관리자 정보를 업데이트한다.

**Request Body:**
```json
{
  "pin": "1234"
}
```

**Response 200:**
```json
{ "success": true }
```

---

## 4. 게임 이력 (History)

### GET /api/history
게임 이력 목록을 조회한다 (최근 50건).

**Response 200:**
```json
[
  {
    "theme": "pirate",
    "preset": "pirate",
    "scenarioId": "pirate-01",
    "completedAt": "2025-01-01T11:00:00.000Z",
    "results": {
      "totalTime": 600,
      "cleared": 5,
      "total": 5,
      "grade": "A",
      "totalAttempts": 8,
      "missions": []
    }
  }
]
```

### POST /api/history
게임 이력을 추가한다. 최대 50건 유지 (초과 시 가장 오래된 것 삭제).

**Request Body:** 위 배열 요소와 동일한 구조

**Response 200:**
```json
{ "success": true }
```

---

## 5. 미니게임 설정 (Game Settings)

### GET /api/games/:gameId/settings
특정 미니게임의 설정을 조회한다.

**URL 파라미터:**
- `gameId`: 게임 ID (예: `game02`, `game03`, `game07` 등)

**Response 200 (예: game02 - 미로):**
```json
{
  "activeDifficulty": "easy",
  "gameTheme": "cat",
  "timeEasy": 30,
  "timeNormal": 60,
  "timeHard": 90
}
```

**Response 200 (예: game03 - 짝맞추기):**
```json
{
  "pairCount": 12,
  "timeLimit": 60
}
```

**Response 404:** 설정이 없는 경우 (기본값 반환 없음)
```json
{ "error": "Settings not found for game02", "data": null }
```

### PUT /api/games/:gameId/settings
미니게임 설정을 저장한다. 저장 후 SSE `game_settings_updated` 이벤트를 브로드캐스트한다.

**Request Body:** 게임별 설정 JSON (구조는 게임마다 다름)

**Response 200:**
```json
{ "success": true }
```

---

## 6. 미디어 파일 업로드

관리자 모바일에서 카메라로 촬영한 이미지나 녹음한 오디오를 서버에 업로드한다.

### POST /api/upload
미디어 파일을 업로드한다.

**Request:**
- Content-Type: `multipart/form-data`
- Form fields:
  - `file`: 업로드할 파일 (image/jpeg, image/png, audio/webm, audio/ogg 등)
  - `gameId`: 게임 ID (예: `game25`, `game19`)
  - `type`: 파일 용도 (예: `background`, `audio_question`)

**Response 200:**
```json
{
  "success": true,
  "url": "/uploads/game25/bg_1704067200000.jpg",
  "filename": "bg_1704067200000.jpg"
}
```

**Response 400:** 파일 없음 또는 지원하지 않는 형식
```json
{ "error": "No file uploaded or unsupported file type" }
```

**제한사항:**
- 최대 파일 크기: 10MB
- 허용 형식: image/jpeg, image/png, image/webp, audio/webm, audio/ogg, audio/mp4
- 파일명: `{type}_{timestamp}.{ext}` 형식으로 자동 생성

### GET /uploads/:gameId/:filename
업로드된 미디어 파일을 정적으로 서빙한다. (Express static middleware)

### DELETE /api/upload/:gameId/:filename
업로드된 미디어 파일을 삭제한다.

**Response 200:**
```json
{ "success": true }
```

---

## 7. SSE 이벤트 스트림

### GET /api/events
Server-Sent Events 연결을 생성한다. 클라이언트는 이 엔드포인트에 연결하여 실시간 업데이트를 수신한다.

**Response Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**이벤트 형식:**

#### config_updated
관리자가 보물찾기 설정을 변경했을 때 발생.
```
event: config_updated
data: {"preset":"pirate","theme":"pirate",...전체 config}
```

#### state_updated
게임 상태가 변경되었을 때 발생.
```
event: state_updated
data: {"status":"playing","currentMissionIndex":3,...전체 state}
```

#### game_reset
게임이 리셋되었을 때 발생.
```
event: game_reset
data: {}
```

#### game_settings_updated
미니게임 설정이 변경되었을 때 발생.
```
event: game_settings_updated
data: {"gameId":"game02","settings":{"activeDifficulty":"hard",...}}
```

#### heartbeat
연결 유지용 핑 (30초마다).
```
event: heartbeat
data: {"timestamp":1704067200000}
```

---

## 8. 정적 파일 서빙

| URL 패턴 | 파일 위치 | 용도 |
|-----------|-----------|------|
| `/` | `public/` | 보물찾기 클라이언트 |
| `/games/*` | `../games/` | 미니게임 파일 |
| `/assets/*` | `../assets/` | 공통 에셋 (common.js 등) |
| `/uploads/*` | `data/uploads/` | 업로드된 미디어 파일 (이미지, 오디오) |

---

## 9. 에러 응답 형식

모든 에러는 아래 형식으로 반환된다.

```json
{
  "error": "에러 메시지",
  "data": null
}
```

| HTTP 코드 | 의미 |
|-----------|------|
| 200 | 성공 |
| 400 | 잘못된 요청 (유효성 검증 실패) |
| 404 | 자원 없음 |
| 500 | 서버 내부 오류 (파일 I/O 실패 등) |

---

## 10. 미니게임별 localStorage 키 ↔ API 매핑

| 게임 | localStorage 키 | API gameId | 설정 구조 |
|------|-----------------|------------|-----------|
| 02-미로탈출 | `mazeGameSettings` | `game02` | `{activeDifficulty, gameTheme, timeEasy, timeNormal, timeHard}` |
| 03-짝맞추기 | `card_match_settings` | `game03` | `{pairCount, timeLimit}` |
| 05-슬라이딩퍼즐 | `sliding_puzzle_settings` | `game05` | `{gridSize, timeLimit, imageMode}` |
| 07-수학경주 | `math_race_settings` | `game07` | `{difficulty, timeLimit, theme}` |
| 08-단어찾기 | `word_search_settings` | `game08` | `{difficulty, gridSize, timeLimit, theme}` |
| 11-시퀀스탭 | `sequence_tap_settings` | `game11` | `{difficulty, speed, rounds}` |
| 12-컬러러시 | `color_rush_settings` | `game12` | `{timeLimit, difficulty}` |
| 13-에너지충전 | `energy_charge_settings` | `game13` | `{targetEnergy, timeLimit}` |
| 15-데시벨미터 | `decibel_meter_settings` | `game15` | `{targetLevel, duration}` |
| 16-마법나침반 | `magic_compass_settings` | `game16` | `{targetAngle, tolerance}` |
| 17-바코드스캐너 | `barcode_scanner_settings` | `game17` | `{targetCode}` |
| 18-컬러헌터 | `color_hunter_settings` | `game18` | `{targetColor, tolerance, timeLimit}` |
| 19-리버스오디오 | `reverse_audio_settings` + `reverseAudio_*` | `game19` | `{difficulty, rounds}` ⚠️ 오디오 업로드 필요 |
| 20-이모지퀴즈 | `game20_settings` | `game20` | `{difficulty, timePerQuestion, totalQuestions}` |
| 21-듀얼터치 | `dual_touch_settings` | `game21` | `{rounds, timeLimit}` |
| 22-와이파이해커 | `wifi_hacker_settings` | `game22` | `{difficulty, timeLimit}` |
| 23-금고해제 | `safe_cracker_settings` | `game23` | `{combination, timeLimit}` |
| 24-폭탄균형 | `bomb_balance_settings` | `game24` | `{sensitivity, duration}` |
| 25-스크래치카드 | `scratch_bg_image` | `game25` | `{backgroundImage}` ⚠️ 미디어 업로드 필요 |
| 27-스톱워치 | `stopwatch_settings` | `game27` | `{targetTime, tolerance}` |
