// 관리자 설정 스크립트 (19 Reverse Audio)
const GAME_ID = 'game19';

// 난이도별 프리셋
const difficultyPresets = {
    0: { name: '🟢 쉬움', questions: 3, maxHints: 3 },
    1: { name: '🟡 보통', questions: 5, maxHints: 2 },
    2: { name: '🔴 어려움', questions: 7, maxHints: 1 }
};

// 전역 변수
let currentDifficulty = 0;
let recordedBlob = null;
let mediaRecorder = null;
let audioCtx = null;
let recordingStartTime = 0;
let recordingTimer = null;

// DOM 요소
const difficultySlider = document.getElementById('difficultySlider');
const currentDifficultyName = document.getElementById('currentDifficultyName');
const questionsInput = document.getElementById('questions');
const maxHintsInput = document.getElementById('maxHints');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const questionList = document.getElementById('questionList');
const questionCount = document.getElementById('questionCount');
const newAnswerInput = document.getElementById('newAnswer');
const recordBtn = document.getElementById('recordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const playBtn = document.getElementById('playBtn');
const recordingTime = document.getElementById('recordingTime');
const addQuestionBtn = document.getElementById('addQuestionBtn');

// 글로벌 설정 요소
const secretCodeInput = document.getElementById('secretCode');
const hintMessageInput = document.getElementById('hintMessage');
const successMessageInput = document.getElementById('successMessage');

// 초기화
window.addEventListener('load', () => {
    loadGlobalSettings();
    onDifficultyChange();
    setupEventListeners();
});

// 이벤트 리스너 설정
function setupEventListeners() {
    difficultySlider.addEventListener('input', onDifficultyChange);
    saveSettingsBtn.addEventListener('click', saveSettings);
    recordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    playBtn.addEventListener('click', playRecording);
    addQuestionBtn.addEventListener('click', addQuestion);
}

// 난이도 변경
function onDifficultyChange() {
    currentDifficulty = parseInt(difficultySlider.value);
    const preset = difficultyPresets[currentDifficulty];

    // 저장된 설정 로드
    const saved = JSON.parse(localStorage.getItem('reverseAudio_settings') || '{}');
    const settings = saved[currentDifficulty] || preset;

    questionsInput.value = settings.questions;
    maxHintsInput.value = settings.maxHints;
    currentDifficultyName.textContent = `${preset.name} 난이도 설정`;

    // 문제 목록 로드
    loadQuestionList();

    // 녹음 초기화
    resetRecordingForm();
}

// 설정 저장
function saveSettings() {
    const settings = JSON.parse(localStorage.getItem('reverseAudio_settings') || '{}');
    settings[currentDifficulty] = {
        questions: parseInt(questionsInput.value),
        maxHints: parseInt(maxHintsInput.value)
    };
    localStorage.setItem('reverseAudio_settings', JSON.stringify(settings));

    // 글로벌 설정 저장
    saveGlobalSettings();

    alert('설정이 저장되었습니다!');
}

// 글로벌 설정 로드
function loadGlobalSettings() {
    const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
    const myConfig = globalConfigs[GAME_ID] || {};

    secretCodeInput.value = myConfig.secretCode || '';
    hintMessageInput.value = myConfig.hintMessage || '';
    successMessageInput.value = myConfig.successMessage || '';
}

// 글로벌 설정 저장
function saveGlobalSettings() {
    const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};

    globalConfigs[GAME_ID] = {
        ...globalConfigs[GAME_ID],
        secretCode: secretCodeInput.value.trim(),
        hintMessage: hintMessageInput.value.trim(),
        successMessage: successMessageInput.value.trim(),
        isActive: true,
        lastUpdated: new Date().toISOString()
    };

    localStorage.setItem('treasureHunt_gameConfigs', JSON.stringify(globalConfigs));
}

// 녹음 시작
async function startRecording() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        const chunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunks.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            recordedBlob = new Blob(chunks, { type: 'audio/webm' });
            playBtn.classList.remove('hidden');
            addQuestionBtn.disabled = false;
            clearInterval(recordingTimer);
            recordingTime.classList.add('hidden');

            // 스트림 정리
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();

        // 녹음 시간 표시
        recordingTime.classList.remove('hidden');
        recordingTimer = setInterval(() => {
            const elapsed = (Date.now() - recordingStartTime) / 1000;
            recordingTime.textContent = `${elapsed.toFixed(1)}초`;
        }, 100);

        // 5초 후 자동 정지
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                stopRecording();
            }
        }, 5000);

        recordBtn.classList.add('hidden');
        stopRecordBtn.classList.remove('hidden');

    } catch (err) {
        console.error('Recording error:', err);
        alert('마이크 권한이 필요합니다.');
    }
}

