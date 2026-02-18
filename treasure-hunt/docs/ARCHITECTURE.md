# Treasure Hunt - Node.js Server Architecture

## 1. 시스템 개요

기존 `treasure-hunt3`의 localStorage 기반 시스템을 Node.js 서버 기반으로 전환하여,
관리자와 플레이어가 동일 WiFi 망에서 실시간 동기화된 게임을 진행한다.

**관리자는 PC 또는 모바일 모두에서 접속 가능**하다.
특히 카메라 촬영이 필요한 미니게임(스크래치카드 배경 사진 등) 설정을 위해
모바일 관리자 접속이 지원되어야 한다.

```
┌──────────────┐                             ┌──────────────┐
│  관리자 (PC)  │                             │  관리자 (모바일) │
│  admin.html  │                             │   admin.html   │
└──────┬───────┘          WiFi LAN           └──────┬───────┘
       │                                           │
       └────────────┬──────────────────────────────┘
                    │
              Node.js 서버 (Express + SSE)
              JSON 파일 + 미디어 파일 저장소
                    │
       ┌────────────┴──────────────────────────────┐
       │                                           │
┌──────┴───────┐                            ┌──────┴───────┐
│ 플레이어 모바일1│                            │ 플레이어 모바일2│
│  index.html  │                            │  index.html  │
└──────────────┘                            └──────────────┘
```

## 2. 기술 스택

| 구분 | 기술 | 이유 |
|------|------|------|
| Server | Node.js + Express | 경량, 빠른 구축 |
| 실시간 통신 | REST API + SSE (Server-Sent Events) | 관리자→플레이어 단방향 실시간 푸시 |
| 데이터 저장 | JSON 파일 (`data/` 폴더) | DB 설치 불필요, 백업 간편 |
| 프론트엔드 | 기존 treasure-hunt3 HTML/CSS/JS 재사용 | 개발 비용 최소화 |
| 세션 | 단일 세션 | 가정용 소규모 사용 |

## 3. 디렉토리 구조

```
treasure-hunt/
├── server.js                    # Express 서버 엔트리포인트
├── package.json                 # Node.js 의존성
├── docs/                        # 개발 문서
│   ├── ARCHITECTURE.md          # 아키텍처 설계 (이 파일)
│   ├── API.md                   # REST API 명세
│   ├── DEVPLAN.md               # 개발 계획 & TODO
│   └── MIGRATION.md             # 마이그레이션 가이드
├── data/                        # JSON 데이터 저장소
│   ├── config.json              # 보물찾기 설정 (관리자 설정값)
│   ├── state.json               # 현재 게임 진행 상태
│   ├── admin.json               # 관리자 PIN 정보
│   ├── history.json             # 게임 이력 (최대 50건)
│   ├── game-settings/           # 미니게임별 설정
│   │   ├── game02.json          # 미로 탈출 설정
│   │   ├── game03.json          # 짝 맞추기 설정
│   │   ├── game05.json          # 슬라이딩 퍼즐 설정
│   │   └── ...                  # (게임별 JSON 파일)
│   └── uploads/                 # ★ NEW: 미디어 업로드 저장소
│       ├── game25/              # 스크래치카드 배경 이미지
│       └── game19/              # 리버스오디오 녹음 파일
├── public/                      # 정적 파일 (클라이언트)
│   ├── index.html               # 메인 화면 (S01/S04/S05)
│   ├── admin.html               # 관리자 대시보드 (S02/S03)
│   ├── play.html                # 게임 플레이 (S06/S07)
│   ├── treasure.html            # 보물 화면 (S08)
│   ├── js/                      # 클라이언트 JS
│   │   ├── api-client.js        # ★ NEW: 서버 API 클라이언트 (Storage 대체)
│   │   ├── sse-client.js        # ★ NEW: SSE 이벤트 수신 클라이언트
│   │   ├── storage.js           # 기존 Storage 객체 → API 래퍼로 변환
│   │   ├── game-engine.js       # 게임 엔진 (비동기 API 호출로 변환)
│   │   ├── app.js               # 앱 메인 로직
│   │   ├── theme-manager.js     # 테마 관리
│   │   ├── preset-data.js       # 프리셋 데이터
│   │   └── effects.js           # 효과/사운드
│   ├── css/                     # 스타일시트
│   │   ├── common.css
│   │   ├── themes.css
│   │   └── animations.css
│   ├── data/                    # 프리셋 데이터 JS 파일
│   └── assets/                  # 이미지 등 에셋
├── games/                       # 미니게임 (심볼릭 링크 또는 복사)
│   └── → ../games/              # 기존 games 폴더 참조
└── assets/                      # 공통 에셋 (심볼릭 링크 또는 복사)
    └── → ../assets/             # 기존 assets 폴더 참조
```

