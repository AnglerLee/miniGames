// 미로 탈출 게임 (개선 버전)

const GAME_ID = 'game02';

const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');
const messageEl = document.getElementById('message');
const movesEl = document.getElementById('moves');
const retryInfoEl = document.getElementById('retryInfo');
const timerValueEl = document.getElementById('timerValue');
const timerBoxEl = document.getElementById('timerBox');
const resetBtn = document.getElementById('resetBtn');
const diffModal = document.getElementById('diffModal');

// 게임 설정
let CELL_SIZE = 40;
let COLS = 10;
let ROWS = 10;
const ANIMATION_SPEED = 0.35;

// 게임 상태
let currentDifficulty = 'easy';
let mazeData = null; // maps.json 데이터
let maze = null;
let timeLimit = 30; // 현재 레벨의 제한 시간
let currentTime = 0; // 남은 시간
let timerInterval = null;
let extraTime = 0; // 재시도 시 추가되는 시간
let retryCount = 0;

// 플레이어 & 목표
let player = { x: 1, y: 1, targetX: 1, targetY: 1, animX: 1, animY: 1 };
let goal = { x: 8, y: 8 };

let moves = 0;
let isPlaying = false;
let isAnimating = false;
let goalAnimFrame = 0;
let hintArrow = null;
let particles = [];

// 관리자 설정 기본값
const DEFAULT_SETTINGS = {
    activeDifficulty: 'easy',
    gameTheme: 'cat',
    timeEasy: 30,
    timeNormal: 60,
    timeHard: 90
};

// 맵 데이터 로드
function loadMapData() {
    if (typeof MAZE_DATA !== 'undefined') {
        mazeData = MAZE_DATA;
        console.log('Maps loaded from JS:', mazeData);
    } else {
        console.error('MAZE_DATA is not defined');
        alert('맵 데이터를 불러오는데 실패했습니다 (MAZE_DATA not found).');
    }
}

// 난이도 선택
window.selectDifficulty = function (diff) {
    currentDifficulty = diff;
    diffModal.classList.remove('active');

    // 난이도별 설정
    // 이 부분은 initGame으로 이동되었으므로, 여기서는 currentDifficulty만 설정하고 게임 시작을 호출
    // (이 함수는 관리자 페이지에서 난이도를 변경할 때 사용될 수 있음)
    // 실제 게임 시작 로직은 initGame에서 담당

    // 설정 저장 (선택된 난이도를 기본값으로)
    const settings = JSON.parse(localStorage.getItem('mazeGameSettings')) || DEFAULT_SETTINGS;
    settings.activeDifficulty = diff;
    localStorage.setItem('mazeGameSettings', JSON.stringify(settings));

    retryCount = 0;
    extraTime = 0;
    initGame(); // 변경된 난이도로 게임 시작
};

// 게임 시작 준비
function initGame() {
    // 설정 로드
    const settings = JSON.parse(localStorage.getItem('mazeGameSettings')) || DEFAULT_SETTINGS;

    // 난이도 설정
    currentDifficulty = settings.activeDifficulty || 'easy';

    // 테마 설정
    if (settings.gameTheme && THEMES[settings.gameTheme]) {
        currentTheme = THEMES[settings.gameTheme];
    } else {
        currentTheme = THEMES.cat;
    }

    // 난이도별 그리드 설정 (Portrait)
    if (currentDifficulty === 'easy') {
        ROWS = 15; COLS = 11;
    } else if (currentDifficulty === 'normal') {
        ROWS = 21; COLS = 15;
    } else if (currentDifficulty === 'hard') {
        ROWS = 25; COLS = 17;
    }

    console.log(`Starting game with difficulty: ${currentDifficulty}`);

    // 초기 캔버스 사이즈 잡기 (데이터 로드 전이라도 틀을 잡기 위함)
    resizeGame();
    startGame();
}

