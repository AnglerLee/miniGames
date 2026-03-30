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
let colorThreshold = 130;
let questionCount = 2;  // 총 문제 수
let solvedCount = 0;    // 맞춘 문제 수

// DOM Elements
const videoEl = document.getElementById('cameraFeed');
const canvasEl = document.getElementById('cameraCanvas');
const targetNameEl = document.getElementById('targetColorName');
const captureBtn = document.getElementById('captureBtn');
const cameraSection = document.getElementById('cameraSection');
const cameraErrorSection = document.getElementById('cameraErrorSection');
const capturedColorSample = document.getElementById('capturedColorSample');
const comparisonResult = document.getElementById('comparisonResult');
const progressText = document.getElementById('progressText');
const ctx = canvasEl.getContext('2d', { willReadFrequently: true });

// Admin 설정 로드
function loadAdminSettings() {
    const settings = JSON.parse(localStorage.getItem('game18_settings')) || {};
    const difficulty = settings.difficulty !== undefined ? settings.difficulty : 0;

    const questionPresets = [2, 3, 5];
    const thresholdPresets = [45, 30, 20]; // 색조 허용 오차 (도)

    questionCount = settings.questionCount !== undefined ? settings.questionCount : questionPresets[difficulty];
    colorThreshold = settings.colorThreshold !== undefined ? settings.colorThreshold : thresholdPresets[difficulty];
}

// 진행도 업데이트
function updateProgress() {
    if (progressText) {
        progressText.textContent = `(${solvedCount}/${questionCount})`;
    }
}

// Initialize Game
function initGame() {
    loadAdminSettings();
    solvedCount = 0;
    updateProgress();
    pickNewTarget();
    startCamera();

    captureBtn.addEventListener('click', captureFrame);
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

    // 비교 결과 초기화
    comparisonResult.textContent = '촬영 대기 중';
    comparisonResult.className = 'comparison-result';
    if (capturedColorSample) capturedColorSample.style.backgroundColor = '';
}

// Camera Handling
async function startCamera() {
    try {
        if (stream) {
            stopCamera();
        }

        const constraints = {
            video: {
                facingMode: 'environment',
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

    playSound('click');

    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;

    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

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

// RGB → HSL 변환
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}

// HSL 색조 기반 색상 거리 (단위: 도, 0~180)
function calcHueDistance(capR, capG, capB, target) {
    const cap = rgbToHsl(capR, capG, capB);
    const tar = rgbToHsl(target.r, target.g, target.b);

    // 채도가 너무 낮으면(회색/흰색/검정) 채도 높은 색상과 불일치
    if (cap.s < 20 && tar.s > 40) return 999;

    // 명도가 너무 낮으면(거의 검정) 불일치
    if (cap.l < 8) return 999;

    // 색조 원형 거리 (0~180)
    const raw = Math.abs(cap.h - tar.h);
    const hueDiff = Math.min(raw, 360 - raw);

    // 채도 부족 패널티: 촬영 채도가 목표보다 낮을수록 가산
    const satPenalty = Math.max(0, tar.s - cap.s) * 0.2;

    return hueDiff + satPenalty;
}

// Color Comparison Logic
function checkColorMatch(r, g, b) {
    const target = currentTarget.rgb;
    const distance = calcHueDistance(r, g, b, target);

    const capHsl = rgbToHsl(r, g, b);
    const tarHsl = rgbToHsl(target.r, target.g, target.b);

    console.log(`Target: ${currentTarget.name} H=${tarHsl.h.toFixed(1)}° S=${tarHsl.s.toFixed(1)}%`);
    console.log(`Captured: H=${capHsl.h.toFixed(1)}° S=${capHsl.s.toFixed(1)}% L=${capHsl.l.toFixed(1)}%`);
    console.log(`Hue distance: ${distance.toFixed(1)}° / Threshold: ${colorThreshold}°`);

    showColorComparison(r, g, b, distance);

    if (distance < colorThreshold) {
        handleSuccess();
    } else {
        handleFail();
    }
}

// 색상 비교 UI 표시
function showColorComparison(r, g, b, distance) {
    capturedColorSample.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

    const isMatch = distance < colorThreshold;
    const distDisplay = distance >= 999 ? '무채색' : `${distance.toFixed(0)}°`;
    comparisonResult.textContent = isMatch
        ? `✅ 일치! (색조 차이: ${distDisplay})`
        : `❌ 불일치 (색조 차이: ${distDisplay} / 허용: ${colorThreshold}°)`;

    comparisonResult.className = 'comparison-result ' + (isMatch ? 'success' : 'fail');
}

function handleSuccess() {
    playSound('success');

    solvedCount++;
    updateProgress();

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    if (solvedCount >= questionCount) {
        // 모든 문제 완료 → 게임 클리어
        captureBtn.disabled = true;
        setTimeout(() => {
            window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
        }, 800);
    } else {
        // 다음 문제로
        setTimeout(() => {
            pickNewTarget();
        }, 1200);
    }
}

function handleFail() {
    playSound('fail');

    if (navigator.vibrate) navigator.vibrate(200);

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
