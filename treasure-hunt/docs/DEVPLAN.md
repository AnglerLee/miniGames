# Treasure Hunt - 개발 계획서 & TODO

## 개발 목표
treasure-hunt3의 localStorage 기반 시스템을 Node.js 서버 기반으로 전환하여
관리자(PC/모바일)와 플레이어(모바일)가 WiFi망에서 실시간 동기화된 게임을 진행한다.

**핵심 요구사항:**
- 관리자 설정은 PC와 모바일 **모두**에서 접속 가능
- 카메라가 필요한 미니게임 설정(스크래치카드 배경 사진, 바코드 스캔 등)은 모바일 관리자에서 진행
- 미디어 파일(이미지/오디오)은 localStorage base64 대신 서버 파일 업로드로 변경

---

## Phase 1: 서버 기본 설정 ⬜

### 1.1 Node.js 프로젝트 초기화
- [ ] `package.json` 생성 (express 의존성)
- [ ] `server.js` 기본 Express 서버 작성
  - 포트: 3000 (환경변수로 변경 가능)
  - CORS 설정 (같은 네트워크 접속 허용)
  - JSON body parser
  - 로컬 IP 주소 자동 출력 (모바일 접속 편의)

### 1.2 데이터 저장소 설정
- [ ] `data/` 디렉토리 구조 생성
- [ ] JSON 파일 읽기/쓰기 유틸리티 작성 (`utils/file-store.js`)
  - `readJSON(filename)` - 파일 읽기, 없으면 null
  - `writeJSON(filename, data)` - 파일 쓰기 (atomic write)
- [ ] 초기 데이터 파일 생성
  - `data/config.json` (빈 객체)
  - `data/state.json` (null)
  - `data/admin.json` (`{"pin":"0000"}`)
  - `data/history.json` (`[]`)
  - `data/game-settings/` (빈 디렉토리)

### 1.3 정적 파일 서빙 설정
- [ ] `public/` → `/` 정적 파일
- [ ] `../games/` → `/games/` 정적 파일
- [ ] `../assets/` → `/assets/` 정적 파일

---

## Phase 2: REST API 구현 ⬜

### 2.1 보물찾기 설정 API
- [ ] `GET /api/config` - 설정 조회
- [ ] `PUT /api/config` - 설정 저장

### 2.2 게임 상태 API
- [ ] `GET /api/state` - 상태 조회
- [ ] `PUT /api/state` - 상태 업데이트
- [ ] `DELETE /api/state` - 상태 리셋

### 2.3 관리자 API
- [ ] `GET /api/admin` - 관리자 정보 조회
- [ ] `PUT /api/admin` - 관리자 정보 업데이트

### 2.4 게임 이력 API
- [ ] `GET /api/history` - 이력 조회
- [ ] `POST /api/history` - 이력 추가 (최대 50건)

### 2.5 미니게임 설정 API
- [ ] `GET /api/games/:gameId/settings` - 게임 설정 조회
- [ ] `PUT /api/games/:gameId/settings` - 게임 설정 저장

### 2.6 미디어 파일 업로드 API
- [ ] `POST /api/upload` - 미디어 파일 업로드 (multer 사용)
  - multipart/form-data 처리
  - 게임별 폴더 분리 (`data/uploads/{gameId}/`)
  - 파일명 자동 생성 (timestamp 기반)
  - 최대 10MB 제한
- [ ] `/uploads/*` 정적 파일 서빙 설정
- [ ] `DELETE /api/upload/:gameId/:filename` - 업로드 파일 삭제
- [ ] 대상 게임: game25(이미지), game19(오디오)

---

## Phase 3: SSE 실시간 통신 ⬜

### 3.1 SSE 서버 구현
- [ ] `GET /api/events` SSE 엔드포인트
- [ ] 클라이언트 연결 관리 (연결/해제 추적)
- [ ] 브로드캐스트 함수 구현
- [ ] 30초 heartbeat 전송
- [ ] 이벤트 타입별 브로드캐스트 함수
  - `broadcastConfigUpdate(config)`
  - `broadcastStateUpdate(state)`
  - `broadcastGameReset()`
  - `broadcastGameSettingsUpdate(gameId, settings)`

### 3.2 API에 SSE 연동
- [ ] `PUT /api/config` → `config_updated` 브로드캐스트
- [ ] `PUT /api/state` → `state_updated` 브로드캐스트
- [ ] `DELETE /api/state` → `game_reset` 브로드캐스트
- [ ] `PUT /api/games/:gameId/settings` → `game_settings_updated` 브로드캐스트

---

## Phase 4: 클라이언트 코드 마이그레이션 ⬜

