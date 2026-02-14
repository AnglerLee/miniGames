// 관리자 설정 스크립트 (17 Barcode Scanner)
const GAME_ID = 'game17';
const STORAGE_KEY = 'barcodeScannerSettings';

// 난이도 프리셋
const difficultyPresets = {
    0: { name: '🟢 쉬움', targetCount: 1, timeLimit: 0 },
    1: { name: '🟡 보통', targetCount: 3, timeLimit: 120 },
    2: { name: '🔴 어려움', targetCount: 5, timeLimit: 90 }
};

// DOM 요소
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');
const difficultySlider = document.getElementById('difficultySlider');
const difficultyLabel = document.getElementById('difficultyLabel');
const targetCountInput = document.getElementById('targetCount');
const timeLimitInput = document.getElementById('timeLimit');

const barcodeInput = document.getElementById('barcodeInput');
const addBarcodeBtn = document.getElementById('addBarcodeBtn');
const scanBarcodeBtn = document.getElementById('scanBarcodeBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
const barcodeCamera = document.getElementById('barcodeCamera');
const barcodeList = document.getElementById('barcodeList');

// 게임 설정 상태
let targetBarcodes = [];
let isScannerActive = false;

// 난이도 슬라이더 변경
difficultySlider.addEventListener('input', () => {
    const level = parseInt(difficultySlider.value);
    const preset = difficultyPresets[level];

    difficultyLabel.textContent = preset.name;
    targetCountInput.value = preset.targetCount;
    timeLimitInput.value = preset.timeLimit;
});

// 바코드 직접 추가
addBarcodeBtn.addEventListener('click', () => {
    const code = barcodeInput.value.trim();

    if (!code) {
        alert('바코드 번호를 입력해주세요.');
        return;
    }

    if (code.length < 8) {
        alert('바코드 번호는 최소 8자리 이상이어야 합니다.');
        return;
    }

    addBarcode(code);
    barcodeInput.value = '';
});

// 바코드 입력 엔터키 처리
barcodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addBarcodeBtn.click();
    }
});

// 바코드 스캔 시작
scanBarcodeBtn.addEventListener('click', () => {
    if (isScannerActive) return;

    startBarcodeScanner();
});

// 바코드 스캔 정지
stopScanBtn.addEventListener('click', () => {
    stopBarcodeScanner();
});

// QuaggaJS 바코드 스캐너 시작
async function startBarcodeScanner() {
    try {
        // 카메라 권한 확인
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        stream.getTracks().forEach(track => track.stop());

        // QuaggaJS 초기화
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.getElementById('barcode-scanner'),
                constraints: {
                    facingMode: "environment",
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            },
            decoder: {
                readers: [
                    "ean_reader",
                    "ean_8_reader",
                    "code_128_reader",
                    "code_39_reader",
                    "upc_reader",
                    "upc_e_reader"
                ]
            },
            locator: {
                patchSize: "medium",
                halfSample: true
            },
            numOfWorkers: 2,
            frequency: 10,
            locate: true
        }, (err) => {
            if (err) {
                console.error('QuaggaJS init error:', err);
                alert('카메라를 시작할 수 없습니다: ' + err.message);
                return;
            }

            Quagga.start();
            isScannerActive = true;
            barcodeCamera.classList.add('active');
            scanBarcodeBtn.style.display = 'none';
        });

        // 바코드 감지 이벤트
        Quagga.onDetected(onBarcodeDetected);

    } catch (error) {
        console.error('Camera error:', error);
        alert('카메라 권한이 필요합니다.');
    }
}

// 바코드 감지 핸들러
function onBarcodeDetected(result) {
    const code = result.codeResult.code;

    // 신뢰도 체크
    if (result.codeResult.decodedCodes.length < 5) {
        return;
    }

    // 바코드 추가
    addBarcode(code);

    // 스캐너 자동 정지
    setTimeout(() => {
        stopBarcodeScanner();
    }, 500);
}

// 바코드 스캐너 정지
function stopBarcodeScanner() {
    if (isScannerActive) {
        Quagga.stop();
        Quagga.offDetected(onBarcodeDetected);
        isScannerActive = false;
    }

    barcodeCamera.classList.remove('active');
    scanBarcodeBtn.style.display = 'inline-block';
}

// 바코드 추가
function addBarcode(code) {
    // 중복 체크
    if (targetBarcodes.includes(code)) {
        alert('이미 등록된 바코드입니다: ' + code);
        return;
    }

    targetBarcodes.push(code);
    renderBarcodeList();
}

// 바코드 삭제
function removeBarcode(code) {
    targetBarcodes = targetBarcodes.filter(b => b !== code);
    renderBarcodeList();
}

// 바코드 목록 렌더링
function renderBarcodeList() {
    if (targetBarcodes.length === 0) {
        barcodeList.innerHTML = '<div class="empty-state">등록된 바코드가 없습니다</div>';
        return;
    }

    barcodeList.innerHTML = targetBarcodes.map(code => `
        <div class="barcode-item">
            <span class="barcode-code">${code}</span>
            <button type="button" class="barcode-remove" onclick="removeBarcode('${code}')">삭제</button>
        </div>
    `).join('');
}

// 설정 로드
function loadSettings() {
    // 게임별 설정 로드
    const settings = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

    // 난이도 설정
    const difficulty = settings.difficulty || 0;
    difficultySlider.value = difficulty;
    difficultyLabel.textContent = difficultyPresets[difficulty].name;

    targetCountInput.value = settings.targetCount || difficultyPresets[difficulty].targetCount;
    timeLimitInput.value = settings.timeLimit || difficultyPresets[difficulty].timeLimit;

    // 목표 바코드 로드
    targetBarcodes = settings.targetBarcodes || [];
    renderBarcodeList();


}

// 설정 저장
function saveSettings(e) {
    e.preventDefault();

    // 게임별 설정 저장
    const settings = {
        difficulty: parseInt(difficultySlider.value),
        targetCount: parseInt(targetCountInput.value),
        timeLimit: parseInt(timeLimitInput.value),
        targetBarcodes: targetBarcodes,
        lastUpdated: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    alert('설정이 저장되었습니다!');
}

// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까?')) {
        // 게임별 설정 삭제
        localStorage.removeItem(STORAGE_KEY);



        // 상태 초기화
        targetBarcodes = [];

        loadSettings();
        alert('초기화되었습니다.');
    }
}

// 이벤트 리스너
form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

// 전역 함수로 노출 (HTML onclick에서 사용)
window.removeBarcode = removeBarcode;

// 페이지 로드 시 설정 로드
loadSettings();
