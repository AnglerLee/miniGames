// 공통 유틸리티 함수 - 보물찾기 미니게임 (Server Version)
// 서버 API를 통해 게임 설정을 관리합니다.

// ===== localStorage → Server Sync Layer =====
// 게임의 기존 localStorage 호출을 가로채서 서버와 동기화합니다.
// 원리: 서버에 게임별 설정 키-값을 저장하고, 페이지 로드 시 복원합니다.
//       이번 세션에서 setItem으로 명시적으로 쓴 키만 서버에 저장합니다.
//       (다른 게임의 localStorage 데이터가 섞이지 않도록 sessionKeys로 추적)
(function() {
    // URL에서 게임 번호 추출 (예: /games/02-maze/ → 02, /games/game19/ → 19)
    var pathMatch = location.pathname.match(/\/games\/(?:game)?(\d+)/);
    if (!pathMatch) return; // 게임 페이지가 아니면 패치하지 않음

    var gameNum = pathMatch[1].padStart(2, '0');
    var gameId = 'game' + gameNum;

    // 원래 메서드 저장
    var _origSetItem = localStorage.setItem.bind(localStorage);
    var _origGetItem = localStorage.getItem.bind(localStorage);
    var _origRemoveItem = localStorage.removeItem.bind(localStorage);

    // 이번 세션에서 이 게임이 setItem한 키만 추적
    var sessionKeys = new Set();

    // 서버에서 설정 로드 → localStorage에 채우기 (동기)
    try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/games/' + gameId + '/settings', false);
        xhr.send();
        if (xhr.status === 200) {
            var serverData = JSON.parse(xhr.responseText);
            if (serverData && typeof serverData === 'object') {
                // 서버 데이터의 각 키를 localStorage에 복원
                Object.keys(serverData).forEach(function(key) {
                    var val = serverData[key];
                    if (val !== null && val !== undefined) {
                        _origSetItem(key, typeof val === 'string' ? val : JSON.stringify(val));
                        // 이 게임의 소유 키로 등록 (다음 저장 시 유지)
                        sessionKeys.add(key);
                    }
                });
            }
        }
    } catch (e) {
        console.warn('[GameSync] Server load failed for ' + gameId + ':', e.message);
    }

    // 게임 관련 키인지 확인 (treasure hunt 시스템 키는 제외)
    var SYSTEM_KEYS = ['treasureHunt3_config', 'treasureHunt3_state', 'treasureHunt3_admin', 'treasureHunt3_history', 'treasureHunt_gameConfigs'];
    function isGameKey(key) {
        if (SYSTEM_KEYS.indexOf(key) !== -1) return false;
        if (key.startsWith('treasureHunt')) return false;
        return true;
    }

    // 값 크기 제한 (50KB 초과 값은 저장 제외 - base64 이미지 등 방지)
    var MAX_VALUE_BYTES = 51200;

    // 서버에 저장하는 헬퍼 (sessionKeys에 등록된 이 게임의 키만 전송)
    var saveTimer = null;
    function scheduleServerSave() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(function() {
            saveTimer = null;
            var data = {};
            sessionKeys.forEach(function(key) {
                var raw = _origGetItem(key);
                if (raw === null) return; // 삭제된 키 제외
                if (raw.length > MAX_VALUE_BYTES) {
                    console.warn('[GameSync] Key "' + key + '" skipped: value too large (' + raw.length + ' bytes)');
                    return;
                }
                try {
                    data[key] = JSON.parse(raw);
                } catch (e) {
                    data[key] = raw;
                }
            });
            // 비동기로 서버에 저장
            fetch('/api/games/' + gameId + '/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).catch(function() {});
        }, 300); // 300ms 디바운스
    }

    // setItem 패치: 이 게임이 쓴 키를 sessionKeys에 등록
    localStorage.setItem = function(key, value) {
        _origSetItem(key, value);
        if (isGameKey(key)) {
            sessionKeys.add(key);
            scheduleServerSave();
        }
    };

    // removeItem 패치: sessionKeys에서도 제거
    localStorage.removeItem = function(key) {
        _origRemoveItem(key);
        if (isGameKey(key)) {
            sessionKeys.delete(key);
            scheduleServerSave();
        }
    };
})();