### 4.1 API 클라이언트 모듈 작성
- [ ] `public/js/api-client.js` 작성
  - fetch 래퍼 함수들 (getConfig, setConfig, getState, setState 등)
  - 에러 핸들링 (네트워크 실패 시 재시도/알림)
  - 미니게임 설정 API (getGameSettings, setGameSettings)

### 4.2 SSE 클라이언트 모듈 작성
- [ ] `public/js/sse-client.js` 작성
  - EventSource 연결/재연결 관리
  - 이벤트 리스너 등록/해제
  - 자동 재연결 (연결 끊김 시)

### 4.3 storage.js 변환
- [ ] 기존 treasure-hunt3/js/storage.js 복사
- [ ] localStorage 호출을 ApiClient 호출로 교체
- [ ] 동기 → 비동기(async/await) 전환
- [ ] 기존 인터페이스 이름 유지

### 4.4 game-engine.js 변환
- [ ] 기존 treasure-hunt3/js/game-engine.js 복사
- [ ] Storage 호출 부분을 async/await로 변환
- [ ] 모든 public 메서드를 async로 전환
- [ ] 상태 변경 시 서버 동기화 보장

### 4.5 app.js 변환
- [ ] 기존 treasure-hunt3/js/app.js 복사
- [ ] Storage/GameEngine 호출을 await로 변환
- [ ] SSE 이벤트 리스너 연결 (설정 변경 시 UI 즉시 반영)
- [ ] 초기화 시 서버에서 데이터 로드

### 4.6 HTML 파일 마이그레이션
- [ ] `index.html` 복사 + script 태그 수정 (api-client.js, sse-client.js 추가)
- [ ] `admin.html` 복사 + script 태그 수정
- [ ] `play.html` 복사 + script 태그 수정
- [ ] `treasure.html` 복사 + script 태그 수정

### 4.7 기타 JS 파일 복사
- [ ] `theme-manager.js` (변경 없음)
- [ ] `preset-data.js` (변경 없음)
- [ ] `effects.js` (변경 없음)
- [ ] `data/*.js` 프리셋 데이터 파일 복사 (변경 없음)
- [ ] CSS 파일 복사 (변경 없음)
- [ ] assets 폴더 복사 또는 링크 (변경 없음)

---

## Phase 5: 미니게임 서버 연동 ⬜

### 5.1 common.js 서버 버전 작성
- [ ] `assets/js/common.js`를 서버 API 호환 버전으로 작성
- [ ] `getGameConfig(gameId)` → 서버 API 호출로 변경
- [ ] 게임 내 설정 로딩 부분을 서버 API 호출로 변경
- [ ] 기존 postMessage 통신은 유지

### 5.2 미니게임 admin.js 수정
- [ ] 각 게임의 admin.js에서 localStorage → fetch API로 변경
- [ ] 변경 대상: game02 ~ game27 (20개 게임)
- [ ] 저장 시 `/api/games/:gameId/settings` PUT 호출
- [ ] 로드 시 `/api/games/:gameId/settings` GET 호출

### 5.3 미니게임 game.js 수정
- [ ] 각 게임의 game.js에서 설정 로딩을 서버 API로 변경
- [ ] 변경 대상: game02 ~ game27 (20개 게임)
- [ ] `localStorage.getItem()` → `fetch('/api/games/:gameId/settings')`
- [ ] 게임 초기화를 async로 변환

### 5.4 미디어 사용 게임 특별 처리
- [ ] game25 (스크래치카드): admin.js의 카메라 촬영/갤러리 선택 → `POST /api/upload`로 변경
  - base64 localStorage 저장 → 서버 파일 업로드로 변경
  - game.js의 배경 이미지 로딩을 서버 URL로 변경
- [ ] game19 (리버스오디오): admin.js의 오디오 녹음 → `POST /api/upload`로 변경
  - base64 localStorage 저장 → 서버 파일 업로드로 변경
  - game.js의 오디오 로딩을 서버 URL로 변경
- [ ] game18 (컬러헌터): 변경 없음 (실시간 카메라 사용, 서버 저장 불필요)
- [ ] game17 (바코드스캐너): 변경 없음 (실시간 카메라 사용, 서버 저장 불필요)

---

## Phase 6: 통합 테스트 ⬜

### 6.1 서버 테스트
- [ ] 모든 API 엔드포인트 동작 확인
- [ ] SSE 이벤트 수신 확인
- [ ] JSON 파일 읽기/쓰기 안정성 확인

