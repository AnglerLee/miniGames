// 단어 찾기 게임 (개선 버전)

const GAME_ID = 'game08';

// DOM 요소
const wordGrid = document.getElementById('wordGrid');
const wordsList = document.getElementById('wordsList');
// const foundCountEl = document.getElementById('foundCount'); // UI 제거됨
const timerEl = document.getElementById('timer');
// const hintsLeftEl = document.getElementById('hintsLeft'); // UI 제거됨
// const hintBtn = document.getElementById('hintBtn'); // UI 제거됨
const resetBtn = document.getElementById('resetBtn');
const toggleListBtn = document.getElementById('toggleListBtn');
const listContainer = document.getElementById('listContainer');

// 찾을 단어들 (테마별로 다양하게)
const wordThemes = {
    animals: ['고양이', '강아지', '토끼', '햄스터', '앵무새', '호랑이', '사자', '기린'],
    fruits: ['사과', '바나나', '포도', '딸기', '수박', '참외', '복숭아', '자두'],
    colors: ['빨강', '파랑', '노랑', '초록', '보라', '주황', '검정', '하양'],
    random: [] // 통합
};
// 랜덤 테마 생성
Object.values(wordThemes).forEach(arr => {
    if (arr !== wordThemes.random) wordThemes.random.push(...arr);
});

// 게임 상태 변수
let currentWords = [];
let grid = [];
let foundWords = [];
let isSelecting = false;
let selectedCells = [];
let hintsLeft = 3;
let timer = null; // createTimer 객체
let gameStarted = false;
let currentConfig = {};
let currentGridSize = 8;
let retryCount = 0;

// 설정 로드
function loadConfig() {
    const savedConfig = getGameConfig(GAME_ID);
    currentConfig = {
        gridSize: parseInt(savedConfig.gridSize) || 8,
        timeLimit: parseInt(savedConfig.timeLimit) || 180,
        theme: savedConfig.theme || 'random',
        difficulty: savedConfig.difficulty || 'normal',
        ...savedConfig
    };
    currentGridSize = currentConfig.gridSize;
}

// 게임 초기화
function initGame() {
    loadConfig();

    // 격자 스타일 업데이트
    wordGrid.style.gridTemplateColumns = `repeat(${currentGridSize}, 1fr)`;

    showInstructions(
        '🔤 단어 찾기',
        [
            `제한 시간은 ${currentConfig.timeLimit}초 입니다.`,
            '가로, 세로 방향으로 숨겨진 단어를 모두 찾으세요.',
            '드래그하거나 터치하여 단어를 선택할 수 있어요.',
            '모든 단어를 찾으면 성공!'
        ],
        () => startGame(false)
    );
}

// 게임 시작
function startGame(isRetry = false) {
    gameStarted = true;
    foundWords = [];
    hintsLeft = 3;
    selectedCells = [];

    // 재시도가 아니면 테마 및 단어 재설정
    if (!isRetry) {
        retryCount = 0;
        selectWordsForGame();
        createGrid();
        placeWords();
        fillEmptySpaces();
    }

    // UI 초기화
    renderGrid();
    renderWordsList();
    updateStats();
    // hintBtn.disabled = false; // UI 제거됨

    // 타이머 시작
    if (timer) timer.stop();

    let duration = currentConfig.timeLimit;
    if (isRetry) {
        duration += (retryCount * 30); // 재시도 시 30초씩 추가
    }

    timerEl.textContent = formatTime(duration);

    timer = createTimer(
        duration,
        (timeLeft) => {
            timerEl.textContent = formatTime(timeLeft);
            if (timeLeft <= 10) {
                timerEl.style.color = 'var(--danger-color)';
            } else {
                timerEl.style.color = '';
            }
        },
        () => {
            handleTimeOut();
        }
    );
}

// 단어 선택
function selectWordsForGame() {
    let themeWords = wordThemes[currentConfig.theme] || wordThemes.random;

    // 격자 크기에 따라 단어 수 조절 (예: 격자 크기 - 2 ~ 격자 크기)
    const wordCount = Math.max(3, currentGridSize - randomInt(1, 3));

    // 셔플 후 선택
    currentWords = shuffleArray(themeWords).slice(0, wordCount);
}

