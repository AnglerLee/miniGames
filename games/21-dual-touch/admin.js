// 관리자 설정 스크립트 (21 Dual Touch)
const SETTINGS_KEY = 'dual_touch_settings';
const GAME_ID = 'game21';

// 난이도별 프리셋
const PRESETS = {
    easy:   { syncTolerance: 0.1,   moveSpeed: 0.5,  goalTime: 2.0 },
    normal: { syncTolerance: 0.05,  moveSpeed: 0.75, goalTime: 3.0 },
    hard:   { syncTolerance: 0.025, moveSpeed: 1.0,  goalTime: 5.0 }
};

// 요소 참조
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');
const difficultySelect = document.getElementById('difficultySelect');
const goalTimeInput = document.getElementById('goalTimeInput');
const goalTimeValue = document.getElementById('goalTimeValue');
const syncInput = document.getElementById('syncInput');
const syncValue = document.getElementById('syncValue');
const speedInput = document.getElementById('speedInput');
const speedValue = document.getElementById('speedValue');

function loadSettings() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
        const s = JSON.parse(saved);
        difficultySelect.value = s.difficulty || 'normal';
        applyValues(s.goalTime || 3.0, s.syncTolerance || 0.05, s.moveSpeed || 0.75);
    } else {
        difficultySelect.value = 'normal';
        applyPreset('normal');
    }
}

function applyPreset(difficulty) {
    const p = PRESETS[difficulty];
    applyValues(p.goalTime, p.syncTolerance, p.moveSpeed);
}

function applyValues(goalTime, syncTolerance, moveSpeed) {
    goalTimeInput.value = goalTime;
    goalTimeValue.textContent = `${goalTime.toFixed(1)}초`;
    syncInput.value = syncTolerance;
    syncValue.textContent = `${syncTolerance.toFixed(3)}s`;
    speedInput.value = moveSpeed;
    speedValue.textContent = `${moveSpeed.toFixed(2)}`;
}

function setupEvents() {
    difficultySelect.addEventListener('change', e => {
        applyPreset(e.target.value);
    });

    goalTimeInput.addEventListener('input', e => {
        goalTimeValue.textContent = `${parseFloat(e.target.value).toFixed(1)}초`;
    });
    syncInput.addEventListener('input', e => {
        syncValue.textContent = `${parseFloat(e.target.value).toFixed(3)}s`;
    });
    speedInput.addEventListener('input', e => {
        speedValue.textContent = `${parseFloat(e.target.value).toFixed(2)}`;
    });

    form.addEventListener('submit', saveSettings);
    resetBtn.addEventListener('click', resetSettings);
}

function saveSettings(e) {
    e.preventDefault();

    const settings = {
        difficulty: difficultySelect.value,
        goalTime: parseFloat(goalTimeInput.value),
        syncTolerance: parseFloat(syncInput.value),
        moveSpeed: parseFloat(speedInput.value)
    };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    alert('설정이 저장되었습니다!');
}

function resetSettings() {
    if (confirm('모든 설정을 기본값으로 초기화하시겠습니까?')) {
        localStorage.removeItem(SETTINGS_KEY);
        loadSettings();
        alert('초기화되었습니다.');
    }
}

loadSettings();
setupEvents();
