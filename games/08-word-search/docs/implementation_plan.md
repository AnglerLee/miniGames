# 08-Word-Search 게임 개선 계획

Word Search 게임을 게임 개발 가이드 표준에 맞게 리팩토링하고 게임 플레이 품질을 개선합니다.

## 사용자 검토 필요 사항

- **설정 키 (Config Key)**: `common.js`와의 일관성을 위해 `treasureHunt_gameConfigs`를 계속 사용합니다.
- **모달 (Modals)**: 브라우저 기본 `alert` 대신 `assets/js/common.js`의 모달 함수 (`showSuccessScreen`, `showInstructions`)를 사용합니다.
- **타이머 (Timer)**: 카운트업(Count-up) 방식에서 관리자가 설정 가능한 카운트다운(Count-down) 타이머로 변경합니다.

## 변경 제안

### 설정 및 관리자 페이지 (Configuration & Admin)
- **`games/08-word-search/admin.js`**:
    - 다음 설정 항목 추가:
        - `timeLimit`: 제한 시간 (초 단위, 기본값: 180초).
        - `gridSize`: 격자 크기 (기본값: 8, 범위: 6-12).
        - `difficulty`: 난이도 프리셋 (쉬움, 보통, 어려움) - 선택 시 격자 크기/시간 자동 설정.
        - `theme`: 기본 테마 선택 (랜덤, 동물, 과일, 색깔).
    - 설정값은 `treasureHunt_gameConfigs`의 `game08` 키 아래에 저장.

- **`games/08-word-search/admin.html`**:
    - 새로운 설정을 위한 UI 추가 (격자 크기 조절 슬라이더, 시간 입력 필드, 테마 선택 박스).

### 게임 로직 및 UI (Game Logic & UI)
- **`games/08-word-search/game.js`**:
    - **리팩토링**: `common.js` 유틸리티 사용:
        - `createTimer`: 게임 타이머 (카운트다운) 구현.
        - `showSuccessScreen`, `showFailScreen`: 게임 종료 상태 표시.
        - `showInstructions`: 기존 사용 유지 (일관성 확인).
    - **새로운 기능**:
        - **카운트다운 타이머**: 시간이 0이 되면 실패 처리.
        - **재시도 로직**: 시간 초과로 실패 시, +30초(또는 설정값) 추가된 상태로 "재시도" 옵션 제공.
        - **동적 난이도**: 설정된 `gridSize`와 `currentWords` 개수 반영.
    - **수정 사항**:
        - `alert` 제거 및 커스텀 모달 적용.
        - "최고 기록" 저장 (필요 시).

- **`games/08-word-search/index.html`**:
    - 타이머 UI가 카운트다운을 표시하도록 수정.
    - `common.css`를 사용하여 모달 스타일 일관성 유지.

### 문서화 (Documentation)
- **`games/08-word-search/docs/`**:
    - `walkthrough.md` 업데이트 (구현 완료 후).
    - `implementation_plan.md` (본 문서).

## 검증 계획

### 자동화 테스트
- 프론트엔드 프로젝트 특성상 별도의 자동화 테스트는 없습니다.

### 수동 검증
1.  **관리자 설정**:
    - Admin 페이지 접속.
    - 격자 크기를 10, 제한 시간을 60초로 변경 후 저장.
    - 게임 페이지 새로고침. 격자가 10x10이고 타이머가 01:00에서 시작하는지 확인.
2.  **게임 플레이**:
    - 게임 플레이 진행.
    - 단어 배치가 정상적인지 확인.
    - 단어 선택(드래그)이 잘 되는지 확인.
    - "힌트" 기능 사용 시 횟수 감소 확인.
3.  **게임 성공 (Win)**:
    - 모든 단어 찾기.
    - 성공 모달(`showSuccessScreen`)이 뜨고 기록이 표시되는지 확인.
4.  **게임 실패 (Time Out)**:
    - 타이머가 0이 될 때까지 대기.
    - 실패 모달(`showFailScreen`)이 뜨는지 확인.
    - "재시도" 버튼 클릭. 시간이 추가된 상태(+30초 등)로 게임이 재시작되는지 확인.
5.  **반응형 (Responsiveness)**:
    - 모바일 뷰(개발자 도구)에서 격자가 화면에 잘 맞는지 확인.
