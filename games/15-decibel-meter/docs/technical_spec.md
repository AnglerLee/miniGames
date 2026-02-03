# 데시벨 측정기 게임 기술 명세서

## 게임 개요

15-decibel-meter는 Web Audio API의 마이크 입력을 활용한 음량 측정 게임입니다.

### 게임 규칙

- **목표**: 목표 음량 범위 내에서 일정 시간 동안 소리를 유지
- **성공 조건**: 목표 음량(target) 이상, 최대 제한(maxLimit) 이하를 지속 시간(sustainTime) 동안 유지
- **실패 조건**:
  - 시간 제한 내에 목표를 달성하지 못한 경우
  - 최대 제한을 초과하여 3초 이상 유지한 경우
- **난이도**: Easy, Medium, Hard 3단계

### 게임 모드

지속 모드(Sustain Mode)로 고정되어 있으며, 목표 음량을 일정 시간 유지해야 합니다.

## Web Audio API 사용

### 마이크 접근

```javascript
const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
        echoCancellation: true,      // 에코 제거
        noiseSuppression: true,       // 노이즈 억제
        autoGainControl: false        // 자동 게인 컨트롤 비활성화
    }
});
```

### 음량 측정

RMS(Root Mean Square) 방식으로 음량을 측정합니다:

```javascript
function measureVolume() {
    analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    
    // 0-100% 범위로 변환
    currentVolume = Math.min(100, (rms / 128) * 100);
}
```

### 정리 (Cleanup)

마이크 사용 종료 시 반드시 리소스를 정리해야 합니다:

```javascript
function stopMicrophone() {
    if (microphone) {
        microphone.disconnect();
        microphone.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
        audioContext.close();
    }
}
```

## Admin 설정

### 설정 항목

각 난이도별로 다음 항목을 조정할 수 있습니다:

| 항목 | 설명 | 단위 | 기본값 (Easy/Medium/Hard) |
|------|------|------|---------------------------|
| 목표 음량 | 도달해야 하는 최소 음량 | % | 50 / 70 / 85 |
| 최대 제한 | 초과하면 안 되는 최대 음량 | % | 100 / 95 / 90 |
| 시간 제한 | 게임 전체 제한 시간 (0=무제한) | 초 | 0 / 30 / 20 |
| 지속 시간 | 목표 음량을 유지해야 하는 시간 | 초 | 2 / 3 / 4 |

### localStorage 데이터 구조

#### 게임별 설정 (`game15_config`)

```json
{
  "difficulties": {
    "easy": {
      "target": 50,
      "maxLimit": 100,
      "timeLimit": 0,
      "sustainTime": 2
    },
    "medium": {
      "target": 70,
      "maxLimit": 95,
      "timeLimit": 30,
      "sustainTime": 3
    },
    "hard": {
      "target": 85,
      "maxLimit": 90,
      "timeLimit": 20,
      "sustainTime": 4
    }
  }
}
```

#### 글로벌 설정 (`treasureHunt_gameConfigs`)

보물찾기 연동을 위한 설정:

```json
{
  "game15": {
    "secretCode": "1234",
    "hintMessage": "다음 장소를 찾아가세요",
    "successMessage": "축하합니다!",
    "isActive": true,
    "lastUpdated": "2026-02-03T06:00:00.000Z"
  }
}
```

## 지속 모드 로직

### 게이지 표시

지속 모드에서는 화면에 게이지가 표시되며, 목표 음량 범위 내에 있을 때만 게이지가 채워집니다.

```javascript
if (currentVolume >= config.target && currentVolume <= config.maxLimit) {
    if (sustainStartTime === 0) {
        sustainStartTime = Date.now();
    }
    sustainDuration = (Date.now() - sustainStartTime) / 1000;
    
    const progress = (sustainDuration / config.sustainTime) * 100;
    sustainFill.style.width = `${Math.min(100, progress)}%`;
    sustainFill.textContent = `${sustainDuration.toFixed(1)}초`;
    
    if (sustainDuration >= config.sustainTime) {
        gameSuccess();
    }
} else {
    // 목표 범위를 벗어나면 게이지 리셋
    sustainStartTime = 0;
    sustainDuration = 0;
    sustainFill.style.width = '0%';
    sustainFill.textContent = '0.0초';
}
```

## 난이도 완화 (Retry Logic)

실패 시 재시도 버튼을 클릭하면 난이도가 약간 낮아집니다:

- **시간 제한**: +1초 증가
- **지속 시간**: -0.5초 감소 (최소 1초)

```javascript
function retryWithEasierDifficulty() {
    const config = difficulties[currentDifficulty];
    if (config.timeLimit > 0) {
        config.timeLimit += 1;
    }
    if (config.sustainTime > 1) {
        config.sustainTime = Math.max(1, config.sustainTime - 0.5);
    }
    startMicrophone();
}
```

## 파일 구조

```
15-decibel-meter/
├── index.html          # 게임 메인 페이지
├── game.js             # 게임 로직
├── admin.html          # 관리자 설정 페이지
├── admin.js            # 관리자 설정 로직
└── docs/
    ├── technical_spec.md    # 기술 명세서 (이 파일)
    └── walkthrough.md       # 작업 완료 보고서
```

## 주요 함수

### `loadGameConfig()`
localStorage에서 게임 설정을 로드하여 난이도 객체를 업데이트합니다.

### `measureVolume()`
마이크 입력을 분석하여 현재 음량을 계산하고 UI를 업데이트합니다.

### `checkGameLogic()`
현재 음량이 목표 범위 내에 있는지 확인하고, 지속 시간을 측정합니다.

### `retryWithEasierDifficulty()`
재시도 시 난이도를 약간 낮춥니다.

### `triggerAlarm()`
음량이 최대 제한을 초과할 때 경보를 발동합니다.

## 검증 방법

게임이 올바르게 작동하는지 확인하려면:

1. **Admin 페이지**에서 난이도 설정 변경 후 저장
2. **게임 페이지**로 이동하여 마이크 시작
3. 목표 음량 범위 내에서 소리를 유지
4. 지속 게이지가 채워지는지 확인
5. 실패 시 "재시도" 버튼이 표시되는지 확인
6. 재시도 후 시간 제한/지속 시간이 완화되었는지 확인
