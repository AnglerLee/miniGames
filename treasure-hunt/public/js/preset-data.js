/* ===== preset-data.js - Theme Scenario Data ===== */

const GAME_INFO = {
    'game02': { name: '미로 탈출', icon: '🌀', path: '02-maze', category: 'puzzle' },
    'game03': { name: '짝 맞추기', icon: '🃏', path: '03-card-match', category: 'puzzle' },
    'game05': { name: '숫자 퍼즐', icon: '🔢', path: '05-sliding-puzzle', category: 'puzzle' },
    'game07': { name: '빠른 계산', icon: '➕', path: '07-math-race', category: 'puzzle' },
    'game08': { name: '단어 찾기', icon: '🔤', path: '08-word-search', category: 'puzzle' },
    'game11': { name: '순서대로 터치', icon: '🔢', path: '11-sequence-tap', category: 'action' },
    'game12': { name: '색깔 스피드', icon: '🌈', path: '12-color-rush', category: 'action' },
    'game13': { name: '에너지 충전', icon: '⚡', path: '13-energy-charge', category: 'sensor', badge: '📱' },
    'game15': { name: '데시벨 측정기', icon: '🔊', path: '15-decibel-meter', category: 'audio', badge: '🎤' },
    'game16': { name: '매직 컴퍼스', icon: '🧭', path: '16-magic-compass', category: 'sensor', badge: '📱' },
    'game17': { name: '바코드 스캐너', icon: '📱', path: '17-barcode-scanner', category: 'camera', badge: '📷' },
    'game18': { name: '컬러 헌터', icon: '🎨', path: '18-color-hunter', category: 'camera', badge: '📷' },
    'game19': { name: '리버스 오디오', icon: '🔄', path: '19-reverse-audio', category: 'audio', badge: '🎤' },
    'game20': { name: '이모지 넌센스', icon: '🤔', path: '20-emoji-quiz', category: 'puzzle' },
    'game21': { name: '동시 터치 협동', icon: '🤝', path: '21-dual-touch', category: 'action' },
    'game22': { name: '와이파이 해커', icon: '📡', path: '22-wifi-hacker', category: 'puzzle' },
    'game23': { name: '디지털 금고 털이', icon: '🔓', path: '23-safe-cracker', category: 'special' },
    'game24': { name: '폭탄 해체', icon: '💣', path: '24-bomb-balance', category: 'sensor', badge: '📱' },
    'game25': { name: '복권 긁기', icon: '🎫', path: '25-scratch-card', category: 'special' },
    'game27': { name: '절대음감 스톱워치', icon: '⏱️', path: '27-stopwatch', category: 'action' }
};

/* Theme data is loaded dynamically from data/*.json files */
var PRESET_DATA = {};

/* ===== JSON Data Loader ===== */

async function loadAllThemeData() {
    var themes = ['mystery', 'pirate', 'space', 'magic', 'dino', 'jungle', 'ocean', 'ninja', 'haunted'];
    await Promise.all(themes.map(async function (themeId) {
        try {
            var res = await fetch('data/' + themeId + '.json');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            PRESET_DATA[themeId] = await res.json();
        } catch (e) {
            console.warn('Failed to load theme data:', themeId, e);
            PRESET_DATA[themeId] = { scenarios: [] };
        }
    }));
}

/* ===== API Functions ===== */

function getScenarios(themeId) {
    var themeData = PRESET_DATA[themeId];
    return themeData ? themeData.scenarios : [];
}

function getScenarioById(scenarioId) {
    var themeIds = Object.keys(PRESET_DATA);
    for (var i = 0; i < themeIds.length; i++) {
        var themeId = themeIds[i];
        var scenarios = PRESET_DATA[themeId].scenarios;
        for (var j = 0; j < scenarios.length; j++) {
            if (scenarios[j].id === scenarioId) {
                return Object.assign({}, scenarios[j], { theme: themeId });
            }
        }
    }
    return null;
}

function getPresetData(themeId) {
    var scenarios = getScenarios(themeId);
    return scenarios.length > 0 ? scenarios[0] : null;
}

function getGameInfo(gameId) {
    return GAME_INFO[gameId] || null;
}

function getAllGameIds() {
    return Object.keys(GAME_INFO);
}
