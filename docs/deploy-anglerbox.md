# AnglerBox(NAS)에 게시하기

이 레포 전체(미니게임 20개와 보물찾기 4가지)를 AnglerBox 작품 하나로 게시한다. 주소는 `https://pros2.synology.me/minigames/` 이다.

| 주소 | 화면 | 누가 |
|---|---|---|
| `/minigames/` | 게임 목록 (별 모으기, 오늘의 도전, 보물찾기 카드) | 아이 |
| `/minigames/admin.html` | 부모 대시보드 (보물찾기 준비, 아이에게 링크 보내기, 미니게임 설정) | 부모 |

## 레포에 들어 있는 것

| 파일 | 하는 일 |
|---|---|
| `anglerbox.json` | slug `minigames`, 제목·요약·분류(`kids`)·실행 방식(`navigate`), 화면 빌드(`npm run build` → `dist/`), 서버 없음(`"server": null`) |
| `package.json`, `package-lock.json` | 빌드와 테스트 스크립트. 의존성이 없어서 `npm ci` 가 바로 끝난다 |
| `scripts/build-site.mjs` | 게시용 빌드 (아래 "빌드가 하는 일") |
| `docs/thumbnail.png` | AnglerBox 목록 카드에 올릴 썸네일 (1200×675) |

AnglerBox 는 기본 브랜치(`master`)의 최신 커밋을 받아 루트에서 `npm ci` → `npm run build` 를 돌리고 `dist/` 를 `/minigames/` 에 게시한다.

## 처음 등록 (사용자가 할 일)

1. 변경을 `master` 에 올린다(PR 병합).
2. NAS 의 GitHub PAT 가 "선택한 레포만"이면 `AnglerLee/miniGames` 를 PAT 에 더한다.
3. AnglerBox 관리자 `/admin/new` 에 `https://github.com/AnglerLee/miniGames` 를 넣고 등록한다.
   - 빌드 로그에 `구조 (anglerbox.json): 화면 . → 빌드, 서버 없음` 과 `게시했습니다 /minigames/` 가 보이면 된다.
4. 관리자 작품 화면에서 설명을 적고 썸네일(`docs/thumbnail.png`)을 올린다. 설명은 `anglerbox.json` 에 넣을 수 없다.
5. GitHub About 의 Homepage 를 게시 주소로 바꾼다.
   ```
   gh repo edit AnglerLee/miniGames --homepage https://pros2.synology.me/minigames/
   ```
6. 폰에서 `/minigames/` 와 `/minigames/admin.html` 을 열어 본다. 홈 화면에 추가해 두면 편하다.

화면 접근 키는 걸지 않는다. 아이 기기도 링크를 바로 열어야 하기 때문이다. 준비 내용(보물 위치 등)은 서버에 올라가지 않고 부모 기기와, 링크를 연 아이 기기에만 저장된다.

## 고친 뒤 다시 게시

`master` 에 병합한 뒤 AnglerBox 관리자에서 작품의 [업데이트]를 누른다. 빌드가 실패하면 예전 판이 그대로 서빙된다.

- `index.html` 은 매번 새로 받는다. 그 밖의 파일은 브라우저가 1시간까지 예전 것을 쓸 수 있다. 업데이트 직후 예전 화면이 보이면 잠시 뒤 다시 연다.
- `assets/` 아래 파일(공통 엔진, 대시보드, 링크 상자)은 nginx 가 1년 동안 바뀌지 않는 파일로 캐시한다. 그래서 빌드가 주소에 내용 해시(`?v=…`)를 붙인다. 내용이 바뀌면 주소도 바뀌어 새 파일을 받는다.

## 빌드가 하는 일 (`npm run build`)

1. 화면 파일만 `dist/` 로 모은다. `tests/`, `docs/`, `*.md`, `package.json`, `serve.py`, 개발용 `lab*.html` 은 뺀다.
2. `assets/` 파일을 부르는 주소마다 `?v=<내용 해시>` 를 붙인다. `assets/` 파일끼리 부르는 주소도 붙이므로 안쪽 파일부터 해시를 정한다.
3. 끊어진 링크를 찾는다. 없는 파일을 부르거나 `/` 로 시작하는 주소(하위 주소 `/minigames/` 에서 깨진다)가 있으면 빌드가 실패한다.

