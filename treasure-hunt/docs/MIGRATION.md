# Treasure Hunt - 마이그레이션 가이드

## 1. 개요

이 문서는 `treasure-hunt3` (localStorage 기반) → `treasure-hunt` (Node.js 서버 기반)
마이그레이션 시 변경되는 코드 패턴을 설명한다.

---

## 2. Storage Layer 변환 패턴

### 2.1 storage.js

**기존 (동기, localStorage):**
```javascript
const Storage = {
    get(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },
    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    },
    getConfig() {
        return this.get(this.KEYS.CONFIG);
    },
    setConfig(config) {
        return this.set(this.KEYS.CONFIG, config);
    }
};
```

**변환 후 (비동기, Server API):**
```javascript
const Storage = {
    async getConfig() {
        const res = await fetch('/api/config');
        if (!res.ok) return null;
        return res.json();
    },
    async setConfig(config) {
        const res = await fetch('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        return res.ok;
    }
};
```

### 2.2 호출부 변환 패턴

**기존:**
```javascript
const config = Storage.getConfig();
if (config) {
    applyTheme(config.theme);
}
```

**변환 후:**
```javascript
const config = await Storage.getConfig();
if (config) {
    applyTheme(config.theme);
}
```

> **핵심**: `Storage.get*()` / `Storage.set*()` 호출 앞에 `await`를 추가하고,
> 해당 함수를 `async` 함수로 변환한다.

---

## 3. game-engine.js 변환 패턴

### 3.1 init() 함수

**기존:**
```javascript
function init() {
    config = Storage.getConfig();
    state = Storage.getState();
}
```

**변환 후:**
```javascript
async function init() {
    config = await Storage.getConfig();
    state = await Storage.getState();
}
```

### 3.2 completeMission() 함수

**기존:**
```javascript
function completeMission(result) {
    state.missionResults.push(result);
    state.currentMissionIndex++;
    Storage.setState(state);
}
```

**변환 후:**
```javascript
async function completeMission(result) {
    state.missionResults.push(result);
    state.currentMissionIndex++;
    await Storage.setState(state);
}
```

### 3.3 연쇄 async 전파

`GameEngine` 내부 메서드가 async가 되면, 이를 호출하는 외부 코드도 async로 변환해야 한다.

```javascript
// app.js - 기존
function onMissionComplete() {
    GameEngine.completeMission(result);
    updateUI();
}

// app.js - 변환 후
async function onMissionComplete() {
    await GameEngine.completeMission(result);
    updateUI();
}
```

---

## 4. SSE 이벤트 수신 패턴

### 4.1 기본 연결

```javascript
// sse-client.js
const SSEClient = {
    source: null,
    listeners: {},

    connect() {
        this.source = new EventSource('/api/events');

        this.source.addEventListener('config_updated', (e) => {
            const config = JSON.parse(e.data);
            this.emit('config_updated', config);
        });

        this.source.addEventListener('state_updated', (e) => {
            const state = JSON.parse(e.data);
            this.emit('state_updated', state);
        });

        this.source.addEventListener('game_reset', () => {
            this.emit('game_reset');
        });

        // 연결 끊김 시 자동 재연결 (EventSource 기본 동작)
        this.source.onerror = () => {
            console.log('SSE 연결 끊김, 자동 재연결 시도...');
        };
    }
};
```

### 4.2 UI 업데이트 연동 (app.js)

```javascript
// 관리자가 설정을 변경하면 플레이어 화면에 즉시 반영
SSEClient.on('config_updated', async (config) => {
    // 메모리 내 config 갱신
    GameEngine.updateConfig(config);
    // UI 업데이트
    renderMainScreen();
    renderMissionHub();
});

SSEClient.on('game_reset', () => {
    // 게임 초기 화면으로 이동
    location.hash = '';
    renderMainScreen();
});
```

---

## 5. 미니게임 admin.js 변환 패턴

### 5.1 설정 저장

