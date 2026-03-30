// 관리자 설정 스크립트 (19 Reverse Audio)
const GAME_ID = 'game19';

// 난이도별 프리셋
const difficultyPresets = {
    0: { name: '🟢 쉬움', questions: 3, maxHints: 3, direction: 'reverse', speed: 0.25 },
    1: { name: '🟡 보통', questions: 5, maxHints: 2, direction: 'reverse', speed: 0.25 },
    2: { name: '🔴 어려움', questions: 7, maxHints: 1, direction: 'reverse', speed: 0.25 }
};

// 전역 변수
let currentDifficulty = 0;
let recordedBlob = null;
let mediaRecorder = null;
let audioCtx = null;
let recordingStartTime = 0;
let recordingTimer = null;
let serverSettings = {}; // 서버에서 로드된 전체 설정

// DOM 요소
const difficultySlider = document.getElementById('difficultySlider');
const currentDifficultyName = document.getElementById('currentDifficultyName');
const questionsInput = document.getElementById('questions');
const maxHintsInput = document.getElementById('maxHints');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const questionListEl = document.getElementById('questionList');
const questionCountEl = document.getElementById('questionCount');
const newAnswerInput = document.getElementById('newAnswer');
const recordBtn = document.getElementById('recordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const playBtn = document.getElementById('playBtn');
const recordingTime = document.getElementById('recordingTime');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const playDirectionSelect = document.getElementById('playDirection');
const playSpeedInput = document.getElementById('playSpeed');
const playSpeedLabel = document.getElementById('playSpeedLabel');

// ===== 서버 API 헬퍼 =====

async function fetchSettings() {
    try {
        const res = await fetch(`/api/games/${GAME_ID}/settings`);
        if (!res.ok) return {};
        return (await res.json()) || {};
    } catch (e) {
        console.error('설정 로드 오류:', e);
        return {};
    }
}

async function saveToServer(settings) {
    const res = await fetch(`/api/games/${GAME_ID}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('서버 저장 실패');
}

// ===== 초기화 =====

window.addEventListener('load', async () => {
    serverSettings = await fetchSettings();
    onDifficultyChange();
    setupEventListeners();
});

// ===== 이벤트 리스너 =====

function setupEventListeners() {
    difficultySlider.addEventListener('input', onDifficultyChange);
    saveSettingsBtn.addEventListener('click', saveSettings);
    recordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    playBtn.addEventListener('click', playRecording);
    addQuestionBtn.addEventListener('click', addQuestion);
    playSpeedInput.addEventListener('input', () => {
        playSpeedLabel.textContent = `${parseFloat(playSpeedInput.value).toFixed(2)}x`;
    });
}

// ===== 난이도 변경 =====

function onDifficultyChange() {
    currentDifficulty = parseInt(difficultySlider.value);
    const preset = difficultyPresets[currentDifficulty];
    const settings = serverSettings[currentDifficulty] || preset;

    questionsInput.value = settings.questions;
    maxHintsInput.value = settings.maxHints;
    playDirectionSelect.value = settings.direction || 'reverse';
    playSpeedInput.value = settings.speed || 0.25;
    playSpeedLabel.textContent = `${parseFloat(settings.speed || 0.25).toFixed(2)}x`;
    currentDifficultyName.textContent = `${preset.name} 난이도 설정`;

    loadQuestionList();
    resetRecordingForm();
}

// ===== 설정 저장 =====

async function saveSettings() {
    // 최신 설정 로드 (questionList 덮어쓰기 방지)
    serverSettings = await fetchSettings();
    serverSettings[currentDifficulty] = {
        ...(serverSettings[currentDifficulty] || {}),
        questions: parseInt(questionsInput.value),
        maxHints: parseInt(maxHintsInput.value),
        direction: playDirectionSelect.value,
        speed: parseFloat(playSpeedInput.value)
    };

    try {
        await saveToServer(serverSettings);
        alert('설정이 저장되었습니다!');
    } catch (e) {
        alert('저장 실패: ' + e.message);
    }
}

// ===== 녹음 =====

async function startRecording() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        const chunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            recordedBlob = new Blob(chunks, { type: 'audio/webm' });
            playBtn.classList.remove('hidden');
            addQuestionBtn.disabled = false;
            clearInterval(recordingTimer);
            recordingTime.classList.add('hidden');
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();

        recordingTime.classList.remove('hidden');
        recordingTimer = setInterval(() => {
            const elapsed = (Date.now() - recordingStartTime) / 1000;
            recordingTime.textContent = `${elapsed.toFixed(1)}초`;
        }, 100);

        // 5초 후 자동 정지
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') stopRecording();
        }, 5000);

        recordBtn.classList.add('hidden');
        stopRecordBtn.classList.remove('hidden');

    } catch (err) {
        console.error('Recording error:', err);
        alert('마이크 권한이 필요합니다.');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        stopRecordBtn.classList.add('hidden');
        recordBtn.classList.remove('hidden');
        recordBtn.innerHTML = '🔄 다시 녹음';
    }
}

// 녹음 미리 재생 (업로드 전 확인용)
function playRecording() {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const audio = new Audio(url);
    playBtn.disabled = true;
    playBtn.textContent = '▶️ 재생 중...';
    audio.play().catch(err => alert('재생 오류: ' + err.message));
    audio.onended = () => {
        playBtn.disabled = false;
        playBtn.textContent = '▶️ 재생';
        URL.revokeObjectURL(url);
    };
}

// ===== 문제 추가 (서버 업로드) =====

async function addQuestion() {
    const answer = newAnswerInput.value.trim();
    if (!answer) { alert('정답 단어를 입력해주세요.'); return; }
    if (!recordedBlob) { alert('목소리를 녹음해주세요.'); return; }

    addQuestionBtn.disabled = true;
    addQuestionBtn.textContent = '업로드 중...';

    try {
        // 오디오 파일 서버 업로드 (텍스트 필드를 파일보다 먼저 추가해야 multer가 올바른 경로로 저장)
        const formData = new FormData();
        formData.append('gameId', GAME_ID);
        formData.append('type', 'audio');
        formData.append('file', recordedBlob, 'audio.webm');

        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) throw new Error(uploadData.error);

        // 최신 설정 로드 후 문제 추가 (문제 목록은 난이도 공통)
        serverSettings = await fetchSettings();
        if (!serverSettings.questionList) {
            serverSettings.questionList = [];
        }

        serverSettings.questionList.push({
            id: uploadData.filename,
            answer: answer,
            audioUrl: uploadData.url
        });

        await saveToServer(serverSettings);
        loadQuestionList();
        closeAddModal();
        alert('문제가 추가되었습니다!');

    } catch (err) {
        alert('업로드 실패: ' + err.message);
    } finally {
        addQuestionBtn.disabled = false;
        addQuestionBtn.textContent = '문제 추가 (즉시 저장)';
    }
}

// ===== 문제 목록 =====

function loadQuestionList() {
    const questions = serverSettings.questionList || [];
    questionCountEl.textContent = questions.length;

    if (questions.length === 0) {
        questionListEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎙️</div>
                <div>등록된 문제가 없습니다.</div>
                <div style="margin-top:4px; font-size:0.85rem;">우측 상단 버튼으로 추가해주세요.</div>
            </div>
        `;
        return;
    }

    questionListEl.innerHTML = '';
    questions.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'question-item';
        item.innerHTML = `
            <span class="question-number">${index + 1}</span>
            <span class="question-answer">${q.answer}</span>
            <button class="btn-play-small" onclick="playQuestion('${q.audioUrl}')">▶️</button>
            <button class="btn-delete-small" onclick="deleteQuestion('${q.id}')">🗑️</button>
        `;
        questionListEl.appendChild(item);
    });
}

