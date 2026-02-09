// Game Configuration
const GAME_ID = 'game18';

// Target Colors Pool (Distinct colors needed)
const TARGET_COLORS = [
    { name: '빨간색', code: '#FF0000', rgb: { r: 255, g: 0, b: 0 } },
    { name: '파란색', code: '#0000FF', rgb: { r: 0, g: 0, b: 255 } },
    { name: '초록색', code: '#008000', rgb: { r: 0, g: 128, b: 0 } },
    { name: '노란색', code: '#FFFF00', rgb: { r: 255, g: 255, b: 0 } },
    { name: '주황색', code: '#FFA500', rgb: { r: 255, g: 165, b: 0 } },
    { name: '보라색', code: '#800080', rgb: { r: 128, g: 0, b: 128 } },
    { name: '하늘색', code: '#00BFFF', rgb: { r: 0, g: 191, b: 255 } },
    { name: '분홍색', code: '#FFC0CB', rgb: { r: 255, g: 192, b: 203 } }
];

// State
let currentTarget = null;
let stream = null;
let isCameraActive = false;
let remainingPasses = 0;
let colorThreshold = 130; // 기본값, Admin에서 로드됨

// DOM Elements
const videoEl = document.getElementById('cameraFeed');
const canvasEl = document.getElementById('cameraCanvas');
const targetNameEl = document.getElementById('targetColorName');
const missionBoxEl = document.querySelector('.mission-box');
const captureBtn = document.getElementById('captureBtn');
const passBtn = document.getElementById('passBtn');
const cameraSection = document.getElementById('cameraSection');
const cameraErrorSection = document.getElementById('cameraErrorSection');
const colorComparison = document.getElementById('colorComparison');
const targetColorSample = document.getElementById('targetColorSample');
const capturedColorSample = document.getElementById('capturedColorSample');
const comparisonResult = document.getElementById('comparisonResult');
const ctx = canvasEl.getContext('2d', { willReadFrequently: true });

// Admin 설정 로드
function loadAdminSettings() {
    const settings = JSON.parse(localStorage.getItem('game18_settings')) || {};
    const difficulty = settings.difficulty !== undefined ? settings.difficulty : 0;

    // 프리셋 기본값
    const passPresets = [5, 3, 1];
    const thresholdPresets = [150, 130, 100];

    remainingPasses = settings.passCount !== undefined ? settings.passCount : passPresets[difficulty];
    colorThreshold = settings.colorThreshold !== undefined ? settings.colorThreshold : thresholdPresets[difficulty];

    updatePassButton();
}

// Initialize Game
function initGame() {
    loadAdminSettings();
    pickNewTarget();
    startCamera();

    // Add Event Listeners
    captureBtn.addEventListener('click', captureFrame);
    passBtn.addEventListener('click', handlePass);
    document.getElementById('retryCameraBtn').addEventListener('click', startCamera);
}

function pickNewTarget() {
    const randomIndex = Math.floor(Math.random() * TARGET_COLORS.length);
    currentTarget = TARGET_COLORS[randomIndex];

    // Update UI
    targetNameEl.textContent = currentTarget.name;
    targetNameEl.style.backgroundColor = currentTarget.code;

    // Adjust text color for contrast
    const brightness = (currentTarget.rgb.r * 299 + currentTarget.rgb.g * 587 + currentTarget.rgb.b * 114) / 1000;
    targetNameEl.style.color = brightness > 125 ? 'black' : 'white';

    // 목표 색상 샘플 업데이트
    if (targetColorSample) {
        targetColorSample.style.backgroundColor = currentTarget.code;
    }
}

// 패스 버튼 상태 업데이트
function updatePassButton() {
    if (!passBtn) return;

    passBtn.textContent = `패스 (${remainingPasses}회)`;
    passBtn.disabled = remainingPasses <= 0;
}

// 패스 처리
function handlePass() {
    if (remainingPasses <= 0) return;

    remainingPasses--;
    playSound('click');
    pickNewTarget();
    updatePassButton();

    // 피드백 표시
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '50%';
    toast.style.left = '50%';
    toast.style.transform = 'translate(-50%, -50%)';
    toast.style.backgroundColor = 'rgba(0,0,0,0.8)';
    toast.style.color = 'white';
    toast.style.padding = '15px 30px';
    toast.style.borderRadius = '8px';
    toast.style.fontSize = '1.1rem';
    toast.style.zIndex = '1000';
    toast.textContent = `패스! 남은 횟수: ${remainingPasses}회`;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 1500);
}

