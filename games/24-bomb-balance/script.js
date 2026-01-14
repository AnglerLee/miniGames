const GAME_ID = 'game24';

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

// Game Constants
const GAME_DURATION = 30; // 30 seconds to survive/transport
const MAX_STABILITY = 100;
const STABILITY_DECREASE_RATE = 20; // Per second when unstable
const STABILITY_RECOVER_RATE = 5;  // Per second when stable
const TILT_THRESHOLD = 15; // Degrees for warning
const TILT_MAX = 45; // Degrees for max penalty

// Game State
let currentState = 'READY'; // READY, PLAYING, ENDED
let timeLeft = GAME_DURATION;
let stability = MAX_STABILITY;
let gameLoopId;
let timerLoopId;
let currentBeta = 0; // Front/Back tilt (-180 to 180)
let currentGamma = 0; // Left/Right tilt (-90 to 90)

// Game Config
const config = getGameConfig(GAME_ID);
config.successMessage = "폭탄을 안전하게 처리했습니다! 대단해요!";

// Initialize
function init() {
    startBtn.addEventListener('click', handleStart);
}

async function handleStart() {
    // Request permission for iOS 13+
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
        // Non-iOS or older devices
        startGame();
    }
}

function startGame() {
    introScreen.classList.remove('active');
    gameScreen.classList.add('active');
    currentState = 'PLAYING';

    // Reset values
    timeLeft = GAME_DURATION;
    stability = MAX_STABILITY;

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
        showSuccessScreen(GAME_ID);
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
    // beta: front-to-back tilt in degrees, where front is positive
    // gamma: left-to-right tilt in degrees, where right is positive
    currentBeta = event.beta || 0;
    currentGamma = event.gamma || 0;

    // Only care about tilt from flat (0,0)
    // Beta is 0 when flat. Gamma is 0 when flat.
    // Clamp values for UI rendering
    if (currentBeta > 90) currentBeta = 90;
    if (currentBeta < -90) currentBeta = -90;
}

function gameLoop() {
    if (currentState !== 'PLAYING') return;

    // 1. Calculate Tilt Magnitude
    // A simple distance from center (0,0)
    const tiltDistance = Math.sqrt(currentBeta * currentBeta + currentGamma * currentGamma);

    // 2. Update UI (Visual Leveler)
    // Map tilt to bubble position (max 100px radius movement)
    // Bubble moves OPPOSITE to tilt (like a real spirit level) or TOWARDS tilt (like a marble)?
    // Real spirit level bubble moves UP (opposite to gravity/tilt).
    // If I tilt phone UP (beta positive), bubble goes UP (negative Y).
    // Let's implement "Marble on a plate" physics or "Spirit Level" physics?
    // User Guide says "Keep level".
    // Let's do "Spirit Level" (Air bubble): Bubble rises to highest point.
    // Tilt Phone Forward (Beta +): Top goes down. Bubble goes to Top (Y -).
    // Tilt Phone Right (Gamma +): Right goes down. Bubble goes to Left (X -).

    // Let's stick to a simpler logic: "Marble Rolling" might be more intuitive for "Balance".
    // If you tilt right, marble rolls right. You must keep marble in center.
    // Let's implement "Keep the ball in the center".
    const maxOffset = 70; // px
    const x = (currentGamma / TILT_MAX) * maxOffset;
    const y = (currentBeta / TILT_MAX) * maxOffset;

    const limitedX = Math.max(-maxOffset, Math.min(maxOffset, x));
    const limitedY = Math.max(-maxOffset, Math.min(maxOffset, y));

    levelBubble.style.transform = `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`;

    // 3. Game Logic (Stability)
    let isUnstable = false;

    if (tiltDistance > TILT_THRESHOLD) {
        isUnstable = true;

        // Calculate damage
        const severity = (tiltDistance - TILT_THRESHOLD) / (TILT_MAX - TILT_THRESHOLD); // 0 to 1+
        const damage = STABILITY_DECREASE_RATE * Math.min(1, severity) * 0.016; // 60fps approx

        stability -= damage;
        if (stability < 0) stability = 0;

        // Feedbacks
        dangerOverlay.style.opacity = Math.min(0.8, severity);
        if (tiltDistance > TILT_MAX) {
            dangerOverlay.classList.add('active'); // Flash
            document.body.classList.add('shaking');
            messageArea.textContent = "위험해요! 수평을 맞추세요!";
            messageArea.style.color = "#ff3333";
        } else {
            dangerOverlay.classList.remove('active');
            document.body.classList.remove('shaking');
            messageArea.textContent = "주의! 중심을 잡으세요";
            messageArea.style.color = "#ffcc00";
        }

    } else {
        // Recover stability slowly
        stability += STABILITY_RECOVER_RATE * 0.016;
        if (stability > MAX_STABILITY) stability = MAX_STABILITY;

        dangerOverlay.style.opacity = 0;
        dangerOverlay.classList.remove('active');
        document.body.classList.remove('shaking');
        messageArea.textContent = "안정적입니다. 계속 유지하세요.";
        messageArea.style.color = "#00ff00";
    }

    // 4. Update Health Bar
    const healthPercent = (stability / MAX_STABILITY) * 100;
    stabilityBar.style.width = `${healthPercent}%`;

    // Color change based on health
    if (healthPercent > 60) {
        stabilityBar.style.background = 'linear-gradient(90deg, #33ff33, #00cc00)';
    } else if (healthPercent > 30) {
        stabilityBar.style.background = 'linear-gradient(90deg, #ffff00, #ffcc00)';
    } else {
        stabilityBar.style.background = 'linear-gradient(90deg, #ff3333, #bd0000)';
    }

    // Check Loss Condition
    if (stability <= 0) {
        stopGame('fail');
        return;
    }

    // Loop
    requestAnimationFrame(gameLoop);
}

// Start
init();