// 등록된 문제 재생 (서버 URL에서)
function playQuestion(audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play().catch(err => alert('재생 오류: ' + err.message));
}

// 문제 삭제
async function deleteQuestion(questionId) {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return;

    try {
        // 서버에서 오디오 파일 삭제
        await fetch(`/api/upload/${GAME_ID}/${questionId}`, { method: 'DELETE' });

        // 설정에서 문제 제거 후 저장 (공통 목록)
        serverSettings = await fetchSettings();
        if (serverSettings.questionList) {
            serverSettings.questionList = serverSettings.questionList.filter(q => q.id !== questionId);
        }
        await saveToServer(serverSettings);
        loadQuestionList();
    } catch (err) {
        alert('삭제 실패: ' + err.message);
    }
}

// ===== 모달 =====

function openAddModal() {
    resetRecordingForm();
    document.getElementById('addQuestionModal').classList.remove('hidden');
}

function closeAddModal() {
    // 녹음 중이면 중지
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    resetRecordingForm();
    document.getElementById('addQuestionModal').classList.add('hidden');
}

// 모달 배경 클릭 시 닫기
document.getElementById('addQuestionModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeAddModal();
});

// ===== 녹음 폼 초기화 =====

function resetRecordingForm() {
    newAnswerInput.value = '';
    recordedBlob = null;
    playBtn.classList.add('hidden');
    addQuestionBtn.disabled = true;
    addQuestionBtn.textContent = '문제 추가 (즉시 저장)';
    recordBtn.classList.remove('hidden');
    stopRecordBtn.classList.add('hidden');
    recordBtn.innerHTML = '🎙️ 녹음 시작';
    recordingTime.classList.add('hidden');
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
}
