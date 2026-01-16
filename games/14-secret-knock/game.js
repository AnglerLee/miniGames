// 비밀 노크 게임 (Touch Event - Time check) - 풀 버전

const GAME_ID = 'game14';

// DOM 요소
const door = document.getElementById('door');
const rhythmDisplay = document.getElementById('rhythmDisplay');
const rhythmFeedback = document.getElementById('rhythmFeedback');
const patternVisual = document.getElementById('patternVisual');
const patternHint = document.getElementById('patternHint');
const accuracyBars = document.getElementById('accuracyBars');

// 통계 요소
const attemptsEl = document.getElementById('attempts');
const successEl = document.getElementById('success');
const bestRecordEl = document.getElementById('bestRecord');

// 버튼
const difficultySelector = document.getElementById('difficultySelector');
const demoBtn = document.getElementById('demoBtn');
const resetBtn = document.getElementById('resetBtn');

// 난이도별 패턴 (ms 간격)
const patterns = {
    easy: {
        intervals: [400, 400], // 짧게-짧게
        tolerance: 250,
        name: '쉬움',
        description: '빠르게 두 번 노크',
        visual: ['small', 'small']
    },
    medium: {
        intervals: [300, 300, 800], // 짧게-짧게-길게
        tolerance: 200,
        name: '보통',
        description: '빠르게 두 번, 잠시 쉬고 한 번',
        visual: ['small', 'small', 'large']
    },
    hard: {
        intervals: [250, 600, 250, 800], // 짧-중-짧-길
        tolerance: 150,
        name: '어려움',
        description: '빠르게, 중간 쉬고, 빠르게, 길게 쉬고',
        visual: ['small', 'medium', 'small', 'large']
    }
};

// 게임 상태
let currentDifficulty = 'easy';
let knockTimes = [];
let attempts = 0;
let successCount = 0;
let isPlaying = true;
let isDemoMode = false;

// 게임 초기화
function initGame() {
    showInstructions(
        '🚪 비밀 노크',
        [
            '문지기가 암호를 요구합니다',
            '화면의 문을 리듬에 맞춰 노크하세요',
            '패턴을 정확히 따라하면 문이 열립니다',
            '데모를 보고 연습할 수 있어요'
        ],
        setupGame
    );
}

// 게임 설정
function setupGame() {
    setupDifficultyButtons();
    setupDoorKnock();
    setupActionButtons();
    updatePatternDisplay();
    loadBestRecord();
    updateStats();
}

// 난이도 버튼 설정
function setupDifficultyButtons() {
    const buttons = difficultySelector.querySelectorAll('.difficulty-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDifficulty = btn.dataset.level;
            resetAttempt();
            updatePatternDisplay();
            loadBestRecord();
        });
    });
}

// 문 노크 설정
function setupDoorKnock() {
    door.addEventListener('click', handleKnock);
    door.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleKnock();
    });
}

// 액션 버튼 설정
function setupActionButtons() {
    demoBtn.addEventListener('click', playDemo);
    resetBtn.addEventListener('click', resetAttempt);
}

// 패턴 표시 업데이트
function updatePatternDisplay() {
    const pattern = patterns[currentDifficulty];

    // 시각적 표시
    patternVisual.innerHTML = '';
    const knockCount = pattern.intervals.length + 1;

    for (let i = 0; i < knockCount; i++) {
        const beat = document.createElement('div');
        beat.className = `knock-beat ${pattern.visual[i] || 'small'}`;
        beat.textContent = '🔨';
        patternVisual.appendChild(beat);

        if (i < knockCount - 1) {
            const pause = document.createElement('div');
            pause.className = 'knock-pause';
            pause.textContent = pattern.intervals[i] > 500 ? '━━' : '━';
            patternVisual.appendChild(pause);
        }
    }

    // 힌트 텍스트
    patternHint.innerHTML = `<strong>리듬:</strong> ${pattern.description}`;
}

// 노크 처리
function handleKnock() {
    if (!isPlaying || isDemoMode) return;

    const now = Date.now();
    knockTimes.push(now);

    // 시각적 피드백
    door.classList.add('knocking');
    setTimeout(() => door.classList.remove('knocking'), 300);

    // 노크 표시
    rhythmDisplay.textContent += '🔨';

    // 사운드
    playKnockSound();

    // 진동
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }

    // 패턴 시각화 업데이트
    highlightPatternBeat(knockTimes.length - 1);

    const pattern = patterns[currentDifficulty];
    const expectedKnocks = pattern.intervals.length + 1;

    // 모든 노크 완료
    if (knockTimes.length === expectedKnocks) {
        isPlaying = false;
        setTimeout(checkPattern, 500);
    } else if (knockTimes.length > expectedKnocks) {
        // 너무 많이 노크 - 리셋
        resetAttempt();
    }
}

// 패턴 비트 강조
function highlightPatternBeat(index) {
    const beats = patternVisual.querySelectorAll('.knock-beat');
    if (beats[index]) {
        beats[index].classList.add('active');
    }
}

