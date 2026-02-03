// 관리자 페이지 스크립트

const gamesSettings = document.getElementById('gamesSettings');
const saveAllBtn = document.getElementById('saveAllBtn');
const resetAllBtn = document.getElementById('resetAllBtn');

// 게임 정보
const games = [
    { id: 'game02', name: '미로 탈출', icon: '🌀', path: 'games/02-maze' },
    { id: 'game03', name: '짝 맞추기', icon: '🃏', path: 'games/03-card-match' },
    { id: 'game05', name: '숫자 퍼즐', icon: '🔢', path: 'games/05-sliding-puzzle' },
    { id: 'game07', name: '빠른 계산', icon: '➕', path: 'games/07-math-race' },
    { id: 'game08', name: '단어 찾기', icon: '🔤', path: 'games/08-word-search' },
    { id: 'game11', name: '순서대로 터치하기', icon: '🔢', path: 'games/11-sequence-tap' },
    { id: 'game12', name: '색깔 스피드', icon: '🌈', path: 'games/12-color-rush' },
    { id: 'game13', name: '에너지 충전', icon: '⚡', path: 'games/13-energy-charge' },

    { id: 'game15', name: '데시벨 측정기', icon: '🔊', path: 'games/15-decibel-meter' },
    { id: 'game16', name: '매직 컴퍼스', icon: '🧭', path: 'games/16-magic-compass' },
    { id: 'game17', name: '바코드 스캐너', icon: '📱', path: 'games/17-barcode-scanner' },
    { id: 'game18', name: '컬러 헌터', icon: '🎨', path: 'games/18-color-hunter' },
    { id: 'game19', name: '리버스 오디오', icon: '🔄', path: 'games/19-reverse-audio' },
    { id: 'game20', name: '이모지 넌센스', icon: '🤔', path: 'games/20-emoji-quiz' },
    { id: 'game21', name: '동시 터치 협동', icon: '🤝', path: 'games/21-dual-touch' },
    { id: 'game22', name: '와이파이 해커', icon: '📡', path: 'games/22-wifi-hacker' },
    { id: 'game23', name: '디지털 금고 털이', icon: '🔓', path: 'games/23-safe-cracker' },
    { id: 'game24', name: '폭탄 해체', icon: '💣', path: 'games/24-bomb-balance' },
    { id: 'game25', name: '복권 긁기', icon: '🎫', path: 'games/25-scratch-card' },
    { id: 'game27', name: '절대음감 스톱워치', icon: '⏱️', path: 'games/27-stopwatch' },
];

// 저장된 설정 로드
function loadConfigs() {
    try {
        const configStr = localStorage.getItem('treasureHunt_gameConfigs');
        return configStr ? JSON.parse(configStr) : {};
    } catch (e) {
        console.error('설정 로드 오류:', e);
        return {};
    }
}

// 설정 저장
function saveConfigs(configs) {
    try {
        localStorage.setItem('treasureHunt_gameConfigs', JSON.stringify(configs));
        return true;
    } catch (e) {
        console.error('설정 저장 오류:', e);
        alert('저장에 실패했습니다: ' + e.message);
        return false;
    }
}

