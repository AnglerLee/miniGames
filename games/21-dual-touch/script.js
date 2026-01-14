const GAME_ID = 'game21';

// Elements
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const timerEl = document.getElementById('timer');
const messageEl = document.getElementById('message');
const connectionFill = document.querySelector('.connection-active');
const container = document.querySelector('.touch-zone-container');
const startBtn = document.getElementById('startBtn');
const difficultySelect = document.getElementById('difficultySelect');
const instructionText = document.getElementById('instructionText');
const settingsPanel = document.querySelector('.settings-panel');

// Constants
const GOAL_TIME = 3.0;
const BTN_RADIUS = 40; // Approx half of 80px
const DIFFICULTY = {
    easy: {
        syncTolerance: 0.1, // 100ms
        moveSpeed: 0.5,
        text: "Easy (0.1s)"
    },
    normal: {
        syncTolerance: 0.05, // 50ms
        moveSpeed: 0.75, // Reduced from 1
        text: "Normal (0.05s)"
    },
    hard: {
        syncTolerance: 0.025, // 25ms
        moveSpeed: 1.0, // Reduced from 2.5
        text: "Hard (0.025s)"
    }
};

// State
let currentDifficulty = 'normal';
let isPlaying = false;
let isCompleted = false;
let gameInterval = null; // For progress timer
let animFrameId = null; // For movement loop
let holdTime = 0;

// Button States
// Positions are relative to container (0,0 is top-left of container)
const btnState = {
    left: {
        active: false,
        touchTime: 0,
        el: leftBtn,
        x: 0, y: 0,
        vx: 0, vy: 0,
        touchId: null,
        touchX: 0, touchY: 0
    },
    right: {
        active: false,
        touchTime: 0,
        el: rightBtn,
        x: 0, y: 0,
        vx: 0, vy: 0,
        touchId: null,
        touchX: 0, touchY: 0
    }
};

// Initialize
function init() {
    setupUI();

    // Initial static positioning
    // Delay slightly to ensure container has size
    setTimeout(resetPositions, 100);

    // Resize observer to handle responsiveness
    new ResizeObserver(() => {
        if (!isPlaying) resetPositions();
    }).observe(container);

    // Initial instruction
    showInstructions('🤝 동시 터치 협동',
        ['난이도를 선택하고 게임을 시작하세요!',
            '두 버튼을 <b>정확히 동시에</b> 눌러야 합니다.',
            '버튼이 움직이면 손을 떼지 말고 따라가세요!'],
        () => {
            // Callback
        }
    );
}

function setupUI() {
    startBtn.addEventListener('click', startGame);

    // Touch Events for Buttons
    setupTouchEvents(leftBtn, 'left');
    setupTouchEvents(rightBtn, 'right');

    // Desktop keyboard support
    window.addEventListener('keydown', handleKeyChange);
    window.addEventListener('keyup', handleKeyChange);
}

function resetPositions() {
    const w = container.clientWidth;
    const h = container.clientHeight;

    // Center Y
    const cy = (h / 2) - 40;

    // Left: Center of left half
    btnState.left.x = (w / 4) - 40;
    btnState.left.y = cy;

    // Right: Center of right half
    btnState.right.x = (w * 0.75) - 40;
    btnState.right.y = cy;

    btnState.left.vx = 0;
    btnState.left.vy = 0;
    btnState.right.vx = 0;
    btnState.right.vy = 0;

    updateButtonVisuals();
}

function startGame() {
    if (isPlaying) return;

    currentDifficulty = difficultySelect.value;
    const diffSettings = DIFFICULTY[currentDifficulty];

    // Hide settings, show instruction
    settingsPanel.style.display = 'none';
    instructionText.style.display = 'block';

    // Reset state
    holdTime = 0;
    isCompleted = false;
    isPlaying = true;
    updateProgress();

    // Assign velocities if moving
    if (diffSettings.moveSpeed > 0) {
        assignRandomVelocities(diffSettings.moveSpeed);
    }

    messageEl.textContent = "두 버튼을 동시에 누르세요!";
    messageEl.style.color = "#fff";

    // Start Loops
    lastTime = performance.now();
    cancelAnimationFrame(animFrameId);
    animLoop();
}

