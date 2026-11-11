// 둘이서 한 호흡 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
(function () {
    const FIELDS = [
        { key: 'syncTolerance', label: '🤝 동시 터치 허용 오차 (초)', min: 0.04, max: 0.3, step: 0.01, help: '"함께!" 음표에서 두 사람이 누른 시간 차가 이 안이면 성공. 재도전할 때마다 0.02초씩 넓어집니다' },
        { key: 'stageTime', label: '⏱️ 스테이지 시간 (초)', min: 20, max: 120, step: 5, help: '1·3스테이지에서 게이지를 채워야 하는 시간. 2스테이지는 노래 길이(약 30초)로 정해집니다' },
        { key: 'moveSpeed', label: '🔵 원 이동 속도', min: 0.3, max: 2, step: 0.05, help: '1스테이지 원의 빠르기. 1이면 위아래로 초당 약 150px' },
        { key: 'lives', label: '❤️ 하트 수', min: 1, max: 5, step: 1, help: '박자를 놓치거나 공을 떨어뜨리면 하나씩 줄어듭니다' }
    ];

    AdminKit.page({
        title: '둘이서 한 호흡 설정',
        storageKey: 'dual_touch_settings',
        recordId: 'game21',
        note: '부모와 아이가 한 폰을 함께 잡고 왼쪽(파랑)·오른쪽(분홍)을 하나씩 맡는 협동 게임입니다. 같이 따라가기 → 동시 박자 → 줄다리기 균형 세 스테이지를 지나요. 난이도가 오르면 박자도 빨라집니다(88 → 96 → 104 BPM).',
        presets: [
            { syncTolerance: 0.12, stageTime: 45, moveSpeed: 0.5, lives: 4 },
            { syncTolerance: 0.09, stageTime: 40, moveSpeed: 0.75, lives: 3 },
            { syncTolerance: 0.06, stageTime: 35, moveSpeed: 1.0, lives: 3 }
        ],
        fields: FIELDS,
        onRender(form, api) {
            // 옛 버전이 저장한 값(예: 허용 오차 0.025초, 속도 0)은 칸의 범위를 벗어나 저장이 막히므로 범위 안으로 맞춘다
            FIELDS.forEach((f) => {
                const input = form.querySelector('#f_' + f.key);
                const v = parseFloat(input && input.value);
                if (!Number.isFinite(v)) return;
                const n = Math.min(f.max, Math.max(f.min, f.min + Math.round((v - f.min) / f.step) * f.step));
                api.set(f.key, Number(n.toFixed(2)));
            });
        }
    });
})();