// 게임 시작
function startGame() {
    if (!mazeData) {
        // 데이터가 아직 없으면 잠시 대기
        setTimeout(startGame, 100);
        return;
    }

    // 맵 선택
    const maps = mazeData[currentDifficulty];
    const randomMap = maps[Math.floor(Math.random() * maps.length)];
    // 복사해서 사용 (원본 보존)
    maze = JSON.parse(JSON.stringify(randomMap));

    // 시작점/도착점 설정
    // 기본적으로 (1,1) 시작, (Rows-2, Cols-2) 도착 (Generate 로직에 따름)
    player.x = 1; player.y = 1;
    player.animX = 1; player.animY = 1;
    player.targetX = 1; player.targetY = 1;

    goal.x = COLS - 2;
    goal.y = ROWS - 2;

    // 시간 설정 로드
    const settings = JSON.parse(localStorage.getItem('mazeGameSettings')) || DEFAULT_SETTINGS;
    let baseTime = settings.timeEasy;
    if (currentDifficulty === 'normal') baseTime = settings.timeNormal;
    if (currentDifficulty === 'hard') baseTime = settings.timeHard;

    timeLimit = baseTime + extraTime;
    currentTime = timeLimit;

    // 상태 초기화
    moves = 0;
    isPlaying = true;

    // 즉시 리사이즈 적용 (초기 렌더링 시 사이즈 불일치 방지)
    resizeGame();

    updateStats();
    startTimer();
    animate();

    messageEl.textContent = '출발!';
    messageEl.style.color = 'var(--text-color)';
}

// 화면 크기 변경 대응
function resizeGame() {
    const container = document.querySelector('.game-area');
    if (!container) return;

    // 뷰포트 높이 기준으로 계산 (container.clientHeight는 캔버스 크기에 따라 변하므로 사용 X)
    // Header(~60px) + Message(~30px) + Stats(~60px) + Instructions(~30px) + Margins(~40px) = ~220px
    const headerAndUIHeight = 220;
    const availableWidth = container.clientWidth - 10;
    const availableHeight = window.innerHeight - headerAndUIHeight;

    // 격자 크기에 맞춰 조정 (최소 크기 보장)
    const maxCellWidth = Math.floor(availableWidth / COLS);
    const maxCellHeight = Math.floor(availableHeight / ROWS);

    // 셀 크기는 화면에 맞게, 최대 40px로 제한 (모바일에서 너무 크지 않게)
    CELL_SIZE = Math.min(maxCellWidth, maxCellHeight, 40);

    canvas.width = CELL_SIZE * COLS;
    canvas.height = CELL_SIZE * ROWS;

    // 리사이즈 시 즉시 다시 그리기 (maze 데이터가 유효할 때만)
    if (!isAnimating && maze && maze.length > 0) drawMaze();
}

window.addEventListener('resize', () => {
    resizeGame();
});

