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

// DOM Elements
const videoEl = document.getElementById('cameraFeed');
const canvasEl = document.getElementById('cameraCanvas');
const targetNameEl = document.getElementById('targetColorName');
const missionBoxEl = document.querySelector('.mission-box');
const captureBtn = document.getElementById('captureBtn');
const cameraSection = document.getElementById('cameraSection');
const fallbackSection = document.getElementById('fallbackSection');
const fallbackColorPicker = document.getElementById('fallbackColorPicker');
const ctx = canvasEl.getContext('2d', { willReadFrequently: true });

// Initialize Game
function initGame() {
    pickNewTarget();
    startCamera();
    
    // Add Event Listeners
    captureBtn.addEventListener('click', captureFrame);
    document.getElementById('retryCameraBtn').addEventListener('click', startCamera);
    document.getElementById('useFallbackBtn').addEventListener('click', enableFallbackMode);
    document.getElementById('checkFallbackBtn').addEventListener('click', checkFallbackColor);
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
        fallbackSection.classList.remove('active');
        captureBtn.disabled = false;
        
    } catch (err) {
        console.error("Camera Error:", err);
        // If camera fails, show fallback
        enableFallbackMode();
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    isCameraActive = false;
}

function enableFallbackMode() {
    stopCamera();
    cameraSection.classList.add('hidden');
    fallbackSection.classList.add('active');
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
    
    const imageData = ctx.getImageData(centerX - sampleSize/2, centerY - sampleSize/2, sampleSize, sampleSize);
    const data = imageData.data;
    
    let r = 0, g = 0, b = 0;
    let count = 0;
    
    for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i+1];
        b += data[i+2];
        count++;
    }
    
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    
    checkColorMatch(r, g, b);
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function checkFallbackColor() {
    const hex = fallbackColorPicker.value;
    const rgb = hexToRgb(hex);
    checkColorMatch(rgb.r, rgb.g, rgb.b);
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
    
    // Threshold: 
    // Max distance (White to Black) is sqrt(255^2 * 3) ~= 441
    // 100 is roughly 22% difference.
    // Let's try 120 for forgiving gameplay for kids.
    const THRESHOLD = 130; 
    
    console.log(`Target: ${currentTarget.name} (${target.r},${target.g},${target.b})`);
    console.log(`Captured: (${r},${g},${b}), Distance: ${distance.toFixed(2)}`);

    if (distance < THRESHOLD) {
        handleSuccess();
    } else {
        handleFail();
    }
}

function handleSuccess() {
    playSound('success');
    showSuccessScreen(GAME_ID);
}

function handleFail() {
    playSound('fail');
    // Using simple alert or toast from common? 
    // common.js has showFailScreen but that's a modal which might stop the flow.
    // Let's use a temporary toast message or just an alert for now, 
    // OR create a custom flash on the camera overlay.
    
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
    
    alert(`땡! 색깔이 달라요. \n목표: ${currentTarget.name}\n비슷한 색을 다시 찾아보세요!`);
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
