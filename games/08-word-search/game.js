// 단어 찾기 게임 (개선 버전)

const GAME_ID = 'game08';
const GRID_SIZE = 8;

const wordGrid = document.getElementById('wordGrid');
const wordsList = document.getElementById('wordsList');
const foundCountEl = document.getElementById('foundCount');
const timerEl = document.getElementById('timer');
const hintsLeftEl = document.getElementById('hintsLeft');
const hintBtn = document.getElementById('hintBtn');
const resetBtn = document.getElementById('resetBtn');

// 찾을 단어들 (테마별로 다양하게)
const wordThemes = {
    animals: ['고양이', '강아지', '토끼', '햄스터', '앵무새'],
    fruits: ['사과', '바나나', '포도', '딸기', '수박'],
    colors: ['빨강', '파랑', '노랑', '초록', '보라']
};

let currentWords = [];
let grid = [];
let foundWords = [];
let isSelecting = false;
let selectedCells = [];
let hintsLeft = 3;
let timerInterval = null;
let seconds = 0;
let gameStarted = false;

// 게임 초기화
function initGame() {
    showInstructions(
        '🔤 단어 찾기',
        [
            '격자에서 숨겨진 단어를 찾으세요',
            '단어는 가로 또는 세로로 배치되어 있어요',
            '드래그하거나 클릭해서 단어를 선택하세요',
            '모든 단어를 찾으면 클리어!'
        ],
        startGame
    );
}

// 게임 시작
function startGame() {
    gameStarted = false;
    stopTimer();
    
    foundWords = [];
    hintsLeft = 3;
    seconds = 0;
    
    // 랜덤 테마 선택
    const themes = Object.keys(wordThemes);
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    currentWords = wordThemes[randomTheme];
    
    createGrid();
    placeWords();
    fillEmptySpaces();
    renderGrid();
    renderWordsList();
    updateStats();
    
    hintBtn.disabled = false;
}

// 타이머 시작
function startTimer() {
    if (timerInterval) return;
    
    timerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

// 타이머 정지
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// 격자 생성
function createGrid() {
    grid = [];
    for (let i = 0; i < GRID_SIZE; i++) {
        grid[i] = [];
        for (let j = 0; j < GRID_SIZE; j++) {
            grid[i][j] = { letter: '', wordId: -1, positions: [] };
        }
    }
}

// 단어 배치
function placeWords() {
    currentWords.forEach((word, wordId) => {
        let placed = false;
        let attempts = 0;
        
        while (!placed && attempts < 100) {
            const direction = Math.random() > 0.5 ? 'horizontal' : 'vertical';
            
            if (direction === 'horizontal') {
                const row = randomInt(0, GRID_SIZE - 1);
                const col = randomInt(0, GRID_SIZE - word.length);
                
                // 배치 가능한지 확인
                let canPlace = true;
                for (let i = 0; i < word.length; i++) {
                    if (grid[row][col + i].letter !== '' && grid[row][col + i].letter !== word[i]) {
                        canPlace = false;
                        break;
                    }
                }
                
                if (canPlace) {
                    for (let i = 0; i < word.length; i++) {
                        grid[row][col + i] = { 
                            letter: word[i], 
                            wordId: wordId,
                            positions: [{ row, col: col + i }]
                        };
                    }
                    placed = true;
                }
            } else {
                const row = randomInt(0, GRID_SIZE - word.length);
                const col = randomInt(0, GRID_SIZE - 1);
                
                let canPlace = true;
                for (let i = 0; i < word.length; i++) {
                    if (grid[row + i][col].letter !== '' && grid[row + i][col].letter !== word[i]) {
                        canPlace = false;
                        break;
                    }
                }
                
                if (canPlace) {
                    for (let i = 0; i < word.length; i++) {
                        grid[row + i][col] = { 
                            letter: word[i], 
                            wordId: wordId,
                            positions: [{ row: row + i, col }]
                        };
                    }
                    placed = true;
                }
            }
            
            attempts++;
        }
    });
}

// 빈 공간 채우기
function fillEmptySpaces() {
    const hangul = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅓㅗㅜㅡㅣ';
    
    for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
            if (grid[i][j].letter === '') {
                grid[i][j].letter = hangul[randomInt(0, hangul.length - 1)];
            }
        }
    }
}

