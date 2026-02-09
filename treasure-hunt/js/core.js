// 보물찾기 시스템 핵심 로직

// ============================================
// 데이터 구조 및 상수
// ============================================

const STORAGE_KEYS = {
    PRESETS: 'treasureHunt_presets',
    ACTIVE_PRESET_ID: 'treasureHunt_activePresetId',
    PROGRESS: 'treasureHunt_progress'
};

// 게임 정보 매핑
const GAME_INFO = {
    'game02': { name: '미로 탈출', icon: '🌀', path: 'games/02-maze' },
    'game03': { name: '짝 맞추기', icon: '🃏', path: 'games/03-card-match' },
    'game05': { name: '숫자 퍼즐', icon: '🔢', path: 'games/05-sliding-puzzle' },
    'game07': { name: '빠른 계산', icon: '➕', path: 'games/07-math-race' },
    'game08': { name: '단어 찾기', icon: '🔤', path: 'games/08-word-search' },
    'game11': { name: '순서대로 터치', icon: '🔢', path: 'games/11-sequence-tap' },
    'game12': { name: '색깔 스피드', icon: '🌈', path: 'games/12-color-rush' },
    'game13': { name: '에너지 충전', icon: '⚡', path: 'games/13-energy-charge' },
    'game15': { name: '데시벨 측정기', icon: '🔊', path: 'games/15-decibel-meter' },
    'game16': { name: '매직 컴퍼스', icon: '🧭', path: 'games/16-magic-compass' },
    'game17': { name: '바코드 스캐너', icon: '📱', path: 'games/17-barcode-scanner' },
    'game18': { name: '컬러 헌터', icon: '🎨', path: 'games/18-color-hunter' },
    'game19': { name: '리버스 오디오', icon: '🔄', path: 'games/19-reverse-audio' },
    'game20': { name: '이모지 넌센스', icon: '🤔', path: 'games/20-emoji-quiz' },
    'game21': { name: '동시 터치 협동', icon: '🤝', path: 'games/21-dual-touch' },
    'game22': { name: '와이파이 해커', icon: '📡', path: 'games/22-wifi-hacker' },
    'game23': { name: '디지털 금고 털이', icon: '🔓', path: 'games/23-safe-cracker' },
    'game24': { name: '폭탄 해체', icon: '💣', path: 'games/24-bomb-balance' },
    'game25': { name: '복권 긁기', icon: '🎫', path: 'games/25-scratch-card' },
    'game27': { name: '절대음감 스톱워치', icon: '⏱️', path: 'games/27-stopwatch' }
};

// 테마 정보
const THEMES = {
    pirate: {
        name: '해적 보물',
        icon: '🏴‍☠️',
        color: '#8b4513',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    space: {
        name: '우주 탐험',
        icon: '🚀',
        color: '#1e3a8a',
        gradient: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)'
    },
    magic: {
        name: '마법사',
        icon: '🔮',
        color: '#7c3aed',
        gradient: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)'
    },
    jungle: {
        name: '정글 탐험',
        icon: '🌴',
        color: '#15803d',
        gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
    },
    spy: {
        name: '비밀 요원',
        icon: '🕵️',
        color: '#1f2937',
        gradient: 'linear-gradient(135deg, #374151 0%, #6b7280 100%)'
    },
    custom: {
        name: '커스텀',
        icon: '✨',
        color: '#4f46e5',
        gradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
    }
};

// ============================================
// 프리셋 관리 함수
// ============================================

/**
 * 모든 프리셋 가져오기
 */
function getAllPresets() {
    try {
        const presetsStr = localStorage.getItem(STORAGE_KEYS.PRESETS);
        return presetsStr ? JSON.parse(presetsStr) : [];
    } catch (e) {
        console.error('프리셋 로드 오류:', e);
        return [];
    }
}

/**
 * 프리셋 저장
 */
function savePresets(presets) {
    try {
        localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
        return true;
    } catch (e) {
        console.error('프리셋 저장 오류:', e);
        return false;
    }
}

/**
 * 특정 프리셋 가져오기
 */
function getPresetById(presetId) {
    const presets = getAllPresets();
    return presets.find(p => p.id === presetId);
}