function assignRandomVelocities(speed) {
    const angleL = Math.random() * Math.PI * 2;
    btnState.left.vx = Math.cos(angleL) * speed;
    btnState.left.vy = Math.sin(angleL) * speed;

    const angleR = Math.random() * Math.PI * 2;
    btnState.right.vx = Math.cos(angleR) * speed;
    btnState.right.vy = Math.sin(angleR) * speed;
}

let lastTime = 0;
function animLoop(timestamp) {
    if (!isPlaying || isCompleted) return;

    // logic for movement
    const dt = timestamp - lastTime; // in ms
    // Limit dt to avoid huge jumps
    const safeDt = Math.min(dt, 50);

    // Only move if difficulty allows
    const speed = DIFFICULTY[currentDifficulty].moveSpeed;
    if (speed > 0) {
        updateMovement('left');
        updateMovement('right');
    }

    updateButtonVisuals();

    // Check tracking (is finger still on button?)
    checkTracking();

    lastTime = timestamp;
    animFrameId = requestAnimationFrame(animLoop);
}

function updateMovement(side) {
    const state = btnState[side];
    const w = container.clientWidth;
    const h = container.clientHeight;
    const btnSize = 80;

    state.x += state.vx;
    state.y += state.vy;

    // Split Zone Logic
    let minX, maxX;

    if (side === 'left') {
        minX = 0;
        maxX = (w / 2) - btnSize; // Keep in left half
    } else {
        minX = (w / 2); // Start from middle
        maxX = w - btnSize; // Keep in right half
    }

    // Bounce Logic X
    if (state.x <= minX) { state.x = minX; state.vx *= -1; }
    if (state.x >= maxX) { state.x = maxX; state.vx *= -1; }

    // Bounce Logic Y (Full height allow)
    if (state.y <= 0) { state.y = 0; state.vy *= -1; }
    if (state.y >= h - btnSize) { state.y = h - btnSize; state.vy *= -1; }
}

function updateButtonVisuals() {
    // Apply transform translation
    // We already removed top/left/right/bottom css pos for gameplay, 
    // but initially they had some. We should ensure style.left/top is set.

    const applyStyle = (side) => {
        const state = btnState[side];
        state.el.style.left = state.x + 'px';
        state.el.style.top = state.y + 'px';
        state.el.style.transform = 'none'; // reset css transform

        if (state.active) {
            state.el.classList.add('active');
        } else {
            state.el.classList.remove('active');
        }
    };

    applyStyle('left');
    applyStyle('right');
}

function setupTouchEvents(btn, side) {
    const state = btnState[side];

    const onStart = (e) => {
        e.preventDefault();
        if (isCompleted || !isPlaying) return;

        // Track the first changed touch
        const touch = e.changedTouches[0];
        if (!state.active) {
            state.active = true;
            state.touchId = touch.identifier;
            state.touchTime = performance.now();
            state.touchX = touch.clientX;
            state.touchY = touch.clientY;

            playSound('click');
            if (navigator.vibrate) navigator.vibrate(10);

            checkSync();
        }
    };

    const onMove = (e) => {
        e.preventDefault();
        if (!state.active) return;

        // Find our specific touch
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === state.touchId) {
                state.touchX = e.changedTouches[i].clientX;
                state.touchY = e.changedTouches[i].clientY;
                break;
            }
        }
    };

    const onEnd = (e) => {
        e.preventDefault();
        // Check if our touch ended
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === state.touchId) {
                failReset(side + " 버튼에서 손을 뗐습니다!");
                return;
            }
        }
    };

    btn.addEventListener('touchstart', onStart, { passive: false });
    btn.addEventListener('touchmove', onMove, { passive: false });
    btn.addEventListener('touchend', onEnd, { passive: false });
    btn.addEventListener('touchcancel', onEnd, { passive: false });

    // Mouse fallback for PC
    btn.addEventListener('mousedown', (e) => {
        if (isCompleted || !isPlaying) return;
        state.active = true;
        state.touchTime = performance.now();
        playSound('click');
        checkSync();

        // Mock mouse tracking center for PC simple test
        // Real tracking on PC with mouse is hard for dual-touch, but we assume static testing
    });
    btn.addEventListener('mouseup', () => failReset("마우스 뗌!"));
    btn.addEventListener('mouseleave', () => { if (state.active) failReset("범위 벗어남!"); });
}

