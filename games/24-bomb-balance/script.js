const GAME_ID = 'game24';
const SETTINGS_KEY = 'bomb_balance_settings';

// Default Settings
const DEFAULT_SETTINGS = {
    gameDuration: 30,
    driftBaseStrength: 5,
    driftMaxStrength: 20,
    driftRotationSpeed: 0.5,
    gustCount: 3,
    gustStrength: 15,
    stabilityDecreaseRate: 20,
    stabilityRecoverRate: 5,
    tiltThreshold: 15,
    tiltMax: 45
};

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
}

const settings = loadSettings();

// DOM Elements
const introScreen = document.getElementById('introScreen');
const gameScreen = document.getElementById('gameScreen');
const startBtn = document.getElementById('startBtn');
const timerDisplay = document.getElementById('timerDisplay');
const bombTimer = document.getElementById('bombTimer');
const stabilityBar = document.getElementById('stabilityBar');
const levelBubble = document.getElementById('levelBubble');
const dangerOverlay = document.getElementById('dangerOverlay');
const messageArea = document.getElementById('messageArea');
const windArrow = document.getElementById('windArrow');
const windStrengthBar = document.getElementById('windStrengthBar');

// Game State
const MAX_STABILITY = 100;
let currentState = 'READY';
let timeLeft = settings.gameDuration;
let stability = MAX_STABILITY;
let gameLoopId;
let timerLoopId;
let currentBeta = 0;
let currentGamma = 0;
let lastTimestamp = 0;

// Drift State
let driftAngle = 0;
let driftStrength = 0;

// Gust State
let gustActive = false;
let gustAngle = 0;
let gustCurrentStrength = 0;
let gustElapsed = 0;
const GUST_DURATION = 1.5;
let gustSchedule = [];
let gustIndex = 0;

// Game Config
const config = getGameConfig(GAME_ID);
config.successMessage = "폭탄을 안전하게 처리했습니다! 대단해요!";

// Initialize
function init() {
    startBtn.addEventListener('click', handleStart);
}

async function handleStart() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission === 'granted') {
                startGame();
            } else {
                alert('센서 권한이 필요합니다.');
            }
        } catch (error) {
            console.error(error);
            alert('권한 요청 중 오류가 발생했습니다.');
        }
    } else {
        startGame();
    }
}

function buildGustSchedule() {
    gustSchedule = [];
    gustIndex = 0;
    const count = settings.gustCount;
    if (count <= 0) return;

    // Distribute gusts across game duration with some randomness
    // Avoid first 3 seconds and last 2 seconds
    const safeStart = 3;
    const safeEnd = 2;
    const window = settings.gameDuration - safeStart - safeEnd;
    if (window <= 0) return;

    for (let i = 0; i < count; i++) {
        const base = safeStart + (window / count) * i;
        const jitter = (Math.random() - 0.5) * (window / count) * 0.6;
        gustSchedule.push(Math.max(safeStart, Math.min(settings.gameDuration - safeEnd, base + jitter)));
    }
    gustSchedule.sort((a, b) => a - b);
}

function startGame() {
    introScreen.classList.remove('active');
    gameScreen.classList.add('active');
    currentState = 'PLAYING';

    // Reset values
    timeLeft = settings.gameDuration;
    stability = MAX_STABILITY;

    // Drift initialization
    driftAngle = Math.random() * Math.PI * 2;
    driftStrength = settings.driftBaseStrength;
    lastTimestamp = performance.now();

    // Gust initialization
    gustActive = false;
    gustCurrentStrength = 0;
    gustElapsed = 0;
    buildGustSchedule();

    // Add Event Listeners
    window.addEventListener('deviceorientation', handleOrientation);

    // Start Loops
    startTimer();
    gameLoopId = requestAnimationFrame(gameLoop);
}

function stopGame(result) {
    currentState = 'ENDED';
    cancelAnimationFrame(gameLoopId);
    clearInterval(timerLoopId);
    window.removeEventListener('deviceorientation', handleOrientation);

    // Remove warning effects
    dangerOverlay.style.opacity = 0;
    dangerOverlay.classList.remove('active');
    document.body.classList.remove('shaking');

    if (result === 'success') {
        playSound('success');
        window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
    } else {
        playSound('fail');
        showFailScreen('폭탄이 너무 많이 흔들려 폭발했습니다!');
    }
}

function startTimer() {
    updateTimerDisplay();
    timerLoopId = setInterval(() => {
        timeLeft -= 0.1;
        if (timeLeft <= 0) {
            timeLeft = 0;
            stopGame('success');
        }
        updateTimerDisplay();
    }, 100);
}

function updateTimerDisplay() {
    const formatted = timeLeft.toFixed(2);
    timerDisplay.textContent = formatted;
    bombTimer.textContent = `00:${Math.ceil(timeLeft).toString().padStart(2, '0')}`;
}

function handleOrientation(event) {
    currentBeta = event.beta || 0;
    currentGamma = event.gamma || 0;

    if (currentBeta > 90) currentBeta = 90;
    if (currentBeta < -90) currentBeta = -90;
}

function triggerGust() {
    gustActive = true;
    gustAngle = Math.random() * Math.PI * 2;
    gustCurrentStrength = settings.gustStrength;
    gustElapsed = 0;
}

