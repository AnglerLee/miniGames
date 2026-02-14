/* ===== app.js - App Initialization & Utilities ===== */

const App = {
    init() {
        GameEngine.init();

        const config = Storage.getConfig();
        if (config && config.theme) {
            ThemeManager.apply(config.theme);
        }
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
            if (touchMoved) return; // Was a scroll, not a tap
            e.preventDefault(); // Prevent ghost click on element behind
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