// 격자 생성
function createGrid() {
    grid = [];
    for (let i = 0; i < currentGridSize; i++) {
        grid[i] = [];
        for (let j = 0; j < currentGridSize; j++) {
            grid[i][j] = { letter: '', wordId: -1 };
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

            // 격자 범위 내에서 랜덤 위치
            const maxRow = direction === 'horizontal' ? currentGridSize - 1 : currentGridSize - word.length;
            const maxCol = direction === 'horizontal' ? currentGridSize - word.length : currentGridSize - 1;

            if (maxRow < 0 || maxCol < 0) { // 단어가 격자보다 긴 경우
                attempts++;
                continue;
            }

            const row = randomInt(0, maxRow);
            const col = randomInt(0, maxCol);

            // 배치 가능 여부 확인
            let canPlace = true;
            for (let i = 0; i < word.length; i++) {
                const r = direction === 'horizontal' ? row : row + i;
                const c = direction === 'horizontal' ? col + i : col;

                if (grid[r][c].letter !== '' && grid[r][c].letter !== word[i]) {
                    canPlace = false;
                    break;
                }
            }

            // 배치
            if (canPlace) {
                for (let i = 0; i < word.length; i++) {
                    const r = direction === 'horizontal' ? row : row + i;
                    const c = direction === 'horizontal' ? col + i : col;
                    grid[r][c] = {
                        letter: word[i],
                        wordId: wordId
                    };
                }
                placed = true;
            }
            attempts++;
        }
    });
}

// 빈 공간 채우기
function fillEmptySpaces() {
    const hangul = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅓㅗㅜㅡㅣ';
    for (let i = 0; i < currentGridSize; i++) {
        for (let j = 0; j < currentGridSize; j++) {
            if (grid[i][j].letter === '') {
                grid[i][j].letter = hangul[randomInt(0, hangul.length - 1)];
            }
        }
    }
}

