// 와이파이 해커 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
// 예전부터 쓰던 game22_config 에 목표 문구·와이파이 이름·비밀번호와 난이도 값을 함께 저장한다.
(function () {
    'use strict';

    let paintMode = () => {};

    AdminKit.page({
        title: '와이파이 해커 설정',
        storageKey: 'game22_config',
        recordId: 'game22',
        note: '세 스테이지(신호 추적 → 방화벽 회로 → 암호 해독)를 차례로 뚫는 게임입니다. 마지막 스테이지의 정답이 아래 <b>비밀번호</b>입니다. 아이가 집 안에 숨겨 둔 쪽지를 찾아오면 한 번에 맞힐 수 있고, 못 찾아도 불빛 단서로 추리해서 풀 수 있어요.',
        presets: [
            { signalTime: 40, fakeCount: 4, lookalikes: 1, firewallTime: 50, gridSize: 4, alarms: 1, decodeTime: 120, attempts: 8 },
            { signalTime: 35, fakeCount: 5, lookalikes: 2, firewallTime: 45, gridSize: 5, alarms: 2, decodeTime: 100, attempts: 7 },
            { signalTime: 30, fakeCount: 6, lookalikes: 3, firewallTime: 40, gridSize: 5, alarms: 3, decodeTime: 80, attempts: 6 }
        ],
        fields: [
            { key: 'signalTime', label: '📡 1단계 시간 (초)', min: 15, max: 120, step: 1, help: '신호 추적. 목표 와이파이에 세 번 접속해야 합니다' },
            { key: 'fakeCount', label: '👻 가짜 와이파이 수', min: 2, max: 6, step: 1, help: '목록에 함께 뜨는 가짜 이름 수' },
            { key: 'lookalikes', label: '🔀 닮은 가짜 수', min: 0, max: 6, step: 1, help: 'SECRET_BASE_WlFI 처럼 한 글자만 다른 가짜. 두 번째 접속부터 섞입니다' },
            { key: 'firewallTime', label: '🧱 2단계 시간 (초)', min: 15, max: 150, step: 1, help: '방화벽. 회로 칸을 돌려 전원과 서버를 잇습니다' },
            { key: 'gridSize', label: '🔌 회로판 크기', type: 'select', options: [['4', '4 × 4'], ['5', '5 × 5']], help: '재도전 두 번째부터는 4 × 4 로 줄어듭니다' },
            { key: 'alarms', label: '🚨 경보 노드 수', min: 0, max: 4, step: 1, help: '전기가 닿아 있는 동안 탐지 게이지가 오릅니다' },
            { key: 'decodeTime', label: '🔐 3단계 시간 (초)', min: 30, max: 300, step: 5, help: '암호 해독. 비밀번호를 추리합니다' },
            { key: 'attempts', label: '🎯 해독 기회 (번)', min: 3, max: 12, step: 1, help: '다 쓰면 하트 하나를 잃고 기회가 다시 채워집니다' }
        ],
        extras: [
            { section: '🗝️ 미션 내용' },
            { key: 'missionGoal', label: '목표 문구', type: 'text', default: '🎯 목표: Wi-Fi 비밀번호를 찾아라!', wide: true, help: '시작 화면에 나옵니다' },
            { key: 'targetName', label: '목표 와이파이 이름', type: 'text', default: 'SECRET_BASE_WIFI', wide: true, help: '1단계에서 아이가 찾아 접속할 이름. 영문 대문자·숫자가 섞이면 헷갈리는 가짜를 만들기 좋습니다 (28자까지)' },
            { key: 'password', label: '비밀번호', type: 'text', default: '1234', wide: true }
        ],
        onRender(form) {
            // 비밀번호가 3스테이지에서 어떻게 쓰이는지 바로 보여 준다
            const input = form.querySelector('#f_password');
            if (!input) return;
            const note = AdminKit.h('small', { class: 'ak-help' });
            input.parentNode.appendChild(note);
            paintMode = () => {
                const v = input.value.trim();
                let ascii = v;
                try {
                    ascii = v.normalize('NFKC');
                } catch (e) {
                    /* 오래된 브라우저 */
                }
                if (!v) note.textContent = '비워 두면 1234 로 합니다.';
                else if (/^\d{3,6}$/.test(ascii)) note.textContent = `✅ 숫자 ${ascii.length}자리: 3단계에서 아이가 이 숫자를 추리합니다. 같은 숫자가 여러 번 있어도 됩니다.`;
                else note.textContent = 'ℹ️ 숫자 3~6자리가 아니에요. 3단계는 임의의 숫자 4자리로 하고, 해독한 뒤 이 비밀번호를 직접 넣는 관문이 붙습니다. 틀릴 때마다 한 글자씩 힌트가 열립니다.';
            };
            input.addEventListener('input', () => paintMode());
            paintMode();
        },
        onReset() {
            paintMode();
        }
    });
})();
