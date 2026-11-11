// 넘버 러시 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
// totalNumbers, timeLimit 은 옛 게임과 같은 이름이라 저장해 둔 값이 그대로 이어진다(옛 spawnRadius 는 쓰지 않는다).
AdminKit.page({
    title: '넘버 러시 설정',
    storageKey: 'sequence_tap_settings',
    recordId: 'game11',
    note: '세 스테이지(1부터 차례로 → 변칙 순서 → 움직이는 색깔 판)를 차례로 통과하는 게임입니다. 화면이 작으면 숫자는 들어가는 만큼만 나옵니다. 난이도가 올라가면 3스테이지의 숫자가 더 빨리 떠다닙니다.',
    presets: [
        { totalNumbers: 12, count2: 12, count3: 10, timeLimit: 26, penalty: 2, comboWindow: 1.8, hideCount: 0, hintDelay: 2.5 },
        { totalNumbers: 16, count2: 16, count3: 13, timeLimit: 24, penalty: 3, comboWindow: 1.4, hideCount: 2, hintDelay: 0 },
        { totalNumbers: 20, count2: 20, count3: 16, timeLimit: 22, penalty: 3, comboWindow: 1.1, hideCount: 4, hintDelay: 0 }
    ],
    fields: [
        { key: 'totalNumbers', label: '🔢 1스테이지 숫자 수', min: 5, max: 30, step: 1, help: '1부터 차례로 누를 숫자 수' },
        { key: 'count2', label: '🔀 2스테이지 숫자 수', min: 5, max: 30, step: 1, help: '함정까지 합친 수. "큰 수부터 거꾸로"가 나오면 80%' },
        { key: 'count3', label: '🌀 3스테이지 숫자 수', min: 4, max: 24, step: 1, help: '떠다니는 숫자 수. 반은 파랑, 반은 빨강' },
        { key: 'timeLimit', label: '⏱️ 스테이지 시간 (초)', min: 5, max: 120, step: 1, help: '스테이지마다 주어지는 시간. 3스테이지는 1.1배' },
        { key: 'penalty', label: '⚠️ 실수 벌점 (초)', min: 0, max: 10, step: 0.5, help: '순서가 틀리거나 함정을 누르면 깎이는 시간' },
        { key: 'comboWindow', label: '🔥 콤보 유지 시간 (초)', min: 0.5, max: 5, step: 0.1, help: '이 시간 안에 다음 숫자를 누르면 콤보가 이어집니다' },
        { key: 'hideCount', label: '❓ 가려지는 숫자 수', min: 0, max: 8, step: 1, help: '3스테이지에서 4초 뒤 "?"로 바뀌는 숫자 수. 0이면 가리지 않습니다' },
        { key: 'hintDelay', label: '💡 길잡이 (초)', min: 0, max: 10, step: 0.5, help: '이 시간 동안 못 찾으면 다음 숫자가 깜빡입니다. 0이면 끕니다' }
    ],
    onRender(form, api) {
        // 옛 저장값에는 1스테이지 수(totalNumbers)만 있다. 게임과 같은 규칙으로 2·3스테이지 수를 채워 보여 준다
        const stored = api.stored();
        const n = parseFloat(stored.totalNumbers);
        if (!Number.isFinite(n)) return;
        const total = Math.round(Math.min(30, Math.max(5, n)));
        if (!Number.isFinite(parseFloat(stored.count2))) api.set('count2', total);
        if (!Number.isFinite(parseFloat(stored.count3))) api.set('count3', Math.min(24, Math.max(4, Math.round(total * 0.8))));
    }
});
