# 18-Color-Hunter 게임 개선 구현 계획

## 목표

18-color-hunter 게임의 완성도를 높이기 위해 다음 개선사항을 적용합니다:
1. **수동 모드 제거**: 카메라 미지원 시 수동 색상 선택 모드를 제거하고 게임 진행을 단순화
2. **패스 기능 추가**: 카메라 화질 차이로 인한 색상 인식 문제 해결을 위해 사용자가 미션을 건너뛸 수 있는 패스 버튼 제공
3. **game-dev-guide.md 룰 준수**: 문서화 위치, Admin 페이지 설정, 모바일 최적화 등

## 현재 상태 분석

### 기존 구현
- **카메라 모드**: 후면 카메라로 물체 색상 캡처 후 RGB 거리 계산으로 매칭 (threshold: 130)
- **수동 모드**: 카메라 실패 시 `<input type="color">` 피커로 색상 직접 선택 가능
- **색상 풀**: 8가지 기본 색상 (빨강, 파랑, 초록, 노랑, 주황, 보라, 하늘, 분홍)
- **Admin 설정**: 글로벌 클리어 코드/힌트만 존재, 게임별 난이도 설정 없음

### 문제점
- 수동 모드는 게임의 핵심 재미(실제 물건 찾기)를 우회하는 치트 수단
- 카메라 화질/조명 차이로 정상적인 색상도 실패할 수 있어 사용자 불만 발생 가능
- 패스 기능이 없어 막힌 경우 게임 진행 불가

## User Review Required

> [!IMPORTANT]
> **패스 버튼 구현 방식 선택**
> 
> 다음 두 가지 방식 중 선호하는 방식을 알려주세요:
> 
> **옵션 A: 제한된 패스 횟수**
> - Admin 페이지에서 난이도별 패스 횟수 설정 (예: 쉬움 5회, 보통 3회, 어려움 1회)
> - 게임 중 패스 버튼에 남은 횟수 표시
> - 패스 사용 시 새로운 색상 미션으로 교체
> 
> **옵션 B: 무제한 패스 (디버깅 모드)**
> - 패스 횟수 제한 없이 언제든 건너뛰기 가능
> - Admin 페이지에서 디버깅 모드 ON/OFF 토글
> - 디버깅 모드 활성화 시에만 패스 버튼 표시
> 
> **추천**: 옵션 A (제한된 패스)가 게임성과 접근성의 균형이 좋습니다.

---

## 제안된 변경사항

### Core Game Logic

#### [script.js](file:///d:/Angler/miniGames/games/18-color-hunter/script.js)

**수동 모드 제거**
- `enableFallbackMode()` 함수 제거
- `checkFallbackColor()` 함수 제거
- Fallback 관련 이벤트 리스너 제거 (line 40-41)

**패스 기능 추가**
- 전역 상태에 `remainingPasses` 변수 추가
- `loadAdminSettings()` 함수 추가: Admin에서 설정한 난이도별 패스 횟수 로드
- `handlePass()` 함수 추가: 패스 버튼 클릭 시 새로운 색상 목표 선택 및 패스 횟수 감소
- `updatePassButton()` 함수 추가: 남은 패스 횟수에 따라 버튼 텍스트/활성화 상태 업데이트

**카메라 실패 처리 개선**
- 카메라 접근 실패 시 수동 모드 대신 안내 메시지 표시
- 재시도 버튼만 제공

```javascript
// 예시 코드
let remainingPasses = 0;

function loadAdminSettings() {
    const settings = JSON.parse(localStorage.getItem('game18_settings')) || {};
    const difficulty = settings.difficulty || 0; // 0: 쉬움, 1: 보통, 2: 어려움
    const passPresets = [5, 3, 1]; // 난이도별 패스 횟수
    remainingPasses = settings.passCount !== undefined ? settings.passCount : passPresets[difficulty];
}

function handlePass() {
    if (remainingPasses <= 0) return;
    
    remainingPasses--;
    playSound('click');
    pickNewTarget();
    updatePassButton();
    
    // 피드백 표시
    showToast(`패스! 남은 횟수: ${remainingPasses}회`);
}
```

---

### UI Components

#### [index.html](file:///d:/Angler/miniGames/games/18-color-hunter/index.html)

**수동 모드 UI 제거**
- `#fallbackSection` 전체 삭제 (line 39-47)
- `#useFallbackBtn` 버튼 삭제 (line 54-55)

**패스 버튼 추가**
- `.controls` 영역에 패스 버튼 추가
- 남은 패스 횟수 표시

```html
<div class="controls">
    <button id="captureBtn" class="btn-capture" aria-label="색깔 캡처" disabled></button>
    <button id="passBtn" class="btn btn-secondary btn-small">패스 (0회)</button>
</div>
```

**카메라 실패 안내 개선**
- Fallback 섹션을 간단한 에러 메시지로 교체

