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
    targetName: 'SECRET_BASE_WIFI',
    password: '1234' // Default password, can be changed in settings
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
    setupAdmin();
});

function initGame() {
    // Phase 1: Scanning
    showScreen('scanning-screen');
    document.getElementById('target-display').innerText = `TARGET: ${config.targetName}`;

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

// Admin Settings
function setupAdmin() {
    const adminBtn = document.getElementById('admin-btn');
    const modal = document.getElementById('admin-modal');

    adminBtn.addEventListener('click', () => {
        modal.classList.remove('hidden');
        document.getElementById('conf-target').value = config.targetName;
        document.getElementById('conf-pass').value = config.password;
    });
}

function saveConfig() {
    const newTarget = document.getElementById('conf-target').value;
    const newPass = document.getElementById('conf-pass').value;

    if (newTarget && newPass) {
        config.targetName = newTarget;
        config.password = newPass;
        localStorage.setItem(GAME_ID + '_config', JSON.stringify(config));
        document.getElementById('admin-modal').classList.add('hidden');
        alert('Config Saved! Reloading...');
        location.reload();
    }
}

function closeAdmin() {
    document.getElementById('admin-modal').classList.add('hidden');
}
