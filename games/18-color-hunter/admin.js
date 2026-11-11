// 컬러 헌터 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
// 옛 설정의 colorThreshold(RGB 거리)는 새 기준(일치도 %)으로 바꿔 보여 준다. 바꾸는 식도 game.js 와 같다.
(function () {
    const needFromOld = (d) => Math.min(90, Math.max(40, Math.round(96 - 0.24 * d)));

    AdminKit.page({
        title: '컬러 헌터 설정',
        storageKey: 'game18_settings',
        recordId: 'game18',
        note: '집 안에서 목표 색 물건을 찍어 팔레트 3장(기본 → 명도 → 순서)을 채우는 게임입니다. ' +
            '카메라는 <b>https</b> 나 localhost 주소에서만 열리고, 그 밖에서는 사진을 찍어 올리는 방식으로 바뀝니다.',
        presets: [
            { stageTime: 120, matchNeed: 60, passCount: 3 },
            { stageTime: 90, matchNeed: 66, passCount: 2 },
            { stageTime: 70, matchNeed: 72, passCount: 1 }
        ],
        fields: [
            { key: 'stageTime', label: '⏱️ 팔레트당 시간 (초)', min: 30, max: 300, step: 5, help: '마지막 팔레트는 이 시간의 60%로 시작하고, 색을 찾을 때마다 시간이 늘어납니다' },
            { key: 'matchNeed', label: '🎯 성공 기준 일치도 (%)', min: 40, max: 95, step: 1, help: '찍은 색이 이만큼 비슷해야 칸이 채워집니다. 낮을수록 너그럽습니다' },
            { key: 'passCount', label: '⏭️ 패스 수 (한 판)', min: 0, max: 10, step: 1, help: '어려운 색을 건너뛰는 횟수. 쓸 때마다 별이 하나 줄어듭니다' }
        ],
        onRender(form, api) {
            const s = api.stored();
            const old = Number(s.colorThreshold);
            if (s.matchNeed === undefined && Number.isFinite(old) && old > 0) api.set('matchNeed', needFromOld(old));
        }
    });
})();
