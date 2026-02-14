// 관리자 설정 스크립트 (25 Scratch Card)
const STORAGE_KEY = 'scratch_bg_image';

const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');
const galleryInput = document.getElementById('galleryInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const statusBadge = document.getElementById('statusBadge');

// Camera Elements
const cameraModal = document.getElementById('cameraModal');
const videoEl = document.getElementById('cameraFeed');
let stream = null;

// 미리보기 업데이트
function updatePreview() {
    const savedImage = localStorage.getItem(STORAGE_KEY);
    if (savedImage) {
        previewImg.src = savedImage;
        imagePreview.classList.add('has-image');
        statusBadge.textContent = '커스텀 이미지 설정됨';
        statusBadge.className = 'status-badge custom';
    } else {
        previewImg.src = '';
        imagePreview.classList.remove('has-image');
        statusBadge.textContent = '기본 힌트 사용 중';
        statusBadge.className = 'status-badge default';
    }
}

// 이미지 적용 (localStorage 저장)
function applyImage(dataUrl) {
    try {
        localStorage.setItem(STORAGE_KEY, dataUrl);
        updatePreview();
        alert('배경 이미지가 설정되었습니다!');
    } catch (err) {
        alert('이미지 저장 용량 초과! 더 작은 이미지를 사용해주세요.');
    }
}

// 갤러리 이미지 파일 처리
galleryInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
        applyImage(event.target.result);
    };
    reader.readAsDataURL(file);
});

// --- 카메라 기능 ---
async function openCamera() {
    try {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
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
        cameraModal.classList.add('active');
    } catch (err) {
        console.error("Camera Error:", err);
        alert("카메라를 실행할 수 없습니다. 권한을 확인해주세요.");
    }
}

function closeCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    cameraModal.classList.remove('active');
}

function takePhoto() {
    if (!stream) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoEl.videoWidth;
    tempCanvas.height = videoEl.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(videoEl, 0, 0, tempCanvas.width, tempCanvas.height);

    const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.8);
    applyImage(dataUrl);
    closeCamera();
}

// 초기화 (기본값 복원)
resetBtn.addEventListener('click', function () {
    if (confirm('기본 힌트로 되돌리시겠습니까?')) {
        localStorage.removeItem(STORAGE_KEY);
        updatePreview();
        alert('초기화되었습니다.');
    }
});

// 폼 제출 방지
form.addEventListener('submit', function (e) {
    e.preventDefault();
});

// 초기 로드
updatePreview();