// 녹음 정지
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        stopRecordBtn.classList.add('hidden');
        recordBtn.classList.remove('hidden');
        recordBtn.innerHTML = '🔄 다시 녹음';
    }
}

// 녹음 재생
async function playRecording() {
    if (!recordedBlob) return;

    try {
        const arrayBuffer = await recordedBlob.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start();

        playBtn.disabled = true;
        playBtn.textContent = '▶️ 재생 중...';

        source.onended = () => {
            playBtn.disabled = false;
            playBtn.textContent = '▶️ 재생';
        };
    } catch (error) {
        console.error('Playback error:', error);
        alert('재생 중 오류가 발생했습니다.');
    }
}

// 문제 추가
async function addQuestion() {
    const answer = newAnswerInput.value.trim();

    if (!answer) {
        alert('정답 단어를 입력해주세요.');
        return;
    }

    if (!recordedBlob) {
        alert('목소리를 녹음해주세요.');
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
        const questionId = `q_${currentDifficulty}_${Date.now()}`;

        // localStorage에 오디오 저장
        localStorage.setItem(`reverseAudio_${questionId}`, reader.result);

        // 문제 목록에 추가
        const questions = JSON.parse(
            localStorage.getItem(`reverseAudio_questions_${currentDifficulty}`) || '[]'
        );
        questions.push({ id: questionId, answer: answer });
        localStorage.setItem(
            `reverseAudio_questions_${currentDifficulty}`,
            JSON.stringify(questions)
        );

        alert('문제가 추가되었습니다!');
        loadQuestionList();
        resetRecordingForm();
    };

    reader.readAsDataURL(recordedBlob);
}

// 문제 목록 로드
function loadQuestionList() {
    const questions = JSON.parse(
        localStorage.getItem(`reverseAudio_questions_${currentDifficulty}`) || '[]'
    );

    questionCount.textContent = questions.length;

    if (questions.length === 0) {
        questionList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎙️</div>
                <div>등록된 문제가 없습니다.</div>
                <div>아래에서 새 문제를 추가해주세요.</div>
            </div>
        `;
        return;
    }

    questionList.innerHTML = '';
    questions.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'question-item';
        item.innerHTML = `
            <span class="question-number">${index + 1}</span>
            <span class="question-answer">${q.answer}</span>
            <button class="btn-play-small" onclick="playQuestion('${q.id}')">▶️</button>
            <button class="btn-delete-small" onclick="deleteQuestion('${q.id}')">🗑️</button>
        `;
        questionList.appendChild(item);
    });
}

// 문제 재생
async function playQuestion(questionId) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    try {
        const audioData = localStorage.getItem(`reverseAudio_${questionId}`);
        if (!audioData) {
            alert('오디오 데이터를 찾을 수 없습니다.');
            return;
        }

        // Base64 디코딩
        const binaryString = atob(audioData.split(',')[1]);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // AudioBuffer로 변환
        const arrayBuffer = bytes.buffer;
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        // 재생
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start();

    } catch (error) {
        console.error('Play error:', error);
        alert('재생 중 오류가 발생했습니다: ' + error.message);
    }
}

// 문제 삭제
function deleteQuestion(questionId) {
    if (!confirm('이 문제를 삭제하시겠습니까?')) return;

    // 오디오 데이터 삭제
    localStorage.removeItem(`reverseAudio_${questionId}`);

    // 문제 목록에서 제거
    const questions = JSON.parse(
        localStorage.getItem(`reverseAudio_questions_${currentDifficulty}`) || '[]'
    );
    const filtered = questions.filter(q => q.id !== questionId);
    localStorage.setItem(
        `reverseAudio_questions_${currentDifficulty}`,
        JSON.stringify(filtered)
    );

    loadQuestionList();
}

// 녹음 폼 초기화
function resetRecordingForm() {
    newAnswerInput.value = '';
    recordedBlob = null;
    playBtn.classList.add('hidden');
    addQuestionBtn.disabled = true;
    recordBtn.classList.remove('hidden');
    stopRecordBtn.classList.add('hidden');
    recordBtn.innerHTML = '🎙️ 녹음 시작';
    recordingTime.classList.add('hidden');
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
}
