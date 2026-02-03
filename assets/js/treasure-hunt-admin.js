// 보물찾기 관리자 페이지 스크립트

let currentEditingId = null;
let selectedGames = [];
let selectedTheme = 'custom';
let draggedElement = null;

// ============================================
// 페이지 로드
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    renderPresets();
    setupThemeSelector();
});

// ============================================
// 프리셋 목록 렌더링
// ============================================

function renderPresets() {
    const container = document.getElementById('presetsContainer');
    const presets = TreasureHunt.getAllPresets();
    const activeId = TreasureHunt.getActivePresetId();

    if (presets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h2>아직 보물찾기가 없습니다</h2>
                <p>새 보물찾기를 만들거나 기본 프리셋을 로드하세요!</p>
                <button class="btn btn-primary" onclick="loadDefaults()">
                    📦 기본 프리셋 로드하기
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = presets.map(preset => {
        const theme = TreasureHunt.getThemeInfo(preset.theme);
        const isActive = preset.id === activeId;

        return `
            <div class="preset-card ${isActive ? 'active' : ''}">
                ${isActive ? '<span class="active-badge">활성화됨</span>' : ''}
                <div class="preset-header">
                    <div class="theme-icon">${theme.icon}</div>
                    <div class="preset-title">
                        <h3>${preset.name}</h3>
                        <p>${preset.description || '설명 없음'}</p>
                    </div>
                </div>
                
                <div class="preset-info">
                    <div><strong>테마:</strong> ${theme.name}</div>
                    <div><strong>게임 수:</strong> ${preset.games.length}개</div>
                    <div><strong>생성일:</strong> ${formatDate(preset.createdAt)}</div>
                </div>

                <div class="preset-actions">
                    ${!isActive ? `
                        <button class="btn btn-primary" onclick="activatePreset('${preset.id}')">
                            ✅ 활성화
                        </button>
                    ` : `
                        <button class="btn btn-secondary" onclick="deactivatePreset()">
                            ⏸️ 비활성화
                        </button>
                    `}
                    <button class="btn btn-secondary" onclick="editPreset('${preset.id}')">
                        ✏️ 편집
                    </button>
                    <button class="btn btn-secondary" onclick="duplicatePresetHandler('${preset.id}')">
                        📋 복제
                    </button>
                    <button class="btn btn-secondary" onclick="exportPresetHandler('${preset.id}')">
                        💾 내보내기
                    </button>
                    <button class="btn btn-danger" onclick="deletePresetHandler('${preset.id}')">
                        🗑️ 삭제
                    </button>
                    ${isActive ? `
                        <button class="btn btn-secondary" onclick="viewProgress('${preset.id}')">
                            📊 진행상황
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// 프리셋 관리 함수
// ============================================

function activatePreset(presetId) {
    TreasureHunt.setActivePresetId(presetId);
    TreasureHunt.resetProgress();
    showNotification('보물찾기가 활성화되었습니다!');
    renderPresets();
}

function deactivatePreset() {
    if (confirm('보물찾기를 비활성화하시겠습니까? 진행 중인 상황은 저장됩니다.')) {
        TreasureHunt.setActivePresetId(null);
        showNotification('비활성화되었습니다');
        renderPresets();
    }
}

function deletePresetHandler(presetId) {
    const preset = TreasureHunt.getPresetById(presetId);
    if (confirm(`"${preset.name}"을(를) 삭제하시겠습니까?`)) {
        TreasureHunt.deletePreset(presetId);
        showNotification('삭제되었습니다');
        renderPresets();
    }
}

function duplicatePresetHandler(presetId) {
    const duplicate = TreasureHunt.duplicatePreset(presetId);
    if (duplicate) {
        showNotification('복제되었습니다!');
        renderPresets();
    }
}

function exportPresetHandler(presetId) {
    const json = TreasureHunt.exportPreset(presetId);
    if (json) {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `treasure-hunt-${presetId}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showNotification('내보내기 완료!');
    }
}

function loadDefaults() {
    if (confirm('기본 프리셋 5개를 로드하시겠습니까?')) {
        const loaded = DefaultPresets.loadDefaultPresets();
        if (loaded) {
            showNotification('기본 프리셋이 로드되었습니다!');
            renderPresets();
        } else {
            showNotification('이미 프리셋이 있습니다');
        }
    }
}

function viewProgress(presetId) {
    const progress = TreasureHunt.getCurrentProgress();
    const preset = TreasureHunt.getPresetById(presetId);
    
    if (!progress || progress.presetId !== presetId) {
        alert('진행 중인 게임이 없습니다');
        return;
    }

    const completedCount = progress.completedGames.length;
    const totalCount = preset.games.length;
    const percentage = Math.round((completedCount / totalCount) * 100);

    alert(`진행 상황: ${completedCount}/${totalCount} (${percentage}%)\n시작 시간: ${formatDate(progress.startedAt)}`);
}

// ============================================
// 모달 관리
// ============================================

function showCreateModal() {
    currentEditingId = null;
    document.getElementById('modalTitle').textContent = '새 보물찾기 만들기';
    document.getElementById('presetForm').reset();
    selectedGames = [];
    selectedTheme = 'custom';
    
    setupThemeSelector();
    renderSelectedGames();
    renderAvailableGames();
    
    document.getElementById('editModal').classList.add('active');
}

function editPreset(presetId) {
    currentEditingId = presetId;
    const preset = TreasureHunt.getPresetById(presetId);
    
    if (!preset) return;

    document.getElementById('modalTitle').textContent = '보물찾기 편집';
    document.getElementById('presetName').value = preset.name;
    document.getElementById('presetDescription').value = preset.description || '';
    document.getElementById('finalMessage').value = preset.finalReward?.message || '';
    document.getElementById('finalCode').value = preset.finalReward?.secretCode || '';
    
    selectedTheme = preset.theme;
    selectedGames = [...preset.games];
    
    setupThemeSelector();
    renderSelectedGames();
    renderAvailableGames();
    renderGamesConfig();
    
    document.getElementById('editModal').classList.add('active');
}

function closeModal() {
    document.getElementById('editModal').classList.remove('active');
    currentEditingId = null;
}

// ============================================
// 테마 선택기
// ============================================

function setupThemeSelector() {
    const container = document.getElementById('themeSelector');
    const themes = TreasureHunt.getAllThemes();

    container.innerHTML = themes.map(theme => `
        <div class="theme-option ${theme.id === selectedTheme ? 'selected' : ''}" 
             onclick="selectTheme('${theme.id}')">
            <div class="icon">${theme.icon}</div>
            <div class="name">${theme.name}</div>
        </div>
    `).join('');
}

function selectTheme(themeId) {
    selectedTheme = themeId;
    setupThemeSelector();
}

// ============================================
// 게임 선택 및 순서
// ============================================

function renderSelectedGames() {
    const container = document.getElementById('selectedGames');
    
    if (selectedGames.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center;">아래에서 게임을 선택하세요</p>';
        return;
    }

    container.innerHTML = selectedGames.map((game, index) => {
        const gameInfo = TreasureHunt.getGameInfo(game.gameId);
        return `
            <div class="game-item" draggable="true" data-index="${index}">
                <div class="game-item-header">
                    <div class="game-item-title">
                        <span class="drag-handle">☰</span>
                        <span>${index + 1}. ${gameInfo.icon} ${gameInfo.name}</span>
                    </div>
                    <button type="button" class="remove-game-btn" onclick="removeGame(${index})">
                        ✕ 제거
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // 드래그 앤 드롭 이벤트 설정
    setupDragAndDrop();
}

function renderAvailableGames() {
    const container = document.getElementById('availableGames');
    const allGames = TreasureHunt.getAllGamesList();
    const selectedIds = selectedGames.map(g => g.gameId);

    container.innerHTML = allGames.map(game => {
        const isSelected = selectedIds.includes(game.id);
        return `
            <div class="game-select-item ${isSelected ? 'disabled' : ''}" 
                 onclick="${isSelected ? '' : `addGame('${game.id}')`}">
                <div>${game.icon}</div>
                <div style="font-size: 0.75rem; margin-top: 3px;">${game.name}</div>
            </div>
        `;
    }).join('');
}

function addGame(gameId) {
    selectedGames.push({
        gameId: gameId,
        storyText: '',
        hintMessage: '',
        secretCode: '',
        successMessage: '잘했어! 다음 미션으로 가자!'
    });
    
    renderSelectedGames();
    renderAvailableGames();
    renderGamesConfig();
}

function removeGame(index) {
    selectedGames.splice(index, 1);
    renderSelectedGames();
    renderAvailableGames();
    renderGamesConfig();
}

// ============================================
// 드래그 앤 드롭
// ============================================

function setupDragAndDrop() {
    const items = document.querySelectorAll('.game-item');
    
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
    });
}

function handleDragStart(e) {
    draggedElement = this;
    this.style.opacity = '0.4';
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    if (draggedElement !== this) {
        const fromIndex = parseInt(draggedElement.dataset.index);
        const toIndex = parseInt(this.dataset.index);
        
        // 배열 순서 변경
        const temp = selectedGames[fromIndex];
        selectedGames.splice(fromIndex, 1);
        selectedGames.splice(toIndex, 0, temp);
        
        renderSelectedGames();
        renderGamesConfig();
    }
    
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
}

// ============================================
// 게임별 설정
// ============================================

function renderGamesConfig() {
    const container = document.getElementById('gamesConfig');
    
    if (selectedGames.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div style="margin-top: 30px; padding-top: 30px; border-top: 2px solid var(--border-color);">
            <h3>게임별 스토리 및 힌트 설정</h3>
            ${selectedGames.map((game, index) => {
                const gameInfo = TreasureHunt.getGameInfo(game.gameId);
                return `
                    <div class="form-group" style="background: var(--bg-light); padding: 15px; border-radius: 8px; margin-top: 15px;">
                        <h4>${index + 1}. ${gameInfo.icon} ${gameInfo.name}</h4>
                        
                        <div style="margin-top: 10px;">
                            <label>스토리 텍스트</label>
                            <textarea id="story-${index}" placeholder="이 게임 시작 전에 보여줄 스토리">${game.storyText || ''}</textarea>
                        </div>
                        
                        <div style="margin-top: 10px;">
                            <label>힌트 메시지</label>
                            <input type="text" id="hint-${index}" placeholder="다음 보물 위치 힌트" value="${game.hintMessage || ''}">
                        </div>
                        
                        <div style="margin-top: 10px;">
                            <label>비밀번호/코드</label>
                            <input type="text" id="code-${index}" placeholder="게임 완료 시 보여줄 코드" value="${game.secretCode || ''}">
                        </div>
                        
                        <div style="margin-top: 10px;">
                            <label>성공 메시지</label>
                            <input type="text" id="success-${index}" placeholder="게임 클리어 메시지" value="${game.successMessage || ''}">
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ============================================
// 폼 제출
// ============================================

document.getElementById('presetForm').addEventListener('submit', (e) => {
    e.preventDefault();

    // 게임별 설정 수집
    selectedGames.forEach((game, index) => {
        game.storyText = document.getElementById(`story-${index}`)?.value || '';
        game.hintMessage = document.getElementById(`hint-${index}`)?.value || '';
        game.secretCode = document.getElementById(`code-${index}`)?.value || '';
        game.successMessage = document.getElementById(`success-${index}`)?.value || '';
    });

    const presetData = {
        name: document.getElementById('presetName').value,
        description: document.getElementById('presetDescription').value,
        theme: selectedTheme,
        games: selectedGames,
        finalReward: {
            message: document.getElementById('finalMessage').value || '축하합니다! 모든 미션을 완료했어요!',
            secretCode: document.getElementById('finalCode').value || ''
        }
    };

    if (currentEditingId) {
        // 편집
        TreasureHunt.updatePreset(currentEditingId, presetData);
        showNotification('보물찾기가 수정되었습니다!');
    } else {
        // 새로 생성
        TreasureHunt.createPreset(presetData);
        showNotification('새 보물찾기가 생성되었습니다!');
    }

    closeModal();
    renderPresets();
});

// ============================================
// 유틸리티
// ============================================

function formatDate(dateString) {
    if (!dateString) return '알 수 없음';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--success-color);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// CSS 애니메이션
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