## 4. 핵심 아키텍처 패턴

### 4.1 Storage Layer 교체 전략

기존 `Storage` 객체의 인터페이스를 유지하면서 내부 구현만 서버 API 호출로 교체한다.

**기존 (localStorage):**
```javascript
Storage.getConfig()           // localStorage.getItem('treasureHunt3_config')
Storage.setConfig(config)     // localStorage.setItem('treasureHunt3_config', ...)
```

**변경 후 (서버 API):**
```javascript
Storage.getConfig()           // GET /api/config → JSON
Storage.setConfig(config)     // PUT /api/config → JSON 파일 저장 + SSE 브로드캐스트
```

### 4.2 SSE (Server-Sent Events) 실시간 동기화

관리자가 설정을 변경하면 서버가 SSE를 통해 모든 연결된 클라이언트에 변경사항을 실시간 푸시한다.

```
관리자 PC                    서버                     모바일
    │                         │                         │
    │── PUT /api/config ────►│                         │
    │                         │── config.json 저장      │
    │                         │── SSE: config_updated ─►│
    │                         │                         │── UI 즉시 반영
    │◄── 200 OK ─────────────│                         │
```

**SSE 이벤트 종류:**

| 이벤트 | 트리거 | 데이터 | 용도 |
|--------|--------|--------|------|
| `config_updated` | 관리자 설정 저장 | config 전체 | 게임 설정 동기화 |
| `state_updated` | 게임 상태 변경 | state 전체 | 게임 진행 상태 동기화 |
| `game_reset` | 게임 리셋 | - | 모든 클라이언트 초기화 |
| `game_settings_updated` | 미니게임 설정 변경 | {gameId, settings} | 미니게임 설정 동기화 |

### 4.3 미디어 파일 업로드 (카메라/이미지/오디오)

일부 미니게임은 관리자 모바일에서 카메라로 사진을 찍거나 오디오를 녹음하여 게임에 사용한다.
기존에는 base64 데이터를 localStorage에 저장했으나, 서버 전환 시 파일 업로드 API를 통해 서버에 저장한다.

**미디어를 사용하는 게임:**

| 게임 | 미디어 종류 | 기존 저장 방식 | 서버 저장 방식 |
|------|------------|---------------|---------------|
| 25-스크래치카드 | 📷 이미지 (카메라/갤러리) | `localStorage('scratch_bg_image')` base64 | `POST /api/upload` → `data/uploads/game25/` |
| 19-리버스오디오 | 🎙️ 오디오 (마이크 녹음) | `localStorage('reverseAudio_*')` base64 | `POST /api/upload` → `data/uploads/game19/` |
| 18-컬러헌터 | 📷 실시간 카메라 | 저장 없음 (실시간 사용) | 변경 없음 (클라이언트 전용) |
| 17-바코드스캐너 | 📷 실시간 카메라 | 저장 없음 (실시간 사용) | 변경 없음 (클라이언트 전용) |

**업로드 플로우 (관리자 모바일):**
```
관리자 모바일                    서버                     game 설정
    │                           │                         │
    │── 📷 카메라 촬영            │                         │
    │── POST /api/upload ──────►│                         │
    │   (multipart/form-data)   │── 파일 저장              │
    │                           │   data/uploads/game25/   │
    │◄── { url: '/uploads/..' }─│                         │
    │                           │                         │
    │── PUT /api/games/game25/settings ──────────────────►│
    │   { backgroundImage: '/uploads/...' }               │
    │                           │── SSE broadcast ────────►│
```

### 4.4 미니게임 설정 서버화

각 미니게임의 admin.js가 localStorage 대신 서버 API를 호출하도록 변경한다.

**기존:**
```javascript
// games/02-maze/admin.js
localStorage.setItem('mazeGameSettings', JSON.stringify(settings));
```

**변경 후:**
```javascript
// games/02-maze/admin.js
fetch('/api/games/game02/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
});
```

**미니게임 game.js 설정 로딩:**
```javascript
// 기존: JSON.parse(localStorage.getItem('mazeGameSettings'))
// 변경: await fetch('/api/games/game02/settings').then(r => r.json())
```

