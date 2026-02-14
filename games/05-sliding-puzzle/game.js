// 숫자 퍼즐 (슬라이딩 퍼즐) 게임 (개선 버전)

const GAME_ID = 'game05';

const puzzleGrid = document.getElementById('puzzleGrid');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
// Hint Button Removed
const resetBtn = document.getElementById('resetBtn');

let gridSize = 3;
let initialTimeLimit = 120;
let currentTimeLimit = 120;
let tiles = [];
let moves = 0;
// hintsLeft Removed
let timerInterval = null;
let seconds = 0;
let gameStarted = false;
let retryCount = 0;

// 게임 초기화
function initGame() {
    loadSettings();
    currentTimeLimit = initialTimeLimit;

    showInstructions(
        '🔢 숫자 퍼즐',
        [
            '숫자를 클릭하여 빈 칸으로 이동하세요.',
            '순서대로(1, 2, 3...) 정렬하면 성공!',
            '제한 시간 안에 완료해야 합니다.',
            '실패 시 재도전하면 시간이 1초 늘어납니다.'
        ],
        startGame
    );
}

// 설정 불러오기
function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('sliding_puzzle_settings')) || { gridSize: 3, timeLimit: 120, theme: 'default' };
    gridSize = parseInt(settings.gridSize);
    initialTimeLimit = parseInt(settings.timeLimit);

    // 테마 적용
    document.body.className = ''; // 기존 테마 제거
    if (settings.theme && settings.theme !== 'default') {
        document.body.classList.add(`theme-${settings.theme}`);
    }
}

// 게임 시작
function startGame(isRetry = false) {
    gameStarted = false;
    stopTimer();

    if (!isRetry) {
        // 완전 초기화 (처음부터)
        loadSettings();
        currentTimeLimit = initialTimeLimit;
        retryCount = 0;
    }

    moves = 0;
    seconds = currentTimeLimit;
    // hintsLeft Removed

    updateTimerDisplay();
    updateStats();

    // 그리드 스타일 적용 (CSS Grid 반복 설정)
    puzzleGrid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;

    // 타일 생성 및 섞기
    initTiles();

    // hintBtn logic removed

    // 타일 클릭 시 바로 시작되므로 여기선 타이머 대기
}

// 타일 초기화
function initTiles() {
    const totalTiles = gridSize * gridSize;
    tiles = Array.from({ length: totalTiles - 1 }, (_, i) => i + 1);
    tiles.push(0); // 0은 빈 칸

    renderPuzzle();
    // 섞기
    shufflePuzzle();
}

// 퍼즐 섞기 (풀 수 있는 상태 보장)
function shufflePuzzle() {
    // 랜덤한 이동을 여러 번 실행 (그리드 크기에 비례하여 더 많이 섞음)
    const shuffleCount = gridSize * gridSize * 15;

    // 섞는 동안은 애니메이션 없이 데이터만 처리
    for (let i = 0; i < shuffleCount; i++) {
        const movableTiles = getMovableTiles();
        const randomTile = movableTiles[Math.floor(Math.random() * movableTiles.length)];
        swapTiles(tiles.indexOf(0), randomTile, false);
    }
    renderPuzzle();
}


// 타이머 시작 (카운트다운)
function startTimer() {
    if (timerInterval) return;

    timerInterval = setInterval(() => {
        seconds--;
        updateTimerDisplay();

        if (seconds <= 0) {
            handleTimeOver();
        }
    }, 1000);
}

// 타이머 정지
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// 타이머 표시 업데이트
function updateTimerDisplay() {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (seconds <= 10) {
        timerEl.parentElement.style.color = 'var(--danger-color)';
    } else {
        timerEl.parentElement.style.color = 'var(--secondary-color)';
    }
}

// 시간 초과 처리
function handleTimeOver() {
    stopTimer();
    gameStarted = false;
    playSound('fail');

    showConfirmModal(
        '시간 초과! 😓',
        '시간이 다 되었습니다. 1초 더 긴 시간으로 재도전 하시겠습니까?',
        '재도전 (+1초)',
        '홈으로',
        () => retryGame(),
        () => location.href = '../../index.html'
    );
}