### 6.2 관리자 플로우 테스트 (PC + 모바일)
- [ ] PC에서 admin.html 접속 및 설정 확인
- [ ] **모바일에서 admin.html 접속 및 설정 확인**
- [ ] PIN 인증 동작 확인
- [ ] 테마/시나리오 선택 동작 확인
- [ ] 미션 추가/편집/삭제/재정렬 확인
- [ ] 설정 저장 → SSE 브로드캐스트 확인
- [ ] **모바일에서 미니게임 관리자 설정 접속 확인**
- [ ] **game25 스크래치카드: 모바일 카메라로 사진 촬영 → 서버 업로드 확인**
- [ ] **game19 리버스오디오: 모바일 마이크로 녹음 → 서버 업로드 확인**

### 6.3 플레이어 플로우 테스트
- [ ] 모바일 접속 → 메인 화면 로딩 확인
- [ ] 관리자 설정 변경 → 모바일 즉시 반영 확인
- [ ] 게임 시작 → 스토리 → 미션 허브 → 게임 플레이 확인
- [ ] 미니게임 iframe 로딩 및 postMessage 통신 확인
- [ ] 물건찾기 미션 동작 확인
- [ ] 2P 모드 턴 교대 확인
- [ ] 보물 화면 및 결과 확인

### 6.4 미니게임 테스트
- [ ] 각 미니게임 서버 설정 로딩 확인
- [ ] 각 미니게임 관리자 설정 저장 확인
- [ ] iframe 내 정상 동작 확인

---

## 개발 순서 요약

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
서버 기본   REST API   SSE 통신   클라이언트   미니게임    통합 테스트
                                 마이그레이션  서버 연동
```

---

## 예상 파일 변경 목록

### 새로 생성하는 파일
| 파일 | 설명 |
|------|------|
| `treasure-hunt/server.js` | Express 서버 |
| `treasure-hunt/package.json` | Node.js 프로젝트 설정 |
| `treasure-hunt/public/js/api-client.js` | 서버 API 클라이언트 |
| `treasure-hunt/public/js/sse-client.js` | SSE 이벤트 클라이언트 |

### treasure-hunt3에서 복사 후 수정하는 파일
| 파일 | 변경 내용 |
|------|-----------|
| `public/index.html` | script 태그 추가 |
| `public/admin.html` | script 태그 추가 |
| `public/play.html` | script 태그 추가 |
| `public/treasure.html` | script 태그 추가 |
| `public/js/storage.js` | localStorage → ApiClient |
| `public/js/game-engine.js` | 동기→비동기 전환 |
| `public/js/app.js` | SSE 연동 + 비동기 전환 |

### 변경 없이 복사하는 파일
| 파일 | 설명 |
|------|------|
| `public/js/theme-manager.js` | 테마 관리 |
| `public/js/preset-data.js` | 프리셋 데이터 로더 |
| `public/js/effects.js` | 효과/사운드 |
| `public/css/*` | 스타일시트 전체 |
| `public/data/*` | 프리셋 데이터 JS |
| `public/assets/*` | 이미지 등 에셋 |

### 미니게임 수정 파일 (20개 게임)
| 파일 패턴 | 변경 내용 |
|-----------|-----------|
| `games/*/admin.js` | localStorage → fetch API |
| `games/*/game.js` | 설정 로딩을 fetch API로 변경 |
| `assets/js/common.js` | getGameConfig를 서버 API로 변경 |

---

## 리스크 & 고려사항

1. **동기→비동기 전환**: game-engine.js, app.js의 모든 Storage 호출 지점을 async/await로 변환해야 함. 호출 체인이 깊은 경우 연쇄적 수정 필요.

2. **미니게임 수정 범위**: 20개 게임의 admin.js와 game.js를 모두 수정해야 함. 게임마다 localStorage 사용 패턴이 다르므로 개별 확인 필요.

3. **iframe 보안**: 같은 서버에서 서빙되므로 Same-Origin 제약 없음. postMessage 통신은 기존 그대로 유지.

4. **네트워크 안정성**: WiFi 연결 끊김 시 SSE 자동 재연결 및 API 재시도 로직 필요.

5. **파일 동시 쓰기**: 관리자와 플레이어가 동시에 state.json을 수정할 수 있음. 서버에서 순차 처리 보장.

6. **모바일 관리자 카메라 접근**: HTTPS가 아닌 HTTP 환경에서는 `getUserMedia()` 사용이 제한될 수 있음.
   - localhost에서는 허용됨
   - 같은 WiFi의 IP 주소 접속 시 일부 브라우저에서 카메라 권한 차단 가능
   - 필요 시 자체 서명 인증서(self-signed SSL)로 HTTPS 서빙 고려

7. **미디어 파일 크기**: base64 → 파일 업로드 전환으로 localStorage 5MB 제한 해소. 서버에서는 10MB 제한 설정.