### 4.5 게임 iframe 통신 (변경 없음)

iframe 내 게임과 play.html 간의 postMessage 통신은 그대로 유지한다.
변경되는 것은 play.html이 GameEngine을 통해 서버에 상태를 저장하는 부분뿐이다.

```
play.html ◄─── postMessage('GAME_CLEAR') ─── iframe (게임)
    │
    └── GameEngine.completeMission() → PUT /api/state → SSE broadcast
```

## 5. 서버 API 설계 원칙

1. **RESTful**: 자원 중심 URL 설계
2. **JSON Only**: 모든 요청/응답은 JSON
3. **동기화 보장**: 데이터 변경 시 SSE 브로드캐스트 필수
4. **파일 기반**: 모든 데이터는 `data/` 폴더의 JSON 파일에 저장
5. **에러 핸들링**: 파일 읽기/쓰기 실패 시 적절한 HTTP 에러 코드 반환

## 6. 클라이언트 아키텍처

### 6.1 api-client.js (NEW)

서버 API 통신을 담당하는 모듈. 기존 Storage 객체와 동일한 인터페이스를 제공한다.

```javascript
const ApiClient = {
    baseUrl: '',  // 같은 서버에서 서빙하므로 상대 경로

    async getConfig() { /* GET /api/config */ },
    async setConfig(config) { /* PUT /api/config */ },
    async getState() { /* GET /api/state */ },
    async setState(state) { /* PUT /api/state */ },
    async getAdmin() { /* GET /api/admin */ },
    async setAdmin(admin) { /* PUT /api/admin */ },
    async getHistory() { /* GET /api/history */ },
    async addHistory(record) { /* POST /api/history */ },
    async clearState() { /* DELETE /api/state */ },

    // 미니게임 설정
    async getGameSettings(gameId) { /* GET /api/games/:gameId/settings */ },
    async setGameSettings(gameId, settings) { /* PUT /api/games/:gameId/settings */ }
};
```

### 6.2 sse-client.js (NEW)

SSE 이벤트를 수신하고 UI 업데이트를 트리거하는 모듈.

```javascript
const SSEClient = {
    connect() { /* EventSource('/api/events') */ },
    disconnect() { /* close EventSource */ },
    on(event, callback) { /* 이벤트 리스너 등록 */ },
    off(event, callback) { /* 이벤트 리스너 해제 */ }
};
```

### 6.3 storage.js 변환

기존 동기 API를 비동기(async/await)로 변환하되, 기존 인터페이스 이름을 유지한다.

```javascript
const Storage = {
    // 변경: localStorage → ApiClient (async)
    async getConfig() { return ApiClient.getConfig(); },
    async setConfig(config) { return ApiClient.setConfig(config); },
    // ...
};
```

## 7. 네트워크 구성

```
로컬 PC (192.168.x.x:3000)
├── Express 서버
│   ├── /api/*          → REST API
│   ├── /api/upload     → 미디어 파일 업로드 (multipart)
│   ├── /api/events     → SSE 엔드포인트
│   ├── /uploads/*      → 업로드된 미디어 파일 정적 서빙
│   ├── /               → public/ 정적 파일
│   ├── /games/*        → games/ 정적 파일
│   └── /assets/*       → assets/ 정적 파일
│
├── 관리자 (PC):      http://localhost:3000/admin.html
├── 관리자 (모바일):   http://192.168.x.x:3000/admin.html  ← 📷 카메라 사용 가능
├── 플레이어 (모바일): http://192.168.x.x:3000
└── 미니게임 관리:     http://192.168.x.x:3000/games/{게임}/admin.html
```

## 8. 주요 변경점 요약

| 구분 | 기존 (treasure-hunt3) | 변경 (treasure-hunt) |
|------|----------------------|---------------------|
| 데이터 저장 | 브라우저 localStorage | 서버 JSON 파일 |
| 설정 동기화 | 없음 (단일 기기) | SSE 실시간 푸시 |
| 게임 호스팅 | GitHub Pages | Node.js Express |
| 관리자↔플레이어 | 같은 기기 | PC/모바일 관리자 ↔ 모바일 플레이어 |
| 미디어 저장 | localStorage (base64) | 서버 파일 업로드 (data/uploads/) |
| 미니게임 설정 | 각 게임 localStorage | 서버 JSON 파일 |
| Storage API | 동기 (sync) | 비동기 (async/await) |
| 서버 필요 | 불필요 | Node.js 필요 |