**기존:**
```javascript
// games/02-maze/admin.js
function saveSettings() {
    const settings = {
        activeDifficulty: getSelectedDifficulty(),
        gameTheme: getSelectedTheme(),
        timeEasy: parseInt(document.getElementById('timeEasy').value),
        timeNormal: parseInt(document.getElementById('timeNormal').value),
        timeHard: parseInt(document.getElementById('timeHard').value)
    };
    localStorage.setItem('mazeGameSettings', JSON.stringify(settings));
    alert('저장 완료!');
}
```

**변환 후:**
```javascript
// games/02-maze/admin.js
async function saveSettings() {
    const settings = {
        activeDifficulty: getSelectedDifficulty(),
        gameTheme: getSelectedTheme(),
        timeEasy: parseInt(document.getElementById('timeEasy').value),
        timeNormal: parseInt(document.getElementById('timeNormal').value),
        timeHard: parseInt(document.getElementById('timeHard').value)
    };
    const res = await fetch('/api/games/game02/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });
    if (res.ok) alert('저장 완료!');
    else alert('저장 실패');
}
```

### 5.2 설정 로딩

**기존:**
```javascript
function loadSettings() {
    const saved = JSON.parse(localStorage.getItem('mazeGameSettings'));
    return saved || DEFAULT_SETTINGS;
}
```

**변환 후:**
```javascript
async function loadSettings() {
    try {
        const res = await fetch('/api/games/game02/settings');
        if (res.ok) return await res.json();
    } catch (e) { /* 네트워크 오류 */ }
    return DEFAULT_SETTINGS;
}
```

---

## 6. 미니게임 game.js 변환 패턴

### 6.1 게임 초기화 시 설정 로딩

**기존:**
```javascript
// games/02-maze/game.js
function initGame() {
    const settings = JSON.parse(localStorage.getItem('mazeGameSettings')) || DEFAULT;
    applySettings(settings);
    startGame();
}
window.onload = initGame;
```

**변환 후:**
```javascript
// games/02-maze/game.js
async function initGame() {
    let settings = DEFAULT;
    try {
        const res = await fetch('/api/games/game02/settings');
        if (res.ok) settings = await res.json();
    } catch (e) { /* 기본값 사용 */ }
    applySettings(settings);
    startGame();
}
window.onload = initGame;
```

---

## 7. common.js 변환

### 7.1 getGameConfig 함수

**기존:**
```javascript
function getGameConfig(gameId) {
    const configs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
    return configs[gameId] || null;
}
```

**변환 후:**
```javascript
async function getGameConfig(gameId) {
    try {
        const res = await fetch(`/api/games/${gameId}/settings`);
        if (res.ok) return await res.json();
    } catch (e) { /* 네트워크 오류 */ }
    return null;
}
```

---

## 8. 미디어 업로드 변환 패턴 (game25, game19)

### 8.1 스크래치카드 (game25) - 이미지 업로드

**기존 (base64 → localStorage):**
```javascript
// games/25-scratch-card/admin.js (또는 inline)
function capturePhoto() {
    const canvas = document.createElement('canvas');
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    localStorage.setItem('scratch_bg_image', dataUrl);
}
```

**변환 후 (파일 → 서버 업로드):**
```javascript
async function capturePhoto() {
    const canvas = document.createElement('canvas');
    canvas.getContext('2d').drawImage(video, 0, 0);

    // canvas → Blob → FormData → 서버 업로드
    const blob = await new Promise(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', 0.8)
    );
    const formData = new FormData();
    formData.append('file', blob, 'photo.jpg');
    formData.append('gameId', 'game25');
    formData.append('type', 'background');

    const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });
    const { url } = await res.json();

    // 설정에 URL 저장
    await fetch('/api/games/game25/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backgroundImage: url })
    });
}
```

**게임에서 이미지 로딩:**
```javascript
// 기존: const bgImage = localStorage.getItem('scratch_bg_image'); // base64
// 변환:
const settings = await fetch('/api/games/game25/settings').then(r => r.json());
const bgImage = settings.backgroundImage; // "/uploads/game25/bg_17040672.jpg"
```