로컬에서 확인할 때:

```bash
npm run build     # dist/ 를 만든다 (로그에 파일 수와 버전 주소 수)
npm run preview   # 빌드한 뒤 NAS 와 같은 주소 모양(http://localhost:8000/minigames/)으로 연다
npm test          # 탐정·잠수함·스낵 볼트 규칙 테스트
```

평소 고칠 때는 `npm run dev` 로 레포 맨 위를 그대로 연다(빌드 없이, 새로고침하면 바로 보인다).

`dist/` 는 `.gitignore` 에 있다.

## 한 주소를 여러 앱이 함께 쓴다

AnglerBox 의 모든 작품은 같은 출처(`pros2.synology.me`)에 있다. 그래서 이 사이트의 localStorage·IndexedDB 키에는 모두 `minigames:` 를 붙인다.

| 어디 | 키 |
|---|---|
| 미니게임 (`assets/js/arcade.js` 의 `Arcade.ns`, `admin-kit.js` 의 `AdminKit.ns`) | `minigames:arcade_records`, `minigames:<게임>_settings` … |
| 홈 트레저헌트 | `minigames:treasureHunt3_config`, `_state`, `_history`, `_admin` |
| 작전명 스낵 볼트 | `minigames:operationVault_*` |
| 우리 집 탐정 | `minigames:homeDetective_*`, 사진 IndexedDB `minigames:homeDetective` |
| 잠수함 간식호 | `minigames:homeSubmarine_*` |

새 게임이나 새 키를 만들 때도 이 접두사를 붙인다. `localStorage.clear()` 는 다른 앱의 데이터까지 지우므로 쓰지 않는다.

예전 로컬 주소(`localhost:8000` 등)에서 쌓인 별과 설정은 키 이름이 바뀌어 보이지 않는다. NAS 주소는 처음부터 새로 시작한다.

## 아이에게 보내는 링크

서버 없이 기기를 넘기므로 준비 내용을 링크에 통째로 담는다. 링크를 연 기기가 설정을 저장하고 바로 시작한다.

| 보물찾기 | 링크 | 비고 |
|---|---|---|
| 우리 집 탐정 | `home-detective/play.html#c=…` | 사진은 부모 기기에만 남는다 |
| 잠수함 간식호 | `home-submarine/play.html#c=…` | 같은 링크를 다시 열면 하던 임무가 이어진다. 새 임무는 대시보드의 "같은 쪽지로 새 임무 링크" |
| 홈 트레저헌트 | `treasure-hunt3/join.html#c=…` | 미니게임의 개별 설정(사진, 녹음)은 함께 가지 않는다 |
| 작전명 스낵 볼트 | `operation-vault/agent.html#m=<작전 코드>` | 부모 기기는 본부(operator.html)로 함께 한다 |

- 링크는 1~2천 자쯤으로 길다. 메신저로 보내는 것이 가장 확실하다. QR 은 촘촘해서 기기에 따라 안 읽힐 수 있다.
- 링크 안의 내용은 가볍게 가려 둔 것이지 암호가 아니다. 아이가 주소만 보고 보물 위치를 읽지 못하게 하는 정도다.
- 진행·기록·관찰 리포트는 링크를 연 기기에 남는다. 끝난 뒤 리포트는 아이 기기에서 본다.
- 카카오톡 같은 메신저 안의 브라우저로 열면 저장도 그 안에 된다. 나중에 Safari·Chrome 으로 열면 이어지지 않으므로, 처음부터 "다른 브라우저로 열기"를 쓰거나 같은 링크를 같은 곳에서 다시 연다.
- 준비가 덜 끝났으면(쪽지를 덜 붙임 등) 링크를 만들지 않고 그 단계로 안내한다.
