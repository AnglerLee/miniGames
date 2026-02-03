// 관리자 설정 스크립트 (15 Decibel Meter)
const GAME_ID = 'game15';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');
const difficultySlider = document.getElementById('difficultySlider');
const difficultyLabel = document.getElementById('difficultyLabel');

// 난이도 프리셋
const DIFFICULTY_PRESETS = {
    easy: { target: 50, maxLimit: 100, timeLimit: 0, sustainTime: 2 },
    medium: { target: 70, maxLimit: 95, timeLimit: 30, sustainTime: 3 },
    hard: { target: 85, maxLimit: 90, timeLimit: 20, sustainTime: 4 }
};

// 현재 선택된 난이도
let currentDifficulty = 'easy';

// 난이도 슬라이더 이벤트
difficultySlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    const difficulties = ['easy', 'medium', 'hard'];
    const labels = ['쉬움', '보통', '어려움'];

    currentDifficulty = difficulties[value];
    difficultyLabel.textContent = labels[value];

    // 프리셋 값으로 자동 업데이트
    const preset = DIFFICULTY_PRESETS[currentDifficulty];
    document.getElementById('target').value = preset.target;
    document.getElementById('maxLimit').value = preset.maxLimit;
    document.getElementById('timeLimit').value = preset.timeLimit;
    document.getElementById('sustainTime').value = preset.sustainTime;

    // 슬라이더 색상 변경
    updateSliderColor(value);
});

// 슬라이더 색상 업데이트
function updateSliderColor(value) {
    const colors = ['#28a745', '#ffc107', '#dc3545'];
    difficultySlider.style.accentColor = colors[value];
}

// 설정 로드
function loadSettings() {
    // 1. 글로벌 설정 로드 (보물찾기용)
    const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
    const myConfig = globalConfigs[GAME_ID] || {};

    document.getElementById('secretCode').value = myConfig.secretCode || '';
    document.getElementById('hintMessage').value = myConfig.hintMessage || '';
    document.getElementById('successMessage').value = myConfig.successMessage || '';

    // 2. 게임별 난이도 설정 로드
    const gameConfig = JSON.parse(localStorage.getItem('game15_config')) || { difficulties: DIFFICULTY_PRESETS };

    // 현재 선택된 난이도를 기준으로 값 표시 (기본값: easy)
    if (gameConfig.currentDifficulty) {
        currentDifficulty = gameConfig.currentDifficulty;
        const difficultyIndex = ['easy', 'medium', 'hard'].indexOf(currentDifficulty);
        difficultySlider.value = difficultyIndex;
        difficultyLabel.textContent = ['쉬움', '보통', '어려움'][difficultyIndex];
        updateSliderColor(difficultyIndex);
    }

    // 현재 난이도의 설정값 표시
    const currentSettings = gameConfig.difficulties[currentDifficulty] || DIFFICULTY_PRESETS[currentDifficulty];
    document.getElementById('target').value = currentSettings.target;
    document.getElementById('maxLimit').value = currentSettings.maxLimit;
    document.getElementById('timeLimit').value = currentSettings.timeLimit;
    document.getElementById('sustainTime').value = currentSettings.sustainTime;
}

// 설정 저장
function saveSettings(e) {
    e.preventDefault();

    // 1. 글로벌 설정 저장
    const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};

    globalConfigs[GAME_ID] = {
        ...globalConfigs[GAME_ID],
        secretCode: document.getElementById('secretCode').value.trim(),
        hintMessage: document.getElementById('hintMessage').value.trim(),
        successMessage: document.getElementById('successMessage').value.trim(),
        isActive: true,
        lastUpdated: new Date().toISOString()
    };

    localStorage.setItem('treasureHunt_gameConfigs', JSON.stringify(globalConfigs));

    // 2. 게임별 난이도 설정 저장
    // 기존 설정 로드
    const savedConfig = JSON.parse(localStorage.getItem('game15_config')) || { difficulties: DIFFICULTY_PRESETS };

    // 현재 난이도의 값만 업데이트
    savedConfig.difficulties = savedConfig.difficulties || {};
    savedConfig.difficulties[currentDifficulty] = {
        target: parseInt(document.getElementById('target').value),
        maxLimit: parseInt(document.getElementById('maxLimit').value),
        timeLimit: parseInt(document.getElementById('timeLimit').value),
        sustainTime: parseFloat(document.getElementById('sustainTime').value)
    };

    // 현재 선택된 난이도 저장
    savedConfig.currentDifficulty = currentDifficulty;

    localStorage.setItem('game15_config', JSON.stringify(savedConfig));

    // 커스텀 모달 사용 (common.js의 showMessage 활용)
    if (typeof showMessage === 'function') {
        showMessage(`✅ ${difficultyLabel.textContent} 난이도 설정이 저장되었습니다!`, 'success');
    } else {
        alert(`${difficultyLabel.textContent} 난이도 설정이 저장되었습니다!`);
    }
}

// 설정 초기화
function resetSettings() {
    // 커스텀 confirm 대체 - 간단한 확인 메시지 사용
    const confirmed = confirm('모든 설정을 초기화하시겠습니까?');

    if (confirmed) {
        // 글로벌 설정 초기화
        const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
        if (globalConfigs[GAME_ID]) {
            delete globalConfigs[GAME_ID];
            localStorage.setItem('treasureHunt_gameConfigs', JSON.stringify(globalConfigs));
        }

        // 게임별 설정 초기화
        localStorage.removeItem('game15_config');

        // 슬라이더를 easy로 리셋
        currentDifficulty = 'easy';
        difficultySlider.value = 0;
        difficultyLabel.textContent = '쉬움';
        updateSliderColor(0);

        loadSettings();

        if (typeof showMessage === 'function') {
            showMessage('✅ 초기화되었습니다.', 'success');
        } else {
            alert('초기화되었습니다.');
        }
    }
}

form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

// 초기 로드
loadSettings();
updateSliderColor(0);
