// 폭탄 해체반 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
AdminKit.page({
    title: '폭탄 해체반 설정',
    storageKey: 'bomb_balance_settings',
    recordId: 'game24',
    note: '폰을 기울여 기포를 가운데 원 안에 붙잡은 채 폭탄 3개(전선 → 코드 → 조건)를 해체하는 게임입니다. 기포가 원 밖이면 해체 조작이 막히고 안정도가 줄며, 안정도가 0 이 되면 하트를 잃습니다. 기울기 센서가 없는 기기에서는 자동으로 손가락으로 기포를 붙잡는 방식으로 바뀝니다.',
    presets: [
        { stageTime: 60, gustCount: 2, gustStrength: 14, stabilityDecreaseRate: 14, stabilityRecoverRate: 10, tiltThreshold: 18, tiltMax: 45 },
        { stageTime: 50, gustCount: 3, gustStrength: 17, stabilityDecreaseRate: 20, stabilityRecoverRate: 7, tiltThreshold: 15, tiltMax: 45 },
        { stageTime: 42, gustCount: 4, gustStrength: 21, stabilityDecreaseRate: 28, stabilityRecoverRate: 5, tiltThreshold: 12, tiltMax: 45 }
    ],
    fields: [
        { key: 'stageTime', label: '폭탄당 시간 (초)', min: 20, max: 180, step: 1, help: '폭탄 하나를 해체할 수 있는 시간. 틀리면 줄어듭니다' },
        { key: 'gustCount', label: '돌풍 횟수 (폭탄당)', min: 0, max: 10, step: 1, help: '예고와 함께 기포를 밀어내는 바람. 마지막 폭탄은 2번 더 붑니다' },
        { key: 'gustStrength', label: '돌풍 세기 (°)', min: 0, max: 40, step: 1, help: '돌풍을 버티려면 이만큼 반대로 기울여야 합니다' },
        { key: 'stabilityDecreaseRate', label: '안정도 감소 속도 (초당)', min: 3, max: 80, step: 1, help: '기포가 원 밖에 있을 때 1초에 줄어드는 안정도(100 만점)' },
        { key: 'stabilityRecoverRate', label: '안정도 회복 속도 (초당)', min: 0, max: 40, step: 1, help: '기포가 원 안에 있을 때 1초에 차오르는 안정도' },
        { key: 'tiltThreshold', label: '수평 여유 (°)', min: 4, max: 40, step: 1, help: '이 각도 안이면 기포가 원 안에 있습니다. 클수록 가운데 원이 커집니다' },
        { key: 'tiltMax', label: '기울기 범위 (°)', min: 15, max: 90, step: 1, help: '이만큼 기울이면 기포가 폭탄 끝에 닿습니다. 작을수록 예민합니다' }
    ],
    extras: [
        { section: '조작' },
        { key: 'forceTouch', label: '기울이지 않고 손가락으로만 하기', type: 'checkbox', default: false, help: '센서가 말을 듣지 않는 기기에서 켜세요. 한 손가락으로 기포를 붙잡고 다른 손가락으로 해체합니다', wide: true }
    ]
});