// 격자 렌더링
function renderGrid() {
    wordGrid.innerHTML = '';
    
    for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.textContent = grid[i][j].letter;
            cell.dataset.row = i;
            cell.dataset.col = j;
            
            // 이미 찾은 단어면 표시
            if (grid[i][j].wordId !== -1 && foundWords.includes(grid[i][j].wordId)) {
                cell.classList.add('found');
            }
            
            // 이벤트 리스너
            cell.addEventListener('mousedown', startSelection);
            cell.addEventListener('mouseenter', continueSelection);
            cell.addEventListener('mouseup', endSelection);
            cell.addEventListener('touchstart', handleTouchStart);
            cell.addEventListener('touchmove', handleTouchMove);
            cell.addEventListener('touchend', endSelection);
            
            wordGrid.appendChild(cell);
        }
    }
}

// 단어 목록 렌더링
function renderWordsList() {
    wordsList.innerHTML = '';
    
    currentWords.forEach((word, index) => {
        const wordItem = document.createElement('div');
        wordItem.className = 'word-item';
        wordItem.textContent = word;
        
        if (foundWords.includes(index)) {
            wordItem.classList.add('found');
        }
        
        wordsList.appendChild(wordItem);
    });
}

// 통계 업데이트
function updateStats() {
    foundCountEl.textContent = `${foundWords.length}/${currentWords.length}`;
    hintsLeftEl.textContent = hintsLeft;
}

// 선택 시작
function startSelection(e) {
    if (!gameStarted) {
        gameStarted = true;
        startTimer();
    }
    
    isSelecting = true;
    selectedCells = [];
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    selectedCells.push({ row, col });
    e.target.classList.add('selected');
}

// 선택 계속
function continueSelection(e) {
    if (!isSelecting) return;
    
    const row = parseInt(e.target.dataset.row);
    const col = parseInt(e.target.dataset.col);
    
    if (!selectedCells.some(cell => cell.row === row && cell.col === col)) {
        selectedCells.push({ row, col });
        e.target.classList.add('selected');
    }
}

// 터치 처리
function handleTouchStart(e) {
    e.preventDefault();
    startSelection({ target: e.target });
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element && element.classList.contains('grid-cell')) {
        continueSelection({ target: element });
    }
}

// 선택 종료
function endSelection() {
    if (!isSelecting) return;
    
    isSelecting = false;
    checkWord();
    
    // 선택 해제
    document.querySelectorAll('.grid-cell.selected').forEach(cell => {
        cell.classList.remove('selected');
    });
    
    selectedCells = [];
}

// 단어 확인
function checkWord() {
    if (selectedCells.length < 2) return;
    
    // 선택한 글자들로 단어 만들기
    const selectedWord = selectedCells.map(cell => grid[cell.row][cell.col].letter).join('');
    
    // 단어 매칭 확인
    currentWords.forEach((word, wordId) => {
        if (!foundWords.includes(wordId)) {
            if (selectedWord === word || selectedWord === word.split('').reverse().join('')) {
                foundWords.push(wordId);
                playSound('success');
                
                if (navigator.vibrate) {
                    navigator.vibrate(100);
                }
                
                renderGrid();
                renderWordsList();
                updateStats();
                
                // 모든 단어 찾았는지 확인
                if (foundWords.length === currentWords.length) {
                    setTimeout(() => {
                        gameComplete();
                    }, 500);
                }
            }
        }
    });
}

// 힌트 기능
function showHint() {
    if (hintsLeft <= 0 || !gameStarted) return;
    
    hintsLeft--;
    updateStats();
    
    if (hintsLeft === 0) {
        hintBtn.disabled = true;
    }
    
    // 아직 찾지 못한 단어 중 하나의 첫 글자 위치 강조
    const unfoundWordIds = currentWords
        .map((_, idx) => idx)
        .filter(id => !foundWords.includes(id));
    
    if (unfoundWordIds.length === 0) return;
    
    const randomWordId = unfoundWordIds[Math.floor(Math.random() * unfoundWordIds.length)];
    
    // 해당 단어의 셀들을 잠깐 강조
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        if (grid[row][col].wordId === randomWordId) {
            cell.style.background = 'rgba(255, 193, 7, 0.5)';
            setTimeout(() => {
                if (!foundWords.includes(randomWordId)) {
                    cell.style.background = '';
                }
            }, 2000);
        }
    });
}

// 게임 완료
function gameComplete() {
    gameStarted = false;
    stopTimer();
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${mins}분 ${secs}초`;
    
    playSound('success');
    
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
    }
    
    setTimeout(() => {
        alert(`축하합니다!\n소요 시간: ${timeStr}`);
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

// 마우스 이벤트 리스너
document.addEventListener('mouseup', endSelection);

// 게임 시작
initGame();
