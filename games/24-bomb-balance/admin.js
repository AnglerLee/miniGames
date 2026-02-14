// 관리자 설정 스크립트 (24 Bomb Balance)
const GAME_ID = 'game24';
const SETTINGS_KEY = 'bomb_balance_settings';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');
const difficultySlider = document.getElementById('difficultySlider');
const difficultyDesc = document.getElementById('difficultyDesc');
const difficultyLabels = document.querySelectorAll('.difficulty-labels span');

// 난이도 프리셋
const PRESETS = {
    0: { // 쉬움
        gameDuration: 30,
        driftBaseStrength: 2,
        driftMaxStrength: 10,
        driftRotationSpeed: 0.3,
        gustCount: 1,
        gustStrength: 8,
        stabilityDecreaseRate: 12,
        stabilityRecoverRate: 10,
        tiltThreshold: 20,
        tiltMax: 50
    },
    1: { // 보통
        gameDuration: 30,
        driftBaseStrength: 5,
        driftMaxStrength: 20,
        driftRotationSpeed: 0.5,
        gustCount: 3,
        gustStrength: 15,
        stabilityDecreaseRate: 20,
        stabilityRecoverRate: 5,
        tiltThreshold: 15,
        tiltMax: 45
    },
    2: { // 어려움
        gameDuration: 30,
        driftBaseStrength: 10,
        driftMaxStrength: 30,
        driftRotationSpeed: 0.8,
        gustCount: 5,
        gustStrength: 22,
        stabilityDecreaseRate: 30,
        stabilityRecoverRate: 3,
        tiltThreshold: 10,
        tiltMax: 40
    }
};

const DEFAULT_SETTINGS = { ...PRESETS[1] };

const DIFFICULTY_DESCS = [
    '바람이 약하고 돌풍도 거의 없어요. 처음 플레이하기 좋습니다.',
    '적당한 바람과 돌풍이 불어옵니다. 기본 난이도입니다.',
    '강한 바람과 잦은 돌풍! 높은 집중력이 필요합니다.'
];

// Setting field definitions: [id, formatter, parseType]
const FIELDS = [
    ['gameDuration', v => `${v}초`, 'int'],
    ['driftBaseStrength', v => `${v}`, 'int'],
    ['driftMaxStrength', v => `${v}`, 'int'],
    ['driftRotationSpeed', v => `${v}`, 'float'],
    ['gustCount', v => `${v}회`, 'int'],
    ['gustStrength', v => `${v}`, 'int'],
    ['stabilityDecreaseRate', v => `${v}`, 'int'],
    ['stabilityRecoverRate', v => `${v}`, 'int'],
    ['tiltThreshold', v => `${v}°`, 'int'],
    ['tiltMax', v => `${v}°`, 'int']
];

// UI에 설정값 반영
function applyToUI(settings) {
    FIELDS.forEach(([id, formatter]) => {
        const input = document.getElementById(id);
        const display = document.getElementById(id + 'Value');
        if (input && display) {
            input.value = settings[id];
            display.textContent = formatter(settings[id]);
        }
    });
}

// 난이도 라벨 활성화 표시
function updateDifficultyLabel(level) {
    difficultyLabels.forEach(span => {
        span.classList.toggle('active', parseInt(span.dataset.level) === level);
    });
    difficultyDesc.textContent = DIFFICULTY_DESCS[level];
}

// 현재 설정이 어떤 프리셋과 일치하는지 확인
function detectPresetLevel(settings) {
    for (let level = 0; level <= 2; level++) {
        const preset = PRESETS[level];
        const match = FIELDS.every(([id]) => {
            const a = parseFloat(settings[id]);
            const b = parseFloat(preset[id]);
            return Math.abs(a - b) < 0.01;
        });
        if (match) return level;
    }
    return -1; // 사용자 정의
}

// 난이도 슬라이더 변경
difficultySlider.addEventListener('input', () => {
    const level = parseInt(difficultySlider.value);
    const preset = PRESETS[level];
    applyToUI(preset);
    updateDifficultyLabel(level);
});

// 개별 슬라이더 변경 시 이벤트
FIELDS.forEach(([id, formatter]) => {
    const input = document.getElementById(id);
    const display = document.getElementById(id + 'Value');
    if (input && display) {
        input.addEventListener('input', () => {
            display.textContent = formatter(parseFloat(input.value));

            // 현재 값들이 프리셋과 일치하는지 체크
            const current = {};
            FIELDS.forEach(([fid, , parseType]) => {
                const el = document.getElementById(fid);
                if (el) current[fid] = parseType === 'float' ? parseFloat(el.value) : parseInt(el.value);
            });
            const detected = detectPresetLevel(current);
            if (detected >= 0) {
                difficultySlider.value = detected;
                updateDifficultyLabel(detected);
            } else {
                difficultyLabels.forEach(span => span.classList.remove('active'));
                difficultyDesc.textContent = '세부 설정이 수동으로 조정되었습니다.';
            }
        });
    }
});

// 설정 로드
function loadSettings() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    const settings = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };

    applyToUI(settings);

    // 프리셋 매칭
    const detected = detectPresetLevel(settings);
    if (detected >= 0) {
        difficultySlider.value = detected;
        updateDifficultyLabel(detected);
    } else {
        difficultySlider.value = 1;
        difficultyLabels.forEach(span => span.classList.remove('active'));
        difficultyDesc.textContent = '세부 설정이 수동으로 조정되었습니다.';
    }
}

// 설정 저장
function saveSettings(e) {
    e.preventDefault();

    const settings = {};
    FIELDS.forEach(([id, , parseType]) => {
        const input = document.getElementById(id);
        if (input) {
            settings[id] = parseType === 'float' ? parseFloat(input.value) : parseInt(input.value);
        }
    });

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    alert('설정이 저장되었습니다!');
}

// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까?')) {
        localStorage.removeItem(SETTINGS_KEY);
        loadSettings();
        alert('초기화되었습니다.');
    }
}

form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

loadSettings();
