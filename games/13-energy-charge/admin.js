const SETTINGS_KEY = 'energy_charge_settings';
const GAME_ID = 'game13';

// 기본 설정 값
const DEFAULT_SETTINGS = {
    threshold: 30,    // 흔들기 임계값 (재추가됨)
    increment: 0.5,   // 충전 속도
    timeLimit: 30,    // 시간 제한
    decayRate: 0.5,   // 감소 속도
    theme: 'default'  // 테마
};

// 요소 참조
const thresholdInput = document.getElementById('thresholdInput');
const thresholdValue = document.getElementById('thresholdValue');
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

    if (settings.increment > 1.0) settings.increment = 0.5;

    updateRangeUI(thresholdInput, thresholdValue, settings.threshold || 30, v => `${v}`);
    updateRangeUI(incrementInput, incrementValue, settings.increment, v => `${v}%`);
    updateRangeUI(decayRateInput, decayRateValue, settings.decayRate || 0.5, v => `${v}%/s`);
    updateRangeUI(timeInput, timeValue, settings.timeLimit, v => v === 0 ? '무제한' : `${v}초`);

    themeSelector.value = settings.theme || 'default';
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
    thresholdInput.addEventListener('input', (e) => {
        updateRangeUI(thresholdInput, thresholdValue, e.target.value, v => `${v}`);
    });

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
        threshold: parseFloat(thresholdInput.value),
        increment: parseFloat(incrementInput.value),
        timeLimit: parseFloat(timeInput.value),
        decayRate: parseFloat(decayRateInput.value),
        theme: themeSelector.value
    };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

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
