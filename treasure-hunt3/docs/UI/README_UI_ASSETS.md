# 홈 트레저헌트 - UI 에셋 생성 스크립트

## 사전 요구사항

```bash
pip install Pillow
```

## 파일 구성

| 파일 | 설명 | 생성 결과물 |
|------|------|-------------|
| `gen_wireframes.py` | 8개 화면 와이어프레임 생성 | S01~S08 PNG 8장 |
| `gen_assets.py` | 테마 팔레트, 컴포넌트, 아이콘, 흐름도 생성 | PNG 8장 |

## 실행 방법

```bash
# 출력 디렉토리 생성
mkdir -p assets/wireframes assets/themes assets/components assets/icons

# 와이어프레임 생성 (8개 화면)
python gen_wireframes.py

# 테마/컴포넌트/아이콘/흐름도 생성
python gen_assets.py
```

## 생성되는 파일 목록

### 와이어프레임 (assets/wireframes/)
- `S01_main.png` - 메인 진입 화면
- `S02_admin_auth.png` - 관리자 인증 화면
- `S03_admin_dashboard.png` - 관리자 대시보드
- `S04_story_intro.png` - 스토리 인트로
- `S05_mission_hub.png` - 미션 허브
- `S06_minigame.png` - 미니게임 플레이
- `S07_find_object.png` - 물건 찾기 미션
- `S08_treasure_box.png` - 최종 보물상자

### 테마 팔레트 (assets/themes/)
- `theme_mystery.png` - 미스테리 탐정단
- `theme_pirate.png` - 해적 보물섬
- `theme_space.png` - 우주 탐험대
- `theme_magic.png` - 마법학교 비밀
- `theme_dino.png` - 공룡시대 발굴단

### 컴포넌트 & 기타 (assets/components/, assets/icons/)
- `component_library.png` - UI 컴포넌트 라이브러리
- `screen_flow.png` - 화면 전환 흐름도
- `icon_set.png` - 게임 아이콘 세트

## 커스터마이징 가이드

### 와이어프레임 수정 시
`gen_wireframes.py` 상단의 컬러 변수를 수정하면 전체 와이어프레임 색상이 변경됩니다:
```python
BG = "#0F0F2E"       # 배경색
CARD_BG = "#1A1A3E"  # 카드 배경
ACCENT = "#FFD700"   # 강조색 (골드)
TEXT = "#FFFFFF"      # 텍스트
TEXT_SUB = "#8888AA"  # 보조 텍스트
GREEN = "#2ECC71"    # 성공
RED = "#E74C3C"      # 실패
```

### 테마 팔레트 수정 시
`gen_assets.py`의 `create_theme_palettes()` 함수 내 themes 딕셔너리에서
각 테마의 colors를 수정하면 됩니다.

### 화면 크기 변경 시
와이어프레임 기본 크기는 iPhone 기준 `W=390, H=844`입니다.
다른 기기 기준으로 변경하려면 상단 변수를 수정하세요.