function gameLoop(timestamp) {
    if (currentState !== 'PLAYING') return;

    const dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    const deltaTime = Math.min(dt, 0.1);

    // --- Drift Update ---
    driftAngle += settings.driftRotationSpeed * deltaTime;

    // Drift strength ramps up over game duration
    const elapsed = settings.gameDuration - timeLeft;
    const progress = Math.min(1, elapsed / settings.gameDuration);
    driftStrength = settings.driftBaseStrength +
        (settings.driftMaxStrength - settings.driftBaseStrength) * progress;

    const driftX = Math.cos(driftAngle) * driftStrength;
    const driftY = Math.sin(driftAngle) * driftStrength;

    // --- Gust Update ---
    let gustX = 0, gustY = 0;

    // Check if a gust should trigger
    if (!gustActive && gustIndex < gustSchedule.length && elapsed >= gustSchedule[gustIndex]) {
        triggerGust();
        gustIndex++;
    }

    if (gustActive) {
        gustElapsed += deltaTime;
        if (gustElapsed >= GUST_DURATION) {
            gustActive = false;
            gustCurrentStrength = 0;
        } else {
            // Ease-out: strong at start, fades out
            const gustProgress = gustElapsed / GUST_DURATION;
            gustCurrentStrength = settings.gustStrength * (1 - gustProgress * gustProgress);
        }
        gustX = Math.cos(gustAngle) * gustCurrentStrength;
        gustY = Math.sin(gustAngle) * gustCurrentStrength;
    }

    // --- Effective Tilt (device + drift + gust) ---
    const effectiveBeta = currentBeta + driftY + gustY;
    const effectiveGamma = currentGamma + driftX + gustX;

    const tiltDistance = Math.sqrt(effectiveBeta * effectiveBeta + effectiveGamma * effectiveGamma);

    // --- Update Bubble UI ---
    const maxOffset = 70;
    const x = (effectiveGamma / settings.tiltMax) * maxOffset;
    const y = (effectiveBeta / settings.tiltMax) * maxOffset;
    const limitedX = Math.max(-maxOffset, Math.min(maxOffset, x));
    const limitedY = Math.max(-maxOffset, Math.min(maxOffset, y));

    levelBubble.style.transform = `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`;

    // --- Update Wind Indicator ---
    const totalWindAngle = gustActive
        ? Math.atan2(driftY + gustY, driftX + gustX)
        : driftAngle;
    const totalWindStrength = Math.sqrt(
        (driftX + gustX) * (driftX + gustX) +
        (driftY + gustY) * (driftY + gustY)
    );

    // Arrow rotates to show wind direction (CSS rotation: 0deg = right, so adjust)
    if (windArrow) {
        const arrowDeg = (totalWindAngle * 180 / Math.PI);
        windArrow.style.transform = `rotate(${arrowDeg}deg)`;
    }
    // Wind strength bar
    if (windStrengthBar) {
        const maxWind = settings.driftMaxStrength + settings.gustStrength;
        const windPercent = Math.min(100, (totalWindStrength / maxWind) * 100);
        windStrengthBar.style.width = `${windPercent}%`;

        if (gustActive) {
            windStrengthBar.style.background = '#ff6600';
        } else {
            windStrengthBar.style.background = '#44aaff';
        }
    }

    // --- Stability Logic ---
    if (tiltDistance > settings.tiltThreshold) {

        const severity = (tiltDistance - settings.tiltThreshold) / (settings.tiltMax - settings.tiltThreshold);
        const damage = settings.stabilityDecreaseRate * Math.min(1, severity) * deltaTime;

        stability -= damage;
        if (stability < 0) stability = 0;

        // Feedbacks
        dangerOverlay.style.opacity = Math.min(0.8, severity);
        if (tiltDistance > settings.tiltMax) {
            dangerOverlay.classList.add('active');
            document.body.classList.add('shaking');
            if (!gustActive) {
                messageArea.textContent = "위험해요! 수평을 맞추세요!";
                messageArea.style.color = "#ff3333";
            }
        } else {
            dangerOverlay.classList.remove('active');
            document.body.classList.remove('shaking');
            if (!gustActive) {
                messageArea.textContent = "주의! 중심을 잡으세요";
                messageArea.style.color = "#ffcc00";
            }
        }
    } else {
        // Recover stability slowly
        stability += settings.stabilityRecoverRate * deltaTime;
        if (stability > MAX_STABILITY) stability = MAX_STABILITY;

        dangerOverlay.style.opacity = 0;
        dangerOverlay.classList.remove('active');
        document.body.classList.remove('shaking');
        if (!gustActive) {
            messageArea.textContent = "안정적입니다. 계속 유지하세요.";
            messageArea.style.color = "#00ff00";
        }
    }

    // Gust message override (show for first 0.5s of gust)
    if (gustActive && gustElapsed < 0.5) {
        messageArea.textContent = "💨 돌풍이 불어옵니다!";
        messageArea.style.color = "#ff9900";
    }

    // --- Update Health Bar ---
    const healthPercent = (stability / MAX_STABILITY) * 100;
    stabilityBar.style.width = `${healthPercent}%`;

    if (healthPercent > 60) {
        stabilityBar.style.background = 'linear-gradient(90deg, #33ff33, #00cc00)';
    } else if (healthPercent > 30) {
        stabilityBar.style.background = 'linear-gradient(90deg, #ffff00, #ffcc00)';
    } else {
        stabilityBar.style.background = 'linear-gradient(90deg, #ff3333, #bd0000)';
    }

    // --- Check Loss ---
    if (stability <= 0) {
        stopGame('fail');
        return;
    }

    // Loop
    gameLoopId = requestAnimationFrame(gameLoop);
}

// Start
init();
