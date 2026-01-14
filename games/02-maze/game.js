// 미로 탈출 게임 (개선 버전)

const GAME_ID = 'game02';

const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');
const messageEl = document.getElementById('message');
const movesEl = document.getElementById('moves');
const attemptsEl = document.getElementById('attempts');
const bestRecordEl = document.getElementById('bestRecord');
const hintBtn = document.getElementById('hintBtn');
const resetBtn = document.getElementById('resetBtn');

// 게임 설정
let CELL_SIZE = 40;
const COLS = 10;
const ROWS = 10;
const ANIMATION_SPEED = 0.15; // 애니메이션 속도

// 미로 맵 (1 = 벽, 0 = 길)
const maze = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 1, 1, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 0, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

// 플레이어 위치
let player = {
    x: 1,
    y: 1,
    targetX: 1,
    targetY: 1,
    animX: 1,
    animY: 1
};

// 도착점
const goal = {
    x: 8,
    y: 8
};

let moves = 0;
let attempts = 0;
let hintsLeft = 3;
let isPlaying = false;
let isAnimating = false;
let goalAnimFrame = 0;
let hintArrow = null;
let particles = [];

// 최고 기록 로드
let bestRecord = parseInt(localStorage.getItem('maze_best_record')) || null;

// 게임 초기화
function initGame() {
    showInstructions(
        '🌀 미로 탈출',
        [
            '파란 공을 움직여 도착점(깃발)까지 가세요',
            '화살표 버튼이나 키보드로 조작하세요',
            '벽에 닿으면 처음부터 다시 시작!',
            '힌트를 사용하면 다음 방향을 알 수 있어요'
        ],
        startGame
    );
}

// 게임 시작
function startGame() {
    isPlaying = true;
    
    // 캔버스 크기를 화면에 맞게 조정
    const container = document.querySelector('.container');
    const maxSize = Math.min(container.clientWidth - 30, 500);
    canvas.width = maxSize;
    canvas.height = maxSize;
    CELL_SIZE = maxSize / COLS;
    
    player.x = 1;
    player.y = 1;
    player.animX = 1;
    player.animY = 1;
    player.targetX = 1;
    player.targetY = 1;
    moves = 0;
    attempts = 0;
    hintsLeft = 3;
    hintArrow = null;
    particles = [];
    
    updateStats();
    loadBestRecord();
    setupControls();
    animate();
}

