// 타임 스나이퍼 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
AdminKit.page({
    title: '타임 스나이퍼 설정',
    storageKey: 'stopwatch_settings',
    recordId: 'game27',
    note: '시작을 누르고 속으로 세다가 목표 시간에 멈추는 게임입니다. 세 스테이지(보이는 시계 → 사라지는 시계 → 거짓말하는 시계)를 차례로 지나갑니다. 난이도가 올라가면 3스테이지의 방해(가짜 시계, 거꾸로 시계, 방해꾼)도 함께 세집니다.',
    presets: [
        { rounds: 2, lives: 3, maxTarget: 6, perfect: 0.07, great: 0.18, good: 0.35, blindAt: 2.5, tick: 'all' },
        { rounds: 2, lives: 3, maxTarget: 8, perfect: 0.05, great: 0.15, good: 0.3, blindAt: 2, tick: 'start' },
        { rounds: 3, lives: 3, maxTarget: 10, perfect: 0.04, great: 0.1, good: 0.22, blindAt: 1.5, tick: 'off' }
    ],
    fields: [
        { key: 'rounds', label: '🔁 스테이지당 라운드 수', min: 1, max: 4, step: 1, help: '세 스테이지 모두 이만큼씩 합니다' },
        { key: 'lives', label: '❤️ 하트 수', min: 1, max: 5, step: 1, help: 'MISS 한 번에 하나씩 줄어듭니다' },
        { key: 'maxTarget', label: '🎯 가장 긴 목표 시간 (초)', min: 4, max: 15, step: 1, help: '목표 시간은 3초부터 이 값 사이에서 나옵니다' },
        { key: 'perfect', label: '🥇 PERFECT 폭 (±초)', min: 0.01, max: 1, step: 0.01, help: '이 안에 멈추면 PERFECT. 잃은 하트도 하나 돌아옵니다' },
        { key: 'great', label: '🥈 GREAT 폭 (±초)', min: 0.01, max: 1.5, step: 0.01, help: 'PERFECT·GREAT 가 이어지면 콤보가 쌓입니다' },
        { key: 'good', label: '🥉 GOOD 폭 (±초)', min: 0.01, max: 2, step: 0.01, help: '이보다 크게 어긋나면 MISS (하트 -1)' },
        { key: 'blindAt', label: '🙈 시계가 사라지는 시점 (초)', min: 0.5, max: 5, step: 0.5, help: '2스테이지에서 시작한 뒤 이 시간이 지나면 시계가 가려집니다' },
        { key: 'tick', label: '🔔 박자 소리', type: 'select', options: [['all', '끝까지 1초마다'], ['start', '처음 2초만'], ['off', '없음']], help: '1초마다 울려 세는 것을 돕습니다. 눈 가리고 도전에서는 나지 않습니다' }
    ]
});