function checkTracking() {
    // Only vital for touch
    ['left', 'right'].forEach(side => {
        const state = btnState[side];
        if (state.active && state.touchId !== null) {
            // Get button center in viewport coordinates
            const rect = state.el.getBoundingClientRect();
            const btnCx = rect.left + rect.width / 2;
            const btnCy = rect.top + rect.height / 2;

            // Calc distance
            const dx = state.touchX - btnCx;
            const dy = state.touchY - btnCy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Allow button radius + some margin (e.g. 20px)
            if (dist > (BTN_RADIUS + 30)) {
                failReset("버튼을 놓쳤습니다!");
            }
        }
    });
}

function checkSync() {
    // Check if both active
    if (btnState.left.active && btnState.right.active) {
        // Calculate diff
        // Time is in ms, tolerance is in sec
        const diffSec = Math.abs(btnState.left.touchTime - btnState.right.touchTime) / 1000;
        const tolerance = DIFFICULTY[currentDifficulty].syncTolerance;

        if (diffSec <= tolerance) {
            // Success sync!
            startTimer();
        } else {
            // Fail sync
            failReset(`동시 터치 오차 ${diffSec.toFixed(3)}s (허용: ${tolerance}s)`);
        }
    }
}

function startTimer() {
    if (gameInterval) return;

    messageEl.textContent = "계속 누르고 있으세요!!";
    messageEl.style.color = "#4CAF50";

    // Start progress
    gameInterval = setInterval(() => {
        holdTime += 0.05;
        updateProgress();

        if (holdTime >= GOAL_TIME) {
            completeGame();
        }
    }, 50);
}

function failReset(reason) {
    if (isCompleted) return;

    // logic to handle single failure vs both released
    // Actually, any failure stops the whole attempt
    stopTimer();

    if (btnState.left.active || btnState.right.active) {
        // Only show fail message, but don't reset 'active' state logic entirely 
        // because the user physically still has finger down.
        // But for game logic, we must force them to re-tap.
        // So we set active=false even if finger is down.
        btnState.left.active = false;
        btnState.right.active = false;
        btnState.left.touchId = null;
        btnState.right.touchId = null;

        playSound('fail');
        messageEl.textContent = reason;
        messageEl.style.color = "#f44336";

        // Vibrate fail
        if (navigator.vibrate) navigator.vibrate(200);
    }
}

function stopTimer() {
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    holdTime = 0;
    updateProgress();
}

function updateProgress() {
    timerEl.textContent = holdTime.toFixed(2) + 's';

    const percent = Math.min((holdTime / GOAL_TIME) * 100, 100);
    connectionFill.style.width = `${percent}%`;

    if (percent > 80) {
        connectionFill.style.background = '#4CAF50';
    } else {
        connectionFill.style.background = 'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)';
    }
}

function completeGame() {
    isCompleted = true;
    clearInterval(gameInterval);
    cancelAnimationFrame(animFrameId);

    timerEl.textContent = GOAL_TIME.toFixed(2) + 's';
    connectionFill.style.width = '100%';

    playSound('success');

    const flash = document.createElement('div');
    flash.className = 'success-flash';
    document.body.appendChild(flash);
    requestAnimationFrame(() => flash.classList.add('flash'));

    setTimeout(() => {
        showSuccessScreen(GAME_ID);
    }, 1000);
}

function handleKeyChange(e) {
    // Only for debugging / dev
    if (!isPlaying || isCompleted) return;
    // ... Simplified implementation for Dev
    // It's hard to simulate sync precisely with keys manually

    if (e.type === 'keydown') {
        if (e.code === 'KeyA' && !btnState.left.active) {
            btnState.left.active = true;
            btnState.left.touchTime = performance.now();
            checkSync();
        }
        if (e.code === 'KeyL' && !btnState.right.active) {
            btnState.right.active = true;
            btnState.right.touchTime = performance.now();
            checkSync();
        }
    } else if (e.type === 'keyup') {
        if (e.code === 'KeyA') failReset("Key Left Stop");
        if (e.code === 'KeyL') failReset("Key Right Stop");
    }
}

// Start
init();