/**
 * 새 프리셋 생성
 */
function createPreset(presetData) {
    const presets = getAllPresets();
    const newPreset = {
        id: 'preset-' + Date.now(),
        name: presetData.name || '새 보물찾기',
        theme: presetData.theme || 'custom',
        description: presetData.description || '',
        isActive: false,
        createdAt: new Date().toISOString(),
        games: presetData.games || [],
        finalReward: presetData.finalReward || {
            message: '축하합니다! 모든 미션을 완료했어요!',
            secretCode: ''
        }
    };
    
    presets.push(newPreset);
    savePresets(presets);
    return newPreset;
}

/**
 * 프리셋 업데이트
 */
function updatePreset(presetId, updates) {
    const presets = getAllPresets();
    const index = presets.findIndex(p => p.id === presetId);
    
    if (index === -1) {
        return false;
    }
    
    presets[index] = {
        ...presets[index],
        ...updates,
        updatedAt: new Date().toISOString()
    };
    
    return savePresets(presets);
}

/**
 * 프리셋 삭제
 */
function deletePreset(presetId) {
    const presets = getAllPresets();
    const filtered = presets.filter(p => p.id !== presetId);
    
    // 활성 프리셋이 삭제되면 활성 ID도 제거
    const activeId = getActivePresetId();
    if (activeId === presetId) {
        setActivePresetId(null);
    }
    
    return savePresets(filtered);
}

/**
 * 프리셋 복제
 */
function duplicatePreset(presetId) {
    const original = getPresetById(presetId);
    if (!original) {
        return null;
    }
    
    const duplicate = {
        ...original,
        id: 'preset-' + Date.now(),
        name: original.name + ' (복사본)',
        isActive: false,
        createdAt: new Date().toISOString()
    };
    
    const presets = getAllPresets();
    presets.push(duplicate);
    savePresets(presets);
    
    return duplicate;
}

// ============================================
// 활성 프리셋 관리
// ============================================

/**
 * 활성 프리셋 ID 가져오기
 */
function getActivePresetId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_PRESET_ID);
}

/**
 * 활성 프리셋 ID 설정
 */
function setActivePresetId(presetId) {
    if (presetId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PRESET_ID, presetId);
        
        // 다른 모든 프리셋을 비활성화
        const presets = getAllPresets();
        presets.forEach(p => {
            p.isActive = (p.id === presetId);
        });
        savePresets(presets);
    } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_PRESET_ID);
    }
}

/**
 * 활성 프리셋 가져오기
 */
function getActivePreset() {
    const activeId = getActivePresetId();
    return activeId ? getPresetById(activeId) : null;
}

// ============================================
// 진행 상황 관리
// ============================================

/**
 * 현재 진행 상황 가져오기
 */
function getCurrentProgress() {
    try {
        const progressStr = localStorage.getItem(STORAGE_KEYS.PROGRESS);
        return progressStr ? JSON.parse(progressStr) : null;
    } catch (e) {
        console.error('진행 상황 로드 오류:', e);
        return null;
    }
}

/**
 * 진행 상황 초기화
 */
function initProgress(presetId) {
    const progress = {
        presetId: presetId,
        startedAt: new Date().toISOString(),
        completedGames: [],
        currentGameIndex: 0
    };
    
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
    return progress;
}

/**
 * 게임 완료 표시
 */
function markGameComplete(gameIndex) {
    const progress = getCurrentProgress();
    if (!progress) {
        return false;
    }
    
    if (!progress.completedGames.includes(gameIndex)) {
        progress.completedGames.push(gameIndex);
    }
    
    // 다음 게임으로 진행
    progress.currentGameIndex = gameIndex + 1;
    progress.lastCompletedAt = new Date().toISOString();
    
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
    return true;
}

/**
 * 진행 상황 초기화 (처음부터 다시)
 */
function resetProgress() {
    localStorage.removeItem(STORAGE_KEYS.PROGRESS);
}

/**
 * 보물찾기 완료 여부 확인
 */
function isHuntComplete() {
    const progress = getCurrentProgress();
    const preset = getActivePreset();
    
    if (!progress || !preset) {
        return false;
    }
    
    return progress.completedGames.length >= preset.games.length;
}

