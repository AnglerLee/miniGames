const GAME_ID = 'game22';

// State Management
const STATE = {
    SCANNING: 'scanning',
    INPUT: 'input',
    SUCCESS: 'success',
    CONFIG: 'config'
};

let currentState = STATE.SCANNING;
const canvas = document.getElementById('matrix-bg');
const ctx = canvas.getContext('2d');

// Default Config
const defaultConfig = {
    missionGoal: '🎯 목표: Wi-Fi 비밀번호를 찾아라!',
    targetName: 'SECRET_BASE_WIFI',
    password: '1234'
};

// Load Config
let config = JSON.parse(localStorage.getItem(GAME_ID + '_config')) || defaultConfig;

// Audio Context (Simple Beeps)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Matrix Rain Effect
let matrixInterval;
function startMatrix() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const cols = Math.floor(canvas.width / 20);
    const drops = Array(cols).fill(0);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    clearInterval(matrixInterval);
    matrixInterval = setInterval(() => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#0f0';
        ctx.font = '15px monospace';

        for (let i = 0; i < drops.length; i++) {
            const text = String.fromCharCode(Math.random() * 128);
            ctx.fillText(text, i * 20, drops[i] * 20);

            if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }, 50);
}

// Init
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

document.addEventListener('DOMContentLoaded', () => {
    startMatrix();
    initGame();
});

function initGame() {
    // Phase 1: Scanning
    showScreen('scanning-screen');

    // 목표 문구 표시
    document.getElementById('mission-goal').innerText = config.missionGoal;

    // Auto transition to input after 3s
    setTimeout(() => {
        showScreen('input-screen');
        playTone(600, 'sine', 0.2);
    }, 3000);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

// Keypad Input
function addDigit(digit) {
    const input = document.getElementById('passwordInput');
    if (input.value.length < 4) {
        input.value += digit;
        playTone(800 + (digit * 50), 'square', 0.1);
        if (navigator.vibrate) navigator.vibrate(10);
    }
}

function clearInput() {
    document.getElementById('passwordInput').value = '';
    playTone(300, 'sawtooth', 0.2);
}

function hack() {
    const input = document.getElementById('passwordInput');
    const val = input.value;

    if (val === config.password) {
        // Success
        playTone(1200, 'square', 0.1);
        setTimeout(() => playTone(1500, 'square', 0.4), 100);
        showScreen('success-screen');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
        // Call success handler
        setTimeout(onHackSuccess, 2000);
    } else {
        // Fail
        playTone(150, 'sawtooth', 0.5);
        if (navigator.vibrate) navigator.vibrate(500);

        const msg = document.getElementById('msg-box');
        msg.innerText = "ACCESS DENIED";
        msg.classList.add('access-denied');
        setTimeout(() => {
            msg.innerText = "";
            msg.classList.remove('access-denied');
            input.value = '';
        }, 1000);
    }
}

function onHackSuccess() {
    // 공통 성공 화면 표시 (힌트/비밀번호 포함)
    // showSuccessScreen(GAME_ID);
    window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
}