// 게임 카드 렌더링
function renderGameCards() {
    const configs = loadConfigs();
    gamesSettings.innerHTML = '';

    games.forEach(game => {
        const config = configs[game.id] || {
            secretCode: '',
            hintMessage: '',
            successMessage: '축하합니다! 게임을 클리어했어요!',
            isActive: true
        };

        const hasConfig = config.secretCode || config.hintMessage;

        const card = document.createElement('div');
        card.className = 'game-card';
        card.innerHTML = `
            <div class="game-card-header">
                <div class="game-title-section">
                    <div class="game-icon">${game.icon}</div>
                    <div class="game-title-text">
                        <h3>${game.name}</h3>
                        <p>${game.path}</p>
                    </div>
                </div>
                <div class="game-status">
                    <span class="status-badge ${hasConfig ? 'active' : 'empty'}">
                        ${hasConfig ? '✓ 설정됨' : '○ 미설정'}
                    </span>
                </div>
            </div>
            
            <div class="form-group">
                <label for="${game.id}-code">🔑 비밀번호/숫자 코드</label>
                <input 
                    type="text" 
                    id="${game.id}-code" 
                    placeholder="예: 1234, 소파뒤, 빨간상자"
                    value="${config.secretCode}"
                    maxlength="50"
                >
                <div class="hint">클리어 시 보여줄 비밀번호나 숫자</div>
            </div>
            
            <div class="form-group">
                <label for="${game.id}-hint">💡 힌트 메시지</label>
                <textarea 
                    id="${game.id}-hint" 
                    placeholder="예: 거실 소파 뒤를 찾아봐!"
                >${config.hintMessage}</textarea>
                <div class="hint">다음 보물 위치를 알려주는 힌트</div>
            </div>
            
            <div class="form-group">
                <label for="${game.id}-success">🎉 성공 메시지</label>
                <input 
                    type="text" 
                    id="${game.id}-success" 
                    placeholder="예: 잘했어! 다음 미션으로 가자!"
                    value="${config.successMessage}"
                    maxlength="100"
                >
                <div class="hint">게임 클리어 시 보여줄 축하 메시지</div>
            </div>
            
            <div class="card-actions">
                <button class="btn btn-primary btn-small" onclick="saveGame('${game.id}')">
                    💾 저장
                </button>
                <button class="btn btn-secondary btn-small" onclick="clearGame('${game.id}')">
                    🗑️ 초기화
                </button>
                <button class="btn btn-secondary btn-small" onclick="testGame('${game.path}')">
                    🎮 게임 테스트
                </button>
            </div>
        `;

        gamesSettings.appendChild(card);
    });
}

// 개별 게임 저장
function saveGame(gameId) {
    const configs = loadConfigs();

    configs[gameId] = {
        secretCode: document.getElementById(`${gameId}-code`).value.trim(),
        hintMessage: document.getElementById(`${gameId}-hint`).value.trim(),
        successMessage: document.getElementById(`${gameId}-success`).value.trim() || '축하합니다! 게임을 클리어했어요!',
        isActive: true
    };

    if (saveConfigs(configs)) {
        showSaveIndicator('저장되었습니다!');
        renderGameCards(); // 상태 업데이트
    }
}

// 개별 게임 초기화
function clearGame(gameId) {
    if (confirm('이 게임의 설정을 초기화하시겠습니까?')) {
        const configs = loadConfigs();
        delete configs[gameId];

        if (saveConfigs(configs)) {
            showSaveIndicator('초기화되었습니다!');
            renderGameCards();
        }
    }
}

// 게임 테스트 (새 창에서 열기)
function testGame(gamePath) {
    window.open(gamePath + '/index.html', '_blank');
}

// 모두 저장
saveAllBtn.addEventListener('click', () => {
    const configs = loadConfigs();

    games.forEach(game => {
        configs[game.id] = {
            secretCode: document.getElementById(`${game.id}-code`).value.trim(),
            hintMessage: document.getElementById(`${game.id}-hint`).value.trim(),
            successMessage: document.getElementById(`${game.id}-success`).value.trim() || '축하합니다! 게임을 클리어했어요!',
            isActive: true
        };
    });

    if (saveConfigs(configs)) {
        showSaveIndicator('모든 설정이 저장되었습니다!');
        renderGameCards();
    }
});

// 전체 초기화
resetAllBtn.addEventListener('click', () => {
    if (confirm('정말 모든 게임의 설정을 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
        localStorage.removeItem('treasureHunt_gameConfigs');
        showSaveIndicator('전체 초기화되었습니다!');
        renderGameCards();
    }
});

// 저장 표시
function showSaveIndicator(message) {
    // 기존 표시 제거
    const existing = document.querySelector('.save-indicator');
    if (existing) {
        existing.remove();
    }

    const indicator = document.createElement('div');
    indicator.className = 'save-indicator';
    indicator.textContent = message;
    document.body.appendChild(indicator);

    setTimeout(() => {
        indicator.classList.add('show');
    }, 10);

    setTimeout(() => {
        indicator.classList.remove('show');
        setTimeout(() => {
            indicator.remove();
        }, 300);
    }, 2000);
}

// 페이지 로드 시 렌더링
renderGameCards();