// Camera Handling
async function startCamera() {
    try {
        if (stream) {
            stopCamera();
        }

        const constraints = {
            video: {
                facingMode: 'environment', // Use rear camera if available
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoEl.srcObject = stream;
        await videoEl.play();

        isCameraActive = true;
        cameraSection.classList.remove('hidden');
        cameraErrorSection.classList.add('hidden');
        captureBtn.disabled = false;

    } catch (err) {
        console.error("Camera Error:", err);
        // If camera fails, show error message
        showCameraError();
    }
}

function showCameraError() {
    cameraSection.classList.add('hidden');
    cameraErrorSection.classList.remove('hidden');
    captureBtn.disabled = true;
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    isCameraActive = false;
}



// Image Processing & Capture
function captureFrame() {
    if (!isCameraActive) return;

    playSound('click'); // Using common.js sound

    // Set canvas dimensions to match video
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;

    // Draw current frame
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

    // Get center pixel data (10x10 area average for stability)
    const centerX = Math.floor(canvasEl.width / 2);
    const centerY = Math.floor(canvasEl.height / 2);
    const sampleSize = 10;

    const imageData = ctx.getImageData(centerX - sampleSize / 2, centerY - sampleSize / 2, sampleSize, sampleSize);
    const data = imageData.data;

    let r = 0, g = 0, b = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
    }

    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    checkColorMatch(r, g, b);
}



// Color Comparison Logic
function checkColorMatch(r, g, b) {
    // Convert both to HSL for better perception matching -> or utilize existing RGB logic but with wider tolerance
    // Let's stick to RGB distance for simplicity but normalize it? 
    // Actually, simple RGB distance is often not enough for "Yellow" vs "Orange".
    // Let's use RGB distance with a generous threshold.

    const target = currentTarget.rgb;

    // Simple Euclidian distance
    const distance = Math.sqrt(
        Math.pow(target.r - r, 2) +
        Math.pow(target.g - g, 2) +
        Math.pow(target.b - b, 2)
    );

    console.log(`Target: ${currentTarget.name} (${target.r},${target.g},${target.b})`);
    console.log(`Captured: (${r},${g},${b}), Distance: ${distance.toFixed(2)}`);
    console.log(`Threshold: ${colorThreshold}`);

    // 색상 비교 UI 표시
    showColorComparison(r, g, b, distance);

    if (distance < colorThreshold) {
        handleSuccess();
    } else {
        handleFail();
    }
}

// 색상 비교 UI 표시
function showColorComparison(r, g, b, distance) {
    const capturedColor = `rgb(${r}, ${g}, ${b})`;

    // 촬영한 색상 표시
    capturedColorSample.style.backgroundColor = capturedColor;

    // 결과 표시
    const isMatch = distance < colorThreshold;
    comparisonResult.textContent = isMatch
        ? `✅ 일치! (차이: ${distance.toFixed(0)})`
        : `❌ 불일치 (차이: ${distance.toFixed(0)} / 허용: ${colorThreshold})`;

    comparisonResult.className = 'comparison-result ' + (isMatch ? 'success' : 'fail');

    // 비교 UI 표시
}

function handleSuccess() {
    playSound('success');
    showSuccessScreen(GAME_ID);
}

function handleFail() {
    playSound('fail');

    // 빨간색 플래시 효과
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.backgroundColor = 'rgba(255,0,0,0.3)';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '100';
    document.body.appendChild(flash);

    setTimeout(() => flash.remove(), 500);
}

// Start Game Flow
window.addEventListener('load', () => {
    showInstructions(
        '🎨 컬러 헌터',
        [
            '화면에 나오는 색깔을 확인하세요.',
            '집 안에서 그 색깔과 같은 물건을 찾으세요.',
            '카메라 십자선(+)에 물건을 맞추고 버튼을 누르세요!',
            '카메라가 안 되면 직접 색을 고를 수도 있어요.'
        ],
        initGame
    );
});
