// 목소리 비행선 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
AdminKit.page({
    title: '목소리 비행선 설정',
    storageKey: 'game15_config',
    recordId: 'game15',
    note: '목소리 크기로 비행선 높이를 조종해 세 스테이지(고리 통과 → 좁은 협곡 → 쉿과 폭풍)를 날아갑니다. 시작할 때 "조용히 2초, 아~ 2초"로 마이크를 맞춥니다. 마이크가 없거나 거부되면 화면을 누르고 있는 방식으로 바뀝니다.',
    presets: [
        { stageSec: 30, gap: 3.0, sens: 1.2, lives: 4 },
        { stageSec: 36, gap: 2.5, sens: 1.0, lives: 3 },
        { stageSec: 42, gap: 2.1, sens: 0.9, lives: 3 }
    ],
    fields: [
        { key: 'stageSec', label: '📏 스테이지 길이 (초)', min: 15, max: 90, step: 1, help: '스테이지 하나를 끝까지 나는 데 걸리는 시간. 세 스테이지 모두 같아요' },
        { key: 'gap', label: '↔️ 장애물 간격 (초)', min: 1.4, max: 6, step: 0.1, help: '고리·기둥이 나오는 간격. 클수록 쉬워요. 재도전하면 저절로 넓어져요' },
        { key: 'sens', label: '🎤 감도 보정 배수', min: 0.3, max: 3, step: 0.1, help: '1보다 크면 작은 소리로도 높이 올라가요. 아이 목소리가 작으면 올려 주세요' },
        { key: 'lives', label: '❤️ 하트 수', min: 1, max: 5, step: 1, help: '벽·기둥에 부딪히거나 새를 깨우면 하나씩 줄어요' }
    ]
});
