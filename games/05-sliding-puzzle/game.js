// 숫자 퍼즐 (슬라이딩 퍼즐) 게임 (개선 버전)

const GAME_ID = 'game05';

const puzzleGrid = document.getElementById('puzzleGrid');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const bestRecordEl = document.getElementById('bestRecord');
const bestRecordTextEl = document.getElementById('bestRecordText');
const hintBtn = document.getElementById('hintBtn');
const resetBtn = document.getElementById('resetBtn');
const sizeSelector = document.getElementById('sizeSelector');

let gridSize = 3;
let tiles = [];
let moves = 0;
let hintsLeft = 3;
let timerInterval = null;
let seconds = 0;
let gameStarted = false;

// 게임 초기화
function initGame() {
    showInstructions(
        '🔢 숫자 퍼즐',
        [
            '숫자를 클릭하여 빈 칸으로 이동하세요',
            '순서대로 정렬하면 클리어!',
            '빈 칸과 인접한 숫자만 이동할 수 있어요',
            '3×3 또는 4×4 크기를 선택할 수 있어요'
        ],
        setupGame
    );
}

// 게임 설정
function setupGame() {
    setupSizeButtons();
    loadBestRecord();
    startGame();
}

// 크기 버튼 설정
function setupSizeButtons() {
    const buttons = sizeSelector.querySelectorAll('.size-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (gameStarted) {
                if (!confirm('게임을 다시 시작하시겠습니까?')) {
                    return;
                }
            }
            
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gridSize = parseInt(btn.dataset.size);
            startGame();
        });
    });
}

// 게임 시작
function startGame() {
    gameStarted = false;
    stopTimer();
    
    moves = 0;
    seconds = 0;
    hintsLeft = 3;
    
    // 그리드 클래스 변경
    puzzleGrid.className = `puzzle-grid size-${gridSize}`;
    
    // 퍼즐 초기화
    const totalTiles = gridSize * gridSize;
    tiles = Array.from({ length: totalTiles - 1 }, (_, i) => i + 1);
    tiles.push(0); // 0은 빈 칸
    
    // 풀 수 있는 상태로 섞기
    shufflePuzzle();
    
    updateStats();
    loadBestRecord();
    renderPuzzle();
    
    hintBtn.disabled = false;
    hintBtn.textContent = `💡 힌트 (${hintsLeft})`;
}

// 타이머 시작
function startTimer() {
    if (timerInterval) return;
    
    timerInterval = setInterval(() => {
        seconds++;
        updateTimerDisplay();
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
}

// 퍼즐 섞기 (풀 수 있는 상태 보장)
function shufflePuzzle() {
    // 랜덤한 이동을 여러 번 실행
    const shuffleCount = gridSize === 3 ? 100 : 200;
    
    for (let i = 0; i < shuffleCount; i++) {
        const movableTiles = getMovableTiles();
        const randomTile = movableTiles[Math.floor(Math.random() * movableTiles.length)];
        swapTiles(tiles.indexOf(0), randomTile, false);
    }
}

// 이동 가능한 타일 찾기
function getMovableTiles() {
    const emptyIdx = tiles.indexOf(0);
    const row = Math.floor(emptyIdx / gridSize);
    const col = emptyIdx % gridSize;
    const movable = [];
    
    // 상
    if (row > 0) movable.push(emptyIdx - gridSize);
    // 하
    if (row < gridSize - 1) movable.push(emptyIdx + gridSize);
    // 좌
    if (col > 0) movable.push(emptyIdx - 1);
    // 우
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
    const emptyIdx = tiles.indexOf(0);
    
    // 이동 가능한지 확인
    const movableTiles = getMovableTiles();
    
    if (movableTiles.includes(index)) {
        // 첫 이동 시 타이머 시작
        if (!gameStarted) {
            gameStarted = true;
            startTimer();
        }
        
        swapTiles(emptyIdx, index, true);
        renderPuzzle();
        
        // 완성 확인
        if (checkWin()) {
            setTimeout(() => {
                gameComplete();
            }, 300);
        }
    } else {
        // 이동 불가능한 타일 클릭 시 피드백
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
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

// 힌트 기능
function showHint() {
    if (hintsLeft <= 0 || !gameStarted) return;
    
    hintsLeft--;
    hintBtn.textContent = `💡 힌트 (${hintsLeft})`;
    if (hintsLeft === 0) {
        hintBtn.disabled = true;
    }
    
    // 이동 가능한 타일 강조 표시
    renderPuzzle(true);
    
    setTimeout(() => {
        renderPuzzle(false);
    }, 2000);
}

// 통계 업데이트
function updateStats() {
    movesEl.textContent = moves;
}

// 최고 기록 불러오기
function loadBestRecord() {
    const recordKey = `sliding_puzzle_best_${gridSize}x${gridSize}`;
    const bestTime = localStorage.getItem(recordKey);
    const bestMoves = localStorage.getItem(`${recordKey}_moves`);
    
    if (bestTime && bestMoves) {
        const mins = Math.floor(bestTime / 60);
        const secs = bestTime % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        bestRecordEl.textContent = bestMoves;
        bestRecordTextEl.innerHTML = `최고 기록: <strong>${timeStr}</strong> (${bestMoves}번 이동)`;
    } else {
        bestRecordEl.textContent = '-';
        bestRecordTextEl.textContent = '최고 기록이 없습니다';
    }
}

// 최고 기록 저장
function saveBestRecord() {
    const recordKey = `sliding_puzzle_best_${gridSize}x${gridSize}`;
    const bestTime = localStorage.getItem(recordKey);
    const bestMoves = localStorage.getItem(`${recordKey}_moves`);
    
    let isNewRecord = false;
    
    if (!bestMoves || moves < parseInt(bestMoves)) {
        localStorage.setItem(recordKey, seconds);
        localStorage.setItem(`${recordKey}_moves`, moves);
        isNewRecord = true;
    } else if (moves === parseInt(bestMoves) && (!bestTime || seconds < parseInt(bestTime))) {
        localStorage.setItem(recordKey, seconds);
        isNewRecord = true;
    }
    
    return isNewRecord;
}

// 게임 완료
function gameComplete() {
    gameStarted = false;
    stopTimer();
    
    const isNewRecord = saveBestRecord();
    
    const totalTiles = gridSize * gridSize - 1;
    const performance = moves <= totalTiles * 2 ? '완벽해요!' : 
                       moves <= totalTiles * 3 ? '잘했어요!' : 
                       '성공!';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${mins}분 ${secs}초`;
    
    playSound('success');
    
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
    }
    
    setTimeout(() => {
        alert(`${performance}\n소요 시간: ${timeStr}\n이동 횟수: ${moves}번${isNewRecord ? '\n🎉 신기록 달성!' : ''}`);
        showSuccessScreen(GAME_ID);
    }, 500);
}

// 리셋 버튼
resetBtn.addEventListener('click', () => {
    if (gameStarted && !confirm('게임을 다시 시작하시겠습니까?')) {
        return;
    }
    startGame();
});

// 힌트 버튼
hintBtn.addEventListener('click', showHint);

// 게임 시작
initGame();