```html
<div id="cameraErrorSection" class="error-message hidden">
    <p>📷 카메라를 사용할 수 없습니다</p>
    <p>브라우저 설정에서 카메라 권한을 확인해주세요</p>
    <button id="retryCameraBtn" class="btn btn-primary">다시 시도</button>
</div>
```

---

### Admin Configuration

#### [admin.html](file:///d:/Angler/miniGames/games/18-color-hunter/admin.html)

**난이도 설정 UI 추가** (game-dev-guide.md 룰 준수)
- 난이도 슬라이더 (0-2: 쉬움/보통/어려움)
- 선택된 난이도의 패스 횟수 설정 필드
- 색상 인식 허용 오차 설정 (THRESHOLD 값)

```html
<h2>🎮 게임 난이도 설정</h2>

<div class="form-group">
    <label for="difficultySlider">난이도 선택</label>
    <input type="range" id="difficultySlider" min="0" max="2" step="1" value="0">
    <div class="difficulty-labels">
        <span>🟢 쉬움</span>
        <span>🟡 보통</span>
        <span>🔴 어려움</span>
    </div>
</div>

<div class="settings-grid">
    <div class="form-group">
        <label for="passCount">패스 횟수</label>
        <input type="number" id="passCount" min="0" max="10" value="5">
        <small>미션을 건너뛸 수 있는 횟수</small>
    </div>
    
    <div class="form-group">
        <label for="colorThreshold">색상 허용 오차</label>
        <input type="number" id="colorThreshold" min="50" max="200" value="130">
        <small>값이 클수록 관대하게 인식 (50-200)</small>
    </div>
</div>
```

#### [admin.js](file:///d:/Angler/miniGames/games/18-color-hunter/admin.js)

**난이도 프리셋 시스템 구현**
- 난이도별 기본값 정의
- 슬라이더 변경 시 프리셋 로드
- 개별 설정 수정 가능

```javascript
const difficultyPresets = {
    0: { name: '🟢 쉬움', passCount: 5, colorThreshold: 150 },
    1: { name: '🟡 보통', passCount: 3, colorThreshold: 130 },
    2: { name: '🔴 어려움', passCount: 1, colorThreshold: 100 }
};
```

**localStorage 키 변경**
- 글로벌 설정(`treasureHunt_gameConfigs`)과 게임별 설정(`game18_settings`) 분리

---

### Documentation

#### [NEW] [docs/implementation_plan.md](file:///d:/Angler/miniGames/games/18-color-hunter/docs/implementation_plan.md)

game-dev-guide.md 룰에 따라 `docs` 폴더에 구현 계획 문서 저장

---

## 검증 계획

### 브라우저 테스트

**테스트 1: 수동 모드 제거 확인**
1. 브라우저에서 `d:\Angler\miniGames\games\18-color-hunter\index.html` 열기
2. 카메라 권한 거부 또는 카메라 없는 환경에서 테스트
3. ✅ 예상 결과: 수동 색상 선택 UI가 표시되지 않고, 에러 메시지와 재시도 버튼만 표시

**테스트 2: 패스 기능 동작 확인**
1. Admin 페이지에서 난이도를 "쉬움"으로 설정 (패스 5회)
2. 게임 시작 후 패스 버튼 클릭
3. ✅ 예상 결과: 
   - 새로운 색상 미션으로 변경
   - 패스 버튼 텍스트가 "패스 (4회)"로 업데이트
   - 5회 사용 후 버튼 비활성화

**테스트 3: Admin 설정 저장/로드**
1. Admin 페이지에서 난이도 슬라이더를 "어려움"으로 변경
2. 패스 횟수 1회, 색상 허용 오차 100으로 설정 후 저장
3. 게임 페이지로 이동하여 설정 반영 확인
4. ✅ 예상 결과: 패스 버튼에 "패스 (1회)" 표시, 색상 매칭이 더 엄격하게 동작

**테스트 4: 모바일 반응형 확인**
1. 브라우저 개발자 도구에서 모바일 뷰포트로 전환 (375x667)
2. 게임 UI가 스크롤 없이 한 화면에 표시되는지 확인
3. ✅ 예상 결과: 모든 요소가 세로 모드에서 스크롤 없이 표시

### 수동 테스트

**실제 카메라 색상 인식 테스트**
1. 스마트폰에서 게임 실행
2. 빨간색 물건(예: 빨간 장난감)을 카메라로 캡처
3. 인식 실패 시 패스 버튼으로 건너뛰기 가능한지 확인
4. ✅ 예상 결과: 패스 기능으로 막힘 없이 게임 진행 가능

---

## 구현 순서

1. **문서 폴더 생성**: `d:\Angler\miniGames\games\18-color-hunter\docs` 디렉토리 생성
2. **Admin 페이지 업데이트**: 난이도 설정 UI 및 로직 구현
3. **게임 로직 수정**: 수동 모드 제거, 패스 기능 추가
4. **UI 업데이트**: HTML에서 불필요한 요소 제거, 패스 버튼 추가
5. **통합 테스트**: 브라우저 및 모바일 환경에서 검증
6. **문서화**: `walkthrough.md` 작성