// 타이머 시작
function startTimer() {
    clearInterval(timerInterval);
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        if (!isPlaying) return;

        currentTime--;
        updateTimerDisplay();

        if (currentTime <= 5) {
            timerBoxEl.classList.add('urgent');
            if (currentTime > 0) playSound('tick'); // 틱톡 소리 (있다면)
        } else {
            timerBoxEl.classList.remove('urgent');
        }

        if (currentTime <= 0) {
            gameOverTime();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const min = Math.floor(currentTime / 60);
    const sec = currentTime % 60;
    timerValueEl.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function gameOverTime() {
    isPlaying = false;
    clearInterval(timerInterval);
    timerBoxEl.classList.remove('urgent');

    // 실패 처리 및 재도전 보너스
    retryCount++;
    extraTime += 1; // 1초 추가

    messageEl.textContent = '시간 초과! 재도전시 시간이 1초 늘어납니다.';
    messageEl.style.color = 'var(--danger-color)';
    playSound('fail');

    if (navigator.vibrate) navigator.vibrate(500);

    updateStats();
}

function updateStats() {
    movesEl.textContent = moves;
    // retryInfo format: "시도횟수 / +추가시간"
    retryInfoEl.textContent = `${retryCount}회 / +${extraTime}s`;
}

// 애니메이션 루프
function animate() {
    if (!isPlaying && particles.length === 0) return;

    // 플레이어 이동 보간
    const dx = player.targetX - player.animX;
    const dy = player.targetY - player.animY;

    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        player.animX += dx * ANIMATION_SPEED;
        player.animY += dy * ANIMATION_SPEED;
        isAnimating = true;
    } else {
        player.animX = player.targetX;
        player.animY = player.targetY;
        isAnimating = false;
    }

    drawMaze();
    goalAnimFrame++;
    requestAnimationFrame(animate);
}

// 테마 데이터 (이모지 & 색상)
const THEMES = {
    cat: { player: '😺', goal: '🧶', wall: '#FFB7B2', bg: '#FFF5F5', wallBorder: '#FF9E99' },
    rabbit: { player: '🐰', goal: '🥕', wall: '#B5EAD7', bg: '#F5FFF5', wallBorder: '#98D8C0' },
    unicorn: { player: '🦄', goal: '🌈', wall: '#E0BBE4', bg: '#FAF0FF', wallBorder: '#D291BC' },
    panda: { player: '🐼', goal: '🎋', wall: '#A2D2FF', bg: '#F0F8FF', wallBorder: '#80C2FF' },
    dog: { player: '🐶', goal: '🦴', wall: '#FFDAC1', bg: '#FFF8F0', wallBorder: '#FFC8A2' }
};

let currentTheme = THEMES.cat; // 기본 테마

// 그리기 함수들
function drawMaze() {
    if (!maze || maze.length === 0) return;

    // 배경
    ctx.fillStyle = currentTheme.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (maze[row][col] === 1) {
                drawWall(col, row);
            } else {
                // 바닥 패턴 (체크무늬 등) - 심플하게 생략하거나 아주 연하게
                // ctx.strokeStyle = 'rgba(0,0,0,0.03)';
                // ctx.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }

    drawGoal();
    if (hintArrow) drawHintArrow();
    drawPlayer();
    updateParticles();
}

function drawWall(col, row) {
    const x = col * CELL_SIZE;
    const y = row * CELL_SIZE;

    // 파스텔 톤 벽 (둥근 사각형 느낌)
    ctx.fillStyle = currentTheme.wall;
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

    // 외곽선으로 입체감 살짝
    ctx.strokeStyle = currentTheme.wallBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);

    // 하이라이트 (Cute 느낌)
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(x + 10, y + 10, 3, 0, Math.PI * 2);
    ctx.fill();
}

function drawPlayer() {
    const x = player.animX * CELL_SIZE + CELL_SIZE / 2;
    const y = player.animY * CELL_SIZE + CELL_SIZE / 2;

    // 통통 튀는 애니메이션 (Y축 오프셋)
    const bounce = Math.abs(Math.sin(Date.now() / 150)) * 5;

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + CELL_SIZE / 2 - 5, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // 이모지 그리기
    ctx.fillStyle = '#000000'; // 이모지 투명도 문제 해결 (그림자 alpha값 초기화)
    const fontSize = Math.floor(CELL_SIZE * 0.8);
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentTheme.player, x, y - bounce);
}

function drawGoal() {
    const x = goal.x * CELL_SIZE + CELL_SIZE / 2;
    const y = goal.y * CELL_SIZE + CELL_SIZE / 2;

    const pulse = Math.sin(goalAnimFrame * 0.1) * 3;

    // 목표 지점 강조 (빛)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(x, y, CELL_SIZE / 2 + pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000000'; // 텍스트 컬러 초기화
    const fontSize = Math.floor(CELL_SIZE * 0.8);
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentTheme.goal, x, y);
}

function drawHintArrow() {
    if (!hintArrow) return;
    const x = player.x * CELL_SIZE + CELL_SIZE / 2;
    const y = player.y * CELL_SIZE + CELL_SIZE / 2;
    const size = CELL_SIZE * 0.4;

    ctx.save();
    ctx.translate(x, y);
    if (hintArrow.dx === 1) ctx.rotate(0);
    else if (hintArrow.dx === -1) ctx.rotate(Math.PI);
    else if (hintArrow.dy === 1) ctx.rotate(Math.PI / 2);
    else if (hintArrow.dy === -1) ctx.rotate(-Math.PI / 2);

    ctx.fillStyle = '#f39c12'; // 힌트는 잘 보여야 하므로 유지
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size / 2, -size / 2);
    ctx.lineTo(-size / 2, size / 2);
    ctx.fill();
    ctx.restore();
}