// 애니메이션 루프
function animate() {
    if (!isPlaying && particles.length === 0) return;
    
    // 플레이어 이동 애니메이션
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

// 미로 그리기
function drawMaze() {
    // 배경
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 미로 그리기
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (maze[row][col] === 1) {
                // 3D 효과 벽
                drawWall(col, row);
            } else {
                // 길 - 격자 무늬
                ctx.strokeStyle = '#e9ecef';
                ctx.lineWidth = 1;
                ctx.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }
    
    // 도착점 (애니메이션 깃발)
    drawGoal();
    
    // 힌트 화살표
    if (hintArrow) {
        drawHintArrow();
    }
    
    // 플레이어 (공)
    drawPlayer();
    
    // 파티클 효과
    updateParticles();
}

// 3D 벽 그리기
function drawWall(col, row) {
    const x = col * CELL_SIZE;
    const y = row * CELL_SIZE;
    
    // 메인 벽
    const gradient = ctx.createLinearGradient(x, y, x + CELL_SIZE, y + CELL_SIZE);
    gradient.addColorStop(0, '#34495e');
    gradient.addColorStop(0.5, '#2c3e50');
    gradient.addColorStop(1, '#1a252f');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    
    // 하이라이트 (위쪽, 왼쪽)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(x, y, CELL_SIZE, 2);
    ctx.fillRect(x, y, 2, CELL_SIZE);
    
    // 그림자 (아래쪽, 오른쪽)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(x, y + CELL_SIZE - 2, CELL_SIZE, 2);
    ctx.fillRect(x + CELL_SIZE - 2, y, 2, CELL_SIZE);
    
    // 테두리
    ctx.strokeStyle = '#1a252f';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
}

// 플레이어 그리기
function drawPlayer() {
    const x = player.animX * CELL_SIZE + CELL_SIZE / 2;
    const y = player.animY * CELL_SIZE + CELL_SIZE / 2;
    const radius = CELL_SIZE / 2 - 6;
    
    // 그림자
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + radius + 2, radius - 2, radius / 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // 공
    const gradient = ctx.createRadialGradient(x - radius / 3, y - radius / 3, 0, x, y, radius);
    gradient.addColorStop(0, '#5DADE2');
    gradient.addColorStop(1, '#2980B9');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // 하이라이트
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(x - radius / 3, y - radius / 3, radius / 4, 0, Math.PI * 2);
    ctx.fill();
    
    // 테두리
    ctx.strokeStyle = '#1565C0';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// 도착점 그리기 (애니메이션)
function drawGoal() {
    const x = goal.x * CELL_SIZE + CELL_SIZE / 2;
    const y = goal.y * CELL_SIZE + CELL_SIZE / 2;
    
    // 반짝이는 원
    const pulseSize = Math.sin(goalAnimFrame * 0.1) * 3;
    ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
    ctx.beginPath();
    ctx.arc(x, y, CELL_SIZE / 2 + pulseSize, 0, Math.PI * 2);
    ctx.fill();
    
    // 깃발
    ctx.font = '32px Arial';
    ctx.fillText('🏁', goal.x * CELL_SIZE + 4, goal.y * CELL_SIZE + 30);
}

// 힌트 화살표 그리기
function drawHintArrow() {
    if (!hintArrow) return;
    
    const x = player.x * CELL_SIZE + CELL_SIZE / 2;
    const y = player.y * CELL_SIZE + CELL_SIZE / 2;
    const size = 15;
    
    ctx.save();
    ctx.translate(x, y);
    
    // 방향에 따라 회전
    if (hintArrow.dx === 1) ctx.rotate(0);
    else if (hintArrow.dx === -1) ctx.rotate(Math.PI);
    else if (hintArrow.dy === 1) ctx.rotate(Math.PI / 2);
    else if (hintArrow.dy === -1) ctx.rotate(-Math.PI / 2);
    
    // 화살표
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size / 2, -size / 2);
    ctx.lineTo(-size / 2, size / 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = '#e67e22';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
}

// 파티클 생성 및 업데이트
function createParticles(x, y) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x,
            y: y,
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
        p.vy += 0.3; // 중력
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

// 플레이어 이동
function movePlayer(dx, dy) {
    if (!isPlaying || isAnimating) return;
    
    const newX = player.x + dx;
    const newY = player.y + dy;
    
    // 경계 체크
    if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) {
        return;
    }
    
    // 벽 체크
    if (maze[newY][newX] === 1) {
        hitWall();
        return;
    }
    
    // 이동
    player.x = newX;
    player.y = newY;
    player.targetX = newX;
    player.targetY = newY;
    moves++;
    hintArrow = null; // 힌트 초기화
    
    updateStats();
    playSound('click');
    
    // 도착 체크
    if (player.x === goal.x && player.y === goal.y) {
        reachGoal();
    }
}

// 벽에 부딪힘
function hitWall() {
    messageEl.textContent = '앗! 벽이에요. 처음부터 다시!';
    messageEl.style.color = 'var(--danger-color)';
    
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
    
    playSound('fail');
    
    attempts++;
    moves = 0;
    hintArrow = null;
    updateStats();
    
    setTimeout(() => {
        player.x = 1;
        player.y = 1;
        player.targetX = 1;
        player.targetY = 1;
        player.animX = 1;
        player.animY = 1;
        messageEl.textContent = '다시 도전해보세요!';
        messageEl.style.color = 'var(--text-light)';
    }, 1000);
}

// 도착!
function reachGoal() {
    isPlaying = false;
    messageEl.textContent = `축하합니다! ${moves}번 만에 탈출!`;
    messageEl.style.color = 'var(--success-color)';
    
    // 파티클 효과
    const x = goal.x * CELL_SIZE + CELL_SIZE / 2;
    const y = goal.y * CELL_SIZE + CELL_SIZE / 2;
    createParticles(x, y);
    
    // 최고 기록 갱신
    if (!bestRecord || moves < bestRecord) {
        bestRecord = moves;
        localStorage.setItem('maze_best_record', bestRecord);
        bestRecordEl.textContent = bestRecord;
        messageEl.textContent = `🎉 신기록! ${moves}번 만에 탈출!`;
    }
    
    playSound('success');
    
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
    }
    
    setTimeout(() => {
        showSuccessScreen(GAME_ID);
    }, 1500);
}

