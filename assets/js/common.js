// 공통 유틸리티 함수 - 보물찾기 미니게임

// 게임 설정 가져오기
function getGameConfig(gameId) {
    try {
        const configStr = localStorage.getItem('treasureHunt_gameConfigs');
        const configs = configStr ? JSON.parse(configStr) : {};
        return configs[gameId] || {
            secretCode: '',
            hintMessage: '',
            successMessage: '축하합니다! 게임을 클리어했어요!',
            isActive: true
        };
    } catch (e) {
        console.error('설정 로드 오류:', e);
        return {
            secretCode: '',
            hintMessage: '',
            successMessage: '축하합니다! 게임을 클리어했어요!',
            isActive: true
        };
    }
}

// 성공 화면 표시
function showSuccessScreen(gameId) {
    const config = getGameConfig(gameId);

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content success-screen fade-in">
            <div class="icon">🎉</div>
            <h2>게임 클리어!</h2>
            <p class="success-message">${config.successMessage}</p>
            
            ${config.secretCode ? `
                <div class="secret-code">
                    <h3>🔑 비밀번호</h3>
                    <div class="code">${config.secretCode}</div>
                </div>
            ` : ''}
            
            ${config.hintMessage ? `
                <div class="hint-message">
                    <h3>💡 다음 힌트</h3>
                    <p>${config.hintMessage}</p>
                </div>
            ` : ''}
            
            <button class="btn btn-primary btn-large" onclick="location.href='../../index.html'">
                홈으로 돌아가기
            </button>
            <button class="btn btn-secondary" onclick="location.reload()">
                다시 하기
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // 진동 피드백 (지원하는 경우)
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
}

// 실패 화면 표시
function showFailScreen(message = '아쉽지만 실패했어요. 다시 도전해보세요!', gameId = null, onRetry = null) {
    const modal = document.createElement('div');
    modal.className = 'modal active';

    // gameId와 treasureHunt 설정 통합 (필요시)
    let additionalContent = '';
    if (gameId) {
        const config = getGameConfig(gameId);
        if (config.secretCode) {
            // 여기서는 실패 화면이므로 추가 정보는 표시하지 않음
        }
    }

    modal.innerHTML = `
        <div class="modal-content fade-in">
            <div class="icon" style="font-size: 80px;">😢</div>
            <h2>다시 도전!</h2>
            <p>${message}</p>
            ${onRetry ? `
                <button class="btn btn-primary btn-large" id="retryBtn">
                    재시도 (+약간 쉬워짐)
                </button>
            ` : ''}
            <button class="btn ${onRetry ? 'btn-secondary' : 'btn-primary btn-large'}" onclick="location.reload()">
                ${onRetry ? '처음부터 다시' : '다시 시작'}
            </button>
            <button class="btn btn-secondary" onclick="location.href='../../index.html'">
                홈으로
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // 재시도 버튼 이벤트 리스너 추가
    if (onRetry) {
        const retryBtn = document.getElementById('retryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                modal.remove();
                onRetry();
            });
        }
    }

    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
}

// 게임 설명 모달 표시
function showInstructions(title, instructions, onStart) {
    const modal = document.createElement('div');
    modal.className = 'modal active';

    let instructionHTML = '';
    if (Array.isArray(instructions)) {
        instructionHTML = '<ul>' + instructions.map(item => `<li>${item}</li>`).join('') + '</ul>';
    } else {
        instructionHTML = `<p>${instructions}</p>`;
    }

    modal.innerHTML = `
        <div class="modal-content instruction-screen fade-in">
            <h2>${title}</h2>
            ${instructionHTML}
            <button class="btn btn-primary btn-large" id="startGameBtn">
                게임 시작!
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('startGameBtn').addEventListener('click', () => {
        modal.remove();
        if (onStart) onStart();
    });
}

// 타이머 생성
function createTimer(duration, onTick, onComplete) {
    let timeLeft = duration;

    const timerInterval = setInterval(() => {
        timeLeft--;

        if (onTick) {
            onTick(timeLeft);
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (onComplete) {
                onComplete();
            }
        }
    }, 1000);

    return {
        stop: () => clearInterval(timerInterval),
        getTimeLeft: () => timeLeft,
        addTime: (seconds) => { timeLeft += seconds; }
    };
}

// 시간 포맷팅 (초 -> MM:SS)
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 배열 섞기 (Fisher-Yates shuffle)
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// 랜덤 정수 생성
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 효과음 재생 (Web Audio API 사용)
// 오디오 컨텍스트 싱글톤 관리
let audioContext = null;

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    return audioContext;
}

// 효과음 재생 (Web Audio API 사용)
function playSound(type) {
    try {
        const ctx = getAudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        gainNode.gain.value = 0.3;

        const now = ctx.currentTime;

        switch (type) {
            case 'success':
                oscillator.frequency.setValueAtTime(800, now);
                oscillator.type = 'sine';
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                oscillator.start(now);
                oscillator.stop(now + 0.5);
                break;
            case 'fail':
                oscillator.frequency.setValueAtTime(200, now);
                oscillator.type = 'sawtooth';
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                break;
            case 'click':
                oscillator.frequency.setValueAtTime(400, now);
                oscillator.type = 'square';
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                oscillator.start(now);
                oscillator.stop(now + 0.1);
                break;
        }
    } catch (e) {
        console.warn('Audio play failed:', e);
    }
}

// 터치/마우스 이벤트 통합
function addUnifiedEventListener(element, handler) {
    element.addEventListener('click', handler);
    element.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handler(e);
    });
}

// 로컬 스토리지 헬퍼
const storage = {
    get: (key, defaultValue = null) => {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch {
            return defaultValue;
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    },
    remove: (key) => {
        localStorage.removeItem(key);
    }
};
