const SETTINGS_KEY = 'energy_charge_settings';
const GAME_ID = 'game13';

// 기본 설정 값
const DEFAULT_SETTINGS = {
    threshold: 30,    // 흔들기 임계값
    increment: 3,     // 충전 증가량
    timeLimit: 30,    // 시간 제한
    theme: 'default'  // 테마
};

// 요소 참조
const thresholdInput = document.getElementById('thresholdInput');
const thresholdValue = document.getElementById('thresholdValue');
const incrementInput = document.getElementById('incrementInput');
const incrementValue = document.getElementById('incrementValue');
const timeInput = document.getElementById('timeInput');
const timeValue = document.getElementById('timeValue');
const themeSelector = document.getElementById('themeSelector');

// 미니게임 정보 요소
const secretCodeInput = document.getElementById('secretCodeInput');
const hintMessageInput = document.getElementById('hintMessageInput');
const successMessageInput = document.getElementById('successMessageInput');

const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetDefaultsBtn');

// 초기화
function init() {
    loadSettings();
    setupEventListeners();
}

// 설정 불러오기
function loadSettings() {
    // 1. 게임 내부 설정 로드
    const saved = localStorage.getItem(SETTINGS_KEY);
    const settings = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;

    updateRangeUI(thresholdInput, thresholdValue, settings.threshold, formatThreshold);
    updateRangeUI(incrementInput, incrementValue, settings.increment, v => `${v}%`);
    updateRangeUI(timeInput, timeValue, settings.timeLimit, v => v === 0 ? '무제한' : `${v}초`);

    themeSelector.value = settings.theme;

    // 2. 미니게임 공통 설정 로드
    let gameConfig = {};
    if (typeof getGameConfig === 'function') {
        gameConfig = getGameConfig(GAME_ID);
    } else {
        const configStr = localStorage.getItem('treasureHunt_gameConfigs');
        const configs = configStr ? JSON.parse(configStr) : {};
        gameConfig = configs[GAME_ID] || {};
    }

    secretCodeInput.value = gameConfig.secretCode || '';
    hintMessageInput.value = gameConfig.hintMessage || '';
    successMessageInput.value = gameConfig.successMessage || '축하합니다! 게임을 클리어했어요!';
}

// 헬퍼 함수들
function formatThreshold(val) {
    if (val < 20) return `쉬움 (${val})`;
    if (val < 35) return `보통 (${val})`;
    return `어려움 (${val})`;
}

function updateRangeUI(input, valueDisplay, value, formatter) {
    input.value = value;
    valueDisplay.textContent = formatter(parseFloat(value));
}

// 이벤트 리스너 설정
function setupEventListeners() {
    thresholdInput.addEventListener('input', (e) => {
        updateRangeUI(thresholdInput, thresholdValue, e.target.value, formatThreshold);
    });

    incrementInput.addEventListener('input', (e) => {
        updateRangeUI(incrementInput, incrementValue, e.target.value, v => `${v}%`);
    });

    timeInput.addEventListener('input', (e) => {
        updateRangeUI(timeInput, timeValue, parseFloat(e.target.value), v => v === 0 ? '무제한' : `${v}초`);
    });

    saveBtn.addEventListener('click', saveSettings);
    resetBtn.addEventListener('click', resetToDefaults);
}

// 설정 저장
function saveSettings() {
    // 1. 게임 내부 설정 저장
    const settings = {
        threshold: parseFloat(thresholdInput.value),
        increment: parseFloat(incrementInput.value),
        timeLimit: parseFloat(timeInput.value),
        theme: themeSelector.value
    };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    // 2. 미니게임 공통 설정 저장
    const configStr = localStorage.getItem('treasureHunt_gameConfigs');
    const configs = configStr ? JSON.parse(configStr) : {};

    configs[GAME_ID] = {
        secretCode: secretCodeInput.value,
        hintMessage: hintMessageInput.value,
        successMessage: successMessageInput.value,
        isActive: true
    };

    localStorage.setItem('treasureHunt_gameConfigs', JSON.stringify(configs));

    alert('설정이 저장되었습니다.');
    // 저장 후 페이지 이동하지 않음 (14-secret-knock flow)
}

// 기본값으로 초기화
function resetToDefaults() {
    if (confirm('모든 설정을 기본값으로 초기화하시겠습니까?')) {
        localStorage.removeItem(SETTINGS_KEY);
        loadSettings(); // Reload UI
        alert('설정이 초기화되었습니다.');
    }
}

init();