// 힌트 기능
function showHint() {
    if (hintsLeft <= 0 || !isPlaying) return;
    
    hintsLeft--;
    hintBtn.textContent = `💡 힌트 (${hintsLeft})`;
    if (hintsLeft === 0) {
        hintBtn.disabled = true;
    }
    
    // 간단한 방향 제시 (도착점 방향)
    const dx = goal.x - player.x;
    const dy = goal.y - player.y;
    
    // 먼저 가로 또는 세로 중 더 먼 방향 선택
    if (Math.abs(dx) > Math.abs(dy)) {
        hintArrow = { dx: dx > 0 ? 1 : -1, dy: 0 };
    } else {
        hintArrow = { dx: 0, dy: dy > 0 ? 1 : -1 };
    }
    
    // 힌트는 3초 후 사라짐
    setTimeout(() => {
        hintArrow = null;
    }, 3000);
}

// 통계 업데이트
function updateStats() {
    movesEl.textContent = moves;
    attemptsEl.textContent = attempts;
}

// 최고 기록 로드
function loadBestRecord() {
    if (bestRecord) {
        bestRecordEl.textContent = bestRecord;
    } else {
        bestRecordEl.textContent = '-';
    }
}

// 컨트롤 설정
function setupControls() {
    // 버튼 클릭
    document.getElementById('upBtn').addEventListener('click', () => movePlayer(0, -1));
    document.getElementById('downBtn').addEventListener('click', () => movePlayer(0, 1));
    document.getElementById('leftBtn').addEventListener('click', () => movePlayer(-1, 0));
    document.getElementById('rightBtn').addEventListener('click', () => movePlayer(1, 0));
    
    // 힌트 버튼
    hintBtn.addEventListener('click', showHint);
    
    // 리셋 버튼
    resetBtn.addEventListener('click', () => {
        player.x = 1;
        player.y = 1;
        player.targetX = 1;
        player.targetY = 1;
        player.animX = 1;
        player.animY = 1;
        moves = 0;
        hintArrow = null;
        updateStats();
        messageEl.textContent = '다시 시작했습니다!';
        messageEl.style.color = 'var(--text-light)';
    });
    
    // 키보드 입력
    document.addEventListener('keydown', (e) => {
        if (!isPlaying) return;
        
        switch(e.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                e.preventDefault();
                movePlayer(0, -1);
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                e.preventDefault();
                movePlayer(0, 1);
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                e.preventDefault();
                movePlayer(-1, 0);
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                e.preventDefault();
                movePlayer(1, 0);
                break;
        }
    });
    
    // 터치/드래그 (스와이프)
    let touchStartX = 0;
    let touchStartY = 0;
    
    canvas.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    });
    
    canvas.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        
        const threshold = 30;
        
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
            // 좌우 이동
            movePlayer(dx > 0 ? 1 : -1, 0);
        } else if (Math.abs(dy) > threshold) {
            // 상하 이동
            movePlayer(0, dy > 0 ? 1 : -1);
        }
    });
}

// 게임 시작
initGame();
