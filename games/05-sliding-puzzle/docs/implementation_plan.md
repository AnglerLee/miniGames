# 구현 계획서 - 05-sliding-puzzle 개선

05-sliding-puzzle 게임에 03-card-match에서 적용했던 개선 사항들을 반영합니다. 관리자 설정, 제한 시간 타이머, 동적 재도전 로직, 그리고 UI/UX 개선이 포함됩니다. (완료)

추가 요청 사항: 힌트 기능 삭제 및 퍼즐 테마 관리 기능 추가.

## 사용자 검토 필요 사항

> [!IMPORTANT]
> - **힌트 삭제**: 게임 내 힌트 버튼과 관련 로직을 완전히 제거합니다.
> - **테마 관리**: 관리자 페이지에서 '기본', '캔디(Pink)', '스카이(Blue)' 테마를 선택할 수 있습니다.
> - **테마 적용**: 선택한 테마에 따라 배경색, 타일 디자인, 폰트 색상이 변경됩니다.

## 변경 제안 사항

### 관리자 설정 (Admin Settings)

#### [admin.html](file:///d:/Angler/miniGames/games/05-sliding-puzzle/admin.html)
- `theme` 설정을 위한 드롭다운(`<select>`) 추가.
    - Options: `default` (기본), `candy` (캔디/핑크), `sky` (스카이/블루).

#### [admin.js](file:///d:/Angler/miniGames/games/05-sliding-puzzle/admin.js)
- `theme` 설정 저장 및 로드 로직 추가.

### 게임 로직 및 UI (Game Logic & UI)

#### [index.html](file:///d:/Angler/miniGames/games/05-sliding-puzzle/index.html)
- **힌트 버튼 삭제**: `#hintBtn` 제거.
- **CSS**: 각 테마별 스타일 클래스 추가 (`.theme-candy`, `.theme-sky`).
    - 테마별로 `--primary-color`, `--secondary-color`, 배경 이미지 등을 오버라이딩하거나 별도 스타일 적용.

#### [game.js](file:///d:/Angler/miniGames/games/05-sliding-puzzle/game.js)
- **힌트 로직 삭제**: `showHint`, `hintsLeft` 등 관련 변수 및 함수 제거.
- **테마 로드**: `loadSettings`에서 `theme` 값을 읽어와 `body` 또는 컨테이너에 클래스 적용.

### 리소스 생성
- `puzzle_theme_candy.png`: 핑크/파스텔 톤의 귀여운 패턴.
- `puzzle_theme_sky.png`: 하늘/구름 패턴.

## 검증 계획 (Verification Plan)

### 수동 검증 (Manual Verification)
1.  **관리자 페이지**:
    - 테마 변경 및 저장 확인.
2.  **게임 플레이**:
    - 게임 진입 시 선택한 테마가 적용되어 있는지 확인 (배경, 타일 색상 등).
    - 힌트 버튼이 보이지 않는지 확인.
