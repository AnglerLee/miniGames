// 단어 탐정 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다. 암호 검사는 게임과 같은 puzzle.js 의 normalizeCode 를 쓴다.
(function () {
    const OLD_LEVEL = { easy: 0, normal: 1, hard: 2, custom: 1 }; // 옛 관리자 페이지가 쓰던 난이도 글자

    const api = AdminKit.page({
        title: '단어 탐정 설정',
        storageKey: 'word_search_settings',
        recordId: 'game08',
        note: '단어를 모두 찾으면 남은 칸의 글자가 수수께끼의 답(암호)이 되는 게임입니다. 사건은 6×6(가로·세로) → 7×7(거꾸로 단어) → 8×8(대각선·가짜 단어) 순서이고, 실패하면 그 사건부터 새 격자로 다시 합니다. 아래에서 <b>마지막 사건의 수수께끼와 암호</b>를 정하면 보물 위치 같은 단서를 격자 속에 숨길 수 있습니다.',
        presets: [
            { stageTime: 60, wrongPenalty: 2, comboWindow: 10, hints: 3 },
            { stageTime: 50, wrongPenalty: 3, comboWindow: 8, hints: 2 },
            { stageTime: 40, wrongPenalty: 4, comboWindow: 6, hints: 1 }
        ],
        fields: [
            { key: 'stageTime', label: '⏱️ 1사건 제한 시간 (초)', min: 20, max: 180, step: 5, help: '2사건은 1.25배, 3사건은 1.6배. 재도전하면 조금씩 늘어납니다' },
            { key: 'wrongPenalty', label: '❌ 틀리면 깎이는 시간 (초)', min: 0, max: 10, step: 0.5, help: '단어가 아닌 줄이나 가짜 단어를 고를 때. 암호를 틀리면 두 배' },
            { key: 'comboWindow', label: '🔥 콤보 인정 시간 (초)', min: 3, max: 20, step: 1, help: '이 시간 안에 다음 단어를 찾으면 콤보(점수 배수와 보너스 시간)' },
            { key: 'hints', label: '🔍 돋보기 수', min: 0, max: 5, step: 1, help: '못 찾은 단어의 첫 글자를 잠깐 비춥니다. 쓰면 별은 최대 2개' }
        ],
        extras: [
            { section: '🔐 마지막 사건의 암호 (선택)' },
            { key: 'customRiddle', label: '수수께끼', type: 'text', default: '', wide: true, placeholder: '다음 단서는 어디에?', help: '마지막 사건에 보이는 질문. 40자까지' },
            { key: 'customCode', label: '암호 (답)', type: 'text', default: '', wide: true, placeholder: '냉장고', help: '한글·영문·숫자 2~8글자. 띄어쓰기와 기호는 빠집니다. 비워 두면 내장 수수께끼가 나옵니다' }
        ],
        onRender(form) {
            const code = form.querySelector('#f_customCode');
            const riddle = form.querySelector('#f_customRiddle');
            riddle.setAttribute('maxlength', '40');
            code.setAttribute('maxlength', '20');
            const preview = AdminKit.h('div', { class: 'ak-note', id: 'codePreview' });
            code.parentNode.appendChild(preview);
            const paint = () => {
                const raw = code.value.trim();
                const letters = window.WordPuzzle.normalizeCode(raw);
                if (!raw) {
                    preview.textContent = '지금은 내장 수수께끼(동물·과일·우주 등)가 나옵니다.';
                } else if (!letters) {
                    preview.textContent = '⚠️ 한글·영문·숫자로 2~8글자를 적어 주세요. 이대로면 내장 수수께끼가 나옵니다.';
                } else {
                    const q = riddle.value.trim() || '다음 단서는 어디에 있을까?';
                    preview.textContent = `격자에 숨을 암호: ${letters.join('')} (${letters.length}글자) · 질문: ${q}`;
                }
            };
            code.addEventListener('input', paint);
            riddle.addEventListener('input', paint);
            paint();
        }
    });

    // 옛 형식({ difficulty: 'normal', timeLimit: 180, gridSize, theme })은 게임과 같은 식으로 옮겨 보여 준다
    const old = api.stored();
    if (OLD_LEVEL[old.difficulty] !== undefined) {
        const slider = document.getElementById('difficultySlider');
        slider.value = OLD_LEVEL[old.difficulty];
        slider.dispatchEvent(new Event('input'));
    }
    const limit = Number(old.timeLimit);
    if (old.stageTime === undefined && limit > 0) {
        api.set('stageTime', Math.round(Math.min(120, Math.max(30, limit / 3))));
    }
})();
