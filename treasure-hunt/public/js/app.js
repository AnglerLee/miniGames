/* ===== app.js - App Initialization & Utilities (Server Version) ===== */

const App = {
    heartbeatInterval: null,

    async init() {
        await GameEngine.init();

        const config = Storage.getCachedConfig() || await Storage.getConfig();
        if (config && config.theme) {
            ThemeManager.apply(config.theme);
        }

        // Connect SSE with playerId (if available)
        const playerId = Storage.getMyPlayerId();
        SSEClient.connect(playerId);

        // Start heartbeat if player is registered
        if (playerId) {
            this.startHeartbeat(playerId);
        }
    },

    startHeartbeat(playerId) {
        this.stopHeartbeat();
        const sendBeat = async () => {
            const result = await ApiClient.sendHeartbeat(playerId);
            if (result && result.sessionMismatch) {
                // New game session started while we were active → reset and go to player select
                this.stopHeartbeat();
                Storage.clearMyPlayer();
                SSEClient.disconnect();
                window.location.href = 'index.html';
            }
        };
        // Send immediately, then every 15 seconds
        sendBeat();
        this.heartbeatInterval = setInterval(sendBeat, 15000);
    },

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    },

    /**
     * Register as a player and start heartbeat + SSE
     */
    async registerPlayer(name) {
        const result = await ApiClient.joinGame(name);
        if (result && result.playerId) {
            Storage.setMyPlayerId(result.playerId);
            Storage.setMyPlayerName(name);

            // Save session ID so we can detect when a new game starts
            if (result.state && result.state.sessionId) {
                Storage.setMySessionId(result.state.sessionId);
            }

            // Reconnect SSE with new playerId
            SSEClient.connect(result.playerId);
            this.startHeartbeat(result.playerId);

            // Update game engine state
            if (result.state) {
                GameEngine.updateState(result.state);
            }

            return result.playerId;
        }
        return null;
    },

    /**
     * Check if the stored session ID matches the server's current session.
     * Returns false when a new game has been started and the player must re-select.
     */
    isSessionValid(state) {
        if (!state || !state.sessionId) return true; // server has no session tracking yet
        const mySessionId = Storage.getMySessionId();
        if (!mySessionId) return false;              // we never joined this session
        return mySessionId === state.sessionId;
    },

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    },

    createTimer(duration, onTick, onComplete) {
        let timeLeft = duration;
        let interval = null;

        function tick() {
            timeLeft--;
            if (onTick) onTick(timeLeft, duration);
            if (timeLeft <= 0) {
                clearInterval(interval);
                if (onComplete) onComplete();
            }
        }

        interval = setInterval(tick, 1000);

        return {
            stop() { clearInterval(interval); },
            getTimeLeft() { return timeLeft; },
            addTime(sec) { timeLeft += sec; }
        };
    },

    addUnifiedEvent(element, handler) {
        if (!element) return;
        let touched = false;
        let touchMoved = false;

        element.addEventListener('touchstart', function () {
            touchMoved = false;
        }, { passive: true });

        element.addEventListener('touchmove', function () {
            touchMoved = true;
        }, { passive: true });

        element.addEventListener('touchend', function (e) {
            if (touchMoved) return;
            e.preventDefault();
            touched = true;
            handler(e);
            setTimeout(function () { touched = false; }, 300);
        });

        element.addEventListener('click', function (e) {
            if (!touched) handler(e);
        });
    },

    navigate(url) {
        window.location.href = url;
    },

    getQueryParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    },

    getHash() {
        return window.location.hash.replace('#', '');
    },

    setHash(hash) {
        window.location.hash = hash;
    },

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
