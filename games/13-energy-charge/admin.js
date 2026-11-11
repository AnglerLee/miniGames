// 에너지 충전 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
AdminKit.page({
    title: '에너지 충전 설정',
    storageKey: 'energy_charge_settings',
    recordId: 'game13',
    note: '로봇이 등을 돌린 초록불에만 폰을 흔들어 배터리 3개를 채우는 게임입니다. 예고(무궁화 꽃이 피었습니다)가 다 켜지면 로봇이 돌아보고, 그때 움직이면 감전됩니다. 흔들기 센서가 없는 기기에서는 자동으로 버튼 연타로 바뀝니다.',
    presets: [
        { threshold: 25, chargeRate: 4.2, stageTime: 55, turnTime: 0.65, redTolerance: 40, lives: 4 },
        { threshold: 30, chargeRate: 3.6, stageTime: 48, turnTime: 0.5, redTolerance: 25, lives: 3 },
        { threshold: 35, chargeRate: 3.2, stageTime: 42, turnTime: 0.4, redTolerance: 18, lives: 3 }
    ],
    fields: [
        { key: 'threshold', label: '흔들림 감도', min: 10, max: 60, step: 1, help: '이 세기 이상으로 흔들어야 충전됩니다. 낮출수록 살살 흔들어도 됩니다' },
        { key: 'chargeRate', label: '충전 속도 (%/초)', min: 1, max: 12, step: 0.1, help: '처음 속도. 쉬지 않고 흔들면 2배까지 빨라집니다' },
        { key: 'stageTime', label: '배터리당 시간 (초)', min: 20, max: 180, step: 1, help: '배터리 하나를 채울 수 있는 시간' },
        { key: 'turnTime', label: '돌아보는 시간 (초)', min: 0.2, max: 1.5, step: 0.05, help: '예고가 끝난 뒤 멈출 때까지 봐주는 시간. 버튼 조작에서는 0.7배' },
        { key: 'redTolerance', label: '빨간불 여유 (%)', min: 5, max: 90, step: 1, help: '빨간불에서 봐주는 움직임. 가만히 있어도 감전되면 올리세요' },
        { key: 'lives', label: '하트 수', min: 1, max: 5, step: 1, help: '감전될 때마다 하나씩 줄어듭니다' }
    ],
    extras: [
        { section: '조작' },
        { key: 'forceTap', label: '흔들지 않고 버튼 연타로만 하기', type: 'checkbox', default: false, help: '센서가 말을 듣지 않는 기기에서 켜세요', wide: true }
    ]
});
