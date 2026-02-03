# 16-magic-compass 게임 개선 구현 계획

## 목표

16-magic-compass 게임의 프로토타입을 분석하고 다음과 같이 개선합니다:
1. **초기 캘리브레이션 제거**: 게임 시작 시 8자 모양으로 폰을 흔드는 보정 작업을 제거
2. **나침반 흔들림 효과 추가**: 자기장 영향을 시뮬레이션하여 나침반 바늘이 계속 흔들리는 상태에서 목표 각도를 맞추도록 변경
3. **game-dev-guide.md 규칙 준수**: 문서 위치, Admin 페이지 분리, localStorage 사용 등

## 현재 상태 분석

### 기존 구조
- **index.html**: 나침반 UI, 난이도 선택, 캘리브레이션 화면, 게임 화면
- **game.js**: DeviceOrientation API 사용, 캘리브레이션 로직, 미션 시스템
- **admin.html/js**: 글로벌 설정(비밀번호, 힌트, 성공메시지)만 있고 게임별 난이도 설정 없음

### 문제점
1. 캘리브레이션 단계가 게임 진입 장벽으로 작용
2. 나침반 바늘이 고정되어 너무 쉬움
3. Admin 페이지에 난이도별 세부 설정이 없음
4. `docs` 폴더가 없음

## User Review Required

> [!IMPORTANT]
> **나침반 흔들림 구현 방법**
> 
> 자기장 영향을 시뮬레이션하기 위해 다음 방법을 고려합니다:
> 1. **Perlin Noise 기반**: 부드러운 랜덤 노이즈를 사용하여 자연스러운 흔들림
> 2. **Sin/Cos 조합**: 여러 주파수의 삼각함수를 조합하여 흔들림 패턴 생성
> 3. **실제 센서 노이즈 활용**: DeviceOrientation의 자연스러운 떨림을 증폭
> 
> **권장 방법**: Perlin Noise를 사용하되, 계산이 복잡하므로 간단한 Sin/Cos 조합으로 시작하여 자연스러운 흔들림을 구현합니다.

> [!WARNING]
> **난이도 조정 필요**
> 
> 현재 난이도 설정:
> - Easy: ±15도, 1초 유지, 1개 방향
> - Medium: ±10도, 2초 유지, 3개 방향
> - Hard: ±5도, 3초 유지, 5개 방향
> 
> 나침반이 흔들리면 난이도가 크게 증가합니다. 허용 각도를 조정해야 할 수 있습니다.

## Proposed Changes

### 게임 디렉토리

#### [NEW] [docs](file:///d:/Angler/miniGames/games/16-magic-compass/docs)
- 이 구현 계획 및 walkthrough 문서를 저장할 폴더

---

### 게임 로직

#### [game.js](file:///d:/Angler/miniGames/games/16-magic-compass/game.js)

**주요 변경사항:**
1. **캘리브레이션 로직 제거**
   - `calibrationScreen`, `startCalibration()`, `calibrationHandler()`, `finishCalibration()` 제거
   - 게임 시작 시 바로 센서 권한 요청 및 게임 화면 표시

2. **나침반 흔들림 효과 추가**
   ```javascript
   // 흔들림 파라미터 (Admin에서 조정 가능)
   let compassNoise = {
       amplitude: 5,      // 흔들림 크기 (±degrees)
       frequency: 0.5,    // 흔들림 속도 (Hz)
       complexity: 3      // 여러 주파수 조합 수
   };
   
   // 흔들림 계산 함수
   function calculateCompassNoise(timestamp) {
       let noise = 0;
       for (let i = 1; i <= compassNoise.complexity; i++) {
           const freq = compassNoise.frequency * i;
           const amp = compassNoise.amplitude / i;
           noise += Math.sin(timestamp * freq * Math.PI * 2 / 1000) * amp;
       }
       return noise;
   }
   
   // orientationHandler 수정
   function orientationHandler(event) {
       // ... 기존 코드 ...
       const rawHeading = Math.round(alpha);
       const noiseOffset = calculateCompassNoise(Date.now());
       currentHeading = (rawHeading + noiseOffset + 360) % 360;
       // ... UI 업데이트 ...
   }
   ```

3. **Admin 설정 통합**
   - localStorage에서 난이도별 설정 로드
   - `loadAdminSettings()` 함수 추가

4. **난이도 조정**
   - 허용 각도를 넓히거나 유지 시간 조정 (테스트 후 결정)

---

### UI 개선

#### [index.html](file:///d:/Angler/miniGames/games/16-magic-compass/index.html)

1. **캘리브레이션 화면 제거**
   - `<div class="calibration-screen">` 전체 삭제
   - 관련 CSS 스타일 제거