// 파티클 시스템
function createParticles(x, y) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8 - 2,
            life: 1,
            color: `hsl(${Math.random() * 60 + 40}, 100%, 50%)`
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.life -= 0.02;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// 조작 및 로직
function movePlayer(dx, dy) {
    if (!isPlaying || isAnimating) return;

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) return;
    if (maze[newY][newX] === 1) {
        // 벽 충돌 - 이번 버전에서는 게임오버 안 시키고 그냥 막힘 처리 (또는 시간 감소?)
        // 기획서에는 '벽에 닿으면 처음부터' 라고 있었으나,
        // 시간 제한 모드에서는 너무 가혹할 수 있음. 
        // 원본 코드는 '처음부터 다시'였음 => 유지?
        // 시간 제한이 있으니, 그냥 막히거나 약간의 페널티가 나을 수 있음.
        // 하지만 원본 유지 + 시간 제한 => 매우 어려움.
        // 여기서는 '시간 페널티' 또는 '그냥 막힘'으로 완화하지 않으면 클리어 불가 수준일 듯.
        // -> 원본 유지하되, 시작점으로만 보내고 시간은 계속 흐르게.
        // -> 또는 기획서엔 '벽에 닿으면 처음부터' 유지 여부 명시 없음. 
        // -> 보통 미로찾기는 벽에 닿으면 막히는게 일반적. 
        // -> UX상 '막힘 + 진동'만 처리하고 뒤로가기 없음 (제자리).
        handleWallCollision();
        return;
    }

    player.x = newX;
    player.y = newY;
    player.targetX = newX;
    player.targetY = newY;
    moves++;
    hintArrow = null;

    updateStats();
    playSound('click');

    if (player.x === goal.x && player.y === goal.y) {
        levelClear();
    }
}

function handleWallCollision() {
    // 벽에 부딪힘 -> 시간 1초 감소? 아니면 그냥 냅둠?
    // 여기서는 그냥 진동만 주고 이동 불가. 
    if (navigator.vibrate) navigator.vibrate(200);
    // playSound('wall'); 
}

function levelClear() {
    isPlaying = false;
    clearInterval(timerInterval);

    const x = goal.x * CELL_SIZE + CELL_SIZE / 2;
    const y = goal.y * CELL_SIZE + CELL_SIZE / 2;
    createParticles(x, y);

    messageEl.textContent = `탈출 성공! (${moves}회, 남은 시간 ${currentTime}초)`;
    messageEl.style.color = 'var(--success-color)';
    playSound('success');

    // setTimeout(() => {
    //     showSuccessScreen(GAME_ID); // common.js 함수
    // }, 1500);
    window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
}

// 힌트 (BFS/A*)
function findPath(sx, sy, gx, gy) {
    // 간단 BFS
    let q = [{ x: sx, y: sy, path: [] }];
    let visited = new Set();
    visited.add(`${sx},${sy}`);

    while (q.length > 0) {
        let curr = q.shift();
        if (curr.x === gx && curr.y === gy) return curr.path[0];

        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (let [dx, dy] of dirs) {
            let nx = curr.x + dx;
            let ny = curr.y + dy;

            if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && maze[ny][nx] === 0 && !visited.has(`${nx},${ny}`)) {
                visited.add(`${nx},${ny}`);
                let newPath = [...curr.path, { x: nx, y: ny }];
                q.push({ x: nx, y: ny, path: newPath });
            }
        }
    }
    return null;
}

// 입력 처리
function setupInputs() {
    resetBtn.addEventListener('click', () => {
        // 리셋 = 해당 맵, 해당 난이도 다시 시작 (시간, retry 초기화?) 
        // 보통 '다시 시작'은 완전히 처음부터.
        // 기획의 '시간 초과 후 다시 도전'과 겹침.
        // 여기서는 그냥 현재 스테이지 재시작 (Retry Count 유지?)
        // 유저가 직접 누른 리셋은 페널티 없이? 아니면 이것도 포함?
        // 편의상 리셋 버튼 -> Retry와 동일하게 처리하되 시간은 리셋.
        startGame();
    });

    document.addEventListener('keydown', (e) => {
        if (!isPlaying) return;
        switch (e.key) {
            case 'ArrowUp': movePlayer(0, -1); break;
            case 'ArrowDown': movePlayer(0, 1); break;
            case 'ArrowLeft': movePlayer(-1, 0); break;
            case 'ArrowRight': movePlayer(1, 0); break;
        }
    });

    // 터치 스와이프
    let touchX, touchY;
    canvas.addEventListener('touchstart', e => {
        touchX = e.touches[0].clientX;
        touchY = e.touches[0].clientY;
    }, { passive: false }); // 스크롤 방지

    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

    canvas.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - touchX;
        const dy = e.changedTouches[0].clientY - touchY;
        if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
            if (Math.abs(dx) > Math.abs(dy)) movePlayer(dx > 0 ? 1 : -1, 0);
            else movePlayer(0, dy > 0 ? 1 : -1);
        }
    });
}

// 초기화
setupInputs();
loadMapData();

// 자동 시작
initGame();