// ============================================
// 보물찾기 모드 확인
// ============================================

/**
 * 현재 게임이 보물찾기 모드인지 확인
 */
function isTreasureHuntMode() {
    const activePreset = getActivePreset();
    const progress = getCurrentProgress();
    
    return !!(activePreset && progress && progress.presetId === activePreset.id);
}

/**
 * 현재 게임의 보물찾기 정보 가져오기
 */
function getCurrentGameHuntInfo(gameId) {
    if (!isTreasureHuntMode()) {
        return null;
    }
    
    const preset = getActivePreset();
    const progress = getCurrentProgress();
    
    if (!preset || !progress) {
        return null;
    }
    
    // 현재 게임 찾기
    const gameIndex = preset.games.findIndex(g => g.gameId === gameId);
    
    if (gameIndex === -1) {
        return null;
    }
    
    const gameData = preset.games[gameIndex];
    const isLastGame = gameIndex === preset.games.length - 1;
    const nextGame = isLastGame ? null : preset.games[gameIndex + 1];
    
    return {
        preset: preset,
        gameIndex: gameIndex,
        gameData: gameData,
        isLastGame: isLastGame,
        nextGame: nextGame,
        progress: progress
    };
}

/**
 * 다음 게임 URL 가져오기
 */
function getNextGameUrl(currentGameId) {
    const huntInfo = getCurrentGameHuntInfo(currentGameId);
    
    if (!huntInfo || huntInfo.isLastGame) {
        return null;
    }
    
    const nextGameInfo = GAME_INFO[huntInfo.nextGame.gameId];
    if (!nextGameInfo) {
        return null;
    }
    
    return `../../${nextGameInfo.path}/index.html`;
}

// ============================================
// 프리셋 import/export
// ============================================

/**
 * 프리셋을 JSON으로 내보내기
 */
function exportPreset(presetId) {
    const preset = getPresetById(presetId);
    if (!preset) {
        return null;
    }
    
    return JSON.stringify(preset, null, 2);
}

/**
 * JSON에서 프리셋 가져오기
 */
function importPreset(jsonString) {
    try {
        const preset = JSON.parse(jsonString);
        
        // ID 재생성
        preset.id = 'preset-' + Date.now();
        preset.isActive = false;
        preset.createdAt = new Date().toISOString();
        
        const presets = getAllPresets();
        presets.push(preset);
        savePresets(presets);
        
        return preset;
    } catch (e) {
        console.error('프리셋 가져오기 오류:', e);
        return null;
    }
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 게임 정보 가져오기
 */
function getGameInfo(gameId) {
    return GAME_INFO[gameId] || null;
}

/**
 * 모든 게임 목록 가져오기
 */
function getAllGamesList() {
    return Object.keys(GAME_INFO).map(gameId => ({
        id: gameId,
        ...GAME_INFO[gameId]
    }));
}

/**
 * 테마 정보 가져오기
 */
function getThemeInfo(themeId) {
    return THEMES[themeId] || THEMES.custom;
}

/**
 * 모든 테마 목록 가져오기
 */
function getAllThemes() {
    return Object.keys(THEMES).map(themeId => ({
        id: themeId,
        ...THEMES[themeId]
    }));
}

// ============================================
// 전역 객체로 노출
// ============================================

window.TreasureHunt = {
    // 프리셋 관리
    getAllPresets,
    savePresets,
    getPresetById,
    createPreset,
    updatePreset,
    deletePreset,
    duplicatePreset,
    
    // 활성 프리셋
    getActivePresetId,
    setActivePresetId,
    getActivePreset,
    
    // 진행 상황
    getCurrentProgress,
    initProgress,
    markGameComplete,
    resetProgress,
    isHuntComplete,
    
    // 보물찾기 모드
    isTreasureHuntMode,
    getCurrentGameHuntInfo,
    getNextGameUrl,
    
    // import/export
    exportPreset,
    importPreset,
    
    // 유틸리티
    getGameInfo,
    getAllGamesList,
    getThemeInfo,
    getAllThemes,
    
    // 상수
    STORAGE_KEYS,
    GAME_INFO,
    THEMES
};
