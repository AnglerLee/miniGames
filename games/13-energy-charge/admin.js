const SETTINGS_KEY = 'energy_charge_settings';
const GAME_ID = 'game13';

// 기본 설정 값 (업데이트됨)
const DEFAULT_SETTINGS = {
    // threshold 제거됨 (코드상으론 호환성을 위해 무시하거나 low value로 고정 가능, 여기선 제거)
    increment: 0.5,   // 충전 속도 (기본 0.5%)
    timeLimit: 30,    // 시간 제한
    decayRate: 0.5,   // 감소 속도
    theme: 'default'  // 테마
};

// 요소 참조
// thresholdInput 제거됨
const incrementInput = document.getElementById('incrementInput');
const incrementValue = document.getElementById('incrementValue');
const decayRateInput = document.getElementById('decayRateInput');
const decayRateValue = document.getElementById('decayRateValue');
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
    const saved = localStorage.getItem(SETTINGS_KEY);
    const settings = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;

    // increment range: 0.1 ~ 1.0
    // 만약 이전 설정(1~10)이 저장되어 있다면 0.5로 리셋하는 안전장치
    let safeIncrement = settings.increment;
    if (safeIncrement > 1.0) safeIncrement = 0.5;

    updateRangeUI(incrementInput, incrementValue, safeIncrement, v => `${v}%`);
    updateRangeUI(decayRateInput, decayRateValue, settings.decayRate || 0.5, v => `${v}%/s`);
    updateRangeUI(timeInput, timeValue, settings.timeLimit, v => v === 0 ? '무제한' : `${v}초`);

    themeSelector.value = settings.theme || 'default';

    // 미니게임 공통 설정
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

// 헬퍼 함수
function updateRangeUI(input, valueDisplay, value, formatter) {
    if (input) {
        input.value = value;
        if (valueDisplay) valueDisplay.textContent = formatter(parseFloat(value));
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    incrementInput.addEventListener('input', (e) => {
        updateRangeUI(incrementInput, incrementValue, e.target.value, v => `${v}%`);
    });

    decayRateInput.addEventListener('input', (e) => {
        updateRangeUI(decayRateInput, decayRateValue, e.target.value, v => `${v}%/s`);
    });

    timeInput.addEventListener('input', (e) => {
        updateRangeUI(timeInput, timeValue, parseFloat(e.target.value), v => v === 0 ? '무제한' : `${v}초`);
    });

    saveBtn.addEventListener('click', saveSettings);
    resetBtn.addEventListener('click', resetToDefaults);
}

// 설정 저장
function saveSettings() {
    const settings = {
        increment: parseFloat(incrementInput.value),
        timeLimit: parseFloat(timeInput.value),
        decayRate: parseFloat(decayRateInput.value),
        theme: themeSelector.value
    };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    // 미니게임 공통 설정 저장
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
}

// 기본값으로 초기화
function resetToDefaults() {
    if (confirm('모든 설정을 기본값으로 초기화하시겠습니까?')) {
        localStorage.removeItem(SETTINGS_KEY);
        loadSettings();
        alert('설정이 초기화되었습니다.');
    }
}

init();