// ===== GameSettingsAPI (직접 서버 통신용, 고급 사용) =====
var GameSettingsAPI = {
    async load(gameId) {
        try {
            var res = await fetch('/api/games/' + gameId + '/settings');
            if (!res.ok) return null;
            return res.json();
        } catch (e) {
            return null;
        }
    },

    async save(gameId, data) {
        try {
            var res = await fetch('/api/games/' + gameId + '/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    },

    async uploadFile(file, gameId, type) {
        var formData = new FormData();
        formData.append('file', file);
        formData.append('gameId', gameId);
        formData.append('type', type || 'file');
        try {
            var res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            if (!res.ok) return null;
            return res.json();
        } catch (e) {
            return null;
        }
    }
};

// ===== storage 호환 래퍼 =====
var storage = {
    get: function(key, defaultValue) {
        if (defaultValue === undefined) defaultValue = null;
        try {
            var value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    },
    set: function(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    },
    remove: function(key) {
        localStorage.removeItem(key);
    }
};

// 부모(treasure-hunt)에서 전달받은 테마 배경색 적용
window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'THEME_BG') {
        var bg = e.data.gradient || e.data.bg;
        if (bg) {
            document.body.style.background = bg;
            document.body.style.backgroundAttachment = 'fixed';
        }
    }
});

// 게임 설정 가져오기 (보물찾기 모드용)
function getGameConfig(gameId) {
    return {
        secretCode: '',
        hintMessage: '',
        successMessage: '축하합니다! 게임을 클리어했어요!',
        isActive: true
    };
}

// 성공 화면 표시
function showSuccessScreen(gameId) {
    // iframe 내부에서 실행 중이면 부모에게 postMessage
    if (window.parent !== window) {
        window.parent.postMessage({
            type: 'GAME_CLEAR',
            gameId: gameId
        }, '*');

        var overlay = document.createElement('div');
        overlay.className = 'modal active';
        overlay.innerHTML =
            '<div class="modal-content success-screen fade-in">' +
                '<div class="icon">🎉</div>' +
                '<h2>게임 클리어!</h2>' +
                '<p class="success-message">잠시 후 다음 미션으로 이동합니다...</p>' +
            '</div>';
        document.body.appendChild(overlay);

        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
        return;
    }

    // 독립 실행 모드
    var config = getGameConfig(gameId);

    var modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML =
        '<div class="modal-content success-screen fade-in">' +
            '<div class="icon">🎉</div>' +
            '<h2>게임 클리어!</h2>' +
            '<p class="success-message">' + config.successMessage + '</p>' +
            '<div class="modal-buttons">' +
                '<button class="btn btn-primary" onclick="location.reload()">다시 하기</button>' +
                '<button class="btn btn-secondary" onclick="location.href=\'/\'">홈으로</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(modal);

    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
}

// 실패 화면 표시
function showFailScreen(message, gameId, onRetry) {
    if (!message) message = '아쉽지만 실패했어요. 다시 도전해보세요!';

    var modal = document.createElement('div');
    modal.className = 'modal active';

    modal.innerHTML =
        '<div class="modal-content fade-in">' +
            '<div class="icon" style="font-size: 80px;">😢</div>' +
            '<h2>다시 도전!</h2>' +
            '<p>' + message + '</p>' +
            '<div class="modal-buttons">' +
                (onRetry ? '<button class="btn btn-primary" id="retryBtn">재시도</button>' : '') +
                '<button class="btn ' + (onRetry ? 'btn-secondary' : 'btn-primary') + '" onclick="location.reload()">' +
                    (onRetry ? '처음부터' : '다시 시작') +
                '</button>' +
                '<button class="btn btn-secondary" onclick="location.href=\'/\'">홈으로</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(modal);

    if (onRetry) {
        var retryBtn = document.getElementById('retryBtn');
        if (retryBtn) {
            retryBtn.addEventListener('click', function() {
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
    var modal = document.createElement('div');
    modal.className = 'modal active';

    var instructionHTML = '';
    if (Array.isArray(instructions)) {
        instructionHTML = '<ul>' + instructions.map(function(item) { return '<li>' + item + '</li>'; }).join('') + '</ul>';
    } else {
        instructionHTML = '<p>' + instructions + '</p>';
    }

    modal.innerHTML =
        '<div class="modal-content instruction-screen fade-in">' +
            '<h2>' + title + '</h2>' +
            instructionHTML +
            '<button class="btn btn-primary btn-large" id="startGameBtn">게임 시작!</button>' +
        '</div>';

    document.body.appendChild(modal);

    document.getElementById('startGameBtn').addEventListener('click', function() {
        modal.remove();
        if (onStart) onStart();
    });
}

// 타이머 생성
function createTimer(duration, onTick, onComplete) {
    var timeLeft = duration;

    var timerInterval = setInterval(function() {
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
        stop: function() { clearInterval(timerInterval); },
        getTimeLeft: function() { return timeLeft; },
        addTime: function(seconds) { timeLeft += seconds; }
    };
}

// 시간 포맷팅 (초 -> MM:SS)
function formatTime(seconds) {
    var mins = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
}

// 배열 섞기 (Fisher-Yates shuffle)
function shuffleArray(array) {
    var newArray = array.slice();
    for (var i = newArray.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = newArray[i];
        newArray[i] = newArray[j];
        newArray[j] = temp;
    }
    return newArray;
}

// 랜덤 정수 생성
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 오디오 컨텍스트 싱글톤 관리
var audioContext = null;

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
        var ctx = getAudioContext();
        var oscillator = ctx.createOscillator();
        var gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        gainNode.gain.value = 0.3;

        var now = ctx.currentTime;

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
    element.addEventListener('touchstart', function(e) {
        e.preventDefault();
        handler(e);
    });
}