// 격자 렌더링
function renderGrid() {
    wordGrid.innerHTML = '';

    // 격자 크기에 맞춰 폰트 사이즈 조절 (격자가 클수록 글자 작게)
    const fontSize = currentGridSize > 10 ? '14px' : (currentGridSize > 8 ? '16px' : '18px');

    for (let i = 0; i < currentGridSize; i++) {
        for (let j = 0; j < currentGridSize; j++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.textContent = grid[i][j].letter;
            cell.dataset.row = i;
            cell.dataset.col = j;
            cell.style.fontSize = fontSize;

            if (grid[i][j].wordId !== -1 && foundWords.includes(grid[i][j].wordId)) {
                cell.classList.add('found');
            }

            // 이벤트 리스너 통합 function
            cell.addEventListener('mousedown', startSelection);
            cell.addEventListener('mouseenter', continueSelection);
            // 터치 이벤트는 별도 처리
            cell.addEventListener('touchstart', handleTouchStart, { passive: false });

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
    // UI 제거로 인해 기능 비활성화
    // foundCountEl.textContent = `${foundWords.length}/${currentWords.length}`;
    // hintsLeftEl.textContent = hintsLeft;
}

// 선택 시작
function startSelection(e) {
    if (!gameStarted) return;

    isSelecting = true;
    selectedCells = [];
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;

    selectCell(parseInt(cell.dataset.row), parseInt(cell.dataset.col));
}

// 선택 셀 추가
function selectCell(row, col) {
    const cellEl = getCellElement(row, col);
    if (!cellEl) return;

    // 이미 선택된 셀인지 확인 (드래그 방향 처리 등을 위해 단순 중복체크만)
    if (!selectedCells.some(c => c.row === row && c.col === col)) {
        selectedCells.push({ row, col });
        cellEl.classList.add('selected');

        // 소리 효과 (아주 짧게)
        // playSound('click');
    }
}

// DOM 요소 가져오기
function getCellElement(row, col) {
    return wordGrid.children[row * currentGridSize + col];
}

// 선택 계속
function continueSelection(e) {
    if (!isSelecting || !gameStarted) return;
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;

    selectCell(parseInt(cell.dataset.row), parseInt(cell.dataset.col));
}

// 터치 시작
function handleTouchStart(e) {
    e.preventDefault();
    if (!gameStarted) return;
    startSelection({ target: e.target });
}

// 터치 이동 (전역 이벤트로 처리)
function handleTouchMove(e) {
    if (!isSelecting || !gameStarted) return;
    e.preventDefault();

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    if (element && element.classList.contains('grid-cell')) {
        continueSelection({ target: element });
    }
}

// 선택 종료 및 확인
function endSelection() {
    if (!isSelecting) return;
    isSelecting = false;

    checkWord();

    // 선택 해제 UI
    const cells = wordGrid.children;
    for (let cell of cells) {
        cell.classList.remove('selected');
    }
    selectedCells = [];
}

// 단어 확인 로직
function checkWord() {
    if (selectedCells.length < 2) return;

    // 선택된 셀들이 직선인지 확인하는 로직이 있으면 좋지만, 간단하게 문자열 조합으로 확인
    // 정확도를 높이려면 행/열/대각선 일치 여부 확인 필요.
    // 여기서는 사용성 편의를 위해 순서대로 연결된 문자열만 확인.

    const selectedWord = selectedCells.map(cell => grid[cell.row][cell.col].letter).join('');

    // 정방향 또는 역방향 매칭
    const foundIndex = currentWords.findIndex((word, index) => {
        if (foundWords.includes(index)) return false;
        return word === selectedWord || word === selectedWord.split('').reverse().join('');
    });

    if (foundIndex !== -1) {
        foundWords.push(foundIndex);
        playSound('success');
        if (navigator.vibrate) navigator.vibrate(100);

        // 해당 단어 위치 영구 표시 (선택된 셀들)
        selectedCells.forEach(pos => {
            // 정확히 해당 단어의 위치인지 확인 (중복 글자 문제 방지)
            // 간단하게 이번에 선택한 셀들을 하이라이트 유지하는 것으로 처리
            // 하지만 원래 grid 정보에 wordId가 있으므로 그걸 쓰는게 더 정확함
            const gridInfo = grid[pos.row][pos.col];
            if (gridInfo.wordId === foundIndex) {
                // OK
            }
        });

        renderGrid(); // 다시 그리면 found 클래스가 적용됨
        renderWordsList();
        updateStats();

        // 게임 클리어 체크
        if (foundWords.length === currentWords.length) {
            gameSuccess();
        }
    } else {
        // 실패 시 피드백 없음 (그냥 선택 해제)
        // playSound('fail'); 
    }
}

// 시간 초과 처리
function handleTimeOut() {
    gameStarted = false;
    playSound('fail');

    // 실패 모달 (재시도 버튼 포함)
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content fail-screen fade-in">
            <div class="icon" style="font-size: 60px;">⏰</div>
            <h2>시간 초과!</h2>
            <p>아쉽네요! 단어를 다 찾지 못했어요.</p>
            <p>조금 더 시간을 드릴까요?</p>
            
            <button class="btn btn-primary" id="retryBtn">
                네, (+30초) 계속할래요!
            </button>
            <button class="btn btn-secondary" onclick="location.reload()">
                다시 시작하기
            </button>
            <button class="btn btn-home" onclick="location.href='../../index.html'">
                그만하기
            </button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('retryBtn').addEventListener('click', () => {
        modal.remove();
        retryCount++;
        startGame(true); // 재시도 모드 (기존 격자 유지, 시간 추가)
    });
}

// 게임 성공 처리
function gameSuccess() {
    gameStarted = false;
    if (timer) timer.stop();

    // 점수 저장 (소요 시간 등) - 여기선 생략

    showSuccessScreen(GAME_ID);
}

// 힌트 보기
function showHint() {
    if (hintsLeft <= 0 || !gameStarted) return;

    hintsLeft--;
    updateStats();
    if (hintsLeft === 0) hintBtn.disabled = true;

    // 못 찾은 단어 중 하나
    const unfoundIndices = currentWords.map((_, i) => i).filter(i => !foundWords.includes(i));
    if (unfoundIndices.length === 0) return;

    const targetIdx = unfoundIndices[Math.floor(Math.random() * unfoundIndices.length)];

    // 해당 단어의 첫 글자 위치 찾기
    let targetCell = null;
    for (let r = 0; r < currentGridSize; r++) {
        for (let c = 0; c < currentGridSize; c++) {
            if (grid[r][c].wordId === targetIdx) {
                targetCell = { r, c };
                break;
            }
        }
        if (targetCell) break;
    }

    if (targetCell) {
        const cellEl = getCellElement(targetCell.r, targetCell.c);
        if (cellEl) {
            cellEl.style.backgroundColor = '#fff68f'; // 힌트 색상
            cellEl.style.transform = 'scale(1.2)';
            setTimeout(() => {
                if (!cellEl.classList.contains('found')) {
                    cellEl.style.backgroundColor = '';
                    cellEl.style.transform = '';
                }
            }, 1000);
        }
    }
}

// 리셋 버튼
resetBtn.addEventListener('click', () => {
    if (confirm('게임을 처음부터 다시 시작할까요?')) {
        startGame(false);
    }
});

// 힌트 버튼
// hintBtn.addEventListener('click', showHint); // 버튼 제거됨

// 단어 목록 토글
toggleListBtn.addEventListener('click', () => {
    const isExpanded = listContainer.classList.contains('expanded');
    if (isExpanded) {
        listContainer.classList.remove('expanded');
        toggleListBtn.textContent = '📋 찾을 단어 목록 보기 (▼)';
    } else {
        listContainer.classList.add('expanded');
        toggleListBtn.textContent = '📋 찾을 단어 목록 접기 (▲)';
    }
});

// 전역 이벤트 (마우스/터치 업, 무브)
document.addEventListener('mouseup', endSelection);
document.addEventListener('touchend', endSelection);
document.addEventListener('touchmove', handleTouchMove, { passive: false });

// 게임 시작
initGame();
