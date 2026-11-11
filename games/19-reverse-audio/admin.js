// 리버스 오디오 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
// 녹음 문제는 예전과 같은 자리에 저장한다:
//   reverseAudio_questions_0|1|2 = [{ id, answer }]  (난이도별 목록)
//   reverseAudio_<id>             = 녹음 data URL (JSON 이 아닌 문자열 그대로)
(function () {
    'use strict';

    const h = AdminKit.h;
    const KEY = 'reverseAudio_settings';
    const LEVEL_NAMES = ['쉬움', '보통', '어려움'];
    const MAX_SEC = 5; // 녹음 최대 길이

    // ----- 예전 설정 { "0": { questions, maxHints }, ... } 을 새 칸에 옮겨 보여 준다 (예전 게임은 쉬움만 썼다)
    function applyLegacy(api) {
        const old = api.stored();
        if (old.difficulty !== undefined || !old[0] || typeof old[0] !== 'object') return;
        const q = Number(old[0].questions);
        const hints = Number(old[0].maxHints);
        if (Number.isFinite(q) && q > 0) api.set('questions', Math.min(4, Math.max(2, Math.round(q))));
        if (Number.isFinite(hints) && hints >= 0) api.set('maxHints', Math.min(5, Math.round(hints)));
    }

    // ----- 저장소
    function readList(level) {
        try {
            const list = JSON.parse(localStorage.getItem('reverseAudio_questions_' + level));
            return Array.isArray(list) ? list.filter((q) => q && typeof q.id === 'string') : [];
        } catch (e) {
            return [];
        }
    }

    function writeList(level, list) {
        localStorage.setItem('reverseAudio_questions_' + level, JSON.stringify(list));
    }

    function readAudio(id) {
        try {
            return localStorage.getItem('reverseAudio_' + id);
        } catch (e) {
            return null;
        }
    }

    function allItems() {
        const out = [];
        [0, 1, 2].forEach((level) => readList(level).forEach((q) => out.push({ id: q.id, answer: String(q.answer || ''), level })));
        return out;
    }

    // ----- 소리
    let ctx = null;
    let playing = null;
    function audioCtx() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            ctx = AC ? new AC() : null;
        }
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
    }

    function decode(arrayBuffer) {
        return new Promise((resolve, reject) => {
            try {
                const p = audioCtx().decodeAudioData(arrayBuffer, resolve, reject);
                if (p && p.then) p.then(resolve, reject);
            } catch (e) {
                reject(e);
            }
        });
    }

    function dataUrlToBuffer(url) {
        const comma = url.indexOf(',');
        const body = url.slice(comma + 1);
        const bin = /;base64/i.test(url.slice(0, comma)) ? atob(body) : decodeURIComponent(body);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 255;
        return bytes.buffer;
    }

    function reverseBuffer(buffer) {
        const out = audioCtx().createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        for (let c = 0; c < buffer.numberOfChannels; c++) {
            const src = buffer.getChannelData(c);
            const dst = out.getChannelData(c);
            for (let i = 0, n = src.length; i < n; i++) dst[i] = src[n - 1 - i];
        }
        return out;
    }

    function stopPlaying() {
        if (playing) {
            try {
                playing.onended = null;
                playing.stop();
            } catch (e) {
                /* 이미 멈춤 */
            }
        }
        playing = null;
    }

    /** arrayBuffer 를 재생한다. reverse 면 거꾸로. 실패하면 false */
    async function playArrayBuffer(arrayBuffer, reverse) {
        if (!audioCtx()) return false;
        try {
            const buffer = await decode(arrayBuffer);
            stopPlaying();
            const src = ctx.createBufferSource();
            src.buffer = reverse ? reverseBuffer(buffer) : buffer;
            src.connect(ctx.destination);
            src.start();
            playing = src;
            return true;
        } catch (e) {
            return false;
        }
    }

    // ----- 녹음 문제 관리 화면
    function renderRecordings(form, api) {
        const countEl = h('span', { class: 'ra-count' });
        const list = h('div', { class: 'ra-list' });
        const answerInput = h('input', { type: 'text', class: 'form-input', id: 'raAnswer', maxlength: 20, placeholder: '예: 냉장고, 무지개, 문을 열어라' });
        const recordBtn = h('button', { type: 'button', class: 'btn ra-rec', id: 'raRecord', text: '🎙️ 녹음 시작' });
        const previewBtn = h('button', { type: 'button', class: 'btn ra-small', id: 'raPreview', text: '▶ 들어 보기', disabled: true });
        const previewRevBtn = h('button', { type: 'button', class: 'btn ra-small', id: 'raPreviewRev', text: '◀ 거꾸로', disabled: true });
        const timeEl = h('span', { class: 'ra-time' });
        const addBtn = h('button', { type: 'button', class: 'btn ra-add', id: 'raAdd', text: '➕ 문제 추가', disabled: true });
        const levelEl = h('small', { class: 'ak-help' });

        let blob = null;
        let recorder = null;
        let stream = null;
        let tick = null;
        let autoStop = null;
        let startedAt = 0;
        let armedId = null;
        let armTimer = null;

        function paintAdd() {
            addBtn.disabled = !blob || !answerInput.value.trim() || !!recorder;
            previewBtn.disabled = !blob || !!recorder;
            previewRevBtn.disabled = !blob || !!recorder;
            levelEl.textContent = `새 문제는 위에서 고른 「${LEVEL_NAMES[api.level()]}」 목록에 들어갑니다. 게임은 지금 난이도의 녹음을 먼저 쓰고, 모자라면 다른 목록의 녹음도 씁니다.`;
        }

        function paintList() {
            const items = allItems();
            let bytes = 0;
            list.innerHTML = '';
            if (!items.length) {
                list.appendChild(h('div', { class: 'ra-empty', html: '<b>🎙️</b>아직 녹음이 없어요.<br>녹음이 없어도 게임은 됩니다. 2스테이지가 <b>녹음 대결</b>이나 <b>빠른 동요</b>로 바뀝니다.' }));
            }
            items.forEach((item, i) => {
                const url = readAudio(item.id);
                bytes += url ? url.length : 0;
                const del = h('button', { type: 'button', class: 'ra-icon del', title: '지우기', text: armedId === item.id ? '한 번 더' : '🗑️' });
                const row = h('div', { class: 'ra-row' + (url ? '' : ' broken') }, [
                    h('span', { class: 'ra-num', text: String(i + 1) }),
                    h('div', { class: 'ra-main' }, [
                        h('span', { class: 'ra-answer', text: item.answer || '(정답 없음)' }),
                        h('span', { class: 'ra-tag lv' + item.level, text: LEVEL_NAMES[item.level] + (url ? '' : ' · 녹음 없음') }),
                    ]),
                    h('div', { class: 'ra-acts' }, [
                        h('button', { type: 'button', class: 'ra-icon', title: '앞으로 듣기', text: '▶', onclick: () => playStored(item, false) }),
                        h('button', { type: 'button', class: 'ra-icon', title: '거꾸로 듣기', text: '◀', onclick: () => playStored(item, true) }),
                        del,
                    ]),
                ]);
                del.addEventListener('click', () => removeItem(item));
                list.appendChild(row);
            });
            countEl.textContent = `${items.length}개 · 약 ${Math.round((bytes * 0.75) / 1024)}KB`;
        }

        async function playStored(item, reverse) {
            const url = readAudio(item.id);
            if (!url) return api.toast('녹음 파일을 찾을 수 없어요');
            let ok = false;
            try {
                ok = await playArrayBuffer(dataUrlToBuffer(url), reverse);
            } catch (e) {
                ok = false;
            }
            if (!ok) api.toast('이 기기에서는 이 녹음을 재생할 수 없어요');
        }

        // 지우기는 두 번 눌러야 한다
        function removeItem(item) {
            if (armedId !== item.id) {
                armedId = item.id;
                clearTimeout(armTimer);
                armTimer = setTimeout(() => {
                    armedId = null;
                    paintList();
                }, 3000);
                paintList();
                api.toast('한 번 더 누르면 지워요');
                return;
            }
            armedId = null;
            clearTimeout(armTimer);
            try {
                localStorage.removeItem('reverseAudio_' + item.id);
                writeList(item.level, readList(item.level).filter((q) => q.id !== item.id));
            } catch (e) {
                /* 저장소를 쓸 수 없는 환경 */
            }
            paintList();
            api.toast('녹음을 지웠어요');
        }

        function endRecording() {
            clearInterval(tick);
            clearTimeout(autoStop);
            tick = null;
            autoStop = null;
            if (stream) stream.getTracks().forEach((t) => t.stop());
            stream = null;
        }

        async function startRecording() {
            if (recorder) {
                try {
                    recorder.stop();
                } catch (e) {
                    recorder = null;
                    endRecording();
                }
                return;
            }
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
                api.toast('이 브라우저에서는 녹음을 할 수 없어요');
                return;
            }
            audioCtx(); // 버튼을 누른 순간에 소리 장치를 깨워 둔다 (아이폰)
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (e) {
                api.toast('마이크 권한이 필요해요');
                return;
            }
            const chunks = [];
            try {
                recorder = new MediaRecorder(stream);
            } catch (e) {
                endRecording();
                api.toast('녹음을 시작할 수 없어요');
                return;
            }
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size) chunks.push(e.data);
            };
            recorder.onstop = () => {
                const type = (recorder && recorder.mimeType) || 'audio/webm';
                recorder = null;
                endRecording();
                blob = chunks.length ? new Blob(chunks, { type }) : null;
                recordBtn.textContent = blob ? '🔄 다시 녹음' : '🎙️ 녹음 시작';
                recordBtn.classList.remove('on');
                timeEl.textContent = blob ? `${((Date.now() - startedAt) / 1000).toFixed(1)}초 녹음됨` : '';
                paintAdd();
                if (!blob) api.toast('녹음된 소리가 없어요. 다시 해 주세요');
            };
            recorder.start();
            startedAt = Date.now();
            blob = null;
            recordBtn.textContent = '⏹️ 녹음 끝';
            recordBtn.classList.add('on');
            paintAdd();
            tick = setInterval(() => {
                timeEl.textContent = `● ${((Date.now() - startedAt) / 1000).toFixed(1)}초 / ${MAX_SEC}초`;
            }, 100);
            autoStop = setTimeout(() => {
                if (recorder && recorder.state === 'recording') recorder.stop();
            }, MAX_SEC * 1000);
        }

        async function preview(reverse) {
            if (!blob) return;
            const ab = blob.arrayBuffer ? await blob.arrayBuffer() : await new Response(blob).arrayBuffer();
            if (!(await playArrayBuffer(ab, reverse))) api.toast('녹음을 재생할 수 없어요');
        }

        function addQuestion() {
            const answer = answerInput.value.trim();
            if (!answer) return api.toast('정답 낱말을 적어 주세요');
            if (!blob) return api.toast('먼저 목소리를 녹음해 주세요');
            const level = api.level();
            const reader = new FileReader();
            reader.onloadend = () => {
                const id = `q_${level}_${Date.now()}`;
                try {
                    localStorage.setItem('reverseAudio_' + id, reader.result);
                } catch (e) {
                    api.toast('저장 공간이 모자라요. 다른 녹음을 지우고 다시 해 주세요');
                    return;
                }
                try {
                    const items = readList(level);
                    items.push({ id, answer });
                    writeList(level, items);
                } catch (e) {
                    localStorage.removeItem('reverseAudio_' + id);
                    api.toast('저장 공간이 모자라요');
                    return;
                }
                blob = null;
                answerInput.value = '';
                timeEl.textContent = '';
                recordBtn.textContent = '🎙️ 녹음 시작';
                paintAdd();
                paintList();
                api.toast(`「${answer}」 문제를 추가했어요`);
            };
            reader.readAsDataURL(blob);
        }

        recordBtn.addEventListener('click', startRecording);
        previewBtn.addEventListener('click', () => preview(false));
        previewRevBtn.addEventListener('click', () => preview(true));
        addBtn.addEventListener('click', addQuestion);
        answerInput.addEventListener('input', paintAdd);
        answerInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') e.preventDefault(); // 엔터로 설정 저장이 눌리지 않게
        });
        const slider = document.getElementById('difficultySlider');
        if (slider) slider.addEventListener('input', paintAdd);

        form.append(
            h('h2', { class: 'form-section-title' }, ['🎙️ 녹음 문제 ', countEl]),
            h('div', { class: 'ra-box' }, [
                list,
                h('div', { class: 'ra-new' }, [
                    h('label', { for: 'raAnswer', text: '정답 낱말' }),
                    answerInput,
                    h('div', { class: 'ra-rec-row' }, [recordBtn, previewBtn, previewRevBtn, timeEl]),
                    addBtn,
                    levelEl,
                    h('small', {
                        class: 'ak-help',
                        text: `2~5글자 낱말이 가장 좋아요(아이가 글자 타일로 조립합니다). 최대 ${MAX_SEC}초. 녹음은 "저장하기"를 누르지 않아도 바로 저장되고, "초기화"를 눌러도 지워지지 않습니다.`,
                    }),
                ]),
            ])
        );
        paintList();
        paintAdd();
    }

    AdminKit.page({
        title: '리버스 오디오 설정',
        storageKey: KEY,
        recordId: 'game19',
        note: '거꾸로 재생되는 소리를 듣고 맞히는 세 스테이지 게임입니다. ① 거꾸로 동요 → ② 외계인 통신(아래에 녹음한 목소리. 녹음이 없으면 둘이서 녹음 대결 또는 빠른 동요) → ③ 속도 해독(다이얼로 원래 빠르기를 찾기). 키보드 없이 보기와 글자 타일로 답합니다.',
        presets: [
            { questions: 3, maxHints: 3, listens: 4, battery: 8, questionTime: 30 },
            { questions: 3, maxHints: 2, listens: 3, battery: 6, questionTime: 25 },
            { questions: 4, maxHints: 1, listens: 3, battery: 6, questionTime: 20 }
        ],
        fields: [
            { key: 'questions', label: '❓ 스테이지당 문제 수', min: 2, max: 5, step: 1, help: '세 스테이지 모두 이만큼씩 나옵니다' },
            { key: 'maxHints', label: '💡 힌트 수 (한 판)', min: 0, max: 5, step: 1, help: '앞으로 살짝(약 1초) 들려줍니다. 쓰면 별 3개는 받을 수 없어요' },
            { key: 'listens', label: '🎧 문제당 듣기 횟수', min: 1, max: 6, step: 1, help: '1·2스테이지에서 한 문제를 들을 수 있는 횟수(처음 한 번 포함). 재도전하면 1번씩 늘어납니다' },
            { key: 'battery', label: '🔋 해독 배터리 (칸)', min: 0, max: 20, step: 1, help: '3스테이지에서 다시 들을 때마다 1칸. 문제마다 처음 한 번은 공짜' },
            { key: 'questionTime', label: '⏱️ 문제당 시간 (초)', min: 10, max: 90, step: 1, help: '2스테이지는 1.2배, 3스테이지는 1.4배' }
        ],
        onRender(form, api) {
            // 새 설정을 한 번도 저장하지 않았다면 예전 값을 보여 준다
            applyLegacy(api);
            renderRecordings(form, api);
        },
        onReset: applyLegacy
    });
})();