// 패턴 확인
function checkPattern() {
    attempts++;

    const pattern = patterns[currentDifficulty];
    const intervals = [];

    for (let i = 1; i < knockTimes.length; i++) {
        intervals.push(knockTimes[i] - knockTimes[i - 1]);
    }

    // 정확도 계산
    const accuracies = intervals.map((interval, i) => {
        const expected = pattern.intervals[i];
        const diff = Math.abs(interval - expected);
        const accuracy = Math.max(0, 100 - (diff / pattern.tolerance * 100));
        return {
            interval,
            expected,
            diff,
            accuracy,
            match: diff < pattern.tolerance
        };
    });

    const allMatch = accuracies.every(a => a.match);
    const avgAccuracy = accuracies.reduce((sum, a) => sum + a.accuracy, 0) / accuracies.length;

    // 정확도 바 표시
    displayAccuracy(accuracies);

    if (allMatch) {
        // 성공!
        successCount++;
        rhythmFeedback.textContent = '✅ 정답! 문이 열렸습니다!';
        rhythmFeedback.className = 'rhythm-feedback success';

        playSound('success');

        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }

        // 최고 기록 저장
        saveBestRecord(attempts);
        updateStats();

        setTimeout(() => {
            showSuccessScreen(GAME_ID);
        }, 1500);

    } else {
        // 실패
        rhythmFeedback.textContent = `❌ 틀렸습니다 (정확도: ${Math.round(avgAccuracy)}%)`;
        rhythmFeedback.className = 'rhythm-feedback error';

        playSound('fail');

        if (navigator.vibrate) {
            navigator.vibrate(200);
        }

        updateStats();

        setTimeout(() => {
            resetAttempt();
        }, 2500);
    }
}

// 정확도 표시
function displayAccuracy(accuracies) {
    accuracyBars.style.display = 'block';
    accuracyBars.innerHTML = '';

    accuracies.forEach((acc, i) => {
        const bar = document.createElement('div');
        bar.className = 'accuracy-bar';

        const label = document.createElement('div');
        label.className = 'accuracy-label';
        label.textContent = `노크 ${i + 1}→${i + 2}: ${Math.round(acc.accuracy)}% (${acc.interval}ms vs ${acc.expected}ms)`;

        const container = document.createElement('div');
        container.className = 'accuracy-fill-container';

        const fill = document.createElement('div');
        fill.className = 'accuracy-fill';
        fill.style.width = `${acc.accuracy}%`;

        if (acc.accuracy >= 70) {
            fill.classList.add('good');
        } else if (acc.accuracy >= 40) {
            fill.classList.add('okay');
        } else {
            fill.classList.add('bad');
        }

        container.appendChild(fill);
        bar.appendChild(label);
        bar.appendChild(container);
        accuracyBars.appendChild(bar);
    });
}

// 노크 사운드
// 노크 사운드
let knockContext = null;

function getKnockContext() {
    if (!knockContext) {
        knockContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (knockContext.state === 'suspended') {
        knockContext.resume();
    }
    return knockContext;
}

function playKnockSound() {
    try {
        const ctx = getKnockContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.setValueAtTime(200, ctx.currentTime);
        oscillator.type = 'square';
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.1);
    } catch (e) {
        playSound('click');
    }
}

// 데모 재생
async function playDemo() {
    if (isDemoMode) return;

    isDemoMode = true;
    demoBtn.disabled = true;

    const pattern = patterns[currentDifficulty];
    const demoIndicator = document.createElement('div');
    demoIndicator.className = 'demo-indicator';
    demoIndicator.textContent = '데모 재생 중...';
    document.body.appendChild(demoIndicator);

    // 리듬 초기화
    rhythmDisplay.textContent = '';
    rhythmFeedback.textContent = '';

    // 패턴 강조 초기화
    const beats = patternVisual.querySelectorAll('.knock-beat');
    beats.forEach(b => b.classList.remove('active'));

    // 첫 노크
    await sleep(500);
    simulateKnock(0);

    // 나머지 노크
    for (let i = 0; i < pattern.intervals.length; i++) {
        await sleep(pattern.intervals[i]);
        simulateKnock(i + 1);
    }

    await sleep(1000);

    demoIndicator.remove();
    demoBtn.disabled = false;
    isDemoMode = false;

    rhythmDisplay.textContent = '';
    beats.forEach(b => b.classList.remove('active'));
}

// 노크 시뮬레이션
function simulateKnock(index) {
    door.classList.add('knocking');
    setTimeout(() => door.classList.remove('knocking'), 300);

    rhythmDisplay.textContent += '🔨';
    playKnockSound();

    if (navigator.vibrate) {
        navigator.vibrate(50);
    }

    highlightPatternBeat(index);
}

// 딜레이 함수
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 시도 리셋
function resetAttempt() {
    knockTimes = [];
    rhythmDisplay.textContent = '';
    rhythmFeedback.textContent = '';
    accuracyBars.style.display = 'none';
    isPlaying = true;

    // 패턴 강조 초기화
    const beats = patternVisual.querySelectorAll('.knock-beat');
    beats.forEach(b => b.classList.remove('active'));
}

// 통계 업데이트
function updateStats() {
    attemptsEl.textContent = attempts;
    successEl.textContent = successCount;
}

// 최고 기록 불러오기
function loadBestRecord() {
    const recordKey = `secret_knock_best_${currentDifficulty}`;
    const best = localStorage.getItem(recordKey);

    if (best) {
        bestRecordEl.textContent = `${best}회`;
    } else {
        bestRecordEl.textContent = '-';
    }
}

// 최고 기록 저장
function saveBestRecord(attemptCount) {
    const recordKey = `secret_knock_best_${currentDifficulty}`;
    const best = localStorage.getItem(recordKey);

    if (!best || attemptCount < parseInt(best)) {
        localStorage.setItem(recordKey, attemptCount);
        bestRecordEl.textContent = `${attemptCount}회`;
    }
}

// 게임 시작
initGame();
