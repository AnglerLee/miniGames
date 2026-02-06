# 17-barcode-scanner 게임 업데이트 구현 계획

## 목표

game-dev-guide.md 룰에 따라 17-barcode-scanner 게임을 개선하고, 관리자가 설정한 목표 바코드를 찾는 방식으로 게임 로직 변경

## 배경

현재 프로토타입은 하드코딩된 미션 목록과 패턴 검증으로 동작하지만, 사용자가 제안한 대로 관리자 페이지에서 찾아야 할 바코드를 사진으로 등록하고 해당 바코드를 찾는 방식으로 변경이 필요함. game-dev-guide.md 룰에 명시된 여러 UI/UX 원칙도 적용 필요.

## User Review Required

> [!IMPORTANT]
> 게임 룰 변경
> - 기존: 미션별로 특정 패턴(880으로 시작)의 바코드를 찾는 방식
> - 변경: 관리자가 바코드를 등록하고, 해당 바코드 번호를 찾는 방식
> - 이렇게 하면 더 명확한 목표 설정이 가능하며, 사용자가 원하는 바코드를 직접 지정할 수 있습니다

> [!NOTE]
> 바코드 스캔 기능
> - 게임에서 이미 QuaggaJS를 사용한 실시간 바코드 스캔 기능이 구현되어 있습니다
> - 관리자 페이지에서도 동일한 QuaggaJS 라이브러리를 사용하여 바코드를 스캔하여 등록할 수 있습니다
> - 스캔 버튼 클릭 → 카메라 활성화 → 바코드 감지 → 자동 등록의 흐름으로 구현

## Proposed Changes

### 관리자 설정 페이지

#### [MODIFY] [admin.html](file:///d:/AnglerProjects/miniGames/games/17-barcode-scanner/admin.html)

- QuaggaJS CDN 스크립트 추가
- 난이도 슬라이더 프리셋 UI 추가 (game-dev-guide.md 룰 준수)
  - 쉬움/보통/어려움 3단계 슬라이더
  - 선택된 난이도의 프리셋 값만 표시
- 난이도별 세부 설정 입력 필드 추가
  - 목표 바코드 수: 찾아야 할 바코드 개수
  - 시간 제한: 제한 시간 (초, 0=무제한)
- 목표 바코드 등록 섹션 추가
  - 바코드 번호 직접 입력 필드
  - **"바코드 스캔" 버튼** (QuaggaJS로 실시간 스캔)
  - 카메라 뷰 영역 (스캔 시에만 표시)
  - 등록된 바코드 목록 카드 (바코드 번호, 삭제 버튼)
- 기존 글로벌 설정 (secretCode, hintMessage, successMessage) 유지

#### [MODIFY] [admin.js](file:///d:/AnglerProjects/miniGames/games/17-barcode-scanner/admin.js)

- 난이도 프리셋 데이터 구조 정의
  ```javascript
  const difficultyPresets = {
    0: { name: '🟢 쉬움', targetCount: 1, timeLimit: 0 },
    1: { name: '🟡 보통', targetCount: 3, timeLimit: 120 },
    2: { name: '🔴 어려움', targetCount: 5, timeLimit: 90 }
  };
  ```
- 슬라이더 변경 시 프리셋 값 자동 로드 로직
- **QuaggaJS 바코드 스캔 기능**
  - `startBarcodeScanner()`: 카메라 활성화 및 QuaggaJS 초기화
  - `onBarcodeDetected()`: 바코드 감지 시 자동으로 목록에 추가
  - `stopBarcodeScanner()`: 카메라 정지 및 정리
- 바코드 등록/삭제 기능
  - 직접 입력 또는 스캔으로 추가
  - 중복 체크
  - 삭제 버튼으로 제거
- localStorage 저장/복원 기능 개선
  - `barcodeScannerSettings` 키로 게임 전용 설정 저장
  - 목표 바코드 배열, 난이도별 설정 저장

---

### 게임 메인 페이지

#### [MODIFY] [index.html](file:///d:/AnglerProjects/miniGames/games/17-barcode-scanner/index.html)

- UI 모바일 최적화 (game-dev-guide.md 룰 준수)
  - 통계 대시보드를 컴팩트하게 변경 (4개 항목을 한 줄에 배치)
  - 카메라 뷰 크기 조정 (max-width: 350px)
  - 미션 표시 간소화 (1-2줄)
  - 불필요한 요소 제거 (수동 입력 섹션은 유지하되 컴팩트하게)
- 커스텀 모달 추가
  - `alert()`, `confirm()` 대체용 커스텀 모달 컴포넌트
  - common.js에 있는 모달 함수 활용 또는 자체 구현
- 난이도 선택 UI 제거 또는 숨김
  - 난이도는 관리자 페이지에서만 설정

#### [MODIFY] [game.js](file:///d:/AnglerProjects/miniGames/games/17-barcode-scanner/game.js)

- localStorage에서 설정 로드 로직 추가
  - 목표 바코드 배열
  - 난이도별 설정 (targetCount, timeLimit)
- 게임 로직 변경
  - 하드코딩된 `missions` 배열 제거
  - 목표 바코드 번호와 정확히 일치하는지 검증
  - 시간 제한 로직 추가 (설정된 경우)
- 동적 재시도 로직 추가
  - 시간 초과 시 +10초 추가하여 재시도 제안
- `alert()`, `confirm()` 대체
  - 커스텀 모달 함수로 변경
- 난이도 버튼 관련 코드 제거

---

### 문서화

#### [NEW] [docs/implementation_plan.md](file:///d:/AnglerProjects/miniGames/games/17-barcode-scanner/docs/implementation_plan.md)

- 이 implementation plan 복사

## Verification Plan

### Automated Tests

자동화된 테스트는 현재 프로젝트에 테스트 프레임워크가 없으므로 수동 테스트로 진행

### Manual Verification

1. **관리자 페이지 설정 테스트**
   - `games/17-barcode-scanner/admin.html` 열기
   - 난이도 슬라이더를 움직여 쉬움/보통/어려움 변경 확인
   - 각 난이도별 프리셋 값이 자동으로 입력 필드에 로드되는지 확인
   - 바코드 번호를 입력하여 목표 바코드 등록
   - "저장하기" 버튼 클릭 후 페이지 새로고침하여 설정이 유지되는지 확인

2. **게임 플레이 테스트 (모바일 환경 권장)**
   - `games/17-barcode-scanner/index.html` 열기
   - 화면이 스크롤 없이 한 화면에 표시되는지 확인 (모바일 세로 모드)
   - "카메라 시작" 버튼 클릭
   - 등록한 바코드를 스캔하여 인식되는지 확인
   - 다른 바코드를 스캔하면 "올바르지 않은 바코드입니다" 메시지가 나타나는지 확인
   - 수동 입력 필드에 목표 바코드 번호 입력하여 동작하는지 확인
   - 시간 제한이 설정된 경우 타이머가 동작하는지 확인

3. **localStorage 저장/복원 테스트**
   - 관리자 페이지에서 설정 저장
   - 브라우저 개발자 도구 > Application > Local Storage에서 `barcodeScannerSettings` 키 확인
   - 페이지 새로고침 후 설정이 복원되는지 확인

4. **커스텀 모달 테스트**
   - 브라우저 기본 `alert()`, `confirm()` 대신 커스텀 모달이 표시되는지 확인
   - 모달이 게임 화면을 적절히 가리지만 너무 크지 않은지 확인
