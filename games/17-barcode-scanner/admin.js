// 바코드 몬스터 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
(function () {
    'use strict';

    const KEY = 'barcodeScannerSettings';
    const h = AdminKit.h;
    const BM = window.BarcodeMonster; // game.js 가 내놓는 바코드 도구. 없어도 페이지는 열린다
    const PRESETS = [
        { timeLimit: 100, targetCount: 3, elemNeed: 2, bossPower: 165 },
        { timeLimit: 85, targetCount: 3, elemNeed: 2, bossPower: 185 },
        { timeLimit: 75, targetCount: 4, elemNeed: 3, bossPower: 210 }
    ];
    // game.js 와 같은 범위. 벗어난 옛 값(예: 시간 0 = 무제한)은 난이도 기본값으로 보여 준다
    const RANGE = { timeLimit: [40, 300], targetCount: [2, 6], elemNeed: [1, 4], bossPower: [80, 300] };

    const norm = (c) => (BM ? BM.normalize(c) : String(c).replace(/\s+/g, '').toUpperCase());
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function readStore() {
        try {
            const v = JSON.parse(localStorage.getItem(AdminKit.ns(KEY)));
            return v && typeof v === 'object' ? v : {};
        } catch (e) {
            return {};
        }
    }

    function storedCodes() {
        const list = readStore().targetBarcodes;
        return Array.isArray(list) ? list.map((c) => String(c)).filter((c) => c.trim()) : [];
    }

    let keep = storedCodes(); // 마지막으로 저장한 목록. "초기화"가 저장소를 지운 뒤 되살릴 때 쓴다

    /** 바코드 목록은 바꾸는 즉시 저장한다. 다른 설정값은 건드리지 않는다 */
    function writeCodes(list) {
        const s = readStore();
        s.targetBarcodes = list;
        s.lastUpdated = new Date().toISOString();
        try {
            localStorage.setItem(AdminKit.ns(KEY), JSON.stringify(s));
            keep = list.slice();
            return true;
        } catch (e) {
            return false;
        }
    }

    let ui = null; // onReset 에서 다시 그릴 때 쓴다

    function renderCodes(form, api) {
        // 옛 값이 범위를 벗어나면 게임과 똑같이 난이도 기본값으로 보여 준다
        const st = api.stored();
        Object.keys(RANGE).forEach((k) => {
            if (st[k] === undefined) return;
            const v = Number(st[k]);
            if (!(Number.isFinite(v) && v >= RANGE[k][0] && v <= RANGE[k][1])) api.set(k, PRESETS[api.level()][k]);
        });

        const input = h('input', { type: 'text', id: 'bmCodeInput', class: 'form-input', placeholder: '바코드 아래 숫자', inputmode: 'numeric', maxlength: 40 });
        const addBtn = h('button', { type: 'button', id: 'bmAdd', class: 'bm-btn', text: '추가' });
        const scanBtn = h('button', { type: 'button', id: 'bmScan', class: 'bm-btn sub', text: '📷 카메라 스캔' });
        const photoInput = h('input', { type: 'file', id: 'bmPhoto', accept: 'image/*', capture: 'environment', hidden: true });
        const photoBtn = h('button', { type: 'button', class: 'bm-btn sub', text: '🖼️ 사진에서' });
        const status = h('div', { class: 'bm-status' });
        const video = h('video', { autoplay: true, playsinline: true });
        video.muted = true;
        const stopBtn = h('button', { type: 'button', class: 'bm-stop', text: '정지' });
        const camBox = h('div', { class: 'bm-cambox' }, [video, h('div', { class: 'bm-guide' }), stopBtn]);
        const list = h('div', { class: 'bm-list', id: 'bmList' });
        const reader = BM ? BM.makeReader(sleep) : null;

        function paint(highlight) {
            const codes = storedCodes();
            list.innerHTML = '';
            if (!codes.length) {
                list.appendChild(h('div', { class: 'bm-empty', text: '등록한 바코드가 없어요. 없으면 기본 임무(보스전)로 진행합니다.' }));
                return;
            }
            codes.forEach((raw) => {
                const m = BM ? BM.monsterOf(raw, true) : null;
                const del = h('button', { type: 'button', class: 'bm-del', text: '삭제' });
                // 실수로 지우지 않게 두 번 눌러야 지워진다
                let armTimer = null;
                del.addEventListener('click', () => {
                    if (!del.classList.contains('armed')) {
                        del.classList.add('armed');
                        del.textContent = '한 번 더';
                        armTimer = setTimeout(() => {
                            del.classList.remove('armed');
                            del.textContent = '삭제';
                        }, 3000);
                        return;
                    }
                    clearTimeout(armTimer);
                    writeCodes(storedCodes().filter((c) => c !== raw));
                    paint();
                    api.toast('바코드를 지웠어요');
                });
                list.appendChild(
                    h('div', { class: 'bm-item' + (highlight && norm(raw) === highlight ? ' new' : '') }, [
                        h('div', { class: 'bm-item-text' }, [
                            h('div', { class: 'bm-item-code', text: raw }),
                            m ? h('div', { class: 'bm-item-mon', text: `${m.body}${m.deco} ${m.name} (힘 ${m.power})` }) : null,
                        ]),
                        del,
                    ])
                );
            });
        }

        function add(raw, typed) {
            const code = norm(raw);
            if (!code) return api.toast('바코드 번호를 넣어 주세요');
            if (typed) {
                if (code.length < 8) return api.toast('바코드 번호는 8자리 이상이에요');
                if (BM && /^\d+$/.test(code) && (code.length === 8 || code.length === 13) && !BM.checkDigitOk(code)) {
                    return api.toast('숫자가 하나 틀린 것 같아요. 끝자리까지 다시 확인해 주세요');
                }
            }
            const codes = storedCodes();
            if (codes.some((c) => norm(c) === code)) {
                paint(code);
                return api.toast('이미 등록된 바코드예요');
            }
            codes.push(code);
            if (!writeCodes(codes)) return api.toast('저장하지 못했어요');
            input.value = '';
            paint(code);
            api.toast('등록했어요');
        }

        addBtn.addEventListener('click', () => add(input.value, true));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                add(input.value, true);
            }
        });

        // ----- 카메라로 스캔 (BarcodeDetector 가 없으면 quagga2)
        let stream = null;
        let loop = null;
        let last = { code: '', at: 0 };
        const setStatus = (t) => (status.textContent = t);

        function stopScan() {
            clearInterval(loop);
            loop = null;
            if (stream) stream.getTracks().forEach((t) => t.stop());
            stream = null;
            video.srcObject = null;
            camBox.classList.remove('on');
            scanBtn.disabled = false;
            setStatus('');
        }

        async function startScan() {
            if (stream) return;
            if (!reader) return api.toast('바코드 도구를 불러오지 못했어요. 번호를 직접 넣어 주세요');
            if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                return api.toast('카메라는 https 주소에서만 열려요. 사진에서 읽기나 번호 입력을 써 주세요');
            }
            scanBtn.disabled = true;
            setStatus('카메라 켜는 중…');
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                });
            } catch (e) {
                stopScan();
                return api.toast('카메라를 열 수 없어요. 사진에서 읽기를 써 주세요');
            }
            video.srcObject = stream;
            video.play().catch(() => {});
            camBox.classList.add('on');
            setStatus('스캐너 준비 중…');
            const ok = await reader.ready();
            if (!stream) return;
            if (!ok) {
                stopScan();
                return api.toast('스캐너를 불러오지 못했어요(인터넷 확인). 번호를 직접 넣어 주세요');
            }
            setStatus('바코드를 초록 네모 안에 맞춰 주세요');
            loop = setInterval(async () => {
                const raw = await reader.readFrame(video, camBox);
                if (!raw || !stream) return;
                const code = norm(raw);
                const now = Date.now();
                // quagga 는 가끔 잘못 읽으므로 같은 번호가 2.5초 안에 두 번 나와야 믿는다
                if (reader.engine === 'quagga' && !(last.code === code && now - last.at < 2500)) {
                    last = { code, at: now };
                    return;
                }
                last = { code: '', at: 0 };
                stopScan();
                add(code, false);
            }, 330);
        }

        scanBtn.addEventListener('click', startScan);
        stopBtn.addEventListener('click', stopScan);
        window.addEventListener('pagehide', stopScan);

        photoBtn.addEventListener('click', () => photoInput.click());
        photoInput.addEventListener('change', async () => {
            const file = photoInput.files && photoInput.files[0];
            photoInput.value = '';
            if (!file) return;
            if (!reader) return api.toast('바코드 도구를 불러오지 못했어요');
            setStatus('사진에서 바코드를 찾는 중…');
            const raw = await reader.readFile(file);
            setStatus('');
            if (raw) add(raw, false);
            else api.toast(reader.status === 'fail' ? '스캐너를 불러오지 못했어요. 번호를 직접 넣어 주세요' : '바코드를 찾지 못했어요. 바코드만 크게 찍어 주세요');
        });

        const box = h('div', { class: 'bm-box' }, [
            h('small', { class: 'ak-help', text: '숨긴 물건의 바코드를 등록하면 그 바코드가 황금 몬스터가 되고, 마지막 임무가 "황금 몬스터를 찾아 보스 물리치기"로 바뀝니다. 등록·삭제는 바로 저장되고, "초기화"를 눌러도 지워지지 않습니다.' }),
            h('div', { class: 'bm-row', style: 'margin-top:10px' }, [input, addBtn]),
            h('div', { class: 'bm-row' }, [scanBtn, photoBtn]),
            photoInput,
            status,
            camBox,
            list,
        ]);
        // "황금 몬스터" 묶음 제목 바로 아래에 넣는다
        const title = Array.from(form.querySelectorAll('.form-section-title')).find((t) => t.textContent.indexOf('황금') >= 0);
        if (title) form.insertBefore(box, title.nextSibling);
        else form.appendChild(box);
        paint();
        ui = { paint };
    }

    AdminKit.page({
        title: '바코드 몬스터 설정',
        storageKey: KEY,
        recordId: 'game17',
        note: '바코드를 찍으면 번호마다 정해진 몬스터가 나옵니다. 임무 3개: <b>아무 몬스터</b> → <b>지정 속성 몬스터</b> → <b>보스전</b>. 카메라는 https 주소에서만 열리고, http 에서는 숫자 입력과 사진으로 진행합니다.',
        presets: PRESETS,
        fields: [
            { key: 'timeLimit', label: '⏱️ 스테이지 시간 (초)', min: 40, max: 300, step: 5, help: '1단계 시간. 2단계는 1.3배, 황금 사냥은 1.5배. 재도전마다 +15초' },
            { key: 'targetCount', label: '🎯 1단계 잡을 수', min: 2, max: 6, step: 1, help: '서로 다른 바코드 몇 개를 찍어야 하는지' },
            { key: 'elemNeed', label: '🔥 2단계 속성 몬스터 수', min: 1, max: 4, step: 1, help: '정해진 속성 2가지 중 아무거나. 다른 속성은 팀에만 들어갑니다' },
            { key: 'bossPower', label: '👹 보스 힘', min: 80, max: 300, step: 5, help: '팀 3마리 힘의 합이 이보다 커야 이깁니다. 팀이 약하면 자동으로 조금 낮아집니다' }
        ],
        extras: [
            { section: '👑 황금 몬스터 (숨긴 물건)' },
            { key: 'goldCount', label: '찾아야 할 황금 몬스터 수', type: 'select', options: [['1', '1마리'], ['2', '2마리'], ['3', '3마리']], default: '1', help: '등록한 바코드 수보다 많으면 등록한 수만큼' },
            { key: 'goldHint', label: '💡 보스전 힌트', type: 'text', default: '', wide: true, placeholder: '예: 부엌 어딘가에 숨어 있어', help: '황금 사냥 때 화면에 보여 줍니다. 비워 두면 기본 문구' }
        ],
        onRender: renderCodes,
        onReset() {
            // "초기화"는 난이도와 설정값만 되돌린다. 등록한 바코드는 다시 넣어 둔다
            if (keep.length) writeCodes(keep);
            if (ui) ui.paint();
        }
    });
})();
