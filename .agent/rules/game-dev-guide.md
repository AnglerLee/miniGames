---
trigger: always_on
glob: "**/*"
description: "Core rules and guidelines for game development tasks."
---

# Game Development & Agent Rules

This document outlines the mandatory rules and workflows for the coding agent when working on game projects.

## 1. Documentation Management
- **Location**: All documentation (planning, implementation, workflows, etc.) must be saved in a `docs` folder located immediately under the specific task's or game's directory.
  - Example: `games/02-maze/docs/`
- **Requirement**: No documents should be placed in the root unless they are global project documentations.

## 2. Architecture & File Structure
- **Separation of Concerns**: 
  - The **Game Main Page** (gameplay) and the **Settings/Admin Page** must be separate files/interfaces.
  - Do not combine admin controls directly into the gameplay view unless specifically requested for debugging overlays (but main settings should still be separate).

## 3. Administrator Mode (Settings)
- **Purpose**: The Admin mode is primarily for adjusting the game's difficulty and behavior.
- **Variables**: It must expose variables that control the general difficulty (e.g., speed, time limits, sensitivity).
- **Persistence**: 
  - Use `localStorage` to save all Admin settings.
  - Ensure settings are cached and restored on the device so the game retains its configuration across reloads.

### Admin UI 디자인 원칙
- **난이도 설정 UI 공통화**:
  - 쉬움/보통/어려움의 3단계 난이도별로 중복된 입력 필드를 만들지 않습니다.
  - **슬라이더 프리셋 방식 사용**: 난이도 슬라이더(0-2 범위)를 통해 프리셋을 선택하고, 해당 프리셋의 값만 단일 입력 필드에 표시/수정합니다.
  - 예시:
    ```html
    <input type="range" id="difficultySlider" min="0" max="2" step="1" value="0">
    <div class="difficulty-labels">
      <span>🟢 쉬움</span>
      <span>🟡 보통</span>
      <span>🔴 어려움</span>
    </div>
    ```
  - 슬라이더 변경 시 해당 난이도의 기본값(프리셋)을 자동으로 입력 필드에 로드합니다.
  
- **단일 설정 필드 그룹**:
  - 선택된 난이도에 대한 설정만 표시합니다 (예: 허용 오차, 유지 시간, 미션 수).
  - 각 입력 필드에는 `<small>` 태그로 간단한 설명을 추가합니다.
  - 3단 그리드 레이아웃(`grid-template-columns: 1fr 1fr 1fr`)으로 깔끔하게 정렬합니다.
  
- **프리셋 데이터 구조**:
  ```javascript
  const difficultyPresets = {
    0: { name: '🟢 쉬움', setting1: value1, setting2: value2 },
    1: { name: '🟡 보통', setting1: value3, setting2: value4 },
    2: { name: '🔴 어려움', setting1: value5, setting2: value6 }
  };
  ```

## 4. UI/UX Standards

### 모바일 최적화 (핵심 원칙)
- **한 화면 원칙**:
  - 스마트폰 세로 모드에서 게임의 모든 핵심 요소가 스크롤 없이 한 화면에 표시되어야 합니다.
  - 불필요한 요소를 과감하게 제거하고, 게임 플레이에 필수적인 정보만 남깁니다.
  
- **컴팩트한 정보 표시**:
  - 통계나 상태 정보는 작은 박스나 인라인 형태로 간결하게 표시합니다.
  - 예시: `<div class="info-compact">` 스타일로 4-6개의 핵심 정보를 한 줄에 배치
  - 큰 대시보드나 카드 형태는 지양하고, 필수 정보만 최소 공간에 표시합니다.

- **게임 요소 크기 조정**:
  - 주요 게임 요소(나침반, 보드 등)는 화면의 50-60%를 넘지 않도록 조절합니다.
  - `max-width: 280px` ~ `350px` 정도가 적절합니다.
  - 게임 요소 상하로 충분한 여백을 확보하여 다른 UI와 밸런스를 맞춥니다.

- **간소화된 레이아웃 구조 예시**:
  ```
  [게임 타이틀] (최소화)
  [미션/목표 표시] (컴팩트, 1-2줄)
  [게임 메인 요소] (나침반, 보드 등)
  [핵심 정보] (한 줄 그리드로 4-6개 항목)
  [진행 게이지]
  [액션 버튼 1-2개]
  ```

### Minimalist Design
- Remove unnecessary controls (e.g., "Hint" buttons) if they clutter the interface.
- Focus on the core gameplay area.
- **중복 정보 제거**: 같은 정보를 여러 곳에 표시하지 않습니다 (예: 방향 안내 텍스트와 시각적 링 표시 중 하나만 선택).

### Responsiveness
- Ensure the game fits within a single screen on mobile devices without scrolling.
- Use responsive grid layouts for game boards.
- 모바일 환경을 우선으로 디자인하고, 데스크톱은 여유 공간 활용합니다.

### Timer Display
- Center the timer at the top of the screen for visibility.
- Use a large, readable font.
- 타이머가 있는 경우, 다른 요소들과 시각적 계층을 명확히 구분합니다.

### Themes
- Support multiple themes (e.g., Default, Candy, Sky) configurable via Admin.
- **Readability**: Use color palettes (gradients/solids) rather than complex pattern images for backgrounds to ensure game elements (like numbers or text) are clearly visible.

### Modals
- Replace native browser `alert()` and `confirm()` with custom, styled HTML modals for a consistent and premium feel.
- 모달은 게임 화면을 가리지 않도록 적절한 크기로 조절합니다.

## 5. Game Logic Standards
- **Time Limits**:
  - Implement a countdown timer for time-sensitive games.
- **Dynamic Retry Logic**:
  - If a user fails due to time, offer a "Retry" option that slightly eases the difficulty (e.g., adding +1 second to the time limit) to encourage persistence.
- **Persistence**:
  - Save "Best Records" or key states using `localStorage`.

## 6. Language & Localization
- **Primary Language**:
  - All user-facing text (UI, instructions, modals) and developer documentation (comments, commits, docs) must be written in **Korean**.