2. **게임 설명 개선**
   - 지침 텍스트에 "나침반이 흔들립니다" 추가

3. **난이도 선택 UI 개선**
   - 난이도 버튼을 게임 시작 전에만 보이도록 변경

---

### Admin 페이지

#### [admin.html](file:///d:/Angler/miniGames/games/16-magic-compass/admin.html)

**추가할 설정:**
```html
<h2>🎮 난이도 설정</h2>

<div class="difficulty-preset">
    <label>난이도 프리셋</label>
    <select id="difficultyPreset">
        <option value="easy">쉬움</option>
        <option value="medium">보통</option>
        <option value="hard">어려움</option>
        <option value="custom">커스텀</option>
    </select>
</div>

<h3>쉬움 난이도</h3>
<div class="form-group">
    <label>허용 오차 (±도)</label>
    <input type="number" id="easyTolerance" min="5" max="30" value="15">
</div>
<div class="form-group">
    <label>유지 시간 (초)</label>
    <input type="number" id="easyHoldTime" min="0.5" max="5" step="0.5" value="1">
</div>
<div class="form-group">
    <label>미션 수</label>
    <input type="number" id="easyMissionCount" min="1" max="8" value="1">
</div>

<!-- Medium, Hard도 동일한 구조 -->

<h3>🌀 나침반 흔들림 설정</h3>
<div class="form-group">
    <label>흔들림 크기 (±도)</label>
    <input type="number" id="noiseAmplitude" min="0" max="20" step="1" value="5">
</div>
<div class="form-group">
    <label>흔들림 속도 (Hz)</label>
    <input type="number" id="noiseFrequency" min="0.1" max="2" step="0.1" value="0.5">
</div>
<div class="form-group">
    <label>흔들림 복잡도</label>
    <input type="number" id="noiseComplexity" min="1" max="5" value="3">
</div>
```

#### [admin.js](file:///d:/Angler/miniGames/games/16-magic-compass/admin.js)

1. **설정 저장/로드 로직 추가**
   - 난이도별 설정을 `localStorage`의 `game16_settings` 키에 저장
   - 프리셋 선택 시 해당 값으로 자동 입력
   - 커스텀 선택 시 직접 수정 가능

2. **데이터 구조**
   ```javascript
   const defaultSettings = {
       difficulties: {
           easy: { tolerance: 20, holdTime: 1, missionCount: 1 },
           medium: { tolerance: 15, holdTime: 2, missionCount: 3 },
           hard: { tolerance: 10, holdTime: 3, missionCount: 5 }
       },
       compassNoise: {
           amplitude: 5,
           frequency: 0.5,
           complexity: 3
       }
   };
   ```

---

## Verification Plan

### 자동화 테스트
현재 프로젝트에는 자동화된 단위 테스트가 없으므로 **수동 검증**을 수행합니다.

### 수동 검증

#### 1. 기능 테스트 (브라우저 도구 사용)
- [ ] **캘리브레이션 제거 확인**: 게임 시작 시 캘리브레이션 화면 없이 바로 게임 시작
- [ ] **나침반 흔들림 확인**: 나침반 바늘이 지속적으로 흔들리는지 확인
- [ ] **난이도별 플레이**: Easy, Medium, Hard 각각 테스트하여 허용 각도와 유지 시간이 적절한지 확인
- [ ] **Admin 설정 반영**: Admin 페이지에서 설정 변경 후 게임에서 적용되는지 확인
- [ ] **localStorage 영속성**: 페이지 새로고침 후에도 Admin 설정이 유지되는지 확인

#### 2. UI/UX 검증
- [ ] **모바일 반응형**: 스마트폰 화면에서 모든 요소가 한 화면에 표시되는지 확인
- [ ] **디바이스 회전**: 세로/가로 모드 전환 시 레이아웃 깨짐 없음
- [ ] **햅틱 피드백**: 목표 각도 근처에서 진동이 작동하는지 확인

#### 3. 호환성 테스트
- [ ] **iOS Safari**: DeviceOrientation API 권한 요청 및 동작 확인
- [ ] **Android Chrome**: DeviceOrientation API 동작 확인

#### 4. 문서 검증
- [ ] **docs 폴더**: `d:\Angler\miniGames\games\16-magic-compass\docs`에 구현 계획 및 walkthrough 저장
- [ ] **한국어**: 모든 문서가 한국어로 작성되었는지 확인

### 검증 방법
1. `browser_subagent`를 사용하여 `index.html` 열기
2. Admin 페이지에서 다양한 설정 조합 테스트
3. 스크린샷과 녹화를 통해 흔들림 효과 시연
4. walkthrough.md에 결과 정리