### 8.2 리버스오디오 (game19) - 오디오 업로드

**기존 (base64 → localStorage):**
```javascript
function saveRecording(blob, questionId) {
    const reader = new FileReader();
    reader.onload = () => {
        localStorage.setItem(`reverseAudio_${questionId}`, reader.result);
    };
    reader.readAsDataURL(blob);
}
```

**변환 후 (Blob → 서버 업로드):**
```javascript
async function saveRecording(blob, questionId) {
    const formData = new FormData();
    formData.append('file', blob, `q_${questionId}.webm`);
    formData.append('gameId', 'game19');
    formData.append('type', `audio_${questionId}`);

    const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });
    const { url } = await res.json();

    // 설정에 오디오 URL 저장
    const settings = await fetch('/api/games/game19/settings').then(r => r.json()) || {};
    settings.audioFiles = settings.audioFiles || {};
    settings.audioFiles[questionId] = url;

    await fetch('/api/games/game19/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });
}
```

---

## 9. HTML 파일 변경

### 8.1 script 태그 추가

각 HTML 파일의 `<head>` 또는 `<body>` 끝 부분에 추가:

```html
<!-- 기존 스크립트 위에 추가 -->
<script src="js/api-client.js"></script>
<script src="js/sse-client.js"></script>

<!-- 기존 스크립트 (수정된 버전) -->
<script src="js/storage.js"></script>
<script src="js/game-engine.js"></script>
<script src="js/app.js"></script>
```

### 8.2 iframe src 경로

**기존 (treasure-hunt3):**
```javascript
iframe.src = `../games/${gameId}/index.html`;
```

**변환 후 (서버 서빙):**
```javascript
iframe.src = `/games/${gameId}/index.html`;
```

> 서버가 `../games/` 폴더를 `/games/` 경로로 서빙하므로 상대경로에서 절대경로로 변경.

---

## 10. 주의사항

### 10.1 async/await 전파
- `Storage.get*()` 호출이 있는 모든 함수를 `async`로 변환해야 한다
- 해당 함수를 호출하는 상위 함수도 `async`로 변환해야 한다
- 이벤트 핸들러에서 async 사용: `element.onclick = async () => { ... }`

### 10.2 에러 핸들링
- 네트워크 실패 시 기본값으로 fallback
- 서버 연결 안 될 때 사용자에게 알림
- SSE 연결 끊김 시 자동 재연결 (EventSource 기본 기능)

### 10.3 기존 기능 유지
- postMessage 통신: 변경 없음
- 테마 시스템: 변경 없음
- 효과/사운드: 변경 없음
- 프리셋 데이터: 변경 없음 (클라이언트에서 JS로 로딩)
- 2P 모드 턴 교대: 로직 변경 없음 (상태 저장만 서버로)

### 10.4 모바일 관리자 카메라 접근
- HTTP 환경에서 `getUserMedia()`가 차단될 수 있음 (HTTPS 필요)
- `localhost`에서는 항상 허용됨
- WiFi IP 주소(`192.168.x.x`) 접속 시:
  - Chrome Android: 보안 경고 후 허용 가능 (chrome://flags에서 설정)
  - Safari iOS: HTTPS 필수
- 필요 시 Node.js에서 자체 서명 인증서로 HTTPS 서빙:
  ```javascript
  // server.js에 HTTPS 옵션 추가 가능
  const https = require('https');
  const fs = require('fs');
  https.createServer({
      key: fs.readFileSync('cert/key.pem'),
      cert: fs.readFileSync('cert/cert.pem')
  }, app).listen(3443);
  ```

### 10.5 미디어 파일 용량
- 기존: localStorage 5MB 제한 → base64 인코딩으로 실제 ~3.7MB
- 변경: 서버 파일 저장으로 10MB까지 지원
- 이미지: JPEG 0.8 품질로 압축 (모바일 카메라 기본 설정)
- 오디오: WebM/OGG 형식으로 녹음 (5초 이내)