// 재도전 (시간 1초 추가)
function retryGame() {
    retryCount++;
    currentTimeLimit = initialTimeLimit + retryCount; // 1초씩 증가
    startGame(true); // Retry 모드로 시작
    // 재도전 시 바로 섞고 게임 시작 (타이머는 첫 클릭시 시작? 아니면 바로 시작? -> CardMatch는 바로 시작이었음)
    // 퍼즐은 첫 클릭까지 대기하는게 관례지만, 시간 제한 모드이므로 바로 시작하는게 긴장감 있음.
    // 하지만 shuffle된 상태를 보고 생각할 시간을 주기 위해 첫 클릭 시 시작 유지.
}

// 이동 가능한 타일 찾기
function getMovableTiles() {
    const emptyIdx = tiles.indexOf(0);
    const row = Math.floor(emptyIdx / gridSize);
    const col = emptyIdx % gridSize;
    const movable = [];

    // 상하좌우
    if (row > 0) movable.push(emptyIdx - gridSize);
    if (row < gridSize - 1) movable.push(emptyIdx + gridSize);
    if (col > 0) movable.push(emptyIdx - 1);
    if (col < gridSize - 1) movable.push(emptyIdx + 1);

    return movable;
}

// 퍼즐 렌더링
function renderPuzzle(highlightMovable = false) {
    puzzleGrid.innerHTML = '';
    const movableTiles = getMovableTiles();

    tiles.forEach((value, index) => {
        const tile = document.createElement('button');
        tile.className = 'puzzle-tile';

        if (value === 0) {
            tile.classList.add('empty');
        } else {
            tile.textContent = value;

            // 타일 크기/폰트 조절 (그리드 크기에 따라)
            if (gridSize >= 5) tile.style.fontSize = '1.5rem';
            if (gridSize >= 6) tile.style.fontSize = '1.2rem';

            if (highlightMovable && movableTiles.includes(index)) {
                tile.classList.add('movable');
            }

            tile.addEventListener('click', () => handleTileClick(index));
        }

        puzzleGrid.appendChild(tile);
    });
}

// 타일 클릭 처리
function handleTileClick(index) {
    if (!gameStarted) {
        // 첫 클릭 시 게임 시작 및 타이머 가동
        gameStarted = true;
        startTimer();
    }

    const emptyIdx = tiles.indexOf(0);
    const movableTiles = getMovableTiles();

    if (movableTiles.includes(index)) {
        swapTiles(emptyIdx, index, true);
        renderPuzzle();

        // 완성 확인
        if (checkWin()) {
            setTimeout(gameComplete, 300);
        }
    } else {
        if (navigator.vibrate) navigator.vibrate(50);
    }
}

// 타일 교환
function swapTiles(idx1, idx2, countMove) {
    [tiles[idx1], tiles[idx2]] = [tiles[idx2], tiles[idx1]];

    if (countMove) {
        moves++;
        updateStats();
        playSound('click');
    }
}

// 완성 확인
function checkWin() {
    const totalTiles = gridSize * gridSize;
    for (let i = 0; i < totalTiles - 1; i++) {
        if (tiles[i] !== i + 1) {
            return false;
        }
    }
    return tiles[totalTiles - 1] === 0;
}

// 힌트 기능 삭제됨 (showHint function removed)

// 통계 업데이트
function updateStats() {
    movesEl.textContent = moves;
}

// 게임 완료
function gameComplete() {
    gameStarted = false;
    stopTimer();

    playSound('success');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);

    // showSuccessScreen(GAME_ID);
    window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
}

// 커스텀 확인 모달
function showConfirmModal(title, message, confirmText, cancelText, onConfirm, onCancel) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content fade-in">
            <h2>${title}</h2>
            <p>${message}</p>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                <button class="btn btn-secondary" id="modalCancelBtn">${cancelText}</button>
                <button class="btn btn-primary" id="modalConfirmBtn">${confirmText}</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('modalConfirmBtn').addEventListener('click', () => {
        modal.remove();
        if (onConfirm) onConfirm();
    });

    document.getElementById('modalCancelBtn').addEventListener('click', () => {
        modal.remove();
        if (onCancel) onCancel();
    });
}


// 리셋(재도전) 버튼
resetBtn.addEventListener('click', () => {
    showConfirmModal(
        '재도전 확인',
        '현재 게임을 중단하고 처음부터 다시 시작하시겠습니까?',
        '예',
        '아니오',
        () => startGame(false),
        null
    );
});

// hintBtn listener removed

initGame();
